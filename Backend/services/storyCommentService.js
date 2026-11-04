const mongoose = require('mongoose');
const crypto = require('node:crypto');
const StoryComment = require('../model/StoryComment');
const Reaction = require('../model/StoryCommentReaction');
const Notification = require('../model/Notification');
const User = require('../model/User');
const UserChannelPost = require('../model/UserChannelPost');
const contentService = require('./contentService');
const { parseVideoUrl } = require('../utils/media');

class CommentError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const objectId = (value) => new mongoose.Types.ObjectId(String(value));
function validId(value) { if (!mongoose.isObjectIdOrHexString(value)) throw new CommentError('Comment not found.', 404); return value; }
function boundedText(value, label, max, required = true) {
  if (typeof value !== 'string' || (required && !value.trim()) || value.trim().length > max) throw new CommentError(`${label} must contain ${required ? '1' : '0'}–${max} characters.`);
  return value.trim();
}
function canonicalThreadUrl(value) {
  const safe = contentService.safeContentUrl(value);
  const video = parseVideoUrl(safe);
  const url = new URL(video?.url || safe);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) if (/^utm_/i.test(key) || ['fbclid', 'gclid'].includes(key.toLowerCase())) url.searchParams.delete(key);
  return url.href;
}
function commentUrl(id) {
  let origin;
  try { origin = new URL(contentService.safeContentUrl(process.env.FRONTEND_URL || 'http://localhost:5173')).origin; }
  catch { throw new CommentError('The app URL is not configured correctly.', 503); }
  return `${origin}/Comments?comment=${encodeURIComponent(String(id))}`;
}
async function requireActor(userId) {
  if (!mongoose.isObjectIdOrHexString(userId) || !await User.exists({ _id: userId })) throw new CommentError('Please sign in again.', 401);
}
async function requireComment(id, includeDeleted = false) {
  validId(id);
  const comment = await StoryComment.findById(id);
  if (!comment || (!includeDeleted && comment.deletedAt)) throw new CommentError('This comment is no longer available.', 404);
  return comment;
}
async function notify(recipientId, actorId, type, comment, targetId, suffix = '', excerpt = comment.text) {
  if (String(recipientId) === String(actorId)) return;
  const dedupeKey = `${type}:${comment._id}:${actorId}${suffix ? `:${suffix}` : ''}`;
  await Notification.updateOne({ recipientId, dedupeKey }, { $setOnInsert: { recipientId, actorId, type, commentId: comment._id, targetCommentId: targetId || comment._id, threadUrl: comment.threadUrl, title: comment.title, excerpt: excerpt.slice(0, 200), dedupeKey, readAt: null } }, { upsert: true, setDefaultsOnInsert: true });
}

async function serializeComments(rows, userId) {
  if (!rows.length) return [];
  const ids = rows.map((row) => row._id);
  const [counts, mine, reposts] = await Promise.all([
    Reaction.aggregate([{ $match: { commentId: { $in: ids }, type: { $in: ['like', 'dislike'] } } }, { $group: { _id: { commentId: '$commentId', type: '$type' }, count: { $sum: 1 } } }]),
    Reaction.find({ commentId: { $in: ids }, actorId: userId }).select('commentId type').lean(),
    UserChannelPost.aggregate([{ $match: { sourceCommentId: { $in: ids } } }, { $group: { _id: '$sourceCommentId', count: { $sum: 1 } } }]),
  ]);
  const byCount = new Map();
  for (const value of counts) byCount.set(`${value._id.commentId}:${value._id.type}`, value.count);
  const myTypes = new Map(mine.map((row) => [String(row.commentId), row.type]));
  const repostCounts = new Map(reposts.map((row) => [String(row._id), row.count]));
  return rows.map((row) => ({
    _id: row._id, url: row.threadUrl, title: row.title, type: row.contentType,
    text: row.deletedAt ? '' : row.text, deleted: Boolean(row.deletedAt), edited: Boolean(row.edited),
    author: row.authorId && typeof row.authorId === 'object' && row.authorId.username ? { _id: row.authorId._id, username: row.authorId.username, fullname: row.authorId.fullname || '', avatar: row.authorId.avatar || '' } : { _id: row.authorId?._id || row.authorId, username: 'Former member', avatar: '' },
    isOwner: !row.deletedAt && String(row.authorId?._id || row.authorId) === String(userId),
    parentId: row.parentId?._id || row.parentId || null,
    parentPreview: row.parentId?.text ? row.parentId.deletedAt ? 'Comment removed' : row.parentId.text.slice(0, 140) : '',
    parentAuthorName: row.parentId?.authorId?.username || '',
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    likes: byCount.get(`${row._id}:like`) || 0, dislikes: byCount.get(`${row._id}:dislike`) || 0,
    myReaction: myTypes.get(String(row._id)) || null, repostCount: repostCounts.get(String(row._id)) || 0,
  }));
}
const populated = (query) => query.populate('authorId', 'username fullname avatar').populate({ path: 'parentId', select: 'text authorId deletedAt', populate: { path: 'authorId', select: 'username' } }).lean();
async function serializeOne(id, userId) { const row = await populated(StoryComment.findById(id)); return (await serializeComments(row ? [row] : [], userId))[0]; }

async function thread(userId, query = {}) {
  await requireActor(userId);
  const url = canonicalThreadUrl(query.url);
  const filter = { threadUrl: url };
  if (query.before) filter._id = { $lt: objectId(validId(query.before)) };
  const rows = await populated(StoryComment.find(filter).sort({ _id: -1 }).limit(51));
  const [comments, totalCount] = await Promise.all([serializeComments(rows.slice(0, 50), userId), StoryComment.countDocuments({ threadUrl: url, deletedAt: null })]);
  return { url, comments, totalCount, hasMore: rows.length > 50, nextCursor: rows.length > 50 ? String(rows[49]._id) : null };
}
async function mine(userId, query = {}) {
  await requireActor(userId);
  const filter = { authorId: userId, deletedAt: null };
  if (query.before) filter._id = { $lt: objectId(validId(query.before)) };
  const rows = await populated(StoryComment.find(filter).sort({ _id: -1 }).limit(31));
  return { comments: await serializeComments(rows.slice(0, 30), userId), hasMore: rows.length > 30, nextCursor: rows.length > 30 ? String(rows[29]._id) : null };
}
async function getOne(userId, id) { await requireActor(userId); await requireComment(id, true); return serializeOne(id, userId); }
async function threadCounts(userId, urls) {
  await requireActor(userId);
  if (!Array.isArray(urls) || urls.length > 50) throw new CommentError('Choose at most 50 story links.');
  const normalized = [...new Set(urls.map(canonicalThreadUrl))];
  const rows = await StoryComment.aggregate([{ $match: { threadUrl: { $in: normalized }, deletedAt: null } }, { $group: { _id: '$threadUrl', count: { $sum: 1 } } }]);
  const counts = Object.fromEntries(normalized.map((url) => [url, 0]));
  for (const row of rows) counts[row._id] = row.count;
  return { counts };
}
async function create(userId, body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CommentError('Choose a story and write a comment.');
  await requireActor(userId);
  const url = canonicalThreadUrl(body.url);
  const text = boundedText(body.text, 'Comment', 2000);
  const title = boundedText(body.title, 'Story title', 300);
  let parent = null;
  if (body.parentId) {
    parent = await requireComment(body.parentId);
    if (parent.threadUrl !== url) throw new CommentError('Replies must belong to the same story.');
  }
  const comment = await StoryComment.create({ threadUrl: url, title, text, authorId: userId, parentId: parent?._id || null, contentType: body.type === 'video' ? 'video' : 'article' });
  try { if (parent) await notify(parent.authorId, userId, 'reply', parent, comment._id, String(comment._id), comment.text); }
  catch (error) { await StoryComment.deleteOne({ _id: comment._id, authorId: userId }); throw error; }
  return serializeOne(comment._id, userId);
}
async function edit(userId, id, body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CommentError('Write a comment.');
  await requireActor(userId); validId(id);
  const text = boundedText(body.text, 'Comment', 2000);
  const updated = await StoryComment.findOneAndUpdate({ _id: id, authorId: userId, deletedAt: null }, { $set: { text, edited: true } }, { new: true, runValidators: true });
  if (!updated) throw new CommentError('Only your own available comments can be edited.', 403);
  return serializeOne(updated._id, userId);
}
async function remove(userId, id) {
  await requireActor(userId); validId(id);
  const updated = await StoryComment.findOneAndUpdate({ _id: id, authorId: userId, deletedAt: null }, { $set: { deletedAt: new Date() } }, { new: true });
  if (!updated) throw new CommentError('Only your own available comments can be removed.', 403);
  return { message: 'Comment removed.', url: updated.threadUrl };
}
async function react(userId, id, type) {
  await requireActor(userId);
  if (!['like', 'dislike'].includes(type)) throw new CommentError('Choose like or dislike.');
  const comment = await requireComment(id);
  const filter = { commentId: id, actorId: userId };
  const operationId = crypto.randomUUID();
  const pipeline = [{ $set: { commentId: objectId(id), actorId: objectId(userId), operationId, type: { $cond: [{ $eq: [{ $ifNull: ['$type', null] }, type] }, null, type] }, createdAt: { $ifNull: ['$createdAt', '$$NOW'] }, updatedAt: '$$NOW' } }];
  let previous;
  try { previous = await Reaction.findOneAndUpdate(filter, pipeline, { upsert: true, new: false, setDefaultsOnInsert: false }); }
  catch (error) { if (error.code !== 11000) throw error; previous = await Reaction.findOneAndUpdate(filter, pipeline, { new: false }); }
  const nextType = previous?.type === type ? null : type;
  try { if (nextType) await notify(comment.authorId, userId, nextType, comment, comment._id); }
  catch (error) { await Reaction.updateOne({ ...filter, type: nextType, operationId }, { $set: { type: previous?.type || null } }); throw error; }
  return serializeOne(id, userId);
}
async function repost(userId, id, body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CommentError('Choose a comment to repost.');
  await requireActor(userId);
  const comment = await requireComment(id);
  const author = await User.findById(comment.authorId).select('username').lean();
  const result = await contentService.repost(userId, { content: { type: 'article', url: commentUrl(comment._id), title: `@${author?.username || 'member'}: ${comment.text}`.slice(0, 200), description: comment.text.slice(0, 500), image: '' }, note: typeof body.note === 'string' ? body.note : '' });
  try {
    await UserChannelPost.updateOne({ _id: result.post._id, ownerId: userId }, { $set: { sourceCommentId: comment._id } });
    if (result.created) await notify(comment.authorId, userId, 'repost', comment, comment._id);
  } catch (error) { if (result.created) await UserChannelPost.deleteOne({ _id: result.post._id, ownerId: userId }); throw error; }
  return { ...result, comment: await serializeOne(id, userId) };
}

module.exports = { CommentError, canonicalThreadUrl, commentUrl, create, edit, remove, react, repost, thread, mine, getOne, threadCounts, requireActor };
