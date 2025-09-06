const express = require('express')
const cors = require('cors')
const connectDB = require('./config/db')
const userRoutes = require('./routers/userRouter.js')
const communityRoutes = require('./routers/communityRouter.js')
const app = express()
const PORT = 4000

app.get('/', (req, res) => {
  res.send('Main BACKEND page')
})

app.use(cors())
app.use(express.json())
app.use('/users', userRoutes)
app.use('/communities',communityRoutes)

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`app is listening at http://localhost:${PORT}`)
  })
})