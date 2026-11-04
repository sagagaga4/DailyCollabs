const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');

test('post preview and mentions remain usable without exposing private save/like identities', async () => {
  process.env.JWT_SECRET='isolated-post-compatibility-secret';
  await mongoose.connect(`mongodb://127.0.0.1:27017/dailycollabs_test_post_compat_${crypto.randomBytes(6).toString('hex')}`);
  const User=require('../model/User');const Post=require('../model/Post');const Comment=require('../model/Comment');
  const app=express();app.use(express.json());app.use('/posts',require('../routers/postRouter'));
  const server=await new Promise(resolve=>{const listener=app.listen(0,'127.0.0.1',()=>resolve(listener));});
  async function request(path,method='GET',token){const r=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:token?{Authorization:`Bearer ${token}`}:{}});return{status:r.status,data:await r.json()};}
  try{
    const author=await User.create({fullname:'Author',username:'author',email:'author@example.test',password:'fixture'});
    const reader=await User.create({fullname:'Reader',username:'reader',email:'reader@example.test',password:'fixture'});
    const post=await Post.create({authorId:author._id,communityId:'personal',title:'A preview',content:'The actual post content.',description:'A short summary.'});
    await Comment.create({authorId:reader._id,postId:post._id,content:'A real comment.'});
    const a=jwt.sign({id:author.id},process.env.JWT_SECRET),b=jwt.sign({id:reader.id},process.env.JWT_SECRET);
    const preview=await request(`/posts/${post.id}/preview`);assert.equal(preview.status,200);assert.equal(preview.data.post.title,'A preview');assert.equal(preview.data.comments.length,1);assert.equal(preview.data.comments[0].authorId.username,'reader');assert.equal(preview.data.comments[0].authorId.password,undefined);
    assert.equal((await request('/posts/not-an-id/preview')).status,400);
    assert.equal((await request(`/posts/${new mongoose.Types.ObjectId()}/preview`)).status,404);
    assert.equal((await request(`/posts/${post.id}/tags/${reader.id}`,'POST')).status,401);
    assert.equal((await request(`/posts/${post.id}/tags/${reader.id}`,'POST',b)).status,403);
    const tagged=await request(`/posts/${post.id}/tags/${reader.id}`,'POST',a);assert.equal(tagged.status,200);assert.deepEqual(tagged.data.tags,[reader.id]);
    assert.equal((await request(`/posts/${post.id}/tags/${reader.id}`,'DELETE',a)).data.tags.length,0);
    const saved=await request(`/posts/${post.id}/save`,'POST',b);assert.equal(saved.status,200);assert.equal(saved.data.savedBy,undefined);
    const liked=await request(`/posts/${post.id}/like`,'POST',b);assert.equal(liked.data.likesCount,1);assert.equal(liked.data.likedBy,undefined);
    const read=await request(`/posts/${post.id}`);assert.equal(read.data.savedBy,undefined);assert.equal(read.data.likedBy,undefined);assert.equal(read.data.likesCount,1);
  }finally{await new Promise(resolve=>server.close(resolve));await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
