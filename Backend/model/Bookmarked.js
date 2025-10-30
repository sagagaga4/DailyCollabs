import mongoose from "mongoose";

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

export default mongoose.model("Bookmarked", BookmarkedSchema);
