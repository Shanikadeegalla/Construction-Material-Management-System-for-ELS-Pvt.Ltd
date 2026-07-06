import mongoose from 'mongoose';
import User from './models/userModel.js';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB');
    console.log('Connected to DB');
    const users = await User.find({});
    console.log('USERS IN DB:', JSON.stringify(users.map(u => ({ id: u._id, name: u.name, email: u.email, role: u.role, status: u.status })), null, 2));
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};
run();
