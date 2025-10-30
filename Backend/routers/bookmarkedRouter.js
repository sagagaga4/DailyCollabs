// routes/bookmarkedRouter.js
const express = require("express");
const bookmarkedService = require("../services/bookmarkedService");
const auth = require("../middleware/authMiddleware");

const router = express.Router();

// GET all bookmarks for logged user
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const bookmarks = await bookmarkedService.getAllBookmarked(userId);

    // Get article links
    const links = bookmarks.map(b => b.articleLink);

    // Fetch all RSS articles
    const rssResponse = await fetch("http://localhost:4000/rss");
    const allArticles = await rssResponse.json();

    // Filter articles that match the saved links
    const bookmarkedArticles = allArticles.filter(article => links.includes(article.link));

    res.json(bookmarkedArticles);
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to fetch bookmarked articles");
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
