const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    fullname: {
        type:String,    required:true
    },
    username: {
        type: String,   required:true
    },
    email:{
        type:String,    required:true
    },
    genres:{
      type:String,      required:true
    }
   /* collaborationsWall: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Video',
      amountOfcollabs: Number,required: true
    }],
    pendingCollabs: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Video'
    }],
    nusicNerds: {
      type:String,      required:true
    },
    */
  },
);

const User = mongoose.model('user', userSchema, 'users');
module.exports = User;
