const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const chatRoutes = require('./routes/chat');
const Room = require('./models/Room');
const Message = require('./models/Message');
const User = require('./models/User');

const app = express();
const server = http.createServer(app);

// Update CORS for Render deployment
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:4200", "https://your-frontend-domain.netlify.app"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: ["http://localhost:4200", "https://your-frontend-domain.netlify.app"],
  credentials: true
}));
app.use(express.json());

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use('/api/chat', chatRoutes);

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is not set');
  process.exit(1);
}

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB Atlas connected successfully');
  console.log('🔗 Connected to:', MONGODB_URI.split('@')[1]?.split('/')[0] || 'MongoDB Atlas');
})
.catch(err => {
  console.error('❌ MongoDB connection failed:', err.message);
  
  if (err.message.includes('ECONNREFUSED')) {
    console.error('💡 This error suggests you\'re connecting to localhost instead of MongoDB Atlas');
    console.error('🔧 Check your MONGODB_URI environment variable');
  }
  
  process.exit(1);
});

// Socket.IO Connection Handling (same as before)
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', async (data) => {
    try {
      const { roomId, username } = data;
      
      let room = await Room.findOne({ roomId });
      if (!room) {
        room = new Room({ roomId });
        await room.save();
      }

      socket.join(roomId);
      
      await User.findOneAndUpdate(
        { username, roomId },
        { 
          username, 
          roomId, 
          isOnline: true, 
          socketId: socket.id,
          joinedAt: new Date()
        },
        { upsert: true }
      );

      const messages = await Message.find({ roomId })
        .sort({ timestamp: -1 })
        .limit(50)
        .lean();

      socket.emit('room-messages', messages.reverse());
      
      socket.to(roomId).emit('user-joined', {
        username,
        message: `${username} joined the room`,
        timestamp: new Date()
      });

      console.log(`${username} joined room: ${roomId}`);
      
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  socket.on('send-message', async (data) => {
    try {
      const { roomId, username, message } = data;
      
      const newMessage = new Message({
        roomId,
        username,
        message,
        timestamp: new Date()
      });
      
      await newMessage.save();
      
      io.to(roomId).emit('new-message', {
        _id: newMessage._id,
        roomId,
        username,
        message,
        timestamp: newMessage.timestamp
      });
      
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('disconnect', async () => {
    try {
      const user = await User.findOneAndUpdate(
        { socketId: socket.id },
        { isOnline: false }
      );
      
      if (user) {
        socket.to(user.roomId).emit('user-left', {
          username: user.username,
          message: `${user.username} left the room`,
          timestamp: new Date()
        });
      }
      
      console.log('User disconnected:', socket.id);
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
});

// Cleanup function
setInterval(async () => {
  try {
    await User.deleteMany({
      isOnline: false,
      joinedAt: { $lt: new Date(Date.now() - 60 * 60 * 1000) }
    });
    
    const activeRooms = await User.distinct('roomId', { isOnline: true });
    await Room.updateMany(
      { roomId: { $nin: activeRooms } },
      { isActive: false }
    );
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}, 5 * 60 * 1000);

// Use Render's PORT environment variable
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
