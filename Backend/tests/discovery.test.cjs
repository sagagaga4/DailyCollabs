const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_PREFERENCES, canonicalUrl } = require('../utils/feedRanking');
const { discoveryPlan, mixDiscoveryRecords, isRecentTopic } = require('../utils/discoveryRanking');
const { createDiscoveryService, validateRequest } = require('../services/discoveryService');

const NOW = Date.parse('2026-11-05T12:00:00Z');
const preferences = patch => ({ ...DEFAULT_PREFERENCES, followedTopics: [], mutedTopics: [], ...patch });
const context = patch => ({ preferences: preferences(), interests: [], recentSearches: [], hiddenUrls: [], hiddenTitles: [], openedUrls: [], moreUrls: [], lessUrls: [], signalsCount: 0, ...patch });
const interest = (topic, source = 'followed', weight = 10) => ({ topic, source, weight, reason: source === 'search' ? 'Related to your recent searches' : 'From a topic you follow' });
const record = (kind, index, topic = '') => ({ item: { kind, title: `${topic || 'World economy'} ${index}`, link: `https://publisher.example/${kind}/${topic || 'world'}/${index}`, discoveryTopic: topic }, key: `${kind}/${topic}/${index}`, reasons: [] });
function fixtures() {
  const calls = { news: [], video: [] };
  const contexts = new Map([['a', context({ interests: [interest('Redis'), interest('Animation')], recentSearches: [{ query: 'Redis' }] })], ['b', context()]]);
  const service = createDiscoveryService({
    now: () => NOW,
    getContext: async owner => contexts.get(owner),
    getMediaPosts: async () => [],
    getRawItems: async (topic, locale) => {
      calls.news.push({ topic, locale });
      return Array.from({ length: 36 }, (_, index) => ({ title: `${topic || 'World economy'} ${index}`, link: `https://publisher.example/${topic || 'world'}/${index}`, sourceLanguage: locale.tag, sourceUrl: `https://source${index % 8}.example`, pubDate: new Date(NOW - index * 3600000).toISOString(), retrievalQuery: topic }));
    },
    searchVideos: async topic => {
      calls.video.push(topic);
      return { query: topic, status: 'ok', videos: Array.from({ length: 8 }, (_, index) => ({ id: `${topic[0]}${String(index).padStart(10, '0')}`, title: `${topic} tutorial ${index}`, channel: `${topic} creator`, videoUrl: `https://www.youtube.com/watch?v=${topic[0]}${String(index).padStart(10, '0')}`, thumbnailUrl: 'https://images.example/video.jpg', provider: 'youtube', published: '2 days ago' })) };
    },
    enrichRecords: async records => records.map(({ item, reasons }) => ({ title: item.title, link: item.link, image: false, pubDate: item.pubDate, reasons })),
  });
  return { service, contexts, calls };
}

test('discovery uses real provenance, limits two query providers, and respects muted/following/off preferences', () => {
  const base = context({ interests: [interest('Redis cache'), interest('Animation'), interest('Music')], recentSearches: [{ query: 'Redis' }, { query: 'Older search' }] });
  assert.deepEqual(discoveryPlan(base), { topics: ['Redis', 'Animation'], recentTopic: 'Redis' });
  assert.deepEqual(discoveryPlan({ ...base, preferences: preferences({ personalized: false }) }), { topics: [], recentTopic: '' });
  assert.deepEqual(discoveryPlan({ ...base, preferences: preferences({ mode: 'fresh' }) }), { topics: [], recentTopic: '' });
  assert.deepEqual(discoveryPlan({ ...base, preferences: preferences({ mutedTopics: ['Redis'] }) }), { topics: ['Older search', 'Animation'], recentTopic: 'Older search' });
  assert.equal(discoveryPlan({ ...base, preferences: preferences({ mode: 'following' }) }).recentTopic, '');
});

