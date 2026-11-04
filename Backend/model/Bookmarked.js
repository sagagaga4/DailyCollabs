const mongoose = require('mongoose')

const BookmarkedSchema = new mongoose.Schema(
    {
        userId: { 
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: true,
        },
        articleLink: { 
            type: String,
            required: true
        },
        title: { type: String, default: '', maxlength: 250 },
        description: { type: String, default: '', maxlength: 1200 },
        image: { type: String, default: '', maxlength: 2048 },
        pubDate: { type: String, default: '' },
        type: { type: String, enum: ['article', 'video'], default: 'article' },
        createdAt: {
            type: Date,
            default: Date.now 
        },
    }
);

const Bookmarked = mongoose.model('Bookmarked', BookmarkedSchema)
module.exports = Bookmarked
