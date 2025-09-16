require('dotenv').config()
const express = require('express')
const jwt = require('jsonwebtoken')
const router = express.Router()

// Entry Point http://localhost:4000/auth
router.post('/login', (req, res) => {
  const { username, password } = req.body
  
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: "JWT secret is not configured" })
    }

    const userId = 'some_id' // later you’ll verify from DB
    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' })
    res.json({ token })
  } catch (err) {
    console.error("JWT error:", err)
    res.status(500).json({ error: "Server error" })
  }
})

module.exports = router
