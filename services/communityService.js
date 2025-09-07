const CommunityRepository = require('../repositories/CommunityRepository')
const communityRepo = new CommunityRepository()

const getAllCommunities = (filters) => {
    if(!filters.name){
        return communityRepo.getAllCommunities()
    }
    return communityRepo.findCommunityByName(filters.name)
}

const getCommunityById = (id) => {
    return communityRepo.getCommunityById(id)
}

const createCommunity = (communityData) => {
    return communityRepo.createCommunity(communityData)    
}

const deleteCommunity = (id) => {
    return communityRepo.deleteCommunity(id)
}

const addMember = (communityId, userId) => {
  return commRepo.addMember(communityId, userId);
}

const removeMember = (communityId, userId) => {
  return commRepo.removeMember(communityId, userId);
}

module.exports = {
    getAllCommunities,
    getCommunityById,
    createCommunity,
    deleteCommunity,
    addMember,
    deleteCommunity,
}