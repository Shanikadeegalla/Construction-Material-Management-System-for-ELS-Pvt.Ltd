import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from '../models/userModel.js';

dotenv.config();

const checkAdmins = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    console.log(`Connecting to MongoDB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected successfully!');

    // Find all users with role 'Admin'
    const admins = await User.find({ role: 'Admin' });

    console.log(`Found ${admins.length} Admin user(s):`);
    admins.forEach((admin, idx) => {
      console.log(`\nAdmin #${idx + 1}:`);
      console.log(`  Name: ${admin.name}`);
      console.log(`  Email: ${admin.email}`);
      console.log(`  Status (isActive): ${admin.status}`);
      console.log(`  Created At: ${admin.createdAt}`);
    });

  } catch (err) {
    console.error('Error during check:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB.');
  }
};

checkAdmins();
