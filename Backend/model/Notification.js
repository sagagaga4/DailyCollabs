const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  type: { type: String, enum: ['like', 'dislike', 'reply', 'repost'], required: true },
  commentId: { type: mongoose.Schema.Types.ObjectId, ref: 'storyComment', required: true },
  targetCommentId: { type: mongoose.Schema.Types.ObjectId, ref: 'storyComment', required: true },
  threadUrl: { type: String, required: true, maxlength: 2048 },
  title: { type: String, required: true, maxlength: 300 },
  excerpt: { type: String, default: '', maxlength: 200 },
  dedupeKey: { type: String, required: true, maxlength: 200 },
  readAt: { type: Date, default: null },
}, { timestamps: true });
schema.index({ recipientId: 1, dedupeKey: 1 }, { unique: true });
schema.index({ recipientId: 1, _id: -1 });
schema.index({ recipientId: 1, readAt: 1 });
module.exports = mongoose.model('notification', schema, 'Notifications');
