const Post = require('../model/Post')

exports.createPost = async (req, res) => {
    try{
        const { content, title, communityId } = req.body
        
        const hashtags = (content.match(/#[]\w]+/g) || []).map(h => h.toLowerCase())
        const newPost = new Post({
            authorId: req.user.id,
            title,
            content,
            hashtags
        })
        await newPost.save();
        res.status(201).json(newPost)
    }   catch (err) {
        console.error(err)
        res.status(500).send(err.message)
    }
}

exports.likePost = async (req, res) => {
    try {
        const { id } = req.params
        const userId = req.user.id
        const post = await Post.findById(id)
        if (!post) return res.status(404).send('Post not found')
        
        if (post.likedBy.includes(userId))  {
            post.likedBy.pull(userId)
            post.likesCount = Math.max(0, post.likesCount - 1)
        } else {
            post.likedBy.push(userId)
            post.likedCount += 1
        }
        await post.save()
        res.json({ likesCount: post.likesCount, likedBy: post.likedBy })
    } catch (err) {
        res.status(500).send(err.message)
    }
}

exports.savePost = async (req, res) => {
    try{    
        const { id } = req.params
        const userId = req.user.id
        const post = await Post.findById(id)
        if (!post) return res.status(404).send('Post not found')
       
        if (post.savedBy.includes(userId)){
            post.savedBy.pull(userId)
        } else {
            post.savedBy.push(userId)
        }
        await post.save()
        req.json({savedBy: post.savedBy})
    } catch (err) {
        res.status(500).send(err.message)
    }
}