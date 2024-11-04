// server.js

// Load environment variables from .env file
require('dotenv').config();

// Import required packages
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
const { body, validationResult, query, param } = require('express-validator');
const http = require('http'); // Import http to create a server instance
const { Server } = require('socket.io'); // Import Socket.io

// Import the Channel, ChannelUser, and Chat models
const Channel = require('./models/Channel');
const ChannelUser = require('./models/ChannelUser');
const Chat = require('./models/Chat'); // Import the Chat model

// Initialize Express app
const app = express();

// Extract environment variables
const PORT = process.env.PORT || 5069;
const APP_ID = process.env.APP_ID;
const APP_CERTIFICATE = process.env.APP_CERTIFICATE;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;
const MONGODB_URI = process.env.MONGODB_URI;

// Validate essential environment variables
if (!APP_ID || !APP_CERTIFICATE || !MONGODB_URI || !ALLOWED_ORIGIN) {
  console.error('Error: Missing essential environment variables. Please check your .env file.');
  process.exit(1); // Exit the application
}

// Connect to MongoDB
mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('Connected to MongoDB successfully.'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit process with failure
  });

// Middleware to parse JSON bodies
app.use(express.json());

// Configure CORS
app.use(
  cors({
    origin: ALLOWED_ORIGIN, // Allow only the specified origin
    methods: ['POST', 'GET', 'PATCH', 'DELETE'], // Allow necessary HTTP methods
    allowedHeaders: ['Content-Type'], // Allow only Content-Type header
  })
);

// Health Check Endpoint
app.get('/', (req, res) => {
  res.send('Server is running.');
});

// =========================
// Updated API Endpoints
// =========================

/**
 * @route   PATCH /channel/:channelName/token
 * @desc    Update the channel with a newly generated token
 * @access  Public
 */
app.patch(
  '/channel/:channelName/token',
  [param('channelName').isString().notEmpty(), body('token').isString().notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn('Patch Token Request Failed:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { channelName } = req.params;
      const { token } = req.body;

      // Find the channel in the database
      const channel = await Channel.findOne({ channelName });

      if (!channel) {
        console.warn(`Patch Token Failed: Channel ${channelName} does not exist.`);
        return res.status(404).json({ error: 'Channel not found.' });
      }

      // Update the token for the channel
      channel.token = token;
      await channel.save();

      console.log(`Token updated for Channel: ${channelName}`);
      return res.status(200).json({ message: 'Token updated successfully.' });
    } catch (error) {
      console.error('Error in PATCH /channel/:channelName/token:', error);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

/**
 * @route   POST /create-channel
 * @desc    Create or update a channel with channelName and uid
 * @access  Public
 */
app.post(
  '/create-channel',
  [body('channelName').isString().notEmpty(), body('uid').isInt()],
  async (req, res) => {
    const { channelName, uid } = req.body;

    try {
      // Check if the channel already exists
      let channel = await Channel.findOne({ channelName });

      if (channel) {
        // If the channel exists, return the existing tokens
        return res.status(200).json({
          message: 'Channel already exists.',
          token: channel.token,
          audienceToken: channel.audienceToken,
        });
      }

      // If channel doesn't exist, create a new one
      const expireTime = 7200; // Token expiration time in seconds (1 hour)
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const privilegeExpireTime = currentTimestamp + expireTime;

      // Generate publisher token
      const publisherRole = RtcRole.PUBLISHER;
      const token = RtcTokenBuilder.buildTokenWithUid(
        APP_ID,
        APP_CERTIFICATE,
        channelName,
        uid,
        publisherRole,
        privilegeExpireTime
      );

      // Generate audience token
      const audienceRole = RtcRole.SUBSCRIBER;
      const audienceUid = 0; // You can use 0 or any fixed UID for audience
      const audienceToken = RtcTokenBuilder.buildTokenWithUid(
        APP_ID,
        APP_CERTIFICATE,
        channelName,
        audienceUid,
        audienceRole,
        privilegeExpireTime
      );

      // Save the channel with both tokens
      channel = new Channel({
        channelName,
        uid,
        token,
        audienceToken,
      });

      await channel.save();

      return res.status(200).json({
        message: 'Channel created successfully.',
        token, // Publisher token
        audienceToken, // Audience token
      });
    } catch (error) {
      console.error('Error in /create-channel:', error);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

/**
 * @route   GET /channel/:channelName/audience-token
 * @desc    Get the audience token for a channel
 * @access  Public
 */
app.get(
  '/channel/:channelName/audience-token',
  [param('channelName').isString().notEmpty().withMessage('channelName parameter must be a non-empty string')],
  async (req, res) => {
    // Validate the request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn('Get Audience Token Failed:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { channelName } = req.params;

      // Find the channel in the database
      const channel = await Channel.findOne({ channelName });

      if (!channel) {
        console.warn(`Get Audience Token Failed: Channel ${channelName} does not exist.`);
        return res.status(404).json({ error: 'Channel not found.' });
      }

      // Return the audience token
      return res.status(200).json({
        audienceToken: channel.audienceToken,
      });
    } catch (error) {
      console.error('Error in GET /channel/:channelName/audience-token:', error);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

/**
 * @route   GET /token
 * @desc    Generate or retrieve Agora RTC Token for a channel
 * @access  Public
 */
app.get(
  '/token',
  [
    query('channelName')
      .isString()
      .notEmpty()
      .withMessage('channelName query parameter is required and must be a non-empty string'),
    query('uid')
      .isInt({ min: 1 })
      .withMessage('uid query parameter is required and must be a positive integer'),
  ],
  async (req, res) => {
    // Validate the request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn('Token Request Failed:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { channelName, uid } = req.query; // Receive channelName and uid as query parameters

      // Find the channel in the database
      const channel = await Channel.findOne({ channelName });

      if (!channel) {
        console.warn(`Token Request Failed: Channel ${channelName} does not exist.`);
        return res.status(404).json({ error: 'Channel does not exist. Please create the channel first.' });
      }

      // Check if the uid matches
      if (channel.uid !== parseInt(uid, 10)) {
        console.warn(`Token Request Failed: UID mismatch for channel ${channelName}.`);
        return res.status(400).json({ error: 'UID does not match the channel owner.' });
      }

      // Define token expiration
      const expireTime = 3600; // 1 hour in seconds
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const privilegeExpireTime = currentTimestamp + expireTime;

      // Generate a new publisher token
      const publisherRole = RtcRole.PUBLISHER; // Assuming the owner is a publisher
      const publisherToken = RtcTokenBuilder.buildTokenWithUid(
        APP_ID,
        APP_CERTIFICATE,
        channelName,
        parseInt(uid, 10),
        publisherRole,
        privilegeExpireTime
      );

      // Generate a new audience token
      const audienceRole = RtcRole.SUBSCRIBER;
      const audienceUid = 0; // You can use 0 or any fixed UID for audience
      const audienceToken = RtcTokenBuilder.buildTokenWithUid(
        APP_ID,
        APP_CERTIFICATE,
        channelName,
        audienceUid,
        audienceRole,
        privilegeExpireTime
      );

      // Update both tokens in the database
      channel.token = publisherToken;
      channel.audienceToken = audienceToken;
      await channel.save();

      console.log(`Tokens regenerated for Channel: ${channelName}, UID: ${uid}`);

      // Respond with the new tokens
      return res.status(200).json({ token: publisherToken, audienceToken: audienceToken });
    } catch (error) {
      console.error('Error in /token:', error);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);


/**
 * @route   GET /channel/:channelName
 * @desc    Fetch channel details along with associated users
 * @access  Public
 */
app.get(
  '/channel/:channelName',
  [
    param('channelName')
      .isString()
      .notEmpty()
      .withMessage('channelName parameter must be a non-empty string'),
  ],
  async (req, res) => {
    // Validate the request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn('Get Channel Details Failed:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { channelName } = req.params;

      // Find the channel in the database
      const channel = await Channel.findOne({ channelName });

      if (!channel) {
        console.warn(`Get Channel Details Failed: Channel ${channelName} does not exist.`);
        return res.status(404).json({ error: 'Channel not found.' });
      }

      // Fetch all users associated with the channel (audience)
      const users = await ChannelUser.find({ channelName }).select('-__v -channelName -createdAt -updatedAt');

      res.status(200).json({
        token: channel.token,
        audienceToken: channel.audienceToken,
        uid: channel.uid,
        createdAt: channel.createdAt,
        updatedAt: channel.updatedAt,
        users: users, // Array of user objects (audience)
      });
    } catch (error) {
      console.error('Error in GET /channel/:channelName:', error);
      res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

/**
 * @route   POST /channel/:channelName/users
 * @desc    Add a user (audience) to a specific channel
 * @access  Public
 */
app.post(
  '/channel/:channelName/users',
  [
    param('channelName')
      .isString()
      .notEmpty()
      .withMessage('channelName parameter must be a non-empty string'),
    body('name').isString().notEmpty().withMessage('name is required and must be a non-empty string'),
    body('userID')
      .isString()
      .notEmpty()
      .withMessage('userID is required and must be a non-empty string'),
    body('profilePic').optional().isString().withMessage('profilePic must be a string if provided'),
  ],
  async (req, res) => {
    // Validate the request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn('Add User Request Failed:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { channelName } = req.params;
      const { name, userID, profilePic } = req.body;

      // Check if the channel exists
      const channel = await Channel.findOne({ channelName });
      if (!channel) {
        console.warn(`Add User Failed: Channel ${channelName} does not exist.`);
        return res.status(404).json({ error: 'Channel does not exist.' });
      }

      // Check if the user already exists in the channel
      const existingUser = await ChannelUser.findOne({ channelName, userID });
      if (existingUser) {
        console.warn(`Add User Failed: UserID ${userID} already exists in channel ${channelName}.`);
        return res.status(400).json({ error: 'User already exists in the channel.' });
      }

      // Create a new ChannelUser document
      const newUser = new ChannelUser({
        channelName,
        name,
        userID,
        profilePic: profilePic || '',
        active: false, // Initially inactive
      });

      await newUser.save();

      console.log(`User ${name} (ID: ${userID}) added to channel ${channelName}.`);
      return res.status(201).json({ message: 'User added to channel successfully.', user: newUser });
    } catch (error) {
      console.error('Error in POST /channel/:channelName/users:', error);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

/**
 * @route   DELETE /channel/:channelName/users/:userID
 * @desc    Remove a user (audience) from a specific channel
 * @access  Public
 */
app.delete(
  '/channel/:channelName/users/:userID',
  [
    param('channelName')
      .isString()
      .notEmpty()
      .withMessage('channelName parameter must be a non-empty string'),
    param('userID').isString().notEmpty().withMessage('userID parameter must be a non-empty string'),
  ],
  async (req, res) => {
    // Validate the request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn('Delete User Request Failed:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { channelName, userID } = req.params;

      // Check if the channel exists
      const channel = await Channel.findOne({ channelName });
      if (!channel) {
        console.warn(`Delete User Failed: Channel ${channelName} does not exist.`);
        return res.status(404).json({ error: 'Channel does not exist.' });
      }

      // Check if the user exists in the channel
      const user = await ChannelUser.findOne({ channelName, userID });
      if (!user) {
        console.warn(`Delete User Failed: UserID ${userID} does not exist in channel ${channelName}.`);
        return res.status(404).json({ error: 'User does not exist in the channel.' });
      }

      // Delete the user
      await ChannelUser.deleteOne({ channelName, userID });

      console.log(`UserID ${userID} removed from channel ${channelName}.`);
      return res.status(200).json({ message: 'User removed from channel successfully.' });
    } catch (error) {
      console.error('Error in DELETE /channel/:channelName/users/:userID:', error);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

/**
 * @route   GET /channel/:channelName/active-users-count
 * @desc    Get the current active users count for a channel
 * @access  Public
 */
app.get(
  '/channel/:channelName/active-users-count',
  [param('channelName').isString().notEmpty().withMessage('channelName parameter must be a non-empty string')],
  async (req, res) => {
    // Validate the request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn('Get Active Users Count Failed:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { channelName } = req.params;

      // Get the active users count from channelUsers
      const count = channelUsers[channelName] ? channelUsers[channelName].size : 0;

      res.status(200).json({ activeUsersCount: count });
    } catch (error) {
      console.error('Error in GET /channel/:channelName/active-users-count:', error);
      res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

/**
 * @route   GET /channels
 * @desc    Retrieve a list of all channels
 * @access  Public
 */
app.get('/channels', async (req, res) => {
  try {
    // Retrieve all channels from the database
    const channels = await Channel.find({}, 'channelName uid createdAt').sort({ createdAt: -1 });

    // Map to extract channel names and other details
    const channelList = channels.map((channel) => ({
      channelName: channel.channelName,
      uid: channel.uid,
      createdAt: channel.createdAt,
    }));

    return res.status(200).json({ channels: channelList });
  } catch (error) {
    console.error('Error in GET /channels:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @route   POST /channel/:channelName/chat
 * @desc    Send a chat message to a specific channel
 * @access  Public
 */
app.post(
  '/channel/:channelName/chat',
  [
    param('channelName').isString().notEmpty().withMessage('channelName parameter must be a non-empty string'),
    body('name').isString().notEmpty().withMessage('name is required and must be a non-empty string'),
    body('userID').isString().notEmpty().withMessage('userID is required and must be a non-empty string'),
    body('message').isString().notEmpty().withMessage('message is required and must be a non-empty string'),
  ],
  async (req, res) => {
    // Validate the request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn('Send Chat Message Failed:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { channelName } = req.params;
      const { name, userID, message } = req.body;

      // Check if the channel exists
      const channel = await Channel.findOne({ channelName });
      if (!channel) {
        console.warn(`Send Chat Message Failed: Channel ${channelName} does not exist.`);
        return res.status(404).json({ error: 'Channel does not exist.' });
      }

      // Optionally, verify if the user exists in the channel
      const user = await ChannelUser.findOne({ channelName, userID });
      if (!user && channel.uid.toString() !== userID.toString()) {
        console.warn(`Send Chat Message Failed: UserID ${userID} not found in channel ${channelName}.`);
        return res.status(400).json({ error: 'User does not exist in the channel.' });
      }

      // Create a new chat message
      const newChat = new Chat({
        channelName,
        name,
        userID,
        message,
      });

      await newChat.save();

      console.log(`New chat message in channel ${channelName} from ${name} (ID: ${userID}): ${message}`);

      return res.status(201).json({ message: 'Chat message sent successfully.', chat: newChat });
    } catch (error) {
      console.error('Error in POST /channel/:channelName/chat:', error);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

/**
 * @route   GET /channel/:channelName/chat
 * @desc    Retrieve all chat messages for a specific channel
 * @access  Public
 */
app.get(
  '/channel/:channelName/chat',
  [param('channelName').isString().notEmpty().withMessage('channelName parameter must be a non-empty string')],
  async (req, res) => {
    // Validate the request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn('Get Chat Messages Failed:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { channelName } = req.params;

      // Check if the channel exists
      const channel = await Channel.findOne({ channelName });
      if (!channel) {
        console.warn(`Get Chat Messages Failed: Channel ${channelName} does not exist.`);
        return res.status(404).json({ error: 'Channel does not exist.' });
      }

      // Retrieve all chat messages for the channel, sorted by timestamp ascending
      const chats = await Chat.find({ channelName }).sort({ timestamp: 1 });

      return res.status(200).json({ chats });
    } catch (error) {
      console.error('Error in GET /channel/:channelName/chat:', error);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

// =========================
// Socket.io Integration
// =========================

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGIN, // Allow only the specified origin
    methods: ['GET', 'POST'],
  },
});

// Objects to track users
const channelUsers = {}; // Object to track active users per channel
const socketUserMap = {}; // Map socket IDs to user info

// =========================
// Socket.io Event Handling
// =========================

// Handle Socket.io Connections
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  /**
   * Event: joinChannel
   * Payload: { channelName, userID }
   * Description: User joins a channel and is marked as active.
   */
  socket.on('joinChannel', async ({ channelName, userID }) => {
    try {
      // Attempt to find the user in the ChannelUser collection
      let user = await ChannelUser.findOne({ channelName, userID });

      if (user) {
        // Update the user's active status to true
        user.active = true;
        await user.save();

        // Add user to active users list
        if (!channelUsers[channelName]) {
          channelUsers[channelName] = new Set();
        }
        channelUsers[channelName].add(userID);

        // Map socket ID to userID and channelName
        socketUserMap[socket.id] = { userID, channelName };

        // Join the Socket.io room for the channel
        socket.join(channelName);

        console.log(`UserID ${userID} joined channel ${channelName} and is now active.`);

        // Emit events
        socket.to(channelName).emit('userActive', { userID, name: user.name });
        io.in(channelName).emit('activeUsersCount', channelUsers[channelName].size);
        console.log(`Emitting activeUsersCount: ${channelUsers[channelName].size} to channel ${channelName}`);
      } else {
        // Check if the user is the host
        const channel = await Channel.findOne({ channelName });
        if (channel && channel.uid.toString() === userID.toString()) {
          // The user is the host
          // Create a temporary user object for the host
          user = {
            name: 'Host',
            userID: userID,
            channelName: channelName,
          };

          // Add host to active users list
          if (!channelUsers[channelName]) {
            channelUsers[channelName] = new Set();
          }
          channelUsers[channelName].add(userID);

          // Map socket ID to userID and channelName
          socketUserMap[socket.id] = { userID, channelName };

          // Join the Socket.io room for the channel
          socket.join(channelName);

          console.log(`Host (UserID ${userID}) joined channel ${channelName} and is now active.`);

          // Emit events
          socket.to(channelName).emit('userActive', { userID, name: user.name });
          io.in(channelName).emit('activeUsersCount', channelUsers[channelName].size);
          console.log(`Emitting activeUsersCount: ${channelUsers[channelName].size} to channel ${channelName}`);
        } else {
          console.warn(`Socket.io: UserID ${userID} not found in channel ${channelName}.`);
          // Optionally, emit an error to the client
          socket.emit('error', { message: 'User not found in the channel.' });
        }
      }
    } catch (error) {
      console.error('Socket.io joinChannel error:', error);
      socket.emit('error', { message: 'Internal server error.' });
    }
  });

  /**
   * Event: leaveChannel
   * Payload: { channelName, userID }
   * Description: User leaves the channel and is marked as inactive.
   */
  socket.on('leaveChannel', async ({ channelName, userID }) => {
    try {
      // Remove user from active users list
      if (channelUsers[channelName]) {
        channelUsers[channelName].delete(userID);
        if (channelUsers[channelName].size === 0) {
          delete channelUsers[channelName];
        }
      }

      // Remove mapping
      delete socketUserMap[socket.id];

      // Leave the Socket.io room
      socket.leave(channelName);

      console.log(`UserID ${userID} left channel ${channelName} and is now inactive.`);

      // Emit events
      socket.to(channelName).emit('userInactive', { userID, name: `User ${userID}` });

      // Emit active users count
      if (channelUsers[channelName]) {
        io.in(channelName).emit('activeUsersCount', channelUsers[channelName].size);
      } else {
        io.in(channelName).emit('activeUsersCount', 0);
      }
      console.log(`Emitting activeUsersCount: ${channelUsers[channelName] ? channelUsers[channelName].size : 0} to channel ${channelName}`);
    } catch (error) {
      console.error('Socket.io leaveChannel error:', error);
      socket.emit('error', { message: 'Internal server error.' });
    }
  });

  /**
   * Removed Socket.IO Chat Functionality
   *
   * The following code related to chat via Socket.IO has been removed:
   *
   * - Handling 'chatMessage' event
   * - Emitting 'newChatMessage' event
   *
   * This ensures that chat functionalities are now exclusively handled via RESTful APIs.
   */

  /**
   * Handle Socket Disconnection
   * Description: When a socket disconnects, mark the user as inactive.
   */
  socket.on('disconnect', async () => {
    console.log(`Socket disconnected: ${socket.id}`);

    const userInfo = socketUserMap[socket.id];

    if (userInfo) {
      const { userID, channelName } = userInfo;

      // Remove user from active users list
      if (channelUsers[channelName]) {
        channelUsers[channelName].delete(userID);
        if (channelUsers[channelName].size === 0) {
          delete channelUsers[channelName];
        }
      }

      // Remove mapping
      delete socketUserMap[socket.id];

      console.log(`UserID ${userID} in channel ${channelName} marked as inactive due to disconnection.`);

      // Emit events
      socket.to(channelName).emit('userInactive', { userID, name: `User ${userID}` });

      // Emit active users count
      if (channelUsers[channelName]) {
        io.in(channelName).emit('activeUsersCount', channelUsers[channelName].size);
      } else {
        io.in(channelName).emit('activeUsersCount', 0);
      }
      console.log(`Emitting activeUsersCount: ${channelUsers[channelName] ? channelUsers[channelName].size : 0} to channel ${channelName}`);
    }
  });
});

// Start the server with Socket.io
server.listen(PORT, () => {
  console.log(`Backend server with Socket.io is running on port ${PORT}`);
});
