const express = require('express');
const mongoose = require('mongoose');
const userService = require('../services/userService');
const User = require('../model/User');
const authMiddleware = require('../middleware/authMiddleware');
const { safeProfile, updateProfile, validateProfilePatch } = require('../services/profileService');
const router = express.Router();

function sendError(res, error) {
  const status = error.code === 11000 ? 409 : (error.status || 500);
  return res.status(status).json({ message: error.code === 11000 ? 'That username is already taken.' : (status === 500 ? 'We could not save your changes. Please try again.' : error.message) });
}

router.post('/', async (req, res) => {
  try {
    const { fullname, username, email, password } = req.body;
    if ([fullname, username, email, password].some(value => typeof value !== 'string')) return res.status(400).send('Complete all account fields.');
    validateProfilePatch({ fullname, username });
    const newUser = await userService.createUser({ fullname: fullname.trim(), username: username.trim(), email: email.trim(), password });
    res.status(201).send(`The new ID: ${newUser._id}`);
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 400).send(error.message || 'Failed to create user');
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'Your account could not be found.' });
    res.json(safeProfile(user));
  } catch (error) { sendError(res, error); }
});

router.patch('/me', authMiddleware, async (req, res) => {
  try { res.json(await updateProfile(req.user.id, req.body)); }
  catch (error) { sendError(res, error); }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const query = {};
    if (typeof req.query.name === 'string' && req.query.name.trim()) {
      const escaped = req.query.name.trim().slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [{ fullname: new RegExp(escaped, 'i') }, { username: new RegExp(escaped, 'i') }];
    }
    const users = await User.find(query).select('fullname username bio avatar').limit(50);
    res.json(users.map(user => safeProfile(user, false)));
  } catch (error) { sendError(res, error); }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid user id.' });
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json(safeProfile(user, String(req.user.id) === String(user._id)));
  } catch (error) { sendError(res, error); }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (String(req.user.id) !== req.params.id) return res.status(403).json({ message: 'You can only change your own account.' });
    const deletedUser = await userService.deleteUser(req.params.id);
    res.json(safeProfile(deletedUser));
  } catch (error) { sendError(res, error); }
});

router.post('/:userId/join/:communityId', authMiddleware, async (req, res) => {
  try {
    if (String(req.user.id) !== req.params.userId) return res.status(403).json({ message: 'You can only change your own membership.' });
    const user = await userService.joinCommunity(req.params.userId, req.params.communityId, req.body || {});
    res.json(safeProfile(user));
  } catch (error) { sendError(res, error); }
});

router.get('/:userId/saved-posts', authMiddleware, async (req, res) => {
  try {
    if (String(req.user.id) !== req.params.userId) return res.status(403).json({ message: 'You can only view your own saved posts.' });
    if (typeof userService.getSavedPosts !== 'function') return res.json([]);
    res.json(await userService.getSavedPosts(req.params.userId));
  } catch (error) { sendError(res, error); }
});

module.exports = router;
