require('dotenv').config()

const express = require('express')
const jwt = require('jsonwebtoken')
const router = express.Router()
const bcrypt = require('bcrypt')
const UserRepository = require('../repositories/UserRepository')
const userRepo = new UserRepository();

// Entry Point http://localhost:4000/auth
router.post('/login', async (req, res) => {

  const { username, password } = req.body
  
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: "JWT secret is not configured" })
    }

    const users = await userRepo.findUserByUsername(username);

    const user = users[0];
    if(!user){
      return res.status(400).json({error: "invalid username or password"})
   }

   const isMatch = await bcrypt.compare(password, user.password) 
   if(!isMatch){
    return res.status(400).json({error: "Invlaid username or password"})
   }
   
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })
    res.json({ token })
  } catch (err) {
    console.error("JWT error:", err)
    res.status(500).json({ error: "Server error" })
  }
})

module.exports = router
