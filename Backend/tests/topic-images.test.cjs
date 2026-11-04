const test = require('node:test');
const assert = require('node:assert/strict');
const { createTopicImageResolver, normalizeTopic, safeTrustedUrl, IMAGE_HOSTS } = require('../services/topicImageService');
const { imageHelpers } = require('../routers/rssRouter');

const wikiPage = (title = 'The Elder Scrolls V: Skyrim') => ({ ns: 0, title, pageimage: 'Skyrim_cover.png', thumbnail: { source: 'https://upload.wikimedia.org/wikipedia/en/1/15/Skyrim_cover.png?utm_source=example' }, fullurl: `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}` });
const response = (pages) => ({ data: { query: { pages } } });

test('topic artwork is cached and concurrent/case-variant searches share one trusted lookup', async () => {
  let calls = 0;
  let clock = 100;
  const resolver = createTopicImageResolver({ now: () => clock, ttlMs: 1000, httpGet: async (endpoint, config) => {
    calls += 1;
    assert.equal(endpoint, 'https://en.wikipedia.org/w/api.php');
    assert.equal(config.params.titles, 'The Elder Scrolls V: Skyrim');
    assert.equal(config.maxRedirects, 0); assert.ok(config.timeout <= 2800);
    return response([wikiPage()]);
  } });
  const results = await Promise.all([resolver.getTopicImage('Skyrim'), resolver.getTopicImage('skyrim'), resolver.getTopicImage('סקיירים')]);
  assert.equal(calls, 1); assert.ok(results.every((image) => image.isTopicImage && image.imageTopic.includes('Skyrim')));
  assert.equal(results[0].image.includes('utm_'), false);
  clock = 1200;
  await resolver.getTopicImage('Skyrim'); assert.equal(calls, 2);
});

test('Redis uses its actual Commons logo and exposes plain source credits', async () => {
  const resolver = createTopicImageResolver({ httpGet: async (endpoint, config) => {
    assert.equal(endpoint, 'https://commons.wikimedia.org/w/api.php');
    assert.equal(config.params.titles, 'File:Redis logo.svg');
    return response([{ ns: 6, title: 'File:Redis logo.svg', imageinfo: [{ thumburl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ee/Redis_logo.svg/960px-Redis_logo.svg.png', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Redis_logo.svg', extmetadata: { Artist: { value: '<a>Redis Ltd</a>' }, LicenseShortName: { value: 'Public domain' } } }] }]);
  } });
  const image = await resolver.getTopicImage('Redis database');
  assert.equal(image.imageTopic, 'Redis'); assert.match(image.imageCredit, /Redis Ltd/); assert.ok(!image.imageCredit.includes('<'));
  assert.equal(image.imageSource, 'wikimedia-commons-topic'); assert.match(image.imagePage, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:Redis_logo/);
});

test('untrusted image hosts, credentials, executable schemes, unrelated search hits, and disambiguation are rejected', async () => {
  for (const url of ['javascript:alert(1)', 'data:image/png;base64,AA', 'http://upload.wikimedia.org/image.png', 'https://upload.wikimedia.org.evil.test/image.png', 'https://user:pass@upload.wikimedia.org/image.png', 'https://upload.wikimedia.org:9443/image.png']) assert.equal(safeTrustedUrl(url, IMAGE_HOSTS), null);
  const unrelated = createTopicImageResolver({ httpGet: async (_endpoint, config) => response(config.params.generator ? [wikiPage('Unrelated galaxy')] : [{ ns: 0, missing: true, title: 'Unfindable subject' }]) });
  assert.equal(await unrelated.getTopicImage('Unfindable subject'), null);
  const unsafe = createTopicImageResolver({ httpGet: async () => response([{ ...wikiPage(), thumbnail: { source: 'https://evil.test/image.png' } }]) });
  assert.equal(await unsafe.getTopicImage('Skyrim'), null);
  const ambiguous = createTopicImageResolver({ httpGet: async () => response([{ ...wikiPage('Mercury'), pageprops: { disambiguation: '' } }]) });
  assert.equal(await ambiguous.getTopicImage('Mercury'), null);
});

