const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ConstructionDB');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('DB Connection Error:', error.message);
    console.warn('Please ensure MongoDB is running locally on 127.0.0.1:27017, or configure MONGO_URI in your .env file.');
    process.exit(1);
  }
};

module.exports = connectDB;