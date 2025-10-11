// routers/rssRouter.js
const express = require("express");
const Parser = require("rss-parser");
const ogs = require("open-graph-scraper");
const axios = require("axios");

const router = express.Router();
const parser = new Parser();

// --- Helper to safely fetch Open Graph images ---
async function safeOGS(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const { result } = await ogs({
      url,
      fetchOptions: { signal: controller.signal },
    });

    clearTimeout(timeout);
    return result?.ogImage?.url || null;
  } catch {
    return null; // fallback if OGS fails
  }
}

// POST /rss endpoint
router.post("/", async (req, res) => {
  const { query } = req.body; // e.g. "Technology", "AI news", etc.

  if (!query) {
    return res.status(400).json({ error: "Query is required" });
  }

  try {
    //Ask the FastAPI AI service for relevant RSS URLs
    const aiResponse = await axios.post("http://127.0.0.1:5000/news-urls", { query });
    const feeds = aiResponse.data.urls || [];

    if (feeds.length === 0) {
      return res.status(404).json({ error: "No RSS feeds found from AI" });
    }

    //Parse RSS feeds and normalize their data
    let allItems = [];

    for (const feedUrl of feeds) {
      try {
        const feed = await parser.parseURL(feedUrl);

        const normalized = await Promise.all(
          feed.items.map(async (item) => {
            let image = item.enclosure?.url || item["media:content"]?.url || null;

            // If no image in the feed, try fetching Open Graph image
            if (!image) {
              image = await safeOGS(item.link);
            }

            return {
              title: item.title || "No title",
              link: item.link || "#",
              image,
              pubDate: item.pubDate || new Date().toISOString(),
              description:
                item.contentSnippet ||
                item.description ||
                "No description available",
            };
          })
        );

        allItems.push(...normalized);
      } catch (err) {
        console.error(`Failed to load ${feedUrl}:`, err.message);
      }
    }

    //Sort articles by date (newest first)
    allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    res.json(allItems);
  } catch (error) {
    console.error("RSS fetch error:", error.message);
    res.status(500).json({ error: "Failed to load feeds" });
  }
});

module.exports = router;
