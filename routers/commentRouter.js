const express = require('express');
const commentService = require('../services/commentService');

const router = express.Router();

// Entry Point - "/communities"
// All CRUD activities
// Get all communities

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
    if (!comment) {
      return res.status(404).json({ message: 'comment not found' });
    }
    res.json(comment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new comment
router.post('/', async (req, res) => {
  try {
    const commentObj = req.body;
    const newcomment = await commentService.createComment(commentObj);
    res.status(201).json({ id: newcomment._id, message: 'comment created successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to create comment' });
  }
});

// Delete a comment
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedcomment = await commentService.deleteComment(id);
    if (!deletedcomment) {
      return res.status(404).json({ message: 'comment not found' });
    }
    res.json({ message: 'comment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
