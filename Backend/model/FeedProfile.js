const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  userId: {type:mongoose.Schema.Types.ObjectId,ref:'user',required:true,unique:true},
  preferences: {
    personalized:{type:Boolean,default:true}, mode:{type:String,enum:['balanced','fresh','discover','following'],default:'balanced'},
    freshness:{type:Number,min:0,max:1,default:0.5}, diversity:{type:Number,min:0,max:1,default:0.5},
    followedTopics:{type:[String],default:[]}, mutedTopics:{type:[String],default:[]},
  },
}, {timestamps:true});
module.exports=mongoose.model('FeedProfile',schema);
