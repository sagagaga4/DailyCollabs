const User = require('../model/User')

class UserRepository{
    //Creating a user
    createUser = async (userdata) => {
        try{
            const newUser = new User(userdata)
            const savedUser = await newUser.save()
            return savedUser
        }catch(error){
            throw new Error(`Failed to create user: ${error.message}`)
        }
    }
 
    //Check if user already exists
    getAllUsers = async (filters) => {
            try{
                const users = await User.find()
                return users
            }catch(error){
            throw new Error(`Failed to find user: ${error.message}`)
        }
    }

    getUserByID = async (id) => {
        return await User.findById(id);
    };

    findUserByName = async (fullname) => {
        return await User.find({fullname: { $regex: fullname , $options: 'i' }})
    }
    
    findUserByUsername = async (username) => {
        return await User.find({username: { $regex: username , $options: 'i' }})
    }
    
    findUserByEmail = async (email) => {
        return await User.find({email: { $regex: email , $options: 'i' }})
    }
    
    updateUserEmail = async (id, newEmail) => {
        if(newEmail.length < 4){
            throw new Error ('Invalid Email')
        }
        try {
        const updatedUser = await User.findByIdAndUpdate
        (
            id, 
            { email: newEmail }, 
            { new: true }
        );
        return await updatedUser}
        catch(error){
            throw new Error(`Can't accept Email address ${error.message}`)
        }
    }

    deleteUser = async (id) => {
        try{
            const deletedUser = await User.findByIdAndDelete(id)
            if(!deletedUser){
                throw new Error("User not found")
            }
            return  deletedUser
        }
        catch(error){
            throw new Error(`Can't delete user ${error.message}`)
        }
    }

    joinCommunity = async (userId, communityId) => {
        try {
            const user = await User.findByIdAndUpdate(
            userId,
            { $addToSet: { communities: communityId } },
            { new: true }
        ).populate('communities');

        if (!user) throw new Error("User not found");
        return user;
        } catch (error) {
        throw new Error(`Can't join community: ${error.message}`);
    }
  }

  leaveCommunity = async (userId, communityId) => {
    try {
        const user = await User.findByIdAndUpdate(
        userId,
        { $pull: { communities: communityId } },
        { new: true }
      ).populate('communities');

      if (!user) throw new Error("User not found");
      return user;
    } catch (error) {
      throw new Error(`Can't leave community: ${error.message}`);
    }
}
/*
    updateCollaborationsWall = async (id) = {
        try {
        const updateCollaborationsWall = await User.findByIdAndUpdate
        (
            id, 
            { email: newEmail }, 
            { new: true }
        );
        return await updatedUser}
        catch(error){
            throw new Error(`Can't accept Email address ${error.message}`)
        }
    }*/
}
module.exports = UserRepository