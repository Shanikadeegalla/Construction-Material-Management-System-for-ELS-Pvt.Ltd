import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel.js';

dotenv.config();

const fixAllUsers = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected successfully!');

    const users = await User.find({});
    console.log(`Found ${users.length} users in database. Activating all accounts and cleaning whitespace...\n`);

    let count = 0;
    for (const u of users) {
      let modified = false;

      // 1. Ensure status is active
      if (u.status !== true) {
        u.status = true;
        modified = true;
      }

      // 2. Clean email & username
      if (u.email && u.email !== u.email.trim().toLowerCase()) {
        u.email = u.email.trim().toLowerCase();
        modified = true;
      }

      if (!u.username) {
        u.username = u.email ? u.email.split('@')[0] : u.name.replace(/\s+/g, '').toLowerCase();
        modified = true;
      }

      if (modified) {
        await u.save();
        count++;
        console.log(`✅ Cleaned & Activated: ${u.email} (Role: ${u.role}, Username: ${u.username})`);
      }
    }

    console.log(`\nSuccessfully updated ${count} user record(s)! All ${users.length} accounts are active and ready for login.`);
  } catch (err) {
    console.error('Error fixing all users:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
};

fixAllUsers();
