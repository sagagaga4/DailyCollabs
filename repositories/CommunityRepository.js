const  Community = require('../model/Community')

class CommunityRepository{
    createCommunity = async (communitydata) => {
        try {
            const newCommunity = new Community(communitydata)
            const savedCommunity = await newCommunity.save()
            return savedCommunity
        }catch(error){
            throw new Error(`Failed to create a new community: ${error.message}`)
        }
    }

    getAllCommunities = async(filters) => {
        try{
            const community = await Community.find(filters || {})
            return community            
        }catch(error){
            throw new Error(`Failed to create community: ${error.message}`)
        }
    }

    getCommunityById = async(id) => {
        return await Community.findById(id)
    }

    getCommunityByDescription = async(description) => {
        return await Community.find({description: {  $regex: description, $options: 'i'}})
    }

    getCommunityBymemeber = async(members) => {
        return await Community.find({members: {  $regex: members, $options: 'i'}})
    }
    
    getCommunitybyAimember = async(aiMember) => {
        return await Community.find({aiMember: {  $regex: aiMember, $options: 'i'}})
    }

    findCommunityByName = async(name) => {
        return await Community.find({name: { $regex: name , $options: 'i' }})
    }

    updateCommunityName = async (id, newname) => {
        if(newname.length < 4){
            throw new Error ('Community name must be at least 4 characters')
        }
        try {
        const updatedCommunityName = await Community.findByIdAndUpdate
        (
            id, 
            { name: newname}, 
            { new: true }
        );
        return updatedCommunityName}
        catch(error){
            throw new Error(`Can't accept new community name ${error.message}`)
        }
    }

    updateCommunityDescription = async (id, newDesc) => {
        if(newDesc.length < 4){
            throw new Error ('Invalid Name')
        }
        try {
        const updatedCommunityDesc = await Community.findByIdAndUpdate
        (
            id, 
            { description: newDesc}, 
            { new: true }
        );
        return await updatedCommunityDesc}
        catch(error){
            throw new Error(`Can't accept community description ${error.message}`)
        }
    }

    updateCommunitymembers = async (id, newMember) => {
        if(newMember.length < 4){
            throw new Error ('Member name must be at least 4 characters')
        }
        try {
        const updatedCommunityMembers = await Community.findByIdAndUpdate
        (
            id, 
            { $push: { members: newMember }}, 
            { new: true }
        );
        return await updatedCommunityMembers}
        catch(error){
            throw new Error(`Can't accept new member name ${error.message}`)
        }
    }

    deleteCommunity = async (id) => {
        try{
            const deletedCommunity = await Community.findByIdAndDelete(id)
            if(!deletedCommunity){
                throw new Error("Community not found")
            }
            return deletedCommunity
        }
        catch(error){
            throw new Error(`Can't delete community ${error.message}`)
        }
    }
}

