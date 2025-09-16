const Post = require('../models/Post');

exports.createPost = async (req, res) => {
  try {
    const { content, communityId } = req.body;

    // extract hashtags from content like "#coding"
    const hashtags = content.match(/#\w+/g) || [];

    const newPost = new Post({
      authorId: req.user.id, 
      communityId: communityId || 'default-community',
      content,
      hashtags,
    });

    await newPost.save();
    res.status(201).json(newPost);
  } catch (error) {
    console.error('Failed to create post:', error);
    res.status(500).json({ error: 'Failed to create a new post' });
  }
};
