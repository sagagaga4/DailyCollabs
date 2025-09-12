require('dotenv').config()

const express = require('express')
const jwt = require('jsonwebtoken')
const router = express.Router()

//Entry Point http://localhost:4000/auth

 router.post('/login',(req, res) => {
    const {username, password} = req.body
    if (true) {
        const userId = 'some_id'
    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({token});
    }
 })
module.exports = router