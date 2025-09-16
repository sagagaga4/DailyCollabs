const express = require('express');
const Parser = require('rss-parser');
const router = express.Router();

const parser = new Parser();

router.get('/', async (req, res) => {
  try {
    const feed = await parser.parseURL('https://techcrunch.com/feed/');
    res.json(feed.items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch RSS feed' });
  }
});

//FOR COMPUTER SCIENCE
//https://techcrunch.com/feed/
//https://www.theverge.com/rss/index.xml
//https://www.reddit.com/r/programming/.rss
//https://stackoverflow.blog/feed/
//http://export.arxiv.org/rss/cs

//FOR MUSIC PRODUCTION
//https://www.gearslutz.com/board/external.php?type=RSS2


module.exports = router;
