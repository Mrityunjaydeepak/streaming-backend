// models/Channel.js

const mongoose = require('mongoose');

const ChannelSchema = new mongoose.Schema({
  channelName: {
    type: String,
    required: true,
    unique: true, // Ensure channel names are unique
    trim: true,
  },
  uid: {
    type: Number,
    required: true,
  },
  token: {
    type: String,
    required: true,
  },
}, { timestamps: true }); // Automatically adds createdAt and updatedAt fields

module.exports = mongoose.model('Channel', ChannelSchema);
