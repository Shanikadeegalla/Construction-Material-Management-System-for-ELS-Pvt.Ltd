import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from '../models/userModel.js';

dotenv.config();

const checkDirector = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    console.log(`Connecting to MongoDB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected successfully!');

    // Find users with role Director or email containing director
    const users = await User.find({
      $or: [
        { role: 'Director' },
        { email: /director/i }
      ]
    });

    console.log(`Found ${users.length} matching user(s):`);
    users.forEach((user, idx) => {
      console.log(`\nUser #${idx + 1}:`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Status (isActive): ${user.status}`);
      console.log(`  Password field exists: ${!!user.password}`);
      console.log(`  Password field length: ${user.password ? user.password.length : 0}`);
      console.log(`  Password value (hash check): ${user.password}`);
    });

  } catch (err) {
    console.error('Error during check:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB.');
  }
};

checkDirector();
