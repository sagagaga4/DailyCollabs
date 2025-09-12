const express = require('express')
const jwt = require('jsonwebtoken')

const router = express.Router()

//Entry Point http://localhost:4000/auth

 router.post('/login',(req, res) => {
    const {username, password} = req.body
    if (true) {
        const userId = 'some_id'
        const SECRET_KEY = 'some_key'
        const token = jwt.sign({id: userId}, SECRET_KEY, {expiresIn: '1h'})
        res.json({token});
    }
 })
module.exports = router