test('mixed pages cap combined recent-topic articles and videos, preserve identity, and end truthfully without filler', () => {
  const recent = [...Array.from({ length: 40 }, (_, i) => record('article', i, 'Redis')), ...Array.from({ length: 8 }, (_, i) => record('video', i, 'Redis'))];
  const other = [...Array.from({ length: 40 }, (_, i) => record('article', i)), ...Array.from({ length: 8 }, (_, i) => record('video', i, 'Animation'))];
  const pages = mixDiscoveryRecords([...recent, ...other], { recentTopic: 'Redis', pageSize: 12 });
  const all = pages.flat();
  assert.equal(new Set(all.map(item => canonicalUrl(item.item.link))).size, all.length);
  assert.equal(pages[0].length, 12);
  assert.ok(pages[0].some(item => item.item.kind === 'article' && item.recentTopic));
  assert.ok(pages[0].some(item => item.item.kind === 'video' && item.recentTopic));
  for (const page of pages) { assert.ok(page.filter(item => item.recentTopic).length <= 3); assert.ok(page.some(item => !item.recentTopic)); }
  assert.ok(all.filter(item => item.recentTopic).length <= other.length / 3);
  const partial = mixDiscoveryRecords(recent, { recentTopic: 'Redis', pageSize: 12 });
  assert.equal(partial.length, 1); assert.equal(partial[0].length, 3);
  assert.equal(mixDiscoveryRecords([], { pageSize: 12 }).length, 0);
  const dominant = mixDiscoveryRecords([...other, ...recent], { recentTopic: 'Redis', pageSize: 12 });
  assert.ok(dominant[0].some(item => item.recentTopic && item.item.kind === 'article'), 'A stronger older interest must not erase recent news.');
  assert.ok(dominant[0].some(item => item.recentTopic && item.item.kind === 'video'), 'A stronger older interest must not erase recent videos.');
  other.find(item => item.item.kind === 'video').item.priorityVideo = true;
  const ownFirst = mixDiscoveryRecords([...other, ...recent], { recentTopic: 'Redis', pageSize: 12 })[0];
  assert.ok(ownFirst.some(item => item.item.priorityVideo));
  assert.ok(ownFirst.some(item => item.recentTopic && item.item.kind === 'video'), 'A new own share still leaves room for a recent-topic video.');
});

test('discovery snapshots are account, locale, preference and page-size scoped, with frozen order and live hard hides', async () => {
  const { service, contexts, calls } = fixtures();
  const first = await service.discover('a', { language: 'en', pageSize: 12 });
  assert.equal(first.items.length, 12); assert.ok(first.items.some(item => item.kind === 'video'));
  assert.deepEqual(calls.video, ['Redis', 'Animation']);
  assert.deepEqual(calls.news.map(call => call.topic), ['', 'Redis', 'Animation']);
  assert.ok(first.items.filter(item => isRecentTopic({ item: { ...item, discoveryTopic: item.topic } }, 'Redis')).length <= 3);
  const request = { language: 'en', page: 2, pageSize: 12, rankingSession: first.rankingSession };
  const second = await service.discover('a', request);
  assert.ok(second.items.every(item => !first.items.some(before => before.link === item.link)));
  await assert.rejects(service.discover('b', request), error => error.status === 409);
  await assert.rejects(service.discover('a', { ...request, language: 'he' }), error => error.status === 409);
  await assert.rejects(service.discover('a', { ...request, pageSize: 6 }), error => error.status === 409);
  contexts.get('a').hiddenUrls = [canonicalUrl(second.items[0].link)];
  const hidden = await service.discover('a', request); assert.ok(hidden.items.every(item => item.link !== second.items[0].link));
  assert.deepEqual(hidden.items.map(item => item.link), second.items.slice(1).map(item => item.link));
  contexts.get('a').preferences = preferences({ diversity: 0.8 });
  await assert.rejects(service.discover('a', request), error => error.status === 409);
  const refresh = await service.discover('a', { language: 'en' }); assert.notEqual(refresh.rankingSession, first.rankingSession);
});

