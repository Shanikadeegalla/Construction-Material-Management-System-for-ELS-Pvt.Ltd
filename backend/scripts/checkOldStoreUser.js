import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from '../models/userModel.js';

dotenv.config();

const checkOldStoreUser = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    console.log(`Connecting to MongoDB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected successfully!');

    // Find all users with role 'StoreOfficer'
    const storeOfficers = await User.find({ role: 'StoreOfficer' });

    console.log(`Found ${storeOfficers.length} legacy StoreOfficer user(s):`);
    storeOfficers.forEach((user, idx) => {
      console.log(`\nStore Officer #${idx + 1}:`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Status (isActive): ${user.status}`);
    });

  } catch (err) {
    console.error('Error during check:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB.');
  }
};

checkOldStoreUser();
