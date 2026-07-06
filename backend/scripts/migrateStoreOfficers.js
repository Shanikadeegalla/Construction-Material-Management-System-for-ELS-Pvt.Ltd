import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from '../models/userModel.js';

dotenv.config();

const migrateStoreOfficers = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    console.log(`Connecting to MongoDB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected successfully!');

    // Find legacy users with role 'StoreOfficer'
    const legacyUsers = await User.find({ role: 'StoreOfficer' });

    if (legacyUsers.length === 0) {
      console.log('\n✅ No legacy users with role "StoreOfficer" were found in the database.');
    } else {
      console.log(`\n⚠️ Found ${legacyUsers.length} legacy user(s) with role "StoreOfficer":`);
      legacyUsers.forEach((user, idx) => {
        console.log(`\nUser #${idx + 1}:`);
        console.log(`  Name: ${user.name}`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Current Role: ${user.role}`);
        console.log(`  Status (isActive): ${user.status}`);
        console.log(`  Created At: ${user.createdAt}`);
      });
      console.log('\nIMPORTANT: No changes have been made. Please instruct which role (MainStoreOfficer or SiteStoreOfficer) each user should be assigned to.');
    }

  } catch (err) {
    console.error('Error during check:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB.');
  }
};

migrateStoreOfficers();
