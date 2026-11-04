const express = require('express');
const mongoose = require('mongoose');
const Post = require('../model/Post');
const Community = require('../model/Community');
const User = require('../model/User');
const Comment = require('../model/Comment');
const auth = require('../middleware/authMiddleware');
const router = express.Router();
const optionalAuth = (req,res,next) => req.headers.authorization ? auth(req,res,next) : next();
const goodId = (req,res,next) => mongoose.isValidObjectId(req.params.id) ? next() : res.status(400).json({message:'Invalid post.'});
const safe = post => { const data = post.toObject(); const likesCount = (data.likedBy || []).length; delete data.likedBy; delete data.savedBy; return { ...data, likesCount }; };
const populate = query => query.populate('authorId','username fullname avatar');
router.get('/', optionalAuth, async (req,res) => {
  try {
    const filter = {};
    if (req.query.mine === 'true') { if(!req.user) return res.status(401).json({message:'Sign in to see your posts.'}); filter.authorId=req.user.id; }
    if(typeof req.query.communityId==='string') filter.communityId=req.query.communityId.slice(0,100);
    res.json((await populate(Post.find(filter).sort({createdAt:-1}).limit(100))).map(safe));
  } catch { res.status(500).json({message:'Posts could not be loaded.'}); }
});
router.post('/', auth, async (req,res) => {
  const {title='',content='',communityId='personal'}=req.body||{};
  if(typeof title!=='string'||title.trim().length<3||title.trim().length>180||typeof content!=='string'||content.trim().length<3||content.trim().length>6000||typeof communityId!=='string') return res.status(400).json({message:'Add a title (3–180 characters) and a message (3–6000 characters).'});
  try {
    if(communityId!=='personal') {
      if(!mongoose.isValidObjectId(communityId)) return res.status(400).json({message:'Choose one of your communities.'});
      const community=await Community.findById(communityId);
      if(!community||!community.members.includes(String(req.user.id))) return res.status(403).json({message:'Join the community before posting there.'});
      await require('../services/communityService').assertPostingRules(communityId,req.user.id);
    }
    const hashtags=Array.isArray(req.body.hashtags)?req.body.hashtags.filter(t=>typeof t==='string').slice(0,6).map(t=>t.replace(/^#+/,'').slice(0,35)):[];
    const post=await Post.create({authorId:req.user.id,title:title.trim(),content:content.trim(),description:content.trim().slice(0,500),communityId,hashtags});
    await post.populate('authorId','username fullname avatar');res.status(201).json(safe(post));
  } catch (error) { const status=error.status||500; res.status(status).json({message:status===500?'Your post could not be published.':error.message}); }
});
router.get('/:id',goodId,async(req,res)=>{try{const p=await populate(Post.findById(req.params.id));return p?res.json(safe(p)):res.status(404).json({message:'Post not found.'});}catch{res.status(500).json({message:'Post could not be loaded.'});}});
router.get('/:id/preview', goodId, async (req,res) => {
  try {
    const post = await populate(Post.findById(req.params.id));
    if (!post) return res.status(404).json({message:'Post not found.'});
    const comments = await Comment.find({postId:req.params.id}).sort({date:-1}).limit(100).populate('authorId','username fullname avatar');
    res.json({post:safe(post),comments});
  } catch { res.status(500).json({message:'Post preview could not be loaded.'}); }
});
for (const [method, operator] of [['post','$addToSet'],['delete','$pull']]) router[method]('/:postId/tags/:userId', auth, async (req,res) => {
  if (!mongoose.isValidObjectId(req.params.postId) || !mongoose.isValidObjectId(req.params.userId)) return res.status(400).json({message:'Choose a valid post and member.'});
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({message:'Post not found.'});
    if (String(post.authorId) !== String(req.user.id)) return res.status(403).json({message:'Only the author can edit post mentions.'});
    if (method === 'post' && !await User.exists({_id:req.params.userId})) return res.status(404).json({message:'Member not found.'});
    const updated = await populate(Post.findOneAndUpdate({_id:req.params.postId,authorId:req.user.id},{[operator]:{tags:req.params.userId}},{new:true}));
    return updated ? res.json(safe(updated)) : res.status(404).json({message:'Post not found.'});
  } catch { res.status(500).json({message:'Post mentions could not be updated.'}); }
});
router.delete('/:id',auth,goodId,async(req,res)=>{try{const p=await Post.findOneAndDelete({_id:req.params.id,authorId:req.user.id});return p?res.json({message:'Post removed.'}):res.status(404).json({message:'Your post was not found.'});}catch{res.status(500).json({message:'Post could not be removed.'});}});
for(const [action,operation] of [['like','$addToSet'],['unlike','$pull'],['save','$addToSet']]) router.post(`/:id/${action}`,auth,goodId,async(req,res)=>{try{const field=action==='save'?'savedBy':'likedBy';const p=await populate(Post.findByIdAndUpdate(req.params.id,{[operation]:{[field]:req.user.id}},{new:true}));return p?res.json(safe(p)):res.status(404).json({message:'Post not found.'});}catch{res.status(500).json({message:'Post action could not finish.'});}});
router.post('/:id/description',auth,goodId,async(req,res)=>{try{const p=await Post.findById(req.params.id);return p?res.json({description:p.description}):res.status(404).json({message:'Post not found.'});}catch{res.status(500).json({message:'Description unavailable.'});}});
module.exports = router;
