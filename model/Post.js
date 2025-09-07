const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user', // reference to User model
      required: true,
    },
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'community', // reference to Community model
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user', // list of tagged users
      },
    ],
    hashtags: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const Post = mongoose.model('post', postSchema, 'posts');
module.exports = Post;
