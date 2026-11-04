const mongoose = require('mongoose');
const attachmentSchema = new mongoose.Schema({
  type: { type: String, enum: ['article', 'video'], required: true },
  url: { type: String, required: true, maxlength: 2048 },
  title: { type: String, required: true, maxlength: 200 },
  image: { type: String, default: '', maxlength: 2048 },
  description: { type: String, default: '', maxlength: 500 },
  contentId: { type: mongoose.Schema.Types.ObjectId, default: null },
}, { _id: false });
const schema = new mongoose.Schema({
  communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'community', required: true },
  channelId: { type: String, required: true, default: 'general', maxlength: 32 },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  content: { type: String, trim: true, maxlength: 3000, default: '' },
  attachment: { type: attachmentSchema, default: null },
}, { timestamps: true });
schema.index({ communityId: 1, channelId: 1, _id: -1 });
module.exports = mongoose.model('communityMessage', schema, 'CommunityMessages');
