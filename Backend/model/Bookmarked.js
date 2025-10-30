const mongoose = require('mongoose')

const BookmarkedSchema = new mongoose.Schema(
    {
        userId: { 
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        articleLink: { 
            type: String,
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now 
        },
    }
);

const Bookmarked = mongoose.model('Bookmarked', BookmarkedSchema)
module.exports = Bookmarked