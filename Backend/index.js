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
const tagRoutes = require('./routers/tagRouter.js')
const reactionRoutes = require('./routers/reactionsRouter.js')
const bookmarkRoutes = require('./routers/bookmarkedRouter.js')
const app = express()
const PORT = process.env.PORT || 4000

app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.use('/agent-status', require('./routers/agentStatusRouter'))
app.use('/media', require('./routers/mediaRouter'))
app.use('/video-search', require('./routers/videoSearchRouter'))
app.use('/content', require('./routers/contentRouter'))
app.use('/feed', require('./routers/feedRouter'))
app.use('/story-comments', require('./routers/storyCommentRouter'))
app.use('/notifications', require('./routers/notificationRouter'))
app.get('/health', (req, res) => {
  const connected = require('mongoose').connection.readyState === 1
  res.status(connected ? 200 : 503).json({ status: connected ? 'ok' : 'starting', database: connected ? 'connected' : 'disconnected' })
})

app.get('/', (req, res) => {
  res.send('Main BACKEND page')
})


app.use('/users', userRoutes)
app.use('/communities', communityRoutes)
app.use('/posts', postRoutes)
app.use('/comments', commentRoutes)
app.use('/auth', authRoutes)
app.use('/rss', rssRouter)
app.use('/tags', tagRoutes)
app.use('/reactions', reactionRoutes)
app.use('/bookmarked', bookmarkRoutes)

connectDB().then(() => {
  require('./seeds/demoCommunities').seedDemoCommunities().catch(error => console.error('Demo community initialization failed:', error.message))
  app.listen(PORT, () => {
    console.log(`app is listening on port ${PORT}`)
  })
})
