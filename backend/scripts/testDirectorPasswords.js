import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';

dotenv.config();

const testDirectorPasswords = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    await mongoose.connect(mongoUri);

    const directors = await User.find({ role: 'Director' });
    console.log(`Found ${directors.length} Director users:\n`);

    const passwordsToTest = ['dir123', 'director123', 'els123', 'yushika123', '123456', 'password', 'Director123!'];

    for (const d of directors) {
      console.log(`Email: ${d.email} | Name: ${d.name} | Status: ${d.status}`);
      let matched = false;
      for (const p of passwordsToTest) {
        if (await bcrypt.compare(p, d.password)) {
          console.log(`  -> Password match found: "${p}"`);
          matched = true;
          break;
        }
      }
      if (!matched) {
        console.log(`  -> No match among common test passwords.`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
};

testDirectorPasswords();
