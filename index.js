const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const userRoutes = require('./routers/userRouter.js');

const app = express();
const PORT = 4000;

app.get('/', (req, res) => {
  res.send('Welcome to the User API! Try /users for user-related endpoints.');
});

app.use(cors());
app.use(express.json());
app.use('/users', userRoutes);

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`app is listening at http://localhost:${PORT}`);
  });
});