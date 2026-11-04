const test = require('node:test');
const assert = require('node:assert/strict');
const { createVideoSearch, normalizeQuery, extractInitialData, parsePublicResults, parseOfficialResults, limitedBody } = require('../services/videoSearchService');
const ids = ['G1rOthIU-uo', '6ecTO22ulRM'];
function renderer(id, title, extra = {}) { return { videoRenderer: { videoId: id, title: { runs: [{ text: title }] }, ownerText: { runs: [{ text: 'Creator' }] }, lengthText: { simpleText: '2:26' }, ...extra } }; }
function page(items) { return `<html><script>var ytInitialData = ${JSON.stringify({ contents: items })};</script></html>`; }
function response(html) { return new Response(html, { headers: { 'Content-Type': 'text/html' } }); }

test('query validation rejects structured, empty, excessive, and control inputs', () => {
  assert.equal(normalizeQuery({ q: 'Redis' }), null); assert.equal(normalizeQuery('a'), null); assert.equal(normalizeQuery('x'.repeat(121)), null);
  assert.equal(normalizeQuery('Re\u0000dis'), null); assert.equal(normalizeQuery('  Redis   streams  '), 'Redis streams');
});
test('public response parses balanced JSON without evaluating scripts, deduplicates and rejects invalid/unplayable/ad records', () => {
  const input = page([renderer(ids[0], 'Redis {in} "quotes"'), renderer(ids[0], 'Duplicate'), renderer('bad<script>', 'Unsafe'), renderer(ids[1], 'Coming soon', { upcomingEventData: {} }), { adSlotRenderer: renderer(ids[1], 'Ad') }]);
  const result = parsePublicResults(input);
  assert.equal(result.length, 1); assert.equal(result[0].id, ids[0]); assert.equal(result[0].title, 'Redis {in} "quotes"');
  assert.equal(result[0].videoUrl, `https://www.youtube.com/watch?v=${ids[0]}`);
  assert.throws(() => extractInitialData('<script>alert(1)</script>'));
  assert.throws(() => extractInitialData('var ytInitialData = {"incomplete":'));
  assert.throws(() => extractInitialData('x'.repeat(4 * 1024 * 1024 + 1)));
});
test('official API results retain only real-shaped video ids and decode plain title entities', () => {
  const results = parseOfficialResults({ items: [{ id: { videoId: ids[0] }, snippet: { title: 'Redis &amp; streams', channelTitle: 'One &amp; Two' } }, { id: { channelId: 'not-a-video' }, snippet: { title: 'Channel' } }] });
  assert.equal(results.length, 1); assert.equal(results[0].title, 'Redis & streams'); assert.equal(results[0].channel, 'One & Two');
});
test('queries are forwarded independently and a cache hit never returns another topic', async () => {
  const called = [];
  const search = createVideoSearch({ apiKey: '', fetchImpl: async url => {
    const query = new URL(url).searchParams.get('search_query'); called.push(query);
    return response(page([renderer(query === 'Redis' ? ids[0] : ids[1], `${query} guide`)]));
  } });
  const redis = await search('Redis'); const animation = await search('animation'); const cached = await search(' redis ');
  assert.deepEqual(called, ['Redis', 'animation']); assert.notEqual(redis.videos[0].id, animation.videos[0].id);
  assert.equal(redis.videos[0].title, 'Redis guide'); assert.equal(animation.videos[0].title, 'animation guide'); assert.equal(cached.cached, true);
});
test('simultaneous identical searches deduplicate network work and official API requests restrict to embeddable video results', async () => {
  let calls = 0;
  const search = createVideoSearch({ apiKey: 'test-key', fetchImpl: async url => {
    calls += 1; const request = new URL(url);
    assert.equal(request.hostname, 'www.googleapis.com'); assert.equal(request.searchParams.get('q'), 'Redis');
    assert.equal(request.searchParams.get('videoEmbeddable'), 'true'); assert.equal(request.searchParams.get('type'), 'video');
    return response(JSON.stringify({ items: [{ id: { videoId: ids[0] }, snippet: { title: 'Redis', channelTitle: 'Creator' } }] }));
  } });
  const result = await Promise.all([search('Redis'), search('Redis')]); assert.equal(calls, 1); assert.equal(result[0].provider, 'YouTube Data API');
});
test('provider failure and consent/bot pages return truthful unavailable without inventing videos or exposing credentials', async () => {
  const search = createVideoSearch({ apiKey: 'secret-key-never-leak', fetchImpl: async () => { throw new Error('secret-key-never-leak'); } });
  const result = await search('Redis'); assert.equal(result.status, 'unavailable'); assert.deepEqual(result.videos, []);
  assert.ok(result.searchUrl.endsWith('Redis')); assert.ok(!JSON.stringify(result).includes('secret-key'));
  const blocked = createVideoSearch({ apiKey: '', fetchImpl: async () => response('<html>Please consent or sign in</html>') });
  assert.equal((await blocked('animation')).status, 'unavailable');
});
test('oversized provider responses are rejected and cache expiry permits recovery', async () => {
  await assert.rejects(() => limitedBody(new Response('x'.repeat(4 * 1024 * 1024 + 1))));
  let clock = 0; let calls = 0;
  const search = createVideoSearch({ apiKey: '', now: () => clock, fetchImpl: async () => { calls += 1; return response(page([renderer(ids[0], 'Redis')])); } });
  await search('Redis'); clock = 100; await search('Redis'); assert.equal(calls, 1); clock = 901000; await search('Redis'); assert.equal(calls, 2);
});
test('live Redis and animation queries return distinct provider videos about the requested topics', { skip: process.env.LIVE_VIDEO_SEARCH !== '1', timeout: 45000 }, async () => {
  const search = createVideoSearch({ apiKey: '' });
  const redis = await search('Redis'); const animation = await search('animation');
  assert.equal(redis.status, 'ok'); assert.equal(animation.status, 'ok'); assert.ok(redis.videos.length > 0); assert.ok(animation.videos.length > 0);
  assert.ok(redis.videos.some(item => /redis/i.test(item.title))); assert.ok(animation.videos.some(item => /animat/i.test(item.title)));
  assert.notDeepEqual(redis.videos.map(item => item.id), animation.videos.map(item => item.id));
  console.log(JSON.stringify({ redis: redis.videos.map(({ id, title }) => ({ id, title })), animation: animation.videos.map(({ id, title }) => ({ id, title })) }));
});
