// models/ChannelUser.js
const mongoose = require('mongoose');

const ChannelUserSchema = new mongoose.Schema({
  channelName: {
    type: String,
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
  },
  userID: {
    type: String,
    required: true,
  },
  profilePic: {
    type: String,
    default: '',
  },
  active: {
    type: Boolean,
    default: true, // Users are active upon joining by default
  },
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt fields
});

module.exports = mongoose.model('ChannelUser', ChannelUserSchema);
