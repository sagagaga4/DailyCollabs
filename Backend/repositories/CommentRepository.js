// CommentRepository.js
const Comment = require('../model/Comment');

class CommentRepository {
  createComment = async (CommentData) => {
    try {
      const newComment = new Comment(CommentData);
      return await newComment.save();
    } catch (error) {
      throw new Error(`Failed to create a new Comment: ${error.message}`);
    }
  };

  getAllComments = async (filters) => {
    try {
      return await Comment.find(filters || {}).limit(50).sort({ date: -1 });
    } catch (error) {
      throw new Error(`Failed to fetch Comments: ${error.message}`);
    }
  };

  getCommentById = async (id) => {
    return await Comment.findById(id);
  };

  getCommentsByPostId = async (postId) => {
    return await Comment.find({ postId }).sort({ date: -1 });
  };

  getCommentByAuthorId = async (authorId) => {
    // search by exact authorId (ObjectId), or if you want partial, adjust accordingly
    return await Comment.find({ authorId });
  };

  findCommentByDate = async (date) => {
    // date should be a string or Date; here we look for exact day matches is more robust in real apps
    return await Comment.find({ date: { $regex: date, $options: 'i' } });
  };

  updateCommentContent = async (id, newContent) => {
    if (!newContent || newContent.length < 4) {
      throw new Error('Content must be at least 4 characters');
    }
    try {
      return await Comment.findByIdAndUpdate(id, { content: newContent }, { new: true });
    } catch (error) {
      throw new Error(`Can't update content: ${error.message}`);
    }
  };

  deleteComment = async (id) => {
    try {
      const deletedComment = await Comment.findByIdAndDelete(id);
      if (!deletedComment) throw new Error("Comment not found");
      return deletedComment;
    } catch (error) {
      throw new Error(`Can't delete Comment: ${error.message}`);
    }
  };
}

module.exports = CommentRepository;
