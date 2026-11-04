const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const Community = require('../model/Community');
const User = require('../model/User');
const Message = require('../model/CommunityMessage');
const Reaction = require('../model/CommunityReaction');
const { validateMessage } = require('../services/communityChannels');
const { registry, EMOJIS } = require('../utils/communityEmojis');
const frontendEmojis = require('../../Frontend/client/src/lib/communityEmojis.json');

test('the 31-expression registry stays aligned across picker and stored reactions', () => {
  assert.equal(registry.length, 31);
  assert.equal(new Set(EMOJIS).size, 31);
  assert.deepEqual(EMOJIS.slice(0, 6), ['spark', 'orbit', 'pulse', 'lens', 'bolt', 'bloom']);
  assert.equal(EMOJIS.filter(id => id.startsWith('dc_')).length, 25);
  assert.deepEqual(frontendEmojis, registry);
});

test('channel attachment validation accepts real HTTP sources while rejecting executable and forged fields', () => {
  const shared = validateMessage({ content: '', attachment: { type: 'article', title: 'A real source', url: 'http://news.example.com/story', description: 'A short summary.' } });
  assert.equal(shared.attachment.url, 'http://news.example.com/story');
  for (const body of [{ content: '' }, { content: 'x', authorId: 'forged' }, { content: 'x'.repeat(3001) }, { attachment: { type: 'article', title: 'Bad', url: 'javascript:alert(1)' } }, { attachment: { type: 'article', title: 'Bad', url: 'https://user:password@example.com/story' } }, { attachment: { type: 'video', title: 'Bad', url: 'https://example.com/', ownerId: 'forged' } }]) assert.throws(() => validateMessage(body));
});

test('persistent channels, owner permissions, rule acknowledgement, safe members, message history, and emoji reactions', async t => {
  process.env.JWT_SECRET = 'community-channel-integration-only-secret';
  await mongoose.connect(`mongodb://127.0.0.1:27017/dailycollabs_channels_test_${Date.now()}`, { serverSelectionTimeoutMS: 5000 });
  const app = express(); app.use(express.json()); app.use('/communities', require('../routers/communityRouter'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  await Promise.all([Community.init(), User.init(), Message.init(), Reaction.init()]);
  const [owner, member, stranger] = await User.create(['owner','member','stranger'].map(name => ({ fullname: `Channel ${name}`, username: `channel_${name}`, email: `${name}@channel.test`, password: 'not-a-real-password' })));
  const tokens = [owner,member,stranger].map(user => jwt.sign({ id: user._id }, process.env.JWT_SECRET));
  const base = `http://127.0.0.1:${server.address().port}/communities`;
  async function request(path = '', method = 'GET', token, body) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
  }
  let result = await request('', 'POST', tokens[0], { name: 'Channel test board', description: 'An isolated community for real channel tests.' });
  const id = result.data._id;
  assert.deepEqual(result.data.channels.map(channel => channel.id), ['welcome','general']);
  assert.equal(result.data.requiresRulesAcceptance, false);
  assert.equal((await request(`/${id}/channels/general/messages`, 'POST', undefined, { content: 'No token' })).status, 401);
  assert.equal((await request(`/${id}/channels/general/messages`, 'POST', tokens[1], { content: 'Not a member' })).status, 403);
  assert.equal((await request(`/${id}/channels`, 'POST', tokens[1], { name: 'forged' })).status, 403);
  result = await request(`/${id}/rules`, 'PATCH', tokens[0], { rules: ['Share original ideas.', 'Credit your sources.'], requireRulesAcceptance: true });
  assert.equal(result.status, 200); assert.equal(result.data.rulesVersion, 2);
  assert.equal((await request(`/${id}/join`, 'POST', tokens[1], {})).status, 409);
  assert.equal((await request(`/${id}/join`, 'POST', tokens[1], { acceptedRules: true, rulesVersion: 1 })).status, 409);
  result = await request(`/${id}/join`, 'POST', tokens[1], { acceptedRules: true, rulesVersion: 2 });
  assert.equal(result.status, 200); assert.equal(result.data.memberCount, 2);
  assert.equal(result.data.rulesAcknowledgements, undefined);
  const record = await Community.findById(id).select('+rulesAcknowledgements');
  assert.equal(record.rulesAcknowledgements.get(String(member._id)).version, 2);
  assert.equal((await request(`/${id}/rules`, 'PATCH', tokens[1], { rules: ['Take control.'] })).status, 403);
  result = await request(`/${id}/channels`, 'POST', tokens[0], { name: 'discoveries', topic: 'Share a new idea.' });
  assert.equal(result.status, 201); assert.equal(result.data.channels.length, 3);
  assert.equal((await request(`/${id}/channels`, 'POST', tokens[0], { name: 'discoveries' })).status, 409);
  assert.equal((await request(`/${id}/channels/welcome/messages`, 'POST', tokens[0], { content: 'No welcome spam.' })).status, 403);
  assert.equal((await request(`/${id}/channels/missing/messages`)).status, 404);
  result = await request(`/${id}/channels/discoveries/messages`, 'POST', tokens[1], { content: 'A persistent :spark: for this community.' });
  assert.equal(result.status, 201);
  const messageId = result.data._id;
  assert.equal(result.data.author.username, member.username);
  assert.equal(result.data.author.email, undefined); assert.equal(result.data.author.password, undefined);
  assert.equal((await request(`/${id}/channels/general/messages`)).data.messages.length, 0, 'Channels must stay separate.');
  result = await request(`/${id}/channels/discoveries/messages`);
  assert.equal(result.data.messages[0].content, 'A persistent :spark: for this community.');
  result = await request(`/${id}/messages/${messageId}/reactions`, 'POST', tokens[1], { emoji: 'spark' });
  assert.deepEqual(result.data.reactions, [{ emoji: 'spark', count: 1, reacted: true }]);
  result = await request(`/${id}/messages/${messageId}/reactions`, 'POST', tokens[0], { emoji: 'spark' });
  assert.equal(result.data.reactions[0].count, 2);
  result = await request(`/${id}/messages/${messageId}/reactions`, 'POST', tokens[1], { emoji: 'spark' });
  assert.equal(result.data.reactions[0].count, 1); assert.equal(result.data.reactions[0].reacted, false);
  assert.equal((await request(`/${id}/messages/${messageId}/reactions`, 'POST', tokens[2], { emoji: 'spark' })).status, 403);
  assert.equal((await request(`/${id}/messages/${messageId}/reactions`, 'POST', tokens[0], { emoji: 'unknown' })).status, 400);
  // Every new expression must survive the real API and Mongo schema, not just the picker registry.
  for (const emoji of EMOJIS.slice(6)) {
    result = await request(`/${id}/messages/${messageId}/reactions`, 'POST', tokens[1], { emoji });
    assert.equal(result.status, 200, emoji);
    assert.ok(result.data.reactions.some(reaction => reaction.emoji === emoji && reaction.reacted), emoji);
  }
  result = await request(`/${id}/channels/discoveries/messages`, 'GET', tokens[1]);
  assert.equal(result.data.messages[0].reactions.filter(reaction => reaction.emoji.startsWith('dc_')).length, 25, 'All new reactions persist and reload.');
  result = await request(`/${id}/messages/${messageId}/reactions`, 'POST', tokens[1], { emoji: 'dc_spark' });
  assert.ok(result.data.reactions.some(reaction => reaction.emoji === 'spark' && reaction.reacted), 'Legacy dc_ aliases map to their original stored id.');
  assert.equal((await request(`/${id}/messages/${messageId}/reactions`, 'POST', tokens[1], { emoji: 'dc_unknown' })).status, 400);
  result = await request(`/${id}/channels/discoveries`, 'PATCH', tokens[0], { name: 'the-lab', topic: 'Owner announcements.', readOnly: true });
  assert.equal(result.status, 200); assert.equal(result.data.channels.find(channel => channel.id === 'discoveries').name, 'the-lab', 'Channel ids stay stable after a rename.');
  assert.equal((await request(`/${id}/channels/discoveries/messages`, 'POST', tokens[1], { content: 'No longer allowed.' })).status, 403);
  assert.equal((await request(`/${id}/channels/discoveries/messages`, 'POST', tokens[0], { content: 'Owner update.' })).status, 201);
  result = await request(`/${id}/channels/general/messages`, 'POST', tokens[1], { content: 'Worth reading.', attachment: { type: 'article', title: 'A shared article', url: 'http://example.com/story' } });
  assert.equal(result.status, 201); assert.equal(result.data.attachment.url, 'http://example.com/story');
  await request(`/${id}/discussions`, 'POST', tokens[0], { title: 'Original board thread', content: 'Preserve earlier conversations.' });
  result = await request(`/${id}/channels/general/messages`);
  assert.ok(result.data.messages.some(message => message.legacy && message.content.includes('Preserve earlier conversations.')));
  // Updating required rules applies consistently to every participation route.
  result = await request(`/${id}/rules`, 'PATCH', tokens[0], { rules: ['Updated rules apply to every participation route.'], requireRulesAcceptance: true });
  assert.equal(result.data.rulesVersion, 3);
  result = await request(`/${id}`, 'GET', tokens[1]);
  assert.equal(result.data.needsRulesAcceptance, true);
  assert.equal((await request(`/${id}/channels/general/messages`, 'POST', tokens[1], { content: 'Outdated acknowledgement.' })).status, 409);
  assert.equal((await request(`/${id}/discussions`, 'POST', tokens[1], { title: 'Legacy bypass', content: 'An old endpoint must not bypass rules.' })).status, 409);
  assert.equal((await request(`/${id}/messages/${messageId}/reactions`, 'POST', tokens[1], { emoji: 'spark' })).status, 409);
  const { assertPostingRules } = require('../services/communityService');
  await assert.rejects(assertPostingRules(id, member._id), error => error.status === 409);
  await assertPostingRules(id, owner._id); // The owner remains able to manage and post.
  result = await request(`/${id}/join`, 'POST', tokens[1], { acceptedRules: true, rulesVersion: 3 });
  assert.equal(result.data.memberCount, 2, 'Re-acknowledging must not create another membership.');
  assert.equal(result.data.needsRulesAcceptance, false);
  assert.equal(result.data.hasAcceptedRules, true);
  assert.equal((await request(`/${id}/channels/general/messages`, 'POST', tokens[1], { content: 'Current rules accepted.' })).status, 201);
  assert.equal((await request(`/${id}/discussions`, 'POST', tokens[1], { title: 'Current participation', content: 'The legacy endpoint now checks the same rules.' })).status, 201);
  result = await request(`/${id}/members`, 'GET', tokens[1]);
  assert.equal(result.data.total, 2);
  assert.equal(result.data.members.find(user => user._id === String(owner._id)).role, 'owner');
  assert.ok(result.data.members.every(user => !user.email && !user.password));
  assert.equal((await request(`/${id}/members`, 'GET', tokens[2])).status, 403);
  await request(`/${id}/membership`, 'DELETE', tokens[1]);
  assert.equal((await request(`/${id}/channels/general/messages`, 'POST', tokens[1], { content: 'No access after leaving.' })).status, 403);
});
