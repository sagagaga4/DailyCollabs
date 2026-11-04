const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  commentId: { type: mongoose.Schema.Types.ObjectId, ref: 'storyComment', required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  operationId: { type: String, default: null },
  type: { type: String, enum: ['like', 'dislike', null], default: null },
}, { timestamps: true });
schema.index({ commentId: 1, actorId: 1 }, { unique: true });
module.exports = mongoose.model('storyCommentReaction', schema, 'StoryCommentReactions');
