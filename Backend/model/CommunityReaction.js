const mongoose = require('mongoose');
const { EMOJIS } = require('../utils/communityEmojis');
const schema = new mongoose.Schema({
  messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'communityMessage', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  emoji: { type: String, enum: EMOJIS, required: true },
});
schema.index({ messageId: 1, userId: 1, emoji: 1 }, { unique: true });
module.exports = mongoose.model('communityReaction', schema, 'CommunityReactions');
