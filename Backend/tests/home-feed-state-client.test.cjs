const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const frontendRoot = path.resolve(__dirname, '../../Frontend/client');
const frontendRequire = createRequire(path.join(frontendRoot, 'package.json'));
const output = frontendRequire('esbuild').buildSync({ entryPoints: [path.join(frontendRoot, 'src/components/Home/homeFeedState.js')], bundle: true, write: false, platform: 'node', format: 'cjs' });
const moduleScope = { exports: {} };
vm.runInNewContext(output.outputFiles[0].text, { module: moduleScope, exports: moduleScope.exports, URL, URLSearchParams });
const { createHomeFeedState, homeFeedReducer: reduce, homeFeedRequest, homeItemUrl } = moduleScope.exports;
const article = (title, link = `https://example.com/${title}`) => ({ title, link, kind: 'article' });
const video = title => ({ title, videoUrl: `https://www.youtube.com/watch?v=${title}`, kind: 'video' });

test('topic submission immediately opens Latest news; late completion caches Videos without changing a chosen tab', () => {
  let state = createHomeFeedState();
  state = reduce(state, { type: 'search-start', id: 1, query: 'חלל', locale: { language: 'he', region: 'IL' } });
  assert.equal(state.mode, 'news'); assert.equal(state.news.loading, true);
  const request = homeFeedRequest('news', { topic: state.topic, locale: state.locale });
  assert.equal(request.path, '/rss'); assert.equal(request.body.modeOverride, 'fresh'); assert.equal(request.body.query, 'חלל');
  state = reduce(state, { type: 'mode', mode: 'videos' });
  state = reduce(state, { type: 'search-success', id: 1, data: { articles: [article('space')], videos: [video('space_video')], rankingSession: 'topic-cursor', hasMore: true } });
  assert.equal(state.mode, 'videos'); assert.equal(state.topic, 'חלל');
  assert.equal(state.videos.items[0].title, 'space_video'); assert.equal(state.news.items[0].title, 'space');
  state = reduce(state, { type: 'mode', mode: 'all' });
  const discovery = homeFeedRequest('forYou', { topic: state.topic, locale: state.locale, page: 1, rankingSession: state.news.rankingSession });
  assert.equal(discovery.path, '/feed/discover'); assert.equal(discovery.body.query, undefined); assert.equal(discovery.body.rankingSession, undefined);
  state = reduce(state, { type: 'fetch-start', bucket: 'forYou', id: 'fresh-mix' });
  assert.equal(state.forYou.rankingSession, null); assert.equal(state.news.rankingSession, 'topic-cursor');
});

test('rapid searches and background results cannot replace the newer topic or force For you away', () => {
  let state = createHomeFeedState();
  state = reduce(state, { type: 'search-start', id: 1, query: 'old topic', locale: { language: 'en' } });
  state = reduce(state, { type: 'search-start', id: 2, query: 'new topic', locale: { language: 'fr' } });
  const newest = state;
  state = reduce(state, { type: 'search-videos', id: 1, data: { videos: [video('old')] } });
  state = reduce(state, { type: 'search-success', id: 1, data: { articles: [article('old')], videos: [] } });
  state = reduce(state, { type: 'search-end', id: 1, cancelled: true });
  assert.equal(state, newest);
  state = reduce(state, { type: 'mode', mode: 'all' });
  state = reduce(state, { type: 'fetch-start', bucket: 'forYou', id: 'mix' });
  state = reduce(state, { type: 'search-success', id: 2, data: { articles: [article('new')], videos: [video('new')] } });
  assert.equal(state.mode, 'all'); assert.equal(state.topic, 'new topic'); assert.equal(state.locale.language, 'fr');
  assert.equal(state.forYou.requestId, 'mix'); assert.equal(state.forYou.items.length, 0);
  state = reduce(state, { type: 'fetch-success', bucket: 'forYou', id: 'mix', items: [article('different'), video('discovery')], data: { rankingSession: 'mix-cursor', hasMore: true } });
  assert.equal(state.forYou.items[0].title, 'different'); assert.equal(state.videos.items[0].title, 'new');
});

