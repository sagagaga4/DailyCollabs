const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');

test('saved topics are private, duplicate-safe and cannot claim or delete legacy/global or another account topics', async () => {
  process.env.JWT_SECRET = 'saved-topic-fixture-secret';
  await mongoose.connect(`mongodb://127.0.0.1:27017/dailycollabs_topics_test_${process.pid}_${Date.now()}`);
  const Tag = require('../model/Tags');
  const User = require('../model/User');
  const app = express(); app.use(express.json()); app.use('/tags', require('../routers/tagRouter'));
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const base = `http://127.0.0.1:${server.address().port}/tags`;
  async function request(method, token, body, suffix = '') { const response = await fetch(base + suffix, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: response.status, data: await response.json() }; }
  try {
    await Tag.init();
    const [one, two] = await User.create(['one', 'two'].map(name => ({ username: name, fullname: name, email: `${name}@example.test`, password: 'fixture' })));
    const a = jwt.sign({ id: one.id }, process.env.JWT_SECRET), b = jwt.sign({ id: two.id }, process.env.JWT_SECRET);
    const legacy = await Tag.collection.insertOne({ tagName: 'Legacy secret' });
    assert.equal((await request('GET')).status, 401);
    assert.deepEqual((await request('GET', a)).data, []);
    assert.equal((await request('POST', a, { tagName: 'Redis', ownerId: two.id })).status, 201);
    assert.equal((await request('POST', a, { tagName: 'redis' })).status, 200);
    assert.equal((await request('GET', a)).data.length, 1);
    assert.deepEqual((await request('GET', b)).data, []);
    assert.equal((await request('DELETE', b, null, '/Redis')).status, 404);
    assert.equal((await request('DELETE', a, null, '/Legacy%20secret')).status, 404);
    assert.ok(await Tag.collection.findOne({ _id: legacy.insertedId }));
    assert.equal((await request('POST', b, { tagName: 'Redis' })).status, 201);
    assert.equal((await request('POST', a, { tagName: { $ne: null } })).status, 400);
    assert.equal((await request('DELETE', a, null, '/Redis')).status, 200);
    assert.equal((await request('GET', b)).data.length, 1);
  } finally { await new Promise(resolve => server.close(resolve)); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); }
});
