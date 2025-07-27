const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true
  },
  roomId: {
    type: String,
    required: true
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  isOnline: {
    type: Boolean,
    default: true
  },
  socketId: {
    type: String
  }
});

userSchema.index({ roomId: 1, username: 1 });

module.exports = mongoose.model('User', userSchema);
