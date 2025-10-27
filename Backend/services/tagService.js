const TagRepository = require('../repositories/TagsRepository');
const TagRepo = new TagRepository();

const getAllTags = (filters) => {
  return TagRepo.getAllTags(filters);
};

const addTag = async (tagName) => {
  const exists = await TagRepo.findByName(tagName);
  if (exists) {
    throw new Error("Tag already exists");
  }

  return TagRepo.createTag({
    tagName
  });
};

const removedTag = (tagName) => {
  return TagRepo.removeTag(tagName);
};

module.exports = {
  addTag,
  getAllTags,
  removedTag
};