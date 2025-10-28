// ReactionsRepository.js
const Reactions = require('../model/Reactions');

class ReactionsRepository {
  async findReaction(userId, articleLink) {
    return await Reactions.findOne({ userId, articleLink });
  }

  async createReaction(userId, articleLink, type) {
    return await Reactions.create({ userId, articleLink, type });
  }

  async updateReaction(userId, articleLink, type) {
    return await Reactions.findOneAndUpdate({ userId, articleLink },{ type },{ new: true });
  }

  async deleteReaction(userId, articleLink) {
    return await Reactions.deleteOne({ userId, articleLink });
  }

  async countReactions(articleLink) {
    const likes = await Reactions.countDocuments({ articleLink, type: "like" });
    const dislikes = await Reactions.countDocuments({ articleLink, type: "dislike" });
    return { likes, dislikes };
  }
}

module.exports = ReactionsRepository;
