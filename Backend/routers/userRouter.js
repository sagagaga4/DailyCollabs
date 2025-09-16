const express = require('express')
const userService = require('../services/userService')

const router = express.Router();

//Entry Point - " /users "
router.post('/:userId/join/:communityId', async (req, res) => {
  const user = await userService.joinCommunity(req.params.userId, req.params.communityId);
  res.json(user);
});

router.get('/', async (req, res) => {
    try {
        const filters = req.query
        const users = await userService.getAllUsers(filters)
        res.send(users)
        }catch (error){
            res.status(500).send(error)
        }    
});  

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params
        const user = await userService.getUserById(id)
        res.send(user)
    } catch(error){
        res.status(500).send(error)
    }
})

router.post('/', async (req, res) => {
    try {
        const userObj = req.body;
        const newUser = await userService.createUser(userObj);
        res.status(201).send(`The new ID: ${newUser._id}`);
    } catch (error) {
        res.status(500).send(error.message || 'Failed to create user');
    }
});

router.delete('/:id', async(req, res) => {
    console.log("User Delete req has been entered")
    try{
        const { id } = req.params
        const deletedUser = await userService.deleteUser(id)
        console.log("User Deleted")
        res.send(deletedUser)  
        }catch(error){
            console.log('DELETE error:', error.message); 
            res.status(500).send(error)
        }
})

router.get('/:userId/saved-posts', async (req, res) => {
  try {
    const { userId } = req.params;
    const savedPosts = await userService.getSavedPosts(userId);
    res.json(savedPosts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

