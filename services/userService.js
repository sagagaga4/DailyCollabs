const UserRepository = require('../repositories/UserRepository')
const CommunityRepository = require('../repositories/CommunityRepository')

const userRepo = new UserRepository()
const commRepo = new CommunityRepository()

//Get All 
const getAllUsers = (filters) => {
  if (!filters.name) {
    return userRepo.getAllUsers(); 
  }
  return userRepo.findUserByName(filters.name);
}

//Get By ID
const getUserById = (id) => {
    return userRepo.getUserByID(id)
}

const createUser = (newUser) => {
    return userRepo.createUser(newUser)
}

const deleteUser = (id) => {
    return userRepo.deleteUser(id)
}

const joinCommunity = async (userId, communityId) => {
  const user = await userRepo.joinCommunity(userId, communityId);
  await commRepo.addMember(communityId, userId);
  return user;
}

// Leave community (update both User + Community)
const leaveCommunity = async (userId, communityId) => {
  const user = await userRepo.leaveCommunity(userId, communityId);
  await commRepo.removeMember(communityId, userId);
  return user;
}

module.exports = {
    getAllUsers,
    getUserById,
    createUser,
    deleteUser,
    joinCommunity,
    leaveCommunity,
}