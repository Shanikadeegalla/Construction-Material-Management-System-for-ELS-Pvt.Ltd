import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel.js';

dotenv.config();

const listAllUsers = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    await mongoose.connect(mongoUri);

    const users = await User.find({});
    console.log(`Found ${users.length} users in database:\n`);
    users.forEach((u, i) => {
      console.log(`${i+1}. Name: ${u.name} | Email: ${u.email} | Role: ${u.role} | Status: ${u.status} | Username: ${u.username || 'N/A'}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
};

listAllUsers();
