const Parser = require('rss-parser')
const parser = new Parser()

async function fetchFeed(url)  {
    try{
        const feed = await parser.parseURL(url)

        return feed.items.map(items => ({
            title: items.title,
            link: items.link,
            pubDate: items.pubDate ? new Date(items.pubDate) : new Date(),
            description: item.contentSnippet || item.content || ''
        }))
    }  catch (err) {
        console.error('Failed to fetch RSS',url, err.message)
        return[];
    }
}
module.exports = { fetchFeed }