const Post = require('../model/Post');

class PostRepository {

  createPost = async (postData) => {
    try {
      const newPost = new Post(postData);
      return await newPost.save();
    } catch (error) {
      throw new Error(`Failed to create a new post: ${error.message}`);
    }
  };

  getAllPosts = async (filters) => {
    try {
      return await Post.find(filters || {});
    } catch (error) {
      throw new Error(`Failed to fetch posts: ${error.message}`);
    }
  };

  getPostById = async (id) => {
    return await Post.findById(id);
  };

  getPostByAuthorId = async (authorId) => {
    return await Post.find({ AuthorID: { $regex: authorId, $options: 'i' } });
  };

  getPostByCommunityId = async (communityId) => {
    return await Post.find({ communityID: { $regex: communityId, $options: 'i' } });
  };

  findPostByDate = async (date) => {
    return await Post.find({ Date: { $regex: date, $options: 'i' } });
  };

  updatePostContent = async (id, newContent) => {
    if (newContent.length < 4) {
      throw new Error('Content must be at least 4 characters');
    }
    try {
      return await Post.findByIdAndUpdate(
        id,
        { content: newContent },
        { new: true }
      );
    } catch (error) {
      throw new Error(`Can't update content: ${error.message}`);
    }
  };

  addTag = async (postId, userId) => {
    try {
      const updatedPost = await Post.findByIdAndUpdate(
        postId,
        { $addToSet: { tags: userId } },
        { new: true }
      ).populate('tags');
      if (!updatedPost) throw new Error("Post not found");
      return updatedPost;
    } catch (error) {
      throw new Error(`Can't add tag: ${error.message}`);
    }
  };

  getPostDescription = async (postId) => {
    try{
      const post = await Post.findById(postId)
      if(!post) throw new Error("Post not found")
      return post.description
    } catch (error) {
      throw new Error ('Cant fetch description')
    } 
  }

  removeTag = async (postId, userId) => {
    try {
      const updatedPost = await Post.findByIdAndUpdate(
        postId,
        { $pull: { tags: userId } },
        { new: true }
      ).populate('tags');
      if (!updatedPost) throw new Error("Post not found");
      return updatedPost;
    } catch (error) {
      throw new Error(`Can't remove tag: ${error.message}`);
    }
  };

  deletePost = async (id) => {
    try {
      const deletedPost = await Post.findByIdAndDelete(id);
      if (!deletedPost) throw new Error("Post not found");
      return deletedPost;
    } catch (error) {
      throw new Error(`Can't delete post: ${error.message}`);
    }
  };
}

module.exports = PostRepository;
