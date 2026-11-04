const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { parseVideoUrl, extractFeedVideo, validateMediaInput } = require('../utils/media');

const ID = 'aqz-KE-bpKQ';
// Use actual 11-character IDs, including case, dash, and underscore variations.
const VIDEO = 'aqz-KE-bpKQ';
const good = [
  ['https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=12', 'youtube'],
  ['https://youtu.be/aqz-KE-bpKQ?si=share', 'youtube'],
  ['https://youtube.com/shorts/aqz-KE-bpKQ', 'youtube'],
  ['https://m.youtube.com/live/aqz-KE-bpKQ', 'youtube'],
  ['https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ', 'youtube'],
  ['https://vimeo.com/76979871', 'vimeo'],
  ['https://player.vimeo.com/video/76979871', 'vimeo'],
  ['https://cdn.example.com/film.MP4?signature=abc', 'file'],
  ['https://cdn.example.com/film.webm', 'file'],
];
const bad = [
  'javascript:alert(1)', 'data:text/html,<iframe>', '<iframe src="https://www.youtube.com/embed/aqz-KE-bpKQ"></iframe>',
  'http://youtube.com/watch?v=aqz-KE-bpKQ', 'https://youtube.com.evil.example/watch?v=aqz-KE-bpKQ',
  'https://youtu.be.evil.example/aqz-KE-bpKQ', 'https://evil.example/embed/aqz-KE-bpKQ',
  'https://youtube.com/watch?v=short', 'https://youtube.com/watch?v=aqz-KE-bpKQ%22onload',
  'https://user:pass@youtube.com/watch?v=aqz-KE-bpKQ', 'https://youtube.com:9443/watch?v=aqz-KE-bpKQ',
  'https://youtube.com/playlist?list=PL123', 'https://localhost/private.mp4', 'https://127.0.0.1/clip.webm',
  'file:///etc/passwd', null, {}, 'x'.repeat(2049),
];

test('recognizes supported video URLs and removes YouTube tracking parameters', () => {
  for (const [url, provider] of good) assert.equal(parseVideoUrl(url)?.provider, provider, url);
  const youtube = parseVideoUrl(good[0][0]);
  assert.equal(youtube.id, VIDEO);
  assert.equal(youtube.url, `https://www.youtube.com/watch?v=${VIDEO}`);
  assert.equal(youtube.embedUrl, `https://www.youtube-nocookie.com/embed/${VIDEO}?rel=0&playsinline=1&cc_load_policy=1`);
  assert.ok(!youtube.embedUrl.includes('autoplay'));
});

test('rejects executable content, spoofed hosts, credentials, unsupported protocols, and invalid IDs', () => {
  for (const url of bad) assert.equal(parseVideoUrl(url), null, String(url));
});

test('frontend and backend agree on the same supported and rejected URL cases', async () => {
  const { parseVideoUrl: frontend } = await import(pathToFileURL(path.resolve(__dirname, '../../Frontend/client/src/lib/media.js')).href);
  for (const [url] of good) assert.deepEqual(frontend(url), parseVideoUrl(url), url);
  for (const url of bad) assert.equal(frontend(url), null, String(url));
});

test('extracts RSS media while avoiding image enclosures and unsupported links', () => {
  assert.equal(extractFeedVideo({ enclosure: { url: 'https://cdn.example.com/file.mp4' } }).provider, 'file');
  assert.equal(extractFeedVideo({ 'media:content': [{ $: { url: 'https://cdn.example.com/img.jpg' } }, { $: { url: good[0][0] } }] }).provider, 'youtube');
  assert.equal(extractFeedVideo({ mediaGroup: { 'media:content': { $: { url: good[1][0] } } } }).id, ID);
  assert.equal(extractFeedVideo({ link: 'https://news.example.com/story', enclosure: { url: 'https://news.example.com/photo.jpg' } }), null);
});

