const io = require('socket.io-client');
const axios = require('axios');

// Constants
const SERVER_URL = 'http://localhost:5069'; // Backend server URL
const CHANNEL_NAME = 'c130f166-4a6e-4881-f687-08dc83b04e80'; // Replace with your actual channel name
const NUMBER_OF_USERS = 5; // Number of simulated users
const USER_JOIN_INTERVAL = 2000; // Time between each user joining (in ms)
const USER_LEAVE_INTERVAL = 5000; // Time after which each user leaves (in ms)

// Function to simulate a user
async function simulateUser(userIndex) {
  const userID = `testUser${userIndex}`;

  try {
    // Add the user to the channel in the database
    await axios.post(`${SERVER_URL}/channel/${CHANNEL_NAME}/users`, {
      name: `Test User ${userIndex}`,
      userID,
      profilePic: '',
    });

    console.log(`User ${userID} added to the channel.`);

    // Connect to Socket.io
    const socket = io(SERVER_URL, {
      query: { channelName: CHANNEL_NAME, userID },
    });

    socket.on('connect', () => {
      console.log(`Socket connected: ${socket.id} for ${userID}`);
      // Emit joinChannel event
      socket.emit('joinChannel', { channelName: CHANNEL_NAME, userID });
      console.log(`UserID ${userID} joined channel ${CHANNEL_NAME} and is now active.`);
    });

    socket.on('activeUsersCount', (count) => {
      console.log(`Active users count received by ${userID}: ${count}`);
    });

    // Simulate user leaving after a certain interval
    setTimeout(() => {
      socket.emit('leaveChannel', { channelName: CHANNEL_NAME, userID });
      console.log(`UserID ${userID} left channel ${CHANNEL_NAME} and is now inactive.`);
      socket.disconnect();
    }, USER_LEAVE_INTERVAL);
  } catch (error) {
    console.error(`Error simulating user ${userID}:`, error.response ? error.response.data : error.message);
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
    console.error('Error creating channel:', error.response ? error.response.data : error.message);
  }

  for (let i = 1; i <= NUMBER_OF_USERS; i++) {
    setTimeout(() => {
      simulateUser(i);
    }, USER_JOIN_INTERVAL * (i - 1));
  }
}

// Start the simulation
startSimulation();
