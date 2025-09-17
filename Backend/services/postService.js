const PostRepository = require('../repositories/PostRepository')
const postRepo = new PostRepository()

const getAllPosts = (filters) => {
  if (!filters || !filters.date) {
    return postRepo.getAllPosts()
  }
  return postRepo.findPostByDate(filters.date)
}

const getPostById = (id) => {
  return postRepo.getPostById(id)
}

const createPost = (postData) => {
  return postRepo.createPost(postData)
}

const deletePost = (id) => {
  return postRepo.deletePost(id)
}

const getDescription = (postId) => {
  return postRepo.getPostDescription(postId);
}

const addTag = (postId, userId) => {
  return postRepo.addTag(postId, userId)
}

const removeTag = (postId, userId) => {
  return postRepo.removeTag(postId, userId)
}

module.exports = {
  getAllPosts,
  getPostById,
  createPost,
  deletePost,
  getDescription,
  addTag,
  removeTag,
};
