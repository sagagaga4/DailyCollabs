const CommentRepository = require('../repositories/CommentRepository');
const CommentsRepo = new CommentRepository();

const getAllComments = (filters) => {
  if (!filters || !filters.date) {
    return CommentsRepo.getAllComments();
  }
  return CommentsRepo.findCommentByDate(filters.date);
};

const getCommentById = (id) => {
  return CommentsRepo.getCommentById(id);
};

const createComment = (CommentsData) => {
  return CommentsRepo.createComment(CommentsData);
};

const deleteComment = (id) => {
  return CommentsRepo.deleteComment(id);
};

module.exports = {
  getAllComments,
  getCommentsById,
  createComment,
  deleteComment,
};
