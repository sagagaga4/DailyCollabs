// routers/rssRouter.js
const express = require("express");
const Parser = require("rss-parser");
const ogs = require("open-graph-scraper");

const router = express.Router();
const parser = new Parser();

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

const feeds = [
  // Tech news
  "https://www.techradar.com/feeds.xml"
];

// --- GET /rss endpoint ---
router.get("/", async (req, res) => {
  try {
    let allItems = [];

    for (const feedUrl of feeds) {
      try {
        const feed = await parser.parseURL(feedUrl);

        const normalized = await Promise.all(
          feed.items.map(async (item) => {
            // Try enclosure/media first
            let image =
              item.enclosure?.url || item["media:content"]?.url || null;

            // If no image, try Open Graph
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
        console.error(`❌ Failed to load ${feedUrl}`, err.message);
      }
    }

    // Sort by date (newest first)
    allItems.sort(
      (a, b) => new Date(b.pubDate) - new Date(a.pubDate)
    );

    res.json(allItems);
  } catch (error) {
    console.error("RSS fetch error:", error.message);
    res.status(500).json({ error: "Failed to load feeds" });
  }
});

module.exports = router;
