const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/authMiddleware');
const MediaPost = require('../model/MediaPost');
const User = require('../model/User');
const { validateMediaInput } = require('../utils/media');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, Math.min(1000, parseInt(req.query.page, 10) || 1));
    const pageSize = 12;
    const posts = await MediaPost.find().sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize + 1).populate('author', 'username fullname avatar').lean();
    res.json({ posts: posts.slice(0, pageSize), page, hasMore: posts.length > pageSize });
  } catch {
    res.status(500).json({ message: 'Could not load videos. Please try again.' });
  }
});

router.post('/', auth, async (req, res) => {
  const checked = validateMediaInput(req.body);
  if (checked.error) return res.status(400).json({ message: checked.error });
  try {
    if (!await User.exists({ _id: req.user.id })) return res.status(401).json({ message: 'Please sign in again.' });
    const post = await MediaPost.create({ ...checked.value, author: req.user.id });
    await post.populate('author', 'username fullname avatar');
    res.status(201).json(post);
  } catch {
    res.status(500).json({ message: 'Could not share this video. Please try again.' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid video ID.' });
  try {
    const post = await MediaPost.findOneAndDelete({ _id: req.params.id, author: req.user.id });
    if (!post) return res.status(404).json({ message: 'Video not found or you do not own it.' });
    res.json({ message: 'Video removed.' });
  } catch {
    res.status(500).json({ message: 'Could not remove this video.' });
  }
});

module.exports = router;
