const mongoose = require('mongoose')
const reactionsSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId,
         ref: "User", required: true 
    },
    articleLink:{
        type:String,
        required:true
    },
    //type will allow to choose between like and dislike 
    type:{
        type:String,
        enum:['like','dislike'],
        required: true,
    },
    createdAt:{
        type:Date,
        default:Date.now
    }
});

reactionsSchema.index({articleLink:1,userId:1}),{unique:true};
export default mongoose.model("Reaction",reactionsSchema);
