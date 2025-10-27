// routers/rssRouter.js
const express = require("express");
const Parser = require("rss-parser");
const ogs = require("open-graph-scraper");
const axios = require("axios");

const router = express.Router();

// Configure parser to handle custom fields including media content
const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media:content'],
      ['media:thumbnail', 'media:thumbnail'],
      ['enclosure', 'enclosure']
    ]
  }
});

// --- Helper to safely fetch Open Graph images ---
async function safeOGS(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const { result } = await ogs({
      url,
      fetchOptions: { signal: controller.signal },
    });

    clearTimeout(timeout);
    return result?.ogImage?.url || null;
  } catch {
    return null;
  }
}

// Helper function to extract image from item
function extractImage(item) {
  // Try media:content first (with $ for attributes)
  if (item['media:content'] && item['media:content'].$) {
    return item['media:content'].$.url;
  }
  
  // Try array format
  if (Array.isArray(item['media:content']) && item['media:content'][0]) {
    if (item['media:content'][0].$) {
      return item['media:content'][0].$.url;
    }
    if (item['media:content'][0].url) {
      return item['media:content'][0].url;
    }
  }
  
  // Try media:thumbnail
  if (item['media:thumbnail'] && item['media:thumbnail'].$) {
    return item['media:thumbnail'].$.url;
  }
  
  // Try enclosure
  if (item.enclosure && item.enclosure.url) {
    return item.enclosure.url;
  }
  
  // Try contentSnippet for embedded images (backup)
  if (item.content) {
    const imgMatch = item.content.match(/<img[^>]+src="([^">]+)"/);
    if (imgMatch) return imgMatch[1];
  }
  
  return null;
}

// GET /rss endpoint (original code without extractImage)
router.get("/", async (req, res) => {
  try {
    const defaultFeeds = [
      "https://www.techradar.com/feeds.xml",
    ];

    const Parser = require("rss-parser");
    const parser = new Parser();
    let allItems = [];

    for (const feedUrl of defaultFeeds) {
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

    allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    res.json(allItems);
  } catch (error) {
    console.error("Default RSS fetch error:", error.message);
    res.status(500).json({ error: "Failed to load default feeds" });
  }
});

// POST /rss endpoint
router.post("/", async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: "Query is required" });
  }

  try {
    // Ask the FastAPI AI service for relevant RSS URLs
    const aiResponse = await axios.post("http://127.0.0.1:5000/news-urls", { query });
    const feeds = aiResponse.data.urls || [];

    if (feeds.length === 0) {
      return res.status(404).json({ error: "No RSS feeds found from AI" });
    }

    let allItems = [];

    for (const feedUrl of feeds) {
      try {
        const feed = await parser.parseURL(feedUrl);

        const normalized = await Promise.all(
          feed.items.map(async (item) => {
            // First try to get image from feed
            let image = extractImage(item);

            // If no image in the feed use this default
            if (!image && item.link) {
              image = "https://cdn.esahubble.org/archives/images/screen/heic0715a.jpg";
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

    // Sort articles by date (newest first)
    allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    res.json(allItems);
  } catch (error) {
    console.error("RSS fetch error:", error.message);
    res.status(500).json({ error: "Failed to load feeds" });
  }
});

module.exports = router;