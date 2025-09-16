const mongoose = require('mongoose')

const CommentSchema = new mongoose.Schema(
    {
        authorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user', // reference to User model
        required: true,
        },
        postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'post', // reference to Post model
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
    },
);

const Comment = mongoose.model('comment', CommentSchema,'Comments')
module.exports = Comment