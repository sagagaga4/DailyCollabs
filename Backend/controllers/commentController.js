const comment = require('../model/Comment')

exports.addcomment = async (req, res) => {
    try {
        const { postId } = req.params
        const { content } = req.body 
        const comment = new Comment({ postId, authorId: req.user.id, content })
        await comment.save()
        res.status(201).json(comment)
    } catch (err) {
        res.status(500).json(err.message)
    }   
}

exports.getComments = async (req, res) => {
    const { postId } = req.params
    const comments = await Comment.find({ postId }).populate('authorId', 'username').sort({ date: -1 }) 
    res.json(comments)
}