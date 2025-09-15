require('dotenv').config()
const express = require('express')
const cors = require('cors')
const connectDB = require('./config/db')

const userRoutes = require('./routers/userRouter.js')
const communityRoutes = require('./routers/communityRouter.js')
const postRoutes = require('./routers/postRouter.js')
const commentRoutes = require('./routers/commentRouter.js')
const authRoutes = require('./routers/authRouter.js')
const authMiddleware = require('./middleware/authMiddleware.js')

const app = express()
const PORT = 4000

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.send('Main BACKEND page')
})

// 🔒 Protected routes
app.use('/users', authMiddleware, userRoutes)
app.use('/communities', authMiddleware, communityRoutes)
app.use('/posts', authMiddleware, postRoutes)
app.use('/comments', authMiddleware, commentRoutes)

// 🔓 Public routes
app.use('/auth', authRoutes)

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`app is listening at http://localhost:${PORT}`)
  })
})
