const express = require('express');
const reactionService = require('../services/reactionService.js');
import auth from "../middleware/auth.js";

const router = express.Router();

//GET Likes and Dislikes toggle
router.get("articleLink/type",auth,async (req,res) =>{ 
    try{
        const {articleLink, type} = req.params;
        const userId = req.user.id;

        if(!['like','dislike'].includes(type))
            return res.status(400).json({error: "Invalid reaction type"}); 

        const result = await reactionService.ToggleReaction(userId,articleLink,type)
        const count = await reactionService.getReactionCount(articleLink)

        res.json({...result,count})
    }
    catch(err){
        res.status(500).json({error: err.message})
    }
})

//GET reaction count
router.get("articleLink/count",auth,async(req,res) => {
    try{
        const counts = await reactionService.getReactionCount(req.params.articleLink);
        res.json(counts)
    }
    catch(err){
        res.status(500).json({ error: err.message });
    }
})

// Get user’s own reaction
router.get("/:articleLink/my", auth, async (req, res) => {
  try {
    const type = await service.getUserReaction(req.user.id, req.params.articleLink);
    res.json({ reaction: type });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;