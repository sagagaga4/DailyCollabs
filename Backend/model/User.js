const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullname: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  bio: { type: String, default: '', maxlength: 240 },
  avatar: { type: String, default: '' },
  preferences: {
    theme: { type: String, enum: ['dark', 'dim', 'light', 'system'], default: 'dark' },
    textSize: { type: String, enum: ['small', 'default', 'large'], default: 'default' },
    reducedMotion: { type: Boolean, default: false },
  },
  communities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'community' }],
}, {
  toJSON: {
    transform(_doc, ret) {
      delete ret.password;
      delete ret.__v;
      return ret;
    },
  },
});

module.exports = mongoose.model('user', userSchema, 'users');
