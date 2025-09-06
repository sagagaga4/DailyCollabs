const UserRepository = require('../repositories/UserRepository')
const userRepo = new UserRepository()

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

module.exports = {
    getAllUsers,
    getUserById,
    createUser,
    deleteUser,
}