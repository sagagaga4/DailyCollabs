const express = require('express')
const cors = require('cors')
const connectDB = require('./config/db')

const userRoutes = require('./routers/userRouter.js')
const communityRoutes = require('./routers/communityRouter.js')
const postRoutes = require('./routers/postRouter.js')
const commentRoutes = require('./routers/commentRouter.js')
const authRoutes = require('./routers/authRouter.js')
const productsRoutes = require('./routers/productsRouter.js')
const authMiddleware = require('./middleware/authMiddleware');

const app = express()
const PORT = 4000


app.get('/', (req, res) => {
  res.send('Main BACKEND page')
})

app.use(cors())
app.use(express.json())

app.use('/users', authMiddleware ,userRoutes)
app.use('/communities', authMiddleware ,communityRoutes)
app.use('/posts', authMiddleware ,postRoutes)
app.use('/comments', authMiddleware ,commentRoutes)
app.use('/auth', authMiddleware ,authRoutes)
app.use('/products', authMiddleware ,productsRoutes)


connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`app is listening at http://localhost:${PORT}`)
  })
})