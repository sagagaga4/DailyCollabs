const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const service = require('../services/contentService');
const User = require('../model/User');
const Community = require('../model/Community');
const SharedContent = require('../model/SharedContent');
const UserChannelPost = require('../model/UserChannelPost');
const communities = require('../services/communityService');
const actor = '507f1f77bcf86cd799439011';
const other = '507f191e810c19729de860ea';
const communityId = '507f1f77bcf86cd799439012';
const content = { type: 'article', url: 'https://example.com/story', title: 'A good story', image: '', description: 'Worth discussing.' };

function patch(t, object, key, replacement) { const previous = object[key]; object[key] = replacement; t.after(() => { object[key] = previous; }); }

test('source validation allows normal HTTP(S) links and rejects executable links, credentials, and oversized fields', () => {
  assert.equal(service.safeContentUrl('http://example.com/story'), 'http://example.com/story');
  for (const url of ['javascript:alert(1)', 'data:text/html,hi', 'file:///tmp/a', 'https://user:password@example.com/', '//example.com/', 'https://', 'https://example.com/\npath', 'x'.repeat(2049)]) assert.throws(() => service.safeContentUrl(url), /valid http or https/);
  assert.deepEqual(service.normalizeContent({ ...content, actorId: other, ownerId: other, communityId, admin: true }), content);
  assert.throws(() => service.normalizeContent({ ...content, description: 'x'.repeat(501) }), /Description/);
  assert.throws(() => service.normalizeContent({ ...content, image: 'javascript:alert(1)' }), /valid http or https/);
  assert.throws(() => service.channelId('../private'), /valid channel/);
});

test('reposts assign their owner from authentication and return the existing saved post on repeat', async (t) => {
  let saved;
  let creates = 0;
  patch(t, User, 'exists', async (filter) => { assert.deepEqual(filter, { _id: actor }); return true; });
  patch(t, UserChannelPost, 'findOne', async (filter) => { assert.deepEqual(filter, { ownerId: actor, 'content.url': content.url }); return saved || null; });
  patch(t, UserChannelPost, 'create', async (value) => { creates += 1; saved = { _id: other, ...value }; return saved; });
  const first = await service.repost(actor, { content, note: 'My take', ownerId: other, actorId: other });
  assert.equal(first.created, true); assert.equal(first.post.ownerId, actor); assert.equal(first.post.note, 'My take');
  assert.equal((await service.repost(actor, { content })).created, false); assert.equal(creates, 1);
});

test('personal channel reads and deletes stay scoped to the authenticated owner', async (t) => {
  patch(t, User, 'exists', async () => true);
  let readFilter;
  patch(t, UserChannelPost, 'find', (filter) => { readFilter = filter; return { sort() { return this; }, skip() { return this; }, limit() { return this; }, async lean() { return [{ ownerId: actor, content }]; } }; });
  assert.equal((await service.listChannel(actor, 1)).posts.length, 1); assert.deepEqual(readFilter, { ownerId: actor });
  let removeFilter;
  patch(t, UserChannelPost, 'findOneAndDelete', async (filter) => { removeFilter = filter; return null; });
  await assert.rejects(service.removeRepost(actor, other), (error) => error.status === 404);
  assert.deepEqual(removeFilter, { _id: other, ownerId: actor });
});

test('sharing requires live membership before saving content or creating a channel message', async (t) => {
  patch(t, User, 'exists', async () => true);
  patch(t, Community, 'findById', () => ({ async select() { return { _id: communityId, members: [other] }; } }));
  patch(t, SharedContent, 'create', async () => assert.fail('Non-members must not save shared records.'));
  await assert.rejects(service.shareToCommunity(actor, { content, communityId, actorId: other }), (error) => error.status === 403);
});

test('a community share creates a real message with trusted actor and validated source attachment', async (t) => {
  patch(t, User, 'exists', async () => true);
  patch(t, Community, 'findById', () => ({ async select() { return { _id: communityId, members: [actor] }; } }));
  let record;
  patch(t, SharedContent, 'create', async (value) => { record = { _id: other, ...value }; return record; });
  patch(t, communities, 'createChannelMessage', async (id, userId, channelId, data) => {
    assert.equal(id, communityId); assert.equal(userId, actor); assert.equal(channelId, 'general');
    assert.deepEqual(data, { content: 'Let’s discuss', attachment: { ...content, contentId: other } });
    return { _id: other, content: data.content, attachment: data.attachment };
  });
  const result = await service.shareToCommunity(actor, { content, communityId, note: 'Let’s discuss', actorId: other });
  assert.equal(result.shared.actorId, actor); assert.equal(result.shared.channelId, 'general'); assert.ok(result.message.attachment);
});

test('a rejected channel write rolls back its shared record instead of leaving a false successful share', async (t) => {
  patch(t, User, 'exists', async () => true);
  patch(t, Community, 'findById', () => ({ async select() { return { _id: communityId, members: [actor] }; } }));
  patch(t, SharedContent, 'create', async (value) => ({ _id: other, ...value }));
  patch(t, communities, 'createChannelMessage', async () => { const error = new Error('Channel is read-only'); error.status = 403; throw error; });
  let rollback;
  patch(t, SharedContent, 'deleteOne', async (filter) => { rollback = filter; });
  await assert.rejects(service.shareToCommunity(actor, { content, communityId, channelId: 'welcome' }), /read-only/);
  assert.deepEqual(rollback, { _id: other, actorId: actor });
});

test('long-press movement and bubble hit targets behave correctly on narrow and desktop viewports', async () => {
  const drag = await import(pathToFileURL(path.resolve(__dirname, '../../Frontend/client/src/components/CardActions/dragMath.js')).href);
  assert.equal(drag.movedBeyondPress({ x: 0, y: 0 }, { x: 6, y: 8 }), false);
  assert.equal(drag.movedBeyondPress({ x: 0, y: 0 }, { x: 11, y: 0 }), true);
  for (const viewport of [{ width: 220, height: 180 }, { width: 375, height: 667 }, { width: 1440, height: 900 }]) {
    const targets = drag.createActionTargets({ x: viewport.width - 1, y: 4 }, viewport);
    for (const target of targets) { assert.ok(target.x >= 36 && target.x <= viewport.width - 36); assert.ok(target.y >= 36 && target.y <= viewport.height - 36); assert.equal(drag.closestAction(target, targets), target.id); }
    assert.equal(drag.closestAction({ x: -1000, y: -1000 }, targets), null);
    assert.equal(drag.resolveDropAction(targets[0], targets[0], targets), null, 'A stationary long press must not choose an overlapping bubble.');
    assert.equal(drag.resolveDropAction({ x: targets[0].x, y: targets[0].y + 100 }, targets[0], targets), 'community');
  }
});

test('recommendations use actual communities and share links encode the source without inventing an Instagram post API', async () => {
  const base = path.resolve(__dirname, '../../Frontend/client/src/components/CardActions');
  const { recommendCommunities, toActionContent } = await import(pathToFileURL(path.join(base, 'recommendations.js')).href);
  const { buildShareTargets } = await import(pathToFileURL(path.join(base, 'shareTargets.js')).href);
  const list = [{ _id: 'music', name: 'Music', board: 'mu' }, { _id: 'tech', name: 'Technology', board: 'g' }, { _id: 'gaming', name: 'Gaming', board: 'v' }];
  assert.equal(recommendCommunities({ title: 'Redis database and cloud software' }, list)[0]._id, 'tech');
  assert.equal(recommendCommunities({ title: 'A new jazz album' }, list)[0]._id, 'music');
  assert.deepEqual(recommendCommunities({ title: 'Unrelated' }, list), []);
  assert.deepEqual(recommendCommunities({ title: 'Redis database and software' }, list).map((item) => item._id), ['tech']);
  assert.deepEqual(recommendCommunities({ title: 'A new album from a jazz singer' }, list).map((item) => item._id), ['music']);
  const fullList = [...list, { _id: 'film', name: 'Film Room', board: 'tv' }, { _id: 'creative', name: 'Creative Studio', board: 'ic' }, { _id: 'generic', name: 'Community News', category: 'Other' }];
  assert.deepEqual(recommendCommunities({ title: 'Trump’s wealth grows after the election', description: 'People share a video as the media create new stories about politics and other events.' }, fullList), []);
  assert.deepEqual(recommendCommunities({ title: 'People share community news and create a video' }, fullList), []);
  assert.deepEqual(recommendCommunities({ title: 'A photograph of the election', description: 'A director shares other political stories.' }, fullList), []);
  assert.deepEqual(recommendCommunities({ title: 'New Redis release' }, [...fullList, { _id: 'redis-builders', name: 'Redis Builders', category: 'Other' }]).map((item) => item._id), ['tech', 'redis-builders']);
  assert.equal(toActionContent({ title: 'Invalid', url: 'javascript:alert(1)' }), null);
  const targets = buildShareTargets({ ...content, title: 'A story & more\nBcc: test', url: 'https://example.com/a?x=1&y=2' });
  assert.equal(new URL(targets.whatsapp).searchParams.get('text'), 'A story & more Bcc: test\nhttps://example.com/a?x=1&y=2');
  assert.equal(targets.instagram, 'https://www.instagram.com/'); assert.ok(targets.email.startsWith('mailto:?subject='));
});