test('validates title and caption bounds and whitelists persisted values', () => {
  const valid = validateMediaInput({ title: '  A good film  ', caption: '  See this  ', videoUrl: good[0][0], author: 'attacker', provider: 'evil', isAdmin: true });
  assert.deepEqual(valid.value, { title: 'A good film', caption: 'See this', transcript: '', videoUrl: `https://www.youtube.com/watch?v=${VIDEO}`, provider: 'youtube' });
  assert.ok(validateMediaInput({ title: 'ab', videoUrl: good[0][0] }).error);
  assert.ok(validateMediaInput({ title: 'x'.repeat(141), videoUrl: good[0][0] }).error);
  assert.ok(validateMediaInput({ title: 'Film', caption: 'x'.repeat(501), videoUrl: good[0][0] }).error);
  assert.ok(validateMediaInput({ title: 'Film', videoUrl: 'javascript:alert(1)' }).error);
  assert.ok(validateMediaInput({ title: 'Film', transcript: 'x'.repeat(8001), videoUrl: good[0][0] }).error);
  assert.equal(validateMediaInput({ title: 'Film', transcript: '  Spoken words.\nA scene description.  ', videoUrl: good[0][0] }).value.transcript, 'Spoken words.\nA scene description.');
});

test('media routes require authentication and scope saved and removed videos to the signed-in user', async (t) => {
  const router = require('../routers/mediaRouter');
  const MediaPost = require('../model/MediaPost');
  const User = require('../model/User');
  const previous = { exists: User.exists, create: MediaPost.create, remove: MediaPost.findOneAndDelete };
  t.after(() => { User.exists = previous.exists; MediaPost.create = previous.create; MediaPost.findOneAndDelete = previous.remove; });
  const route = (method, routePath) => router.stack.find((layer) => layer.route?.path === routePath && layer.route.methods[method]).route.stack;
  const response = () => ({ code: 200, body: null, status(value) { this.code = value; return this; }, json(value) { this.body = value; return this; } });
  const create = route('post', '/');
  const unauthenticated = response();
  create[0].handle({ headers: {} }, unauthenticated, () => assert.fail('Anonymous user must not continue.'));
  assert.equal(unauthenticated.code, 401);

  let saved;
  User.exists = async (filter) => { assert.deepEqual(filter, { _id: '507f1f77bcf86cd799439011' }); return true; };
  MediaPost.create = async (value) => { saved = value; return { ...value, populate: async (field, projection) => { assert.equal(field, 'author'); assert.equal(projection, 'username fullname avatar'); } }; };
  const posted = response();
  await create.at(-1).handle({ user: { id: '507f1f77bcf86cd799439011' }, body: { title: 'A fine video', videoUrl: good[0][0], author: 'attacker', password: 'secret' } }, posted);
  assert.equal(posted.code, 201);
  assert.equal(saved.author, '507f1f77bcf86cd799439011');
  assert.equal(saved.password, undefined);
  assert.equal(saved.videoUrl, `https://www.youtube.com/watch?v=${VIDEO}`);

  const invalid = response();
  await create.at(-1).handle({ user: { id: '507f1f77bcf86cd799439011' }, body: { title: 'Film', videoUrl: 'javascript:alert(1)' } }, invalid);
  assert.equal(invalid.code, 400);

  let deleteFilter;
  MediaPost.findOneAndDelete = async (filter) => { deleteFilter = filter; return null; };
  const removed = response();
  await route('delete', '/:id').at(-1).handle({ params: { id: '507f191e810c19729de860ea' }, user: { id: '507f1f77bcf86cd799439011' } }, removed);
  assert.equal(removed.code, 404);
  assert.deepEqual(deleteFilter, { _id: '507f191e810c19729de860ea', author: '507f1f77bcf86cd799439011' });

  const malformed = response();
  await route('delete', '/:id').at(-1).handle({ params: { id: 'invalid' }, user: { id: '507f1f77bcf86cd799439011' } }, malformed);
  assert.equal(malformed.code, 400);
});
