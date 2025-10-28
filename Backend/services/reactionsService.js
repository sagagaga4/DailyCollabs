// reactionsService.js
const ReactionsRepository = require('../repositories/ReactionsRepository');
const ReactionsRepo = new ReactionsRepository();

const toggleReaction = async (userId, articleLink, type) => {
  const existing = await ReactionsRepo.findReaction(userId, articleLink);

  // If no reaction exists, create one
  if (!existing) {
    await ReactionsRepo.createReaction(userId, articleLink, type);
    return { status: `${type} added` };
  }

  // If same type exists, delete it
  if (existing.type === type) {
    await ReactionsRepo.deleteReaction(userId, articleLink);
    return { status: `${type} removed` };
  }

  // If different type exists, update it
  await ReactionsRepo.updateReaction(userId, articleLink, type);
  return { status: `${type} updated` };
};

const getReactionCount = async (articleLink) => {
  return await ReactionsRepo.countReactions(articleLink);
};

const getUserReaction = async (userId, articleLink) => {
  const reaction = await ReactionsRepo.findReaction(userId, articleLink);
  return reaction ? reaction.type : null;
};

module.exports = {
  toggleReaction,
  getReactionCount,
  getUserReaction
};