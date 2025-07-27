const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const Message = require('../models/Message');
const User = require('../models/User');

// Get room messages
router.get('/room/:roomId/messages', async (req, res) => {
  try {
    const { roomId } = req.params;
    const messages = await Message.find({ roomId })
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();
    
    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active users in room
router.get('/room/:roomId/users', async (req, res) => {
  try {
    const { roomId } = req.params;
    const users = await User.find({ roomId, isOnline: true })
      .select('username joinedAt')
      .lean();
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create or get room
router.post('/room', async (req, res) => {
  try {
    const { roomId, name } = req.body;
    
    let room = await Room.findOne({ roomId });
    if (!room) {
      room = new Room({ roomId, name });
      await room.save();
    }
    
    res.json(room);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
