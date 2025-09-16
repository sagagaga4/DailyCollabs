const express = require('express');
const communityService = require('../services/communityService');
const ctrl = require('../controllers/communityController');
const auth = require('../middleware/authMiddleware');
const router = express.Router();

// Entry Point - "/communities"
// All CRUD activities

// Get all communities
router.get('/', async (req, res) => {
  try {
    const filters = req.query;
    const communities = await communityService.getAllCommunities(filters);
    res.json(communities);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get community by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const community = await communityService.getCommunityById(id);
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }
    res.json(community);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new community
router.post('/', async (req, res) => {
  try {
    const communityObj = req.body;
    const newCommunity = await communityService.createCommunity(communityObj);
    res.status(201).json({ id: newCommunity._id, message: 'Community created successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to create community' });
  }
});

// Delete a community
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedCommunity = await communityService.deleteCommunity(id);
    if (!deletedCommunity) {
      return res.status(404).json({ message: 'Community not found' });
    }
    res.json({ message: 'Community deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

// Get RSS news for desired community
router.get('/:id/rss', async (req, res) => {
  try {
    const { id } = req.params
    const feed = await communityService.getCommunityNews(id)
    res.json(feed)
  } catch (err) {
    res.status(500).json({ message: error.message || 'Failed to fetch RSS news '})  
  }
})