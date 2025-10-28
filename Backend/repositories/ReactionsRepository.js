const Reactions = require('../model/Reactions');

class Reactions {
    findReaction = async(userId,articleLink) => {
        await Reactions.findOne({userId,articleLink});
    }

    createReaction = async(userId,articleLink,type) => {
        await Reactions.createLike({userId,articleLink,type});
    }

    updateReacrtion = async(userId,articleLink,type) => {
        await Reactions.updateOne({userId,articleLink}, {type});
    }

    deleteReaction = async(userId,articleLink) => {
        await Reactions.deleteOne({userId,articleLink});
    }

    countReactions = async(articleLink) => {
        const likes = await Reactions.countDocuments({articleLink,type:'like'})
        const dislikes = await Reactions.countDocuments({articleLink,type:'dislike'})
        return({likes,dislikes});
    }
}


module.exports = Reactions