// routes/bookmarkedRouter.js
const express = require("express");
const bookmarkedService = require("../services/bookmarkedService");
const auth = require("../middleware/authMiddleware");

const router = express.Router();

// GET all bookmarks for logged user
router.get("/", auth, async (req, res) => {
  try {
    const userId = req.userId;
    const bookmarks = await bookmarkedService.getAllBookmarked(userId);
    res.json(bookmarks);
  } catch (error) {
    res.status(500).send(error.message || "Failed to fetch bookmarks");
  }
});

// CREATE a bookmark
router.post("/", auth, async (req, res) => {
  try {
    const { articleLink } = req.body;
    const userId = req.userId;
    const newBookmark = await bookmarkedService.createBookmark(userId, articleLink);
    res.status(201).json(newBookmark);
  } catch (error) {
    res.status(500).send(error.message || "Failed to create bookmark");
  }
});

// DELETE a bookmark
router.delete("/", auth, async (req, res) => {
  try {
    const { articleLink } = req.body;
    const userId = req.userId;
    const deleted = await bookmarkedService.deleteBookmark(userId, articleLink);
    res.json(deleted);
  } catch (error) {
    res.status(500).send(error.message || "Failed to delete bookmark");
  }
});

module.exports = router;
