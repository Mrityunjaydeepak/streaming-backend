// server.js
const io = require('socket.io')(5069, {
    cors: {
      origin: '*', // Adjust as needed for security
      methods: ['GET', 'POST']
    }
  });
  
  const channelUsers = {}; // Object to track users per channel
  
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
  
    socket.on('joinChannel', ({ channelName, userID }) => {
      socket.join(channelName);
      console.log(`User ${userID} joined channel ${channelName}`);
  
      if (!channelUsers[channelName]) {
        channelUsers[channelName] = new Set();
      }
      channelUsers[channelName].add(userID);
  
      // Emit 'userActive' to all clients in the channel except the one who just joined
      socket.to(channelName).emit('userActive', { userID, name: `User ${userID}` });
  
      // Optionally, emit the current active users count to the host
      io.in(channelName).emit('activeUsersCount', channelUsers[channelName].size);
    });
  
    socket.on('heartbeat', ({ channelName, userID }) => {
      // Handle heartbeat logic if needed
      console.log(`Heartbeat from user ${userID} in channel ${channelName}`);
    });
  
    socket.on('leaveChannel', ({ channelName, userID }) => {
      socket.leave(channelName);
      console.log(`User ${userID} left channel ${channelName}`);
  
      if (channelUsers[channelName]) {
        channelUsers[channelName].delete(userID);
        if (channelUsers[channelName].size === 0) {
          delete channelUsers[channelName];
        }
      }
  
      // Emit 'userInactive' to all clients in the channel except the one who just left
      socket.to(channelName).emit('userInactive', { userID, name: `User ${userID}` });
  
      // Optionally, emit the current active users count to the host
      if (channelUsers[channelName]) {
        io.in(channelName).emit('activeUsersCount', channelUsers[channelName].size);
      } else {
        io.in(channelName).emit('activeUsersCount', 0);
      }
    });
  
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      // Optionally handle cleanup if necessary
    });
  });
  