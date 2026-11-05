const mongoose = require('mongoose');

const connectDB = async () => {
  // If already connected, return existing connection
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/college_event_management';
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[Database] Connected to MongoDB at: ${mongoose.connection.host}/${mongoose.connection.name}`);
    return mongoose.connection;
  } catch (err) {
    console.error(`[Database] Failed to connect to MongoDB at ${uri}: ${err.message}`);
    throw err;
  }
};

const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};

module.exports = { connectDB, disconnectDB };

