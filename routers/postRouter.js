const express = require('express');
const postService = require('../services/postService');

const router = express.Router();

// Entry Point - "/posts"

router.get('/', async (req, res) => {
  try {
    const filters = req.query;
    const posts = await postService.getAllPosts(filters);
    res.json(posts);
  } catch (error) {
    res.status(500).send(error.message || 'Failed to fetch posts');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const post = await postService.getPostById(id);
    if (!post) return res.status(404).send('Post not found');
    res.json(post);
  } catch (error) {
    res.status(500).send(error.message || 'Failed to fetch post');
  }
});

router.post('/', async (req, res) => {
  try {
    const postObj = req.body;
    const newPost = await postService.createPost(postObj);
    res.status(201).send(`The new ID: ${newPost._id}`);
  } catch (error) {
    res.status(500).send(error.message || 'Failed to create post');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedPost = await postService.deletePost(id);
    if (!deletedPost) return res.status(404).send('Post not found');
    res.json(deletedPost);
  } catch (error) {
    res.status(500).send(error.message || 'Failed to delete post');
  }
});

router.post('/:postId/tags/:userId', async (req, res) => {
  try {
    const { postId, userId } = req.params;
    const updatedPost = await postService.addTag(postId, userId);
    res.json(updatedPost);
  } catch (error) {
    res.status(500).send(error.message || 'Failed to add tag');
  }
});

router.delete('/:postId/tags/:userId', async (req, res) => {
  try {
    const { postId, userId } = req.params;
    const updatedPost = await postService.removeTag(postId, userId);
    res.json(updatedPost);
  } catch (error) {
    res.status(500).send(error.message || 'Failed to remove tag');
  }
});

module.exports = router;