test('independent discovery snapshots retain server order and ignore stale requests when paging or returning fresh', () => {
  let state = createHomeFeedState();
  state = reduce(state, { type: 'fetch-start', bucket: 'forYou', id: 'first' });
  state = reduce(state, { type: 'fetch-success', bucket: 'forYou', id: 'first', items: [article('one'), video('two'), article('three')], data: { page: 1, rankingSession: 'cursor', hasMore: true } });
  const next = homeFeedRequest('forYou', { page: 2, rankingSession: state.forYou.rankingSession });
  assert.equal(next.body.rankingSession, 'cursor'); assert.equal(next.body.query, undefined);
  state = reduce(state, { type: 'fetch-start', bucket: 'forYou', id: 'page-two', append: true });
  state = reduce(state, { type: 'fetch-success', bucket: 'forYou', id: 'page-two', append: true, items: [article('three'), video('four')], data: { page: 2, rankingSession: 'cursor', hasMore: false } });
  assert.deepEqual(Array.from(state.forYou.items, item => item.title), ['one', 'two', 'three', 'four']);
  state = reduce(state, { type: 'fetch-start', bucket: 'forYou', id: 'return-fresh' });
  assert.equal(state.forYou.items.length, 0); assert.equal(state.forYou.rankingSession, null);
  const fresh = state;
  state = reduce(state, { type: 'fetch-success', bucket: 'forYou', id: 'page-two', items: [article('stale')], data: {} });
  assert.equal(state, fresh);
});

test('video retry stays on its topic and a newer retry is not replaced by an earlier news response', () => {
  let state = reduce(createHomeFeedState(), { type: 'search-start', id: 1, query: 'חדשות מדע', locale: { language: 'he', region: 'IL' } });
  const request = homeFeedRequest('videos', { topic: state.topic, locale: state.locale });
  const url = new URL(`https://example.com${request.path}`);
  assert.equal(request.method, 'GET'); assert.equal(url.searchParams.get('q'), 'חדשות מדע'); assert.equal(url.searchParams.get('language'), 'he');
  state = reduce(state, { type: 'fetch-start', bucket: 'videos', id: 'retry' });
  state = reduce(state, { type: 'search-success', id: 1, data: { articles: [article('science')], videos: [video('old-result')] } });
  assert.equal(state.videos.requestId, 'retry'); assert.equal(state.videos.loading, true);
  state = reduce(state, { type: 'search-end', id: 1 });
  assert.equal(state.videos.loading, true);
  state = reduce(state, { type: 'fetch-success', bucket: 'videos', id: 'retry', items: [video('new-result')], data: {} });
  assert.equal(state.videos.items[0].title, 'new-result');
});

test('Undo hide canonicalizes tracked sources and restores only the original request, keeping old stories out of a newer topic', () => {
  let state = reduce(createHomeFeedState(), { type: 'fetch-start', bucket: 'news', id: 'old-topic' });
  state = reduce(state, { type: 'fetch-success', bucket: 'news', id: 'old-topic', data: {}, items: [article('hidden')] });
  const location = { bucket: 'news', index: 0, item: state.news.items[0], requestId: 'old-topic' };
  state = reduce(state, { type: 'hide', url: `${location.item.link}?utm_source=ignored` }); assert.equal(state.news.items.length, 0);
  const restored = reduce(state, { type: 'restore', locations: [location] }); assert.equal(restored.news.items.length, 1);
  state = reduce(state, { type: 'search-start', id: 2, query: 'another topic', locale: { language: 'auto' } });
  state = reduce(state, { type: 'restore', locations: [location] }); assert.equal(state.news.items.length, 0);
});

test('an article containing a video keeps its article identity for feedback and Undo', () => {
  const item = { kind: 'article', link: 'https://example.com/news?utm_source=rss', videoUrl: 'https://youtu.be/aqz-KE-bpKQ' };
  assert.equal(homeItemUrl(item), 'https://example.com/news');
  assert.equal(homeItemUrl({ ...item, kind: 'video' }), 'https://www.youtube.com/watch?v=aqz-KE-bpKQ');
});
