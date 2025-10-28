// reactionsRouter.js
const express = require('express');
const reactionService = require('../services/reactionsService');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

//GET Toggle reaction (like/dislike)
router.post("/", auth, async (req, res) => {
  try {
    const { articleLink, type } = req.body;
    const userId = req.user.id;

    if (!["like", "dislike"].includes(type))
      return res.status(400).json({ error: "Invalid reaction type" });

    const result = await reactionService.toggleReaction(userId, articleLink, type);
    const count = await reactionService.getReactionCount(articleLink);

    res.json({ ...result, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET reaction count
router.get("/:articleLink/count", auth, async (req, res) => {
  try {
    const counts = await reactionService.getReactionCount(req.params.articleLink);
    res.json(counts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET current user's reaction
router.get("/:articleLink/my", auth, async (req, res) => {
  try {
    const type = await reactionService.getUserReaction(req.user.id, req.params.articleLink);
    res.json({ reaction: type });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