test('API failures are negatively cached, cache size is bounded, and the total deadline is enforced', async () => {
  let failures = 0;
  const failed = createTopicImageResolver({ httpGet: async () => { failures += 1; throw new Error('API unavailable'); } });
  assert.equal(await failed.getTopicImage('Skyrim'), null); assert.equal(await failed.getTopicImage('Skyrim'), null); assert.equal(failures, 1);
  const bounded = createTopicImageResolver({ maxEntries: 2, httpGet: async (_endpoint, config) => response([wikiPage(config.params.titles)]) });
  for (const topic of ['Mountain biking', 'Quantum physics', 'Ocean science']) await bounded.getTopicImage(topic);
  assert.equal(bounded.cache.size, 2);
  let signal;
  const slow = createTopicImageResolver({ timeoutMs: 20, httpGet: (_endpoint, config) => { signal = config.signal; return new Promise(() => {}); } });
  const started = Date.now();
  assert.equal(await slow.getTopicImage('Skyrim'), null); assert.ok(Date.now() - started < 1000); assert.equal(signal.aborted, true);
});

test('Hebrew queries use Hebrew Wikipedia and invalid locale strings cannot choose an arbitrary host', async () => {
  const endpoints = [];
  const resolver = createTopicImageResolver({ httpGet: async (endpoint, config) => { endpoints.push(endpoint); return response([wikiPage(config.params.titles)]); } });
  const image = await resolver.getTopicImage('ירושלים', { language: 'he-IL' });
  assert.equal(endpoints[0], 'https://he.wikipedia.org/w/api.php'); assert.equal(image.imageLanguage, 'he'); assert.match(image.imagePage, /^https:\/\/he\.wikipedia\.org\//);
  await resolver.getTopicImage('Mountain biking', { language: 'en.evil.test/path' }); assert.equal(endpoints[1], 'https://en.wikipedia.org/w/api.php');
  assert.equal(normalizeTopic('https://evil.test/'), null); assert.equal(normalizeTopic('latest news'), null);
  const englishFallback = createTopicImageResolver({ httpGet: async (endpoint, config) => response(endpoint.startsWith('https://he.') ? [] : [wikiPage(config.params.titles)]) });
  assert.equal((await englishFallback.getTopicImage('Mountain biking', { language: 'he' })).imageLanguage, 'en');
});

test('RSS preserves publisher artwork, skips video enclosures, and returns a relevant topic image or false', async () => {
  const publisher = 'https://publisher.example/artwork.jpg';
  assert.equal(imageHelpers.extractImage({ 'media:content': [{ $: { url: 'https://cdn.example/clip.mp4', type: 'video/mp4' } }, { $: { url: publisher, type: 'image/jpeg' } }] }), publisher);
  assert.equal(imageHelpers.extractImage({ enclosure: { url: 'https://cdn.example/audio.mp3', type: 'audio/mpeg' } }), null);
  const topic = { image: 'https://upload.wikimedia.org/wikipedia/en/1/15/Skyrim_cover.png', imageSource: 'wikipedia-topic', imagePage: 'https://en.wikipedia.org/wiki/The_Elder_Scrolls_V:_Skyrim', imageCredit: 'Wikipedia', imageTopic: 'Skyrim', isTopicImage: true };
  const own = await imageHelpers.resolveItem({ title: 'Skyrim story', enclosure: { url: publisher, type: 'image/jpeg' } }, { topicImagePromise: Promise.resolve(topic) });
  assert.equal(own.image, publisher); assert.equal(own.imageSource, 'feed'); assert.equal(own.isTopicImage, false);
  const fallback = await imageHelpers.resolveItem({ title: 'Skyrim story' }, { topicImagePromise: Promise.resolve(topic) });
  assert.equal(fallback.image, topic.image); assert.equal(fallback.isTopicImage, true);
  const none = await imageHelpers.resolveItem({ title: 'No artwork' }, { topicImagePromise: Promise.resolve(null) });
  assert.equal(none.image, false); assert.equal(none.isTopicImage, false);
});

test('live Skyrim and Redis resolve actual topic images served successfully', { skip: process.env.RUN_LIVE_TOPIC_IMAGES !== '1' }, async () => {
  const axios = require('axios');
  const resolver = createTopicImageResolver({ timeoutMs: 4500 });
  for (const topic of ['Skyrim', 'Redis']) {
    const image = await resolver.getTopicImage(topic);
    assert.ok(image?.isTopicImage, `No relevant image available for ${topic}`);
    assert.match(image.imageTopic, topic === 'Skyrim' ? /Skyrim/i : /Redis/i);
    const result = await axios.head(image.image, { timeout: 5000, maxRedirects: 3, headers: { 'User-Agent': 'DailyCollabs/1.0 (+https://github.com/sagagaga4/DailyCollabs)' }, validateStatus: () => true });
    assert.equal(result.status, 200, `${topic} image returned HTTP ${result.status}`); assert.match(result.headers['content-type'], /^image\//);
  }
});
