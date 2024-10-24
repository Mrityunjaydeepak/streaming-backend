// models/Chat.js

const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
  channelName: {
    type: String,
    required: true,
    index: true,
  },
  userID: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

module.exports = mongoose.model('Chat', ChatSchema);
