const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
  type: { type: String, enum: ['article', 'video'], required: true },
  url: { type: String, required: true, maxlength: 2048 },
  title: { type: String, required: true, maxlength: 200 },
  image: { type: String, default: '', maxlength: 2048 },
  description: { type: String, default: '', maxlength: 1200 },
}, { _id: false });

const sharedContentSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'community', required: true },
  channelId: { type: String, required: true, default: 'general', maxlength: 80 },
  content: { type: contentSchema, required: true },
  note: { type: String, default: '', maxlength: 1200 },
}, { timestamps: true });
sharedContentSchema.index({ communityId: 1, channelId: 1, createdAt: -1 });
sharedContentSchema.index({ actorId: 1, communityId: 1, channelId: 1, 'content.url': 1 }, { unique: true });

module.exports = mongoose.model('sharedContent', sharedContentSchema, 'SharedContent');
module.exports.contentSchema = contentSchema;
