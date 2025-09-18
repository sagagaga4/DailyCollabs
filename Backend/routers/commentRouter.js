// commentRouter.js
const express = require('express');
const commentService = require('../services/commentService');

const router = express.Router();

// Get all comments (with optional filters)
router.get('/', async (req, res) => {
  try {
    const filters = req.query;
    const comments = await commentService.getAllComments(filters);
    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get comment by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const comment = await commentService.getCommentById(id);
    if (!comment) return res.status(404).json({ message: 'comment not found' });
    res.json(comment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new comment
router.post('/', async (req, res) => {
  try {
    const { postId, content } = req.body;
    // NOTE: ensure req.user exists (authentication) or allow authorId via body for testing
    const authorId = (req.user && req.user.id) ? req.user.id : req.body.authorId;
    const newComment = await commentService.createComment({
      postId,
      content,
      authorId,
    });
    res.status(201).json(newComment);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to create comment' });
  }
});

// Get comments for a post
router.get('/post/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const comments = await commentService.getCommentByPost(postId);
    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update a comment
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const updated = await commentService.updateComment(id, content);
    if (!updated) return res.status(404).json({ message: 'comment not found or not updated' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete a comment
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedComment = await commentService.deleteComment(id);
    if (!deletedComment) return res.status(404).json({ message: 'comment not found' });
    res.json({ message: 'comment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
