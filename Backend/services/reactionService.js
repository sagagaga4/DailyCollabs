const { model } = require('mongoose');
const ReactionRepository = require('../repositories/ReactionsRepository.js');
const ReactionRepo = new ReactionRepository()

const ToggleReaction = async (userId, articleLink, type) => {
    const existing = await ReactionRepo.findReaction()

    //If there are no likes or dislikes = create
    if(!existing){
        await ReactionRepo.createReaction({userId, articleLink, type});
        return {status: `{$type} added`};
    }

    //If there are no like/dislike already clicked = remove it
    if(existing.type = type){
        await ReactionRepo.deleteReaction({userId, articleLink, type});
        return {status: `{$type} removed`}
    }

    //If one of them like/dislike already clicked = switch to the second one
    await ReactionRepo.updateReacrtion({userId, articleLink, type});
    return{status:`{$type} updated`}
}

const getReactionCount = async(articleLink) => {
   return await ReactionRepo.countReactions({articleLink})
}

const getUserReaction = async(userId,articleLink) => {
   const reaction = await ReactionRepo.findReaction({userId,articleLink});
   return reaction ? reaction.type : null;
}

module.exports={
    ToggleReaction,
    getReactionCount,
    getUserReaction
}
