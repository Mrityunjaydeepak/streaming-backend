// test.js
const { io } = require("socket.io-client");

// Connect to the Socket.io server
const socket = io("http://localhost:5069");

socket.on("connect", () => {
  console.log("Connected to Socket.io server.");

  // Emit joinChannel event
  socket.emit("joinChannel", { channelName: "c130f166-4a6e-4881-f687-08dc83b04e80", userID: 'user124' });

  // Emit heartbeat event every 30 seconds
  const heartbeatInterval = setInterval(() => {
    socket.emit("heartbeat", { channelName: "c130f166-4a6e-4881-f687-08dc83b04e80", userID: 'user124' });
    console.log("Heartbeat emitted.");
  }, 30000);

  // Emit leaveChannel after 2 minutes
  setTimeout(() => {
    socket.emit("leaveChannel", { channelName: "c130f166-4a6e-4881-f687-08dc83b04e80", userID: 'user124' });
    console.log("Leave channel emitted.");
    clearInterval(heartbeatInterval);
    socket.disconnect();
  }, 120000); // 120,000 ms = 2 minutes
});

socket.on("userActive", (data) => {
  console.log("User Active:", data);
});

socket.on("userInactive", (data) => {
  console.log("User Inactive:", data);
});

socket.on("disconnect", () => {
  console.log("Disconnected from Socket.io server.");
});

socket.on("error", (error) => {
  console.error("Socket.io Error:", error);
});
