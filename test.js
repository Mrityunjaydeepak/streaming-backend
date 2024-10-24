// test.js

const io = require('socket.io-client');
const axios = require('axios');

// Constants
const SERVER_URL = 'http://localhost:5069'; // Backend server URL
const CHANNEL_NAME = 'c130f166-4a6e-4881-f687-08dc83b04e80'; // Replace with your actual channel name
const NUMBER_OF_USERS = 5; // Number of simulated users
const USER_JOIN_INTERVAL = 2000; // Time between each user joining (in ms)
const USER_LEAVE_INTERVAL = 10000; // Time after which each user leaves (in ms)

// Function to simulate a user
async function simulateUser(userIndex) {
  const userID = `testUser${userIndex}`;

  try {
    // Add the user to the channel in the database
    const addUserResponse = await axios.post(`${SERVER_URL}/channel/${encodeURIComponent(CHANNEL_NAME)}/users`, {
      name: `Test User ${userIndex}`,
      userID,
      profilePic: '',
    });

    console.log(`User ${userID} added to the channel.`);

    // Connect to Socket.IO
    const socket = io(SERVER_URL, {
      query: { channelName: CHANNEL_NAME, userID },
      reconnectionAttempts: 5, // Limit reconnection attempts
      reconnectionDelay: 1000, // Initial reconnection delay
    });

    // Handle successful connection
    socket.on('connect', () => {
      console.log(`Socket connected: ${socket.id} for ${userID}`);
      // Emit joinChannel event
      socket.emit('joinChannel', { channelName: CHANNEL_NAME, userID });
      console.log(`UserID ${userID} joined channel ${CHANNEL_NAME} and is now active.`);
    });

    // Handle activeUsersCount event
    socket.on('activeUsersCount', (count) => {
      console.log(`Active users count received by ${userID}: ${count}`);
    });

    // Handle connection errors
    socket.on('connect_error', (error) => {
      console.error(`Socket.io connection error for ${userID}:`, error.message);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected for ${userID}: ${reason}`);
    });

    // Schedule user to leave the channel after USER_LEAVE_INTERVAL
    setTimeout(() => {
      socket.emit('leaveChannel', { channelName: CHANNEL_NAME, userID });
      console.log(`UserID ${userID} left channel ${CHANNEL_NAME} and is now inactive.`);
      socket.disconnect();
    }, USER_LEAVE_INTERVAL);
  } catch (error) {
    if (error.response) {
      console.error(`Error simulating user ${userID}:`, error.response.data);
    } else {
      console.error(`Error simulating user ${userID}:`, error.message);
    }
  }
}

// Main function to start the simulation
async function startSimulation() {
  // Create the channel if it doesn't exist
  try {
    await axios.post(`${SERVER_URL}/create-channel`, {
      channelName: CHANNEL_NAME,
      uid: 690, // Assuming 690 is the host UID
    });
    console.log(`Channel ${CHANNEL_NAME} is ready.`);
  } catch (error) {
    if (error.response && (error.response.status === 409 || error.response.status === 400)) {
      // Assuming 409 Conflict if channel exists or 400 Bad Request for other creation issues
      console.log(`Channel ${CHANNEL_NAME} already exists or cannot be created.`);
    } else {
      console.error('Error creating channel:', error.response ? error.response.data : error.message);
      return; // Exit if channel creation fails for other reasons
    }
  }

  // Simulate users joining the channel at intervals
  for (let i = 1; i <= NUMBER_OF_USERS; i++) {
    setTimeout(() => {
      simulateUser(i);
    }, USER_JOIN_INTERVAL * (i - 1));
  }
}

// Start the simulation
startSimulation();
