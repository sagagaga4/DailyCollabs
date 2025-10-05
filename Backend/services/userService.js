const UserRepository = require('../repositories/UserRepository')
const CommunityRepository = require('../repositories/CommunityRepository')
const userRepo = new UserRepository()
const commRepo = new CommunityRepository()
const bcrypt = require('bcrypt')

//Get All 
const getAllUsers = (filters) => {
  if (!filters.name) {
    return userRepo.getAllUsers()
  }
  return userRepo.findUserByName(filters.name)
}

//Get By ID
const getUserById = (id) => {
    return userRepo.getUserByID(id)
}

//Password validation
function validatePassword(password){
  const hasUppercase = /[A-Z]/.test(password);//At least 1
  const hasSpecial = /[\/#@^&*%]/.test(password);//At least 1
  const isLongEnough = password.length >= 6;

  return hasUppercase && hasSpecial && isLongEnough;
}

const createUser = async (newUser) => {
  //User input validations
  if(!newUser.username || !newUser.password || !newUser.email )
    throw new Error("User input is invalid!")

  if(!validatePassword(newUser.password))
    throw new Error("Password invalid! must include at least 1 capital letter and 1 special charecter") 

  const saltRounds = 10;
  newUser.password = await bcrypt.hash(newUser.password, saltRounds)
  return userRepo.createUser(newUser)

}



const deleteUser = (id) => {
    return userRepo.deleteUser(id)
}

const joinCommunity = async (userId, communityId) => {
  const user = await userRepo.joinCommunity(userId, communityId)
  await commRepo.addMember(communityId, userId)
  return user;
}

// Leave community (update both User + Community)
const leaveCommunity = async (userId, communityId) => {
  const user = await userRepo.leaveCommunity(userId, communityId)
  await commRepo.removeMember(communityId, userId)
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