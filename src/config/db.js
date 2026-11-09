const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  if (process.env.NODE_ENV === 'test') {
    // Tests run instantly against in-memory fallback
    isConnected = false;
    return;
  }

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/billflow';

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2000,
    });
    isConnected = true;
    console.log(`[BillFlow DB] MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    isConnected = false;
    console.warn(`[BillFlow DB] MongoDB connection skipped (${err.message}). Running in high-speed in-memory mode.`);
  }
};

const getStatus = () => ({
  connected: isConnected,
  mode: isConnected ? 'mongodb' : 'in-memory-fallback',
});

module.exports = { connectDB, getStatus };
