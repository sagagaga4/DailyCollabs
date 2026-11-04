const express = require('express');
const Bookmarked = require('../model/Bookmarked');
const auth = require('../middleware/authMiddleware');
const {invalidateProfile}=require('../services/feedService');
const router = express.Router();
router.use(auth);
function input(body) {
  const link = body.articleLink || body.link;
  let url; try { url = new URL(link); } catch { return null; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.href.length > 2048) return null;
  const text = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
  let image = '';
  try { const candidate = new URL(text(body.image, 2048)); if (['http:', 'https:'].includes(candidate.protocol) && !candidate.username && !candidate.password) image = candidate.href; } catch { /* Optional image may be absent. */ }
  return { articleLink: url.href, title: text(body.title, 250), description: text(body.description, 1200), image, pubDate: text(body.pubDate, 100), type: body.type === 'video' ? 'video' : 'article' };
}
const serialize = item => ({ ...item.toObject(), link: item.articleLink });
router.get('/', async (req, res) => {
  try { res.json((await Bookmarked.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(500)).map(serialize)); }
  catch { res.status(500).json({ message: 'Your saved stories could not be loaded.' }); }
});
router.post('/', async (req, res) => {
  const value = input(req.body || {});
  if (!value) return res.status(400).json({ message: 'Save a valid HTTP or HTTPS story link.' });
  try {
    const bookmark = await Bookmarked.findOneAndUpdate({ userId: req.user.id, articleLink: value.articleLink }, { $set: value, $setOnInsert: { userId: req.user.id } }, { upsert: true, new: true, runValidators: true });
    invalidateProfile(req.user.id);
    res.status(201).json(serialize(bookmark));
  } catch { res.status(500).json({ message: 'This story could not be saved. Please try again.' }); }
});
router.delete('/', async (req, res) => {
  const value = input(req.body || {});
  if (!value) return res.status(400).json({ message: 'Choose a valid saved link.' });
  try { await Bookmarked.deleteMany({ userId: req.user.id, articleLink: value.articleLink }); invalidateProfile(req.user.id); res.json({ message: 'Removed from bookmarks.' }); }
  catch { res.status(500).json({ message: 'The saved story could not be removed.' }); }
});
module.exports = router;
