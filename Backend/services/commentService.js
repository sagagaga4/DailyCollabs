// commentService.js
const CommentRepository = require('../repositories/CommentRepository');
const CommentsRepo = new CommentRepository();

const getAllComments = (filters) => {
  if (!filters || !filters.date) {
    return CommentsRepo.getAllComments();
  }
  return CommentsRepo.findCommentByDate(filters.date);
}

const getCommentById = (id) => {
  return CommentsRepo.getCommentById(id);
}

const createComment = (CommentsData) => {
  return CommentsRepo.createComment(CommentsData);
}

const updateComment = (id, content) => {
  return CommentsRepo.updateCommentContent(id, content);
}

const deleteComment = (id) => {
  return CommentsRepo.deleteComment(id);
}

const getCommentByPost = (postId) => {
  return CommentsRepo.getCommentsByPostId(postId);
}

module.exports = {
  getAllComments,
  getCommentById,
  createComment,
  updateComment,
  deleteComment,
  getCommentByPost,
};
