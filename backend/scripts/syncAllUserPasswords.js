import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ensureDefaultUsersExist } from './verifyAndSeedUsers.js';

dotenv.config();

const syncUserPasswords = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log(`Connected to ${mongoose.connection.host}/${mongoose.connection.name}`);

    console.log('Synchronizing canonical test user accounts...');
    const summary = await ensureDefaultUsersExist();
    console.table(summary);

    console.log('\nSuccessfully synchronized test user accounts.');
  } catch (err) {
    console.error('Error syncing user passwords:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
};

syncUserPasswords();
