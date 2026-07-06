import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';

dotenv.config();

const checkAdmin = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    console.log(`Connecting to MongoDB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected successfully!');

    // Find all users with role 'Admin'
    const admins = await User.find({ role: 'Admin' });

    console.log(`\nFound ${admins.length} Admin user(s):`);
    for (let idx = 0; idx < admins.length; idx++) {
      const admin = admins[idx];
      console.log(`\n--- Admin #${idx + 1} ---`);
      console.log(`Name: "${admin.name}"`);
      
      // Log email character by character to detect hidden spaces or weird characters
      const emailChars = [];
      for (let i = 0; i < admin.email.length; i++) {
        emailChars.push(`${admin.email.charAt(i)} [code: ${admin.email.charCodeAt(i)}]`);
      }
      console.log(`Email String: "${admin.email}"`);
      console.log(`Email Chars detail: ${emailChars.join(', ')}`);
      
      console.log(`Role: "${admin.role}"`);
      console.log(`Status (isActive): ${admin.status}`);
      console.log(`Password Hash: "${admin.password}"`);

      // Verify password
      let isMatch = false;
      try {
        isMatch = await bcrypt.compare('admin123', admin.password);
        console.log(`Password 'admin123' comparison result: ${isMatch ? '✅ MATCHES' : '❌ DOES NOT MATCH'}`);
      } catch (err) {
        console.log(`❌ Password comparison error: ${err.message}`);
      }

      // If it doesn't match, reset it
      if (!isMatch) {
        console.log(`Resetting password to 'admin123' for ${admin.email}...`);
        admin.password = 'admin123';
        admin.status = true; // Ensure active
        await admin.save();
        console.log(`Updated successfully! New hash is: ${admin.password}`);
      } else if (admin.status !== true) {
        console.log(`Activating status to true for ${admin.email}...`);
        admin.status = true;
        await admin.save();
        console.log('Activated successfully!');
      }
    }

  } catch (err) {
    console.error('Error during run:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB.');
  }
};

checkAdmin();
