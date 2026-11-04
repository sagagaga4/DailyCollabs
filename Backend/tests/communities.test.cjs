const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const Community = require('../model/Community');
const User = require('../model/User');
const { seedDemoCommunities } = require('../seeds/demoCommunities');
const router = require('../routers/communityRouter');

// This suite owns a fresh temporary database and never touches the app database.
test('community lifecycle, privacy, membership, invitations, and permissions', async t => {
  process.env.JWT_SECRET = 'community-integration-test-only-secret';
  const dbName = `dailycollabs_community_test_${Date.now()}`;
  await mongoose.connect(`mongodb://127.0.0.1:27017/${dbName}`, { serverSelectionTimeoutMS: 5000 });
  const app = express(); app.use(express.json()); app.use('/communities', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/communities`;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  await Promise.all([Community.init(), User.init()]);
  const [owner, visitor] = await User.create([
    { fullname: 'Test Creator', username: 'community_creator', email: 'creator@local.test', password: 'test-hash' },
    { fullname: 'Test Visitor', username: 'community_visitor', email: 'visitor@local.test', password: 'test-hash' },
  ]);
  const ownerToken = jwt.sign({ id: owner._id }, process.env.JWT_SECRET);
  const visitorToken = jwt.sign({ id: visitor._id }, process.env.JWT_SECRET);
  async function request(path = '', method = 'GET', token, body) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
  }

  await seedDemoCommunities(); await seedDemoCommunities();
  let result = await request();
  assert.equal(result.status, 200); assert.equal(result.data.length, 5);
  assert.deepEqual(new Set(result.data.map(board => board.board)), new Set(['g', 'v', 'mu', 'tv', 'ic']));
  for (const board of result.data) { assert.equal(board.memberCount, 0); assert.equal(board.isDemo, true); assert.equal('members' in board, false); assert.equal('inviteToken' in board, false); }
  assert.equal((await request('', 'POST', undefined, { name: 'Unauthenticated' })).status, 401);
  assert.equal((await request('/not-an-id')).status, 404);
  assert.equal((await request('', 'POST', ownerToken, { name: 'No' })).status, 400);

  result = await request('', 'POST', ownerToken, { name: 'Integration board', description: 'A space to test real community flows.', category: 'Technology', board: 'testing', ownerId: visitor._id, members: [visitor._id], isDemo: true });
  assert.equal(result.status, 201); assert.equal(result.data.isOwner, true); assert.equal(result.data.isDemo, false); assert.equal(result.data.memberCount, 1);
  const id = result.data._id;
  assert.equal((await Community.findById(id)).ownerId.toString(), owner._id.toString());
  assert.equal((await request(`/${id}/invite`, 'POST', visitorToken, {})).status, 403);
  assert.equal((await request(`/${id}/discussions`, 'POST', visitorToken, { title: 'No access', content: 'Cannot post yet.' })).status, 403);
  await Community.updateOne({ _id: id }, { $unset: { inviteToken: 1 } });
  const invitations = await Promise.all([request(`/${id}/invite`, 'POST', ownerToken, {}), request(`/${id}/invite`, 'POST', ownerToken, {})]);
  assert.equal(invitations[0].data.token, invitations[1].data.token, 'Concurrent first invitations must keep the same working token');
  result = invitations[0];
  assert.equal(result.status, 200); assert.match(result.data.token, /^[a-f0-9]{48}$/);
  const inviteToken = result.data.token;
  assert.equal((await request(`/${id}/join`, 'POST', visitorToken, { inviteToken: 'invalid' })).status, 400);
  result = await request(`/${id}/join`, 'POST', visitorToken, { inviteToken });
  assert.equal(result.status, 200); assert.equal(result.data.memberCount, 2); assert.equal(result.data.isMember, true);
  result = await request(`/${id}/join`, 'POST', visitorToken, {});
  assert.equal(result.data.memberCount, 2);
  result = await request('?joined=true', 'GET', visitorToken);
  assert.equal(result.data.length, 1); assert.equal(result.data[0]._id, id);
  result = await request('?search=integration'); assert.equal(result.data.length, 1);
  result = await request(`/${id}/discussions`, 'POST', visitorToken, { title: 'Hello, community', content: 'A real conversation saved in MongoDB.', authorName: 'forged' });
  assert.equal(result.status, 201); assert.equal(result.data.discussionCount, 1); assert.equal(result.data.discussions[0].authorName, visitor.username);
  assert.equal(result.data.discussions[0].isDemo, false);
  assert.equal((await request(`/${id}/membership`, 'DELETE', ownerToken)).status, 409);
  assert.equal((await request(`/${id}`, 'DELETE', visitorToken)).status, 403);
  result = await request(`/${id}/membership`, 'DELETE', visitorToken);
  assert.equal(result.status, 200); assert.equal(result.data.memberCount, 1); assert.equal(result.data.isMember, false);
  assert.equal((await request(`/${id}/invite`, 'POST', visitorToken, {})).status, 403);
  result = await request(`/${id}`); assert.equal('inviteToken' in result.data, false); assert.equal('members' in result.data, false);
  assert.equal((await request(`/${id}`, 'DELETE', ownerToken)).status, 200);
  assert.equal((await request(`/${id}`)).status, 404);
});
