const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');

test('authenticated discovery blends genuine provider and shared videos with private frozen paging', async t => {
  process.env.JWT_SECRET = 'isolated-discovery-secret';
  process.env.YOUTUBE_API_KEY = ''; process.env.GOOGLE_YOUTUBE_API_KEY = '';
  await mongoose.connect(`mongodb://127.0.0.1:27017/dailycollabs_test_discovery_${crypto.randomBytes(6).toString('hex')}`);
  const User = require('../model/User'); const Media = require('../model/MediaPost'); const Profile = require('../model/FeedProfile'); const Signal = require('../model/FeedSignal');
  const axios = require('axios'); const Parser = require('rss-parser'); const images = require('../services/topicImageService');
  await Promise.all([Profile.init(), Signal.init()]);
  const originalFetch = global.fetch; const providerQueries = [];
  t.mock.method(global, 'fetch', async (input, options) => {
    const url = new URL(String(input));
    if (url.hostname !== 'www.youtube.com') return originalFetch(input, options);
    const query = url.searchParams.get('search_query'); providerQueries.push(query);
    const prefix = query.toLowerCase().includes('redis') ? 'r' : 'a';
    const content = { contents: Array.from({ length: 8 }, (_, i) => ({ videoRenderer: { videoId: `${prefix}${String(i).padStart(10, '0')}`, title: { simpleText: `${query} practical guide ${i}` }, ownerText: { simpleText: `${query} creator` }, publishedTimeText: { simpleText: '2 days ago' } } })) };
    return new Response(`var ytInitialData = ${JSON.stringify(content)};`, { status: 200 });
  });
  t.mock.method(images, 'getTopicImage', async () => ({ image: false }));
  t.mock.method(axios, 'post', async (url, body) => ({ data: { urls: [`https://news.google.com/rss/search?q=${encodeURIComponent(body.query || '')}`] } }));
  t.mock.method(Parser.prototype, 'parseURL', async url => {
    const query = new URL(url).searchParams.get('q') || '';
    return { title: 'Real provider fixture', language: 'en', link: 'https://publisher.example', items: Array.from({ length: 36 }, (_, index) => ({ title: `${query || 'World economy'} story ${index}`, link: `https://publisher.example/${encodeURIComponent(query || 'general')}/${index}`, pubDate: new Date(Date.now() - index * 3600000).toISOString(), contentSnippet: `${query || 'World economy'} report`, enclosure: { url: 'https://images.example/story.jpg', type: 'image/jpeg' } })) };
  });
  const app = express(); app.use(express.json()); app.use('/feed', require('../routers/feedRouter')); app.use('/video-search', require('../routers/videoSearchRouter'));
  const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  async function request(token, body, method = 'POST') {
    const response = await originalFetch(`http://127.0.0.1:${server.address().port}/feed/discover${method === 'GET' ? '?language=en&pageSize=12' : ''}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(method === 'GET' ? {} : { body: JSON.stringify(body || {}) }) });
    return { status: response.status, data: await response.json(), cache: response.headers.get('cache-control') };
  }
  try {
    const first = await User.create({ fullname: 'First reader', username: 'discovery_a', email: 'discovery-a@example.test', password: 'fixture' });
    const second = await User.create({ fullname: 'Second reader', username: 'discovery_b', email: 'discovery-b@example.test', password: 'fixture' });
    const tokenA = jwt.sign({ id: first.id }, process.env.JWT_SECRET); const tokenB = jwt.sign({ id: second.id }, process.env.JWT_SECRET);
    await Profile.create({ userId: first.id, preferences: { followedTopics: ['Animation'], personalized: true } });
    await Signal.create({ userId: first.id, key: 'search:redis-fixture', type: 'search', query: 'Redis', expiresAt: new Date(Date.now() + 86400000) });
    const own = await Media.create({ title: 'My rooftop garden tour', caption: 'A real shared video', transcript: 'An original caption transcript', videoUrl: 'https://www.youtube.com/watch?v=o0000000000', provider: 'youtube', author: first.id });
    await Media.create({ title: 'Big Buck Bunny default demo', videoUrl: 'https://www.youtube.com/watch?v=b0000000000', provider: 'youtube', author: second.id });
    assert.equal((await request()).status, 401);
    assert.equal((await request(tokenA, { userId: second.id })).status, 400);
    const topicResponse = await originalFetch(`http://127.0.0.1:${server.address().port}/video-search?q=Redis`);
    const topicVideos = await topicResponse.json(); assert.equal(topicVideos.status, 'ok'); assert.equal(topicVideos.videos.length, 8);
    const result = await request(tokenA, { language: 'en', page: 1, pageSize: 12 });
    assert.equal(result.status, 200); assert.equal(result.cache, 'no-store'); assert.equal(result.data.items.length, 12);
    assert.deepEqual(providerQueries, ['Redis', 'Animation'], 'For You must reuse the successful topic-search cache rather than refetch Redis.');
    const items = result.data.items; const recent = items.filter(item => /redis/i.test(`${item.title} ${item.topic || ''}`));
    assert.ok(recent.length >= 2 && recent.length <= 3); assert.ok(recent.some(item => item.kind === 'article')); assert.ok(recent.some(item => item.kind === 'video'));
    const shared = items.find(item => item._id === own.id); assert.ok(shared); assert.equal(shared.caption, own.caption); assert.equal(shared.transcript, own.transcript); assert.equal(shared.author.username, first.username); assert.equal(shared.author.email, undefined); assert.ok(shared.reasons.includes('A video you shared'));
    assert.ok(items.every(item => item.videoUrl !== 'https://www.youtube.com/watch?v=b0000000000'), 'Unrelated public videos must not become generic defaults.');
    const nextRequest = { language: 'en', page: 2, pageSize: 12, rankingSession: result.data.rankingSession };
    const next = await request(tokenA, nextRequest); assert.equal(next.status, 200); assert.ok(next.data.items.every(item => !items.some(before => before.link === item.link)));
    assert.equal((await request(tokenB, nextRequest)).status, 409);
    await Signal.create({ userId: first.id, key: 'hide:fixture', type: 'hide', url: next.data.items[0].link, title: next.data.items[0].title, expiresAt: new Date(Date.now() + 86400000) });
    require('../services/feedService').invalidateProfile(first.id);
    const hidden = await request(tokenA, nextRequest); assert.ok(hidden.data.items.every(item => item.link !== next.data.items[0].link));
    const get = await request(tokenA, undefined, 'GET'); assert.equal(get.status, 200);
    await Profile.updateOne({ userId: first.id }, { $set: { 'preferences.diversity': 0.9 } }); require('../services/feedService').invalidateProfile(first.id);
    assert.equal((await request(tokenA, nextRequest)).status, 409);
  } finally {
    await new Promise(resolve => server.close(resolve)); require('../services/feedService').profileCache.clear();
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  }
});
