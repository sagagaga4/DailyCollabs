const mongoose = require('mongoose');
const storyCommentSchema = new mongoose.Schema({
  threadUrl: { type: String, required: true, maxlength: 2048 },
  title: { type: String, required: true, maxlength: 300 },
  contentType: { type: String, enum: ['article', 'video'], default: 'article' },
  text: { type: String, required: true, maxlength: 2000 },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'storyComment', default: null },
  edited: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });
storyCommentSchema.index({ threadUrl: 1, _id: -1 });
storyCommentSchema.index({ authorId: 1, deletedAt: 1, _id: -1 });
module.exports = mongoose.model('storyComment', storyCommentSchema, 'StoryComments');
