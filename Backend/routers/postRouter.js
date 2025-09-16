const express = require('express');
const postService = require('../services/postService');
const router = express.Router();

// GET all posts with optional filters
router.get("/", async (req, res) => {
  try {
    const filters = req.query;
    // Ensure description is included
    const posts = await postService.getAllPosts(filters);
    res.json(posts);
  } catch (error) {
    res.status(500).send(error.message || 'Failed to fetch posts');
  }
});

// GET a single post by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const post = await postService.getPostById(id);
    if (!post) return res.status(404).send('Post not found');
    res.json(post);
  } catch (error) {
    res.status(500).send(error.message || 'Failed to fetch post');
  }
});

// CREATE a new post
router.post("/", async (req, res) => {
  try {
    const postObj = req.body;
    const newPost = await postService.createPost(postObj);
    res.status(201).json(newPost);
  } catch (error) {
    res.status(500).send(error.message || 'Failed to create post');
  }
});

// DELETE a post by ID
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedPost = await postService.deletePost(id);
    if (!deletedPost) return res.status(404).send('Post not found');
    res.json(deletedPost);
  } catch (error) {
    res.status(500).send(error.message || 'Failed to delete post');
  }
});

// LIKE a post
router.post("/:id/like", async (req, res) => {
  try {
    const { id } = req.params;
    const updatedPost = await postService.likePost(id, req.user.id);
    res.json(updatedPost);
  } catch (error) {
    res.status(500).send(error.message || 'Failed to like post');
  }
});

// UNLIKE a post
router.post("/:id/unlike", async (req, res) => {
  try {
    const { id } = req.params;
    const updatedPost = await postService.unlikePost(id, req.user.id);
    res.json(updatedPost);
  } catch (error) {
    res.status(500).send(error.message || 'Failed to unlike post');
  }
});

// SAVE a post
router.post("/:id/save", async (req, res) => {
  try {
    const { id } = req.params;
    const updatedPost = await postService.savePost(id, req.user.id);
    res.json(updatedPost);
  } catch (error) {
    res.status(500).send(error.message || 'Failed to save post');
  }
});

// ADD a tag to a post
router.post("/:postId/tags/:userId", async (req, res) => {
  try {
    const { postId, userId } = req.params;
    const updatedPost = await postService.addTag(postId, userId);
    res.json(updatedPost);
  } catch (error) {
    res.status(500).send(error.message || 'Failed to add tag');
  }
});

// REMOVE a tag from a post
router.delete("/:postId/tags/:userId", async (req, res) => {
  try {
    const { postId, userId } = req.params;
    const updatedPost = await postService.removeTag(postId, userId);
    res.json(updatedPost);
  } catch (error) {
    res.status(500).send(error.message || 'Failed to remove tag');
  }
});

module.exports = router;
