// TagRouter.js
const express = require('express');
const tagService = require('../services/tagService');

const router = express.Router();

//GET all tags
router.get('/', async (req, res) => {
    try {
        const tags = await tagService.getAllTags(req.query);
        res.json(tags);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

//CREATE a new tag 
router.post('/', async (req, res) => {
    try {
        const { tagName } = req.body;
        const newTag = await tagService.addTag(tagName);
        return res.status(201).json(newTag);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


//DELETE a tag
router.delete('/:name', async (req, res) => {
    try {
        const removedTag = await tagService.removedTag(req.params.name);
        if(!removedTag) return res.status(404).json({message:'tag not found'});
        res.json({ message: 'tag deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
    });

module.exports = router;
