const express = require('express');
const Tag = require('../model/Tags');
const auth = require('../middleware/authMiddleware');
const { invalidateProfile } = require('../services/feedService');
const router = express.Router();
router.use(auth);
function topic(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 80 || /[\u0000-\u001f\u007f]/.test(value)) {
    const error = new Error('Choose a topic of 1–80 characters.'); error.status = 400; throw error;
  }
  const tagName = value.normalize('NFKC').trim();
  return { tagName, normalizedName: tagName.toLocaleLowerCase() };
}
const handle = action => async (req, res) => {
  try { await action(req, res); }
  catch (error) { res.status(error.status || (error.code === 11000 ? 409 : 500)).json({ message: error.status ? error.message : error.code === 11000 ? 'This topic is already saved.' : 'Your topics could not be updated.' }); }
};
router.get('/', handle(async (req, res) => {
  res.json(await Tag.find({ ownerId: req.user.id }).select('tagName').sort({ _id: 1 }).limit(12).lean());
}));
router.post('/', handle(async (req, res) => {
  const values = topic(req.body.tagName);
  const filter = { ownerId: req.user.id, normalizedName: values.normalizedName };
  const existing = await Tag.findOne(filter).select('tagName').lean();
  if (existing) return res.json(existing);
  if (await Tag.countDocuments({ ownerId: req.user.id }) >= 12) return res.status(400).json({ message: 'You can save up to 12 topics.' });
  const saved = await Tag.findOneAndUpdate(filter, { $setOnInsert: { ...values, ownerId: req.user.id } }, { upsert: true, new: true, runValidators: true });
  invalidateProfile(req.user.id);
  res.status(201).json({ _id: saved._id, tagName: saved.tagName });
}));
router.delete('/:name', handle(async (req, res) => {
  const { normalizedName } = topic(req.params.name);
  const removed = await Tag.findOneAndDelete({ ownerId: req.user.id, normalizedName });
  if (!removed) return res.status(404).json({ message: 'This topic is not in your collection.' });
  invalidateProfile(req.user.id);
  res.json({ message: 'Topic removed.' });
}));
module.exports = router;
