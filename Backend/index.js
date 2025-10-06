require('dotenv').config()
const express = require('express')
const cors = require('cors')
const connectDB = require('./config/db')

const userRoutes = require('./routers/userRouter.js')
const communityRoutes = require('./routers/communityRouter.js')
const postRoutes = require('./routers/postRouter.js')
const commentRoutes = require('./routers/commentRouter.js')
const authRoutes = require('./routers/authRouter.js')
const rssRouter = require('./routers/rssRouter')

const app = express()
const PORT = 4000

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.send('Main BACKEND page')
})


app.use('/users', userRoutes)
app.use('/communities', communityRoutes)
app.use('/posts', postRoutes)
app.use('/comments', commentRoutes)
app.use('/auth', authRoutes)
app.use('/rss', rssRouter)

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`app is listening at http://localhost:${PORT}`)
  })
})
