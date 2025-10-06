const express = require('express')
const userService = require('../services/userService')
const authMiddleware = require('../middleware/authMiddleware')

const router = express.Router();

//Entry Point - " /users "

// ============ PUBLIC ROUTES (No authentication required) ============

//ADD User 
router.post('/', async (req, res) => {
    try {
        const userObj = req.body;
        const newUser = await userService.createUser(userObj);
        res.status(201).send(`The new ID: ${newUser._id}`);
    } catch (error) {
        res.status(500).send(error.message || 'Failed to create user');
    }
});

// ============ PROTECTED ROUTES (Authentication required) ============

//GET all users
router.get('/', authMiddleware, async (req, res) => {
    try {
        const filters = req.query
        const users = await userService.getAllUsers(filters)
        res.send(users)
    } catch (error){
        res.status(500).send(error)
    }    
});  

//GET user by id
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params
        const user = await userService.getUserById(id)
        res.send(user)
    } catch(error){
        res.status(500).send(error)
    }
})

//DELETE user by id
router.delete('/:id', authMiddleware, async(req, res) => {
    console.log("User Delete req has been entered")
    try{
        const { id } = req.params
        const deletedUser = await userService.deleteUser(id)
        console.log("User Deleted")
        res.send(deletedUser)  
    } catch(error){
        console.log('DELETE error:', error.message); 
        res.status(500).send(error)
    }
})

//Join community
router.post('/:userId/join/:communityId', authMiddleware, async (req, res) => {
    try {
        const user = await userService.joinCommunity(req.params.userId, req.params.communityId);
        res.json(user);
    } catch(error) {
        res.status(500).json({ message: error.message });
    }
});

//GET saved posts from user
router.get('/:userId/saved-posts', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        const savedPosts = await userService.getSavedPosts(userId);
        res.json(savedPosts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;