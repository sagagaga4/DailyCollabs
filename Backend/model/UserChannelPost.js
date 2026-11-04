const mongoose = require('mongoose');
const { contentSchema } = require('./SharedContent');
const userChannelPostSchema = new mongoose.Schema({
  sourceCommentId: { type: mongoose.Schema.Types.ObjectId, ref: 'storyComment', default: null, index: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  content: { type: contentSchema, required: true },
  note: { type: String, default: '', maxlength: 1200 },
}, { timestamps: true });
userChannelPostSchema.index({ ownerId: 1, createdAt: -1 });
userChannelPostSchema.index({ ownerId: 1, 'content.url': 1 }, { unique: true });
module.exports = mongoose.model('userChannelPost', userChannelPostSchema, 'UserChannelPosts');
