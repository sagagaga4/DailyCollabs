const express = require('express');
const service = require('../services/communityService');
const auth = require('../middleware/authMiddleware');
const router = express.Router();
const optionalAuth = (req, res, next) => req.headers.authorization ? auth(req, res, next) : next();
const route = handler => async (req, res) => {
  try { await handler(req, res); }
  catch (error) {
    const status = error.status || (error.name === 'ValidationError' ? 400 : 500);
    if (status === 500) console.error('Community request failed:', error.message);
    res.status(status).json({ message: status === 500 ? 'Something went wrong. Please try again.' : error.message });
  }
};

router.get('/', optionalAuth, route(async (req, res) => res.json(await service.getAllCommunities(req.query, req.user?.id))));
router.post('/', auth, route(async (req, res) => res.status(201).json(await service.createCommunity(req.body, req.user.id))));
router.get('/:id', optionalAuth, route(async (req, res) => res.json(await service.getCommunityById(req.params.id, req.user?.id))));
router.post('/:id/join', auth, route(async (req, res) => res.json(await service.addMember(req.params.id, req.user.id, req.body?.inviteToken, req.body || {}))));
router.delete('/:id/membership', auth, route(async (req, res) => res.json(await service.removeMember(req.params.id, req.user.id))));
router.post('/:id/invite', auth, route(async (req, res) => res.json(await service.getInvite(req.params.id, req.user.id))));
router.post('/:id/discussions', auth, route(async (req, res) => res.status(201).json(await service.createDiscussion(req.params.id, req.user.id, req.body))));
router.delete('/:id', auth, route(async (req, res) => res.json(await service.deleteCommunity(req.params.id, req.user.id))));

router.get('/:id/channels', optionalAuth, route(async (req, res) => {
  const board = await service.getCommunityById(req.params.id, req.user?.id);
  res.json({ channels: board.channels, defaultChannelId: 'general' });
}));
router.post('/:id/channels', auth, route(async (req, res) => res.status(201).json(await service.createChannel(req.params.id, req.user.id, req.body))));
router.patch('/:id/channels/:channelId', auth, route(async (req, res) => res.json(await service.editChannel(req.params.id, req.params.channelId, req.user.id, req.body))));
router.patch('/:id/rules', auth, route(async (req, res) => res.json(await service.editRules(req.params.id, req.user.id, req.body))));
router.get('/:id/members', auth, route(async (req, res) => res.json(await service.getMembers(req.params.id, req.user.id))));
router.get('/:id/channels/:channelId/messages', optionalAuth, route(async (req, res) => res.json(await service.getChannelMessages(req.params.id, req.params.channelId, req.user?.id, req.query.before))));
router.post('/:id/channels/:channelId/messages', auth, route(async (req, res) => res.status(201).json(await service.createChannelMessage(req.params.id, req.user.id, req.params.channelId, req.body))));
router.post('/:id/messages/:messageId/reactions', auth, route(async (req, res) => res.json(await service.toggleMessageReaction(req.params.id, req.params.messageId, req.user.id, req.body?.emoji))));

router.get('/:id/feed', optionalAuth, route(async (req, res) => {
  const community = await service.getCommunityById(req.params.id, req.user?.id);
  res.json(community.discussions.map(item => ({ ...item, description: item.content, pubDate: item.createdAt, source: item.isDemo ? 'demo' : 'user' })));
}));
module.exports = router;
