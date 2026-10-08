import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import { ensureDefaultUsersExist } from './verifyAndSeedUsers.js';

dotenv.config();

const resetAllPasswords = async () => {
  try {
    console.log('Connecting to database using system db config...');
    await connectDB();

    const hostName = mongoose.connection?.host || 'Unknown Host';
    const dbName = mongoose.connection?.name || 'Unknown DB';
    console.log(`Connected to active DB: ${hostName}/${dbName}`);

    console.log('Synchronizing canonical test user accounts...');
    const summary = await ensureDefaultUsersExist();

    console.log(`\n======================================================`);
    console.log(`  VERIFIED TEST USER ACCOUNTS IN ACTIVE DATABASE (${hostName}/${dbName})  `);
    console.log(`======================================================`);
    console.table(summary);
  } catch (err) {
    console.error('Error resetting user passwords:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Finished user synchronization script.');
    process.exit(0);
  }
};

resetAllPasswords();
