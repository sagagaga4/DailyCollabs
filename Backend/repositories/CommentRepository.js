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

  getCommentByAuthorId = async (authorId) => {
    return await Comment.find({ AuthorID: { $regex: authorId, $options: 'i' } });
  };

  findCommentByDate = async (date) => {
    return await Comment.find({ Date: { $regex: date, $options: 'i' } });
  };

  updateCommentContent = async (id, newContent) => {
    if (newContent.length < 4) {
      throw new Error('Content must be at least 4 characters');
    }
    try {
      return await Comment.findByIdAndUpdate(
        id,
        { content: newContent },
        { new: true }
      );
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
