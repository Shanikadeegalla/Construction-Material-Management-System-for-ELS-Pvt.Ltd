import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from '../models/userModel.js';

dotenv.config();

const migrateStoreUser = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    console.log(`Connecting to MongoDB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected successfully!');

    // Find user by email
    const user = await User.findOne({ email: 'store@els.com' });
    if (!user) {
      console.log('User store@els.com not found!');
      return;
    }

    console.log(`Found user: ${user.email} with current role: ${user.role}`);
    user.role = 'MainStoreOfficer';
    
    // We update using updateOne or save, but we must make sure it updates in database.
    // Since password hashing pre-save runs on save, wait: does it re-hash if password is not modified?
    // Let's check userModel.js:
    // userSchema.pre('save', async function (next) {
    //   if (!this.isModified('password')) {
    //     next();
    //   } ...
    // Since it checks isModified('password'), user.save() will NOT re-hash! It is perfectly safe.
    await user.save();
    console.log(`Successfully migrated ${user.email} to role: ${user.role}`);

  } catch (err) {
    console.error('Error during migration:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
};

migrateStoreUser();
