const mongoose = require('mongoose')

const reactionsSchema = new mongoose.Schema(
    {
        userId: { 
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        articleLink: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            enum: ["like", "dislike"],
            required: true,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
        }
);

//Unable same user duplicates
reactionsSchema.index({ articleLink: 1, userId: 1 }, { unique: true });

const Reactions = mongoose.model('reaction', reactionsSchema)
module.exports = Reactions