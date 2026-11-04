const express = require('express');
const auth = require('../middleware/authMiddleware');
const service = require('../services/contentService');
const router = express.Router();
const route = (handler) => async (req, res) => {
  try { await handler(req, res); }
  catch (error) { res.status(error.status || (error.name === 'ValidationError' ? 400 : 500)).json({ message: error.status || error.name === 'ValidationError' ? error.message : 'Could not save this content. Please try again.' }); }
};
router.use(auth);
router.get('/channel', route(async (req, res) => res.json(await service.listChannel(req.user.id, req.query.page))));
router.post('/repost', route(async (req, res) => { const result = await service.repost(req.user.id, req.body); res.status(result.created ? 201 : 200).json(result); }));
router.delete('/channel/:id', route(async (req, res) => res.json(await service.removeRepost(req.user.id, req.params.id))));
router.post('/community', route(async (req, res) => res.status(201).json(await service.shareToCommunity(req.user.id, req.body))));
router.get('/communities/:id', route(async (req, res) => res.json(await service.listCommunityContent(req.user.id, req.params.id, req.query.channelId))));
module.exports = router;
