const express = require('express');
const Parser = require('rss-parser');
const ogs = require('open-graph-scraper');
const router = express.Router();

const parser = new Parser();

router.get('/', async (req, res) => {
  try {
    const feedUrl = req.query.url; 
    if (!feedUrl) {
      return res.status(400).json({ error: 'Missing RSS feed URL' });
    }

    const feed = await parser.parseURL(feedUrl);

    const normalized = await Promise.all(
      feed.items.map(async (item) => {
        let image =
          item.enclosure?.url || item['media:content']?.url || null;

        // If no image found, try Open Graph
        if (!image && item.link) {
          try {
            const { result } = await ogs({ url: item.link });
            image = result?.ogImage?.url || null;
          } catch {
            image = null;
          }
        }

        return {
          title: item.title || 'No title',
          link: item.link || '#',
          image,
          pubDate: item.pubDate || new Date().toISOString(),
          description:
            item.contentSnippet ||
            item.description ||
            'No description available',
        };
      })
    );

    res.json(normalized);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch RSS feed' });
  }
});

module.exports = router;
