const Community = require('../model/Community')
const Post =  require('../model/Post')
const { fetchFeed } = require('../services/rssService')

exports.createCommunity = async (req, res) => {
    try{
        const { name, rssUrls } = req.body
        const community = new Community({ name, rssUrls })
        await community.save()
        res.status(201).json(community)
    } catch (err) {
        res.status(500).send(err.message)
    }
}

exports.listCommunities = async (req, res) => {
    const items = await Community.find()
    res.json(items)
}

exports.getCommunityFeed = async (req, res) => {
    try {
        const { id } = req.params;
        const community = await Community.findById(id) || await Community.findOne({ name:id })
        if (!community) return res.status(404).send('Community not found')
    
    
    //Rss fetching all rssUrls
    const rssPromises = community.rssUrls.map(url => fetchFeed(url))
    const rssLists = await Promise.all(rssPromises)
    const rssItems = rssLists.flat()

    //Posts for community
    const posts = await Posts.find({ communityId: communityId.toString() }).lean()

    //Normalizing post to my Rss model  
    const normalizedPosts = posts.map(p =>  ({
        title: p.title || (p.content.length > 100 ? p.content.slice(0,100)  + '...' : p.content),
        link: null,
        postId: p._id,
        pubDate: p.date,
        description: p.content,
        source: 'user'
    }));
    
    const normalizedRss = rssItems.map(r => ({ ...r, source: 'rss' }))
    
    const merged = normalizedPosts.concat(normalizedPosts)
        .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))

    res.json(merged.slice(0, Number(req.query.limit || 50)))
    }catch (err) {
        console.error(err)
        res.status(500).send(err.message)
    }
}

