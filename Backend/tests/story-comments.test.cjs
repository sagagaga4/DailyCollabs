const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const service = require('../services/storyCommentService');

test('story threads canonicalize tracking and video aliases while rejecting unsafe URLs', async () => {
  assert.equal(service.canonicalThreadUrl('https://example.com/a?utm_source=x&keep=yes#section'), 'https://example.com/a?keep=yes');
  assert.equal(service.canonicalThreadUrl('https://youtu.be/aqz-KE-bpKQ?si=tracking&t=20'), 'https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  assert.throws(() => service.canonicalThreadUrl('javascript:alert(1)'), /valid http or https/);
  assert.throws(() => service.canonicalThreadUrl('https://user:password@example.com/'), /valid http or https/);
  const frontend = await import(pathToFileURL(path.resolve(__dirname, '../../Frontend/client/src/components/Comments/commentThreads.js')).href);
  for (const url of ['https://example.com/a?utm_source=x&keep=yes#section', 'https://youtu.be/aqz-KE-bpKQ?si=tracking&t=20']) assert.equal(frontend.canonicalThreadUrl(url), service.canonicalThreadUrl(url));
});

test('live Mongo comments enforce ownership, real threads/reactions/reposts, recipient privacy, event deduplication, and rollback', { skip: process.env.RUN_LIVE_COMMENT_TESTS !== '1', timeout: 30000 }, async (t) => {
  const mongoose = require('mongoose');
  const User = require('../model/User');
  const StoryComment = require('../model/StoryComment');
  const Reaction = require('../model/StoryCommentReaction');
  const Notification = require('../model/Notification');
  const UserChannelPost = require('../model/UserChannelPost');
  const notifications = require('../services/notificationService');
  const dbName = `dailycollabs_story_comments_test_${process.pid}_${Date.now()}`;
  await mongoose.connect(`mongodb://127.0.0.1:27017/${dbName}`, { serverSelectionTimeoutMS: 3000 });
  t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  await Promise.all([User.init(), StoryComment.init(), Reaction.init(), Notification.init(), UserChannelPost.init()]);
  const users = await User.create(['alice', 'bob', 'charlie'].map((name) => ({ username: `test_${name}`, fullname: name, email: `${name}@comments-fixture.example`, password: 'fixture-only' })));
  const [alice, bob, charlie] = users.map((user) => String(user._id));
  const url = 'https://example.com/story';
  const original = await service.create(alice, { url: `${url}?utm_source=x#part`, title: 'A real story', text: 'My first perspective.', authorId: bob });
  assert.equal(String(original.author._id), alice); assert.equal(original.author.password, undefined);
  await assert.rejects(service.edit(bob, original._id, { text: 'Hijacked' }), (error) => error.status === 403);
  await assert.rejects(service.remove(bob, original._id), (error) => error.status === 403);
  await assert.rejects(service.create(bob, { url: 'https://example.com/other', title: 'Other', text: 'Wrong thread', parentId: original._id }), /same story/);
  const edited = await service.edit(alice, original._id, { text: 'An edited perspective.' }); assert.equal(edited.edited, true);
  const reply = await service.create(bob, { url, title: 'A real story', text: 'A thoughtful reply.', parentId: original._id });
  assert.equal(String(reply.parentId), String(original._id));
  assert.equal((await notifications.list(alice)).notifications.filter((row) => row.type === 'reply').length, 1);
  assert.equal((await notifications.list(alice)).notifications.find((row) => row.type === 'reply').excerpt, reply.text);
  assert.equal((await service.react(bob, original._id, 'like')).likes, 1);
  assert.equal((await service.react(bob, original._id, 'like')).likes, 0);
  assert.equal((await service.react(bob, original._id, 'like')).likes, 1);
  const disliked = await service.react(bob, original._id, 'dislike'); assert.equal(disliked.likes, 0); assert.equal(disliked.dislikes, 1);
  const beforeSelf = await Notification.countDocuments({ recipientId: alice });
  await service.react(alice, original._id, 'like'); assert.equal(await Notification.countDocuments({ recipientId: alice }), beforeSelf);
  const firstRepost = await service.repost(bob, original._id, { ownerId: charlie, url: 'https://evil.example/' });
  assert.equal(firstRepost.created, true); assert.equal(String(firstRepost.post.ownerId), bob); assert.match(firstRepost.post.content.url, /\/Comments\?comment=/);
  const secondRepost = await service.repost(bob, original._id); assert.equal(secondRepost.created, false); assert.equal(secondRepost.comment.repostCount, 1);
  const inbox = await notifications.list(alice);
  for (const type of ['reply', 'like', 'dislike', 'repost']) assert.equal(inbox.notifications.filter((row) => row.type === type).length, 1, `${type} should notify once`);
  assert.equal((await notifications.list(charlie)).notifications.length, 0);
  await assert.rejects(notifications.markRead(charlie, inbox.notifications[0]._id), (error) => error.status === 404);
  await notifications.markAllRead(alice); assert.equal((await notifications.list(alice)).unreadCount, 0);
  const realNotify = Notification.updateOne;
  Notification.updateOne = async () => { throw new Error('Simulated notification failure'); };
  try {
    const beforeReplies = await StoryComment.countDocuments({});
    await assert.rejects(service.create(charlie, { url, title: 'A real story', text: 'Should roll back.', parentId: original._id }), /Simulated notification failure/);
    assert.equal(await StoryComment.countDocuments({}), beforeReplies);
    await assert.rejects(service.repost(charlie, original._id), /Simulated notification failure/);
    assert.equal(await UserChannelPost.countDocuments({ ownerId: charlie }), 0);
    await assert.rejects(service.react(charlie, original._id, 'like'), /Simulated notification failure/);
    assert.equal((await Reaction.findOne({ actorId: charlie, commentId: original._id })).type, null);
  } finally { Notification.updateOne = realNotify; }
  let releaseFirst;
  let entered;
  const firstBlocked = new Promise((resolve) => { entered = resolve; });
  let blockOnce = true;
  Notification.updateOne = function(...args) {
    if (blockOnce && args[1].$setOnInsert.type === 'like' && String(args[1].$setOnInsert.actorId) === charlie) {
      blockOnce = false; entered(); return new Promise((_resolve, reject) => { releaseFirst = reject; });
    }
    return realNotify.apply(this, args);
  };
  try {
    const first = service.react(charlie, original._id, 'like').then(() => assert.fail('The delayed write should fail.'), (error) => error);
    await firstBlocked;
    await service.react(charlie, original._id, 'like');
    await service.react(charlie, original._id, 'like');
    releaseFirst(new Error('Delayed notification failure'));
    assert.match((await first).message, /Delayed notification failure/);
    assert.equal((await Reaction.findOne({ actorId: charlie, commentId: original._id })).type, 'like', 'A failed old reaction must not undo a newer valid reaction.');
  } finally { Notification.updateOne = realNotify; }
  const counts = await service.threadCounts(alice, [url]); assert.equal(counts.counts[url], 2);
  await service.remove(alice, original._id);
  assert.equal((await service.mine(alice)).comments.length, 0);
  const remaining = await service.thread(alice, { url }); assert.equal(remaining.totalCount, 1); assert.equal(remaining.comments.find((row) => String(row._id) === String(original._id)).deleted, true); assert.ok(remaining.comments.some((row) => String(row._id) === String(reply._id)));
});
