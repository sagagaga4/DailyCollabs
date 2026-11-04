const mongoose = require('mongoose');

const MediaPostSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 140 },
  caption: { type: String, trim: true, maxlength: 500, default: '' },
  transcript: { type: String, trim: true, maxlength: 8000, default: '' },
  videoUrl: { type: String, required: true, maxlength: 2048 },
  provider: { type: String, enum: ['youtube', 'vimeo', 'file'], required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
}, { timestamps: true });
MediaPostSchema.index({ createdAt: -1 });

module.exports = mongoose.model('mediaPost', MediaPostSchema, 'MediaPosts');
