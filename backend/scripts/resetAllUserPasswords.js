import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import connectDB from '../config/db.js';
import User from '../models/userModel.js';
import { ensureDefaultUsersExist } from './verifyAndSeedUsers.js';

dotenv.config();

const resetAllPasswords = async () => {
  try {
    console.log('Connecting to database using system db config...');
    await connectDB();

    const hostName = mongoose.connection?.host || 'Unknown Host';
    const dbName = mongoose.connection?.name || 'Unknown DB';
    console.log(`Connected to active DB: ${hostName}/${dbName}`);

    // Ensure default test users exist
    await ensureDefaultUsersExist();

    const targetPassword = 'Password123!';
    const salt = await bcrypt.genSalt(10);
    const freshHash = await bcrypt.hash(targetPassword, salt);

    const allUsers = await User.find({});
    console.log(`Found ${allUsers.length} user records. Resetting passwords to '${targetPassword}'...`);

    const summary = [];
    for (const u of allUsers) {
      u.password = freshHash;
      u.status = true;
      await u.save();

      const verified = await u.matchPassword(targetPassword);
      summary.push({
        Role: u.role,
        Email: u.email,
        Password: targetPassword,
        Status: u.status ? 'Active' : 'Disabled',
        Verified: verified ? 'PASS ✅' : 'FAIL ❌'
      });
    }

    console.log(`\n======================================================`);
    console.log(`  VERIFIED LOGIN CREDENTIALS IN ACTIVE DATABASE (${hostName}/${dbName})  `);
    console.log(`======================================================`);
    console.table(summary);
  } catch (err) {
    console.error('Error resetting user passwords:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Finished password reset script.');
    process.exit(0);
  }
};

resetAllPasswords();
