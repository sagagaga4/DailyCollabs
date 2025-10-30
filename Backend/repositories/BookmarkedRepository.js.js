//BookmarkedRepository.js
const Bookmarked = require('../model/Bookmarked')

class BookmarkedRepository {
    async findBookmark(userId, articleLink) {
        return await Bookmarked.findOne({userId, articleLink});
    }

    async findAllBookmarksByUserId(userId) {
        return await Bookmarked.find({userId})
    }
    async createBookmark(userId, articleLink) {
        return await Bookmarked.create({userId, articleLink});
    }

    async deleteBookmark(userId, articleLink) {
        return await Bookmarked.deleteOne({userId,articleLink});
    }
}

module.exports = BookmarkedRepository;