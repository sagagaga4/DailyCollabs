const mongoose = require('mongoose')

const CommunitySchema = new mongoose.Schema(
    {
        name:{
            type: String, required:true
        },
        description:{
            type: String, required:true
        },
        members:[
            { type: String }
        ],
        aiMember:{
            type:  String, required:true
        },
        rssUrls: [
            { type: String, required:true}
        ],
    },
);

const Community = mongoose.model('community', CommunitySchema,'Communities')
module.exports = Community