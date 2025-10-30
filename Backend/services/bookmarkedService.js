// services/bookmarkedService.js
const BookmarkedRepository = require('../repositories/BookmarkedRepository.js');
const BookRepo = new BookmarkedRepository();

const getAllBookmarked = async (userId) => {
  return await BookRepo.getAllBookmarks(userId);
};

const createBookmark = async (userId, articleLink) => {
  const existing = await BookRepo.findBookmark(userId, articleLink);
  if (existing) return { status: "Already bookmarked!" };

  await BookRepo.createBookmark(userId, articleLink);
  return { status: "Bookmarked article created!" };
};

const deleteBookmark = async (userId, articleLink) => {
  const existing = await BookRepo.findBookmark(userId, articleLink);
  if (!existing) return { status: `Couldn't find article ${articleLink}` };

  await BookRepo.deleteBookmark(userId, articleLink);
  return { status: "Bookmark removed!" };
};

module.exports = {
  getAllBookmarked,
  createBookmark,
  deleteBookmark,
};
