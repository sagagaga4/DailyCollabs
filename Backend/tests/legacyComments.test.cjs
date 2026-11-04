const test=require('node:test');const assert=require('node:assert/strict');const mongoose=require('mongoose');const express=require('express');const jwt=require('jsonwebtoken');const crypto=require('node:crypto');
test('legacy comment routes reject anonymous and cross-account writes while preserving real author identity',async()=>{
 process.env.JWT_SECRET='legacy-comment-isolation-test';await mongoose.connect(`mongodb://127.0.0.1:27017/dailycollabs_test_legacy_comment_${crypto.randomBytes(6).toString('hex')}`);
 const User=require('../model/User'),Post=require('../model/Post'),Comment=require('../model/Comment');const app=express();app.use(express.json());app.use('/comments',require('../routers/commentRouter'));
 const server=await new Promise(resolve=>{const listener=app.listen(0,'127.0.0.1',()=>resolve(listener));});
 async function request(path,method='GET',token,body){const r=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()};}
 try{const [a,b]=await User.create(['a','b'].map(name=>({fullname:name,username:name,email:`${name}@legacy.example`,password:'fixture'})));const ta=jwt.sign({id:a.id},process.env.JWT_SECRET),tb=jwt.sign({id:b.id},process.env.JWT_SECRET);const post=await Post.create({authorId:a.id,communityId:'personal',content:'A real post',description:'A real description'});
 assert.equal((await request('/comments','POST',null,{postId:post.id,content:'Anonymous',authorId:a.id})).status,401);
 const created=await request('/comments','POST',ta,{postId:post.id,content:'A comment',authorId:b.id});assert.equal(created.status,201);assert.equal(created.data.authorId,a.id);
 assert.equal((await request(`/comments/${created.data._id}`,'PUT',tb,{content:'Not mine'})).status,403);assert.equal((await request(`/comments/${created.data._id}`,'DELETE',tb)).status,403);assert.equal((await request(`/comments/${created.data._id}`,'DELETE')).status,401);
 assert.equal((await request(`/comments/${created.data._id}`,'PUT',ta,{content:'My updated comment'})).status,200);assert.equal((await request('/comments/post/'+post.id)).data.length,1);assert.equal((await request(`/comments/${created.data._id}`,'DELETE',ta)).status,200);assert.equal(await Comment.countDocuments({}),0);
 }finally{await new Promise(resolve=>server.close(resolve));await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
