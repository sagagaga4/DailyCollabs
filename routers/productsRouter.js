const express = require('express')
const jwt = require('jsonwebtoken')

const router = express.Router();

//Entry Point: http://localhost:4000/products
router.get('/', (req, res) => {
   const token = req.headers['x-access-token']
   if(!token){
    res.status(401).json('No token provided')
   }
   
   const SECRET_KEY = 'some_key'

   jwt.verify(token, SECRET_KEY, (err, data) => {
        if(err){
            res.status(500).json('Failed to authenticate token')
        }

        console.log(data) 
        const products = [{name: 'Car'}, { name: 'Phone' }]
        res.json(products)
    })
})

module.exports = router