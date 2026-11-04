// Compatibility routes for legacy post comments. Mutations always use the JWT author.
const express=require('express');const mongoose=require('mongoose');const auth=require('../middleware/authMiddleware');
const Comment=require('../model/Comment');const Post=require('../model/Post');const User=require('../model/User');
const router=express.Router();
const route=handler=>async(req,res)=>{try{await handler(req,res);}catch{res.status(500).json({message:'The comment request could not finish.'});}};
const goodId=(value)=>mongoose.isObjectIdOrHexString(value);
function checkedContent(body){const content=body?.content;return typeof content==='string'&&content.trim().length>0&&content.trim().length<=2000?content.trim():null;}
async function actorExists(req,res){if(!goodId(req.user?.id)||!await User.exists({_id:req.user.id})){res.status(401).json({message:'Please sign in again.'});return false;}return true;}
router.get('/',route(async(req,res)=>{const filter={};for(const key of ['postId','authorId'])if(req.query[key]){if(!goodId(req.query[key]))return res.status(400).json({message:'Choose a valid post or author.'});filter[key]=req.query[key];}res.json(await Comment.find(filter).sort({date:-1}).limit(50));}));
router.get('/post/:postId',route(async(req,res)=>{if(!goodId(req.params.postId))return res.status(400).json({message:'Choose a valid post.'});res.json(await Comment.find({postId:req.params.postId}).sort({date:-1}).limit(100));}));
router.get('/:id',route(async(req,res)=>{if(!goodId(req.params.id))return res.status(400).json({message:'Choose a valid comment.'});const comment=await Comment.findById(req.params.id);return comment?res.json(comment):res.status(404).json({message:'Comment not found.'});}));
router.post('/',auth,route(async(req,res)=>{
 if(!await actorExists(req,res))return;const content=checkedContent(req.body);if(!content||!goodId(req.body?.postId))return res.status(400).json({message:'Choose a post and write a comment of 1–2000 characters.'});
 if(!await Post.exists({_id:req.body.postId}))return res.status(404).json({message:'Post not found.'});
 const created=await Comment.create({postId:req.body.postId,content,authorId:req.user.id});res.status(201).json(created);
}));
router.put('/:id',auth,route(async(req,res)=>{if(!await actorExists(req,res))return;const content=checkedContent(req.body);if(!content||!goodId(req.params.id))return res.status(400).json({message:'Choose a comment and write 1–2000 characters.'});const updated=await Comment.findOneAndUpdate({_id:req.params.id,authorId:req.user.id},{$set:{content}},{new:true,runValidators:true});return updated?res.json(updated):res.status(403).json({message:'Only your own comments can be edited.'});}));
router.delete('/:id',auth,route(async(req,res)=>{if(!await actorExists(req,res))return;if(!goodId(req.params.id))return res.status(400).json({message:'Choose a valid comment.'});const removed=await Comment.findOneAndDelete({_id:req.params.id,authorId:req.user.id});return removed?res.json({message:'Comment deleted successfully.'}):res.status(403).json({message:'Only your own comments can be removed.'});}));
module.exports=router;
