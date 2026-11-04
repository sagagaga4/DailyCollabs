const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');

test('posts and saved stories persist metadata, enforce identity, and isolate collections', async () => {
  process.env.JWT_SECRET = 'isolated-collections-test-secret';
  const database = `dailycollabs_test_collections_${crypto.randomBytes(6).toString('hex')}`;
  await mongoose.connect(`mongodb://127.0.0.1:27017/${database}`);
  const User = require('../model/User');
  const app = express(); app.use(express.json());
  app.use('/posts', require('../routers/postRouter')); app.use('/bookmarked', require('../routers/bookmarkedRouter'));
  const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, method, token, body) { const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: response.status, data: await response.json() }; }
  try {
    const first = await User.create({ fullname: 'First', username: 'first', email: 'first@example.test', password: 'fixture' });
    const second = await User.create({ fullname: 'Second', username: 'second', email: 'second@example.test', password: 'fixture' });
    const a = jwt.sign({ id: first.id }, process.env.JWT_SECRET), b = jwt.sign({ id: second.id }, process.env.JWT_SECRET);
    const story = { articleLink: 'https://example.com/redis', title: 'Redis patterns', description: 'A story to revisit.', type: 'article' };
    assert.equal((await request('/bookmarked', 'POST', null, story)).status, 401);
    assert.equal((await request('/bookmarked', 'POST', a, story)).status, 201);
    await request('/bookmarked', 'POST', a, story);
    const saved = await request('/bookmarked', 'GET', a); assert.equal(saved.data.length, 1); assert.equal(saved.data[0].title, story.title);
    assert.equal((await request('/bookmarked', 'GET', b)).data.length, 0);
    await request('/bookmarked', 'DELETE', b, story); assert.equal((await request('/bookmarked', 'GET', a)).data.length, 1);
    assert.equal((await request('/bookmarked', 'POST', a, { articleLink: 'javascript:alert(1)' })).status, 400);
    const draft = { title: 'An idea worth sharing', content: 'The author comes from the authenticated account.', communityId: 'personal', authorId: second.id, AuthorID: second.id };
    assert.equal((await request('/posts', 'POST', null, draft)).status, 401);
    const created = await request('/posts', 'POST', a, draft); assert.equal(created.status, 201); assert.equal(created.data.authorId._id, first.id);
    assert.equal((await request('/posts', 'POST', a, { title: 'x', content: 'short' })).status, 400);
    const liked = await request(`/posts/${created.data._id}/like`, 'POST', a); assert.equal(liked.data.likesCount, 1);
    assert.equal((await request(`/posts/${created.data._id}/like`, 'POST', a)).data.likesCount, 1);
    assert.equal((await request(`/posts/${created.data._id}`, 'DELETE', b)).status, 404);
    assert.equal((await request(`/posts/${created.data._id}`, 'DELETE', a)).status, 200);
    await request('/bookmarked', 'DELETE', a, story); assert.equal((await request('/bookmarked', 'GET', a)).data.length, 0);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  }
});
