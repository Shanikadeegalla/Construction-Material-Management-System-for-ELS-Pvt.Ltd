import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from '../models/userModel.js';

dotenv.config();

const resetDirector = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    console.log(`Connecting to MongoDB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected successfully!');

    // Find the user
    const user = await User.findOne({ email: 'director@els.com' });
    if (!user) {
      console.log('Director user not found! Let us create one...');
      const newUser = new User({
        name: 'director',
        email: 'director@els.com',
        password: 'dir123',
        role: 'Director',
        status: true
      });
      await newUser.save();
      console.log('Created new Director user with password: dir123');
    } else {
      console.log(`Found Director user. Old hash: ${user.password}`);
      user.password = 'dir123';
      user.status = true; // Ensure active
      await user.save();
      console.log(`Updated Director user. New hash: ${user.password}`);
    }

  } catch (err) {
    console.error('Error during reset:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
};

resetDirector();
