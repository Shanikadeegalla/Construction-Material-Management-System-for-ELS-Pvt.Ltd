import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from '../models/userModel.js';

dotenv.config();

const listStoreUsers = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    console.log(`Connecting to MongoDB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected successfully!');

    // Find users with roles: StoreOfficer, MainStoreOfficer, or SiteStoreOfficer
    const users = await User.find({
      role: { $in: ['StoreOfficer', 'MainStoreOfficer', 'SiteStoreOfficer'] }
    }).sort({ createdAt: 1 });

    console.log(`\nFound ${users.length} store user(s):`);
    users.forEach((user, idx) => {
      console.log(`\nStore User #${idx + 1}:`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Status (isActive): ${user.status}`);
      console.log(`  Created At: ${user.createdAt}`);
    });

  } catch (err) {
    console.error('Error during query:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB.');
  }
};

listStoreUsers();
