import mongoose from "mongoose";

const BookmarkedSchema = new mongoose.Schema(
    {
        articleLink: { type: String, required: true },
        title: String,
        description: String,
        image: String,
        createdAt: { type: Date, default: Date.now },
    }
);

export default mongoose.model("Bookmarked", BookmarkedSchema);
