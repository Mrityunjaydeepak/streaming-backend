// models/Channel.js

const mongoose = require('mongoose');

const ChannelSchema = new mongoose.Schema({
  channelName: { type: String, required: true, unique: true },
  uid: { type: Number, required: true },
  token: { type: String, required: true },
  audienceToken: { type: String, required: true }, 
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Channel', ChannelSchema);
