const express = require('express');
const { createVideoSearch } = require('../services/videoSearchService');
const router = express.Router();
const searchVideos = createVideoSearch();
const limits = new Map();
router.get('/', async (req, res) => {
  const address = req.ip || 'local'; const now = Date.now();
  let entry = limits.get(address);
  if (!entry || entry.until < now) { entry = { count: 0, until: now + 60000 }; limits.set(address, entry); }
  if (limits.size > 1000) for (const [key, value] of limits) if (value.until < now) limits.delete(key);
  if (++entry.count > 30) { res.set('Retry-After', String(Math.max(1, Math.ceil((entry.until - now) / 1000)))); return res.status(429).json({ message: 'A lot of searches are happening. Please try again in a moment.' }); }
  try { res.set('Cache-Control', 'no-store'); res.json(await searchVideos(req.query.q)); }
  catch (error) { res.status(error.status || 500).json({ message: error.status ? error.message : 'Video search could not finish.' }); }
});
module.exports = router;
