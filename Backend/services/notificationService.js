const mongoose = require('mongoose');
const Notification = require('../model/Notification');
const { CommentError, requireActor } = require('./storyCommentService');
const unreadCount = (recipientId) => Notification.countDocuments({ recipientId, readAt: null });
async function list(userId, before) {
  await requireActor(userId);
  const filter = { recipientId: userId };
  if (before) { if (!mongoose.isObjectIdOrHexString(before)) throw new CommentError('Invalid notification cursor.'); filter._id = { $lt: new mongoose.Types.ObjectId(String(before)) }; }
  const [rows, unread] = await Promise.all([Notification.find(filter).sort({ _id: -1 }).limit(51).populate('actorId', 'username avatar').lean(), unreadCount(userId)]);
  return { notifications: rows.slice(0, 50).map((row) => ({ ...row, actor: row.actorId && typeof row.actorId === 'object' ? { _id: row.actorId._id, username: row.actorId.username || 'Former member', avatar: row.actorId.avatar || '' } : { username: 'Former member', avatar: '' }, actorId: undefined, recipientId: undefined, dedupeKey: undefined })), unreadCount: unread, hasMore: rows.length > 50, nextCursor: rows.length > 50 ? String(rows[49]._id) : null };
}
async function markRead(userId, id) {
  await requireActor(userId);
  if (!mongoose.isObjectIdOrHexString(id)) throw new CommentError('Notification not found.', 404);
  const notification = await Notification.findOneAndUpdate({ _id: id, recipientId: userId }, { $set: { readAt: new Date() } }, { new: true }).lean();
  if (!notification) throw new CommentError('Notification not found.', 404);
  return { id, readAt: notification.readAt, unreadCount: await unreadCount(userId) };
}
async function markAllRead(userId) {
  await requireActor(userId);
  const readAt = new Date();
  const result = await Notification.updateMany({ recipientId: userId, readAt: null, createdAt: { $lte: readAt } }, { $set: { readAt } });
  return { modifiedCount: result.modifiedCount, readAt, unreadCount: await unreadCount(userId) };
}
module.exports = { list, markRead, markAllRead };
