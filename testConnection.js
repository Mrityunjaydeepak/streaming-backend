const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://mrityunjay:nSSPZx8gJ9jGZGOo@cluster0.4koohwj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  authMechanism: 'SCRAM-SHA-256',
})
.then(() => {
  console.log('MongoDB connected');
  mongoose.disconnect();
})
.catch((err) => {
  console.error('MongoDB connection error:', err);
});