test('Auto follows Hebrew recent search or explicit interests while explicit English always wins', async () => {
  const { service, contexts, calls } = fixtures();
  contexts.set('a', context({ interests: [interest('טכנולוגיה')], recentSearches: [{ query: 'טכנולוגיה' }] }));
  const hebrew = await service.discover('a', { language: 'auto' });
  assert.equal(hebrew.locale.language, 'he'); assert.ok(calls.news.every(call => call.locale.language === 'he'));
  assert.ok(hebrew.items.every(item => /[\u0590-\u05ff]/u.test(item.title)));
  const english = await service.discover('a', { language: 'en' });
  assert.equal(english.locale.language, 'en'); assert.ok(english.items.every(item => !/[\u0590-\u05ff]/u.test(item.title)));
  contexts.get('a').recentSearches = [];
  assert.equal((await service.discover('a', { language: 'auto' })).locale.language, 'he');
});

test('provider failures stay independent and cold start/off never invent unrelated videos', async () => {
  const { service, contexts, calls } = fixtures();
  const cold = await service.discover('b', {});
  assert.equal(cold.videoStatus, 'empty'); assert.ok(cold.items.every(item => item.kind === 'article')); assert.equal(calls.video.length, 0);
  contexts.get('a').preferences = preferences({ personalized: false });
  const off = await service.discover('a', {}); assert.deepEqual(off.ranking.topics, []); assert.equal(calls.video.length, 0);
  const onlyVideo = createDiscoveryService({ now: () => NOW, getContext: async () => contexts.get('a'), getMediaPosts: async () => [], getRawItems: async () => { throw new Error('RSS unavailable'); }, enrichRecords: async () => [], searchVideos: async query => ({ query, status: 'ok', videos: [{ title: `${query} guide`, videoUrl: 'https://www.youtube.com/watch?v=r0000000000' }] }) });
  contexts.get('a').preferences = preferences();
  const independent = await onlyVideo.discover('a', {}); assert.ok(independent.items.some(item => item.kind === 'video')); assert.equal(independent.ranking.newsStatus, 'unavailable');
  const onlyNews = createDiscoveryService({ getContext: async () => contexts.get('a'), getMediaPosts: async () => [], getRawItems: async () => [{ title: 'World economy', link: 'https://world.example/1' }], enrichRecords: async records => records.map(record => ({ ...record.item, reasons: record.reasons })), searchVideos: async () => { throw new Error('Video provider unavailable'); } });
  const degraded = await onlyNews.discover('a', {}); assert.equal(degraded.videoStatus, 'unavailable'); assert.equal(degraded.items[0].kind, 'article');
  const enrichmentFailure = createDiscoveryService({ getContext: async () => contexts.get('a'), getMediaPosts: async () => [], getRawItems: async () => [{ title: 'World economy', link: 'https://world.example/1' }], enrichRecords: async () => { throw new Error('Publisher resolution unavailable'); }, searchVideos: async query => ({ query, status: 'ok', videos: [{ title: `${query} guide`, videoUrl: 'https://www.youtube.com/watch?v=r0000000000' }] }) });
  const resolvedFailure = await enrichmentFailure.discover('a', {}); assert.ok(resolvedFailure.items.some(item => item.kind === 'video')); assert.equal(resolvedFailure.ranking.newsStatus, 'unavailable');
  contexts.get('a').preferences = preferences({ mutedTopics: ['Redis'] });
  const muted = await service.discover('a', {}); assert.ok(!muted.ranking.topics.includes('Redis')); assert.ok(muted.items.every(item => !/redis/i.test(item.title)));
});

test('discovery request validation rejects account injection, unsafe locale, and unfrozen pagination', () => {
  for (const value of [{ query: 'Redis' }, { userId: 'someone' }, { page: 0 }, { pageSize: 31 }, { language: '<script>' }, { region: [] }, { rankingSession: 'bad' }, { page: 2 }]) assert.throws(() => validateRequest(value));
  assert.equal(validateRequest({ language: 'fr-CA', region: 'CA', page: '1', pageSize: '12' }).language, 'fr-CA');
});
