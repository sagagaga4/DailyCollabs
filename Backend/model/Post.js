const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  communityId: { type: String, required: true },
  title: { type: String, required: false },
  content: { type: String, required: true },

  description: {type: String, required: true},

  date: { type: Date, default: Date.now },
  tags: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
  hashtags: [{ type: String }],
  likesCount: { type: Number, default: 0 },
  dislikesCount: { type: Number, default: 0 },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
  savedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
}, { timestamps: true });

module.exports = mongoose.model('Post', postSchema, 'posts');
