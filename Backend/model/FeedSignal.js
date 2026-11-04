const mongoose = require('mongoose');
const schema=new mongoose.Schema({
 userId:{type:mongoose.Schema.Types.ObjectId,ref:'user',required:true},key:{type:String,required:true,maxlength:100},
 type:{type:String,enum:['search','open','more','less','hide'],required:true},
 url:{type:String,default:'',maxlength:2048},title:{type:String,default:'',maxlength:300},query:{type:String,default:'',maxlength:200},
 expiresAt:{type:Date,required:true},
},{timestamps:true});
schema.index({userId:1,key:1},{unique:true});schema.index({expiresAt:1},{expireAfterSeconds:0});schema.index({userId:1,updatedAt:-1});
module.exports=mongoose.model('FeedSignal',schema);
