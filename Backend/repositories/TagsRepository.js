const Tag = require("../model/Tags");

class TagsRepository {

    createTag = async (tagData) => {
        const newTag = new Tag(tagData);
        return newTag.save();
    }

    getAllTags = async (filters) => {
        try{
            return Tag.find(filters || {}).limit(12);
        }catch (error){
            throw new Error (`Failed to get tags: ${error.message}`)
        }
    }

  findByName = async (tagName) => {
    return Tag.findOne({ tagName });
  }

  removeTag = async (tagName) => {
    return Tag.findOneAndDelete({ tagName });
  }

}

module.exports = TagsRepository;