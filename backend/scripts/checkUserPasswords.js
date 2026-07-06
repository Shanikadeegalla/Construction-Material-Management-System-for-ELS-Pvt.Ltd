import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';

dotenv.config();

const checkPasswords = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    await mongoose.connect(mongoUri);

    const testUsers = [
      { email: 'pm@els.com', possiblePasswords: ['pm123', 'pm1234', 'els123', 'kamal123'] },
      { email: 'purchase@els.com', possiblePasswords: ['purchase123', 'purchase1234', 'els123', 'nimal123'] },
      { email: 'director@els.com', possiblePasswords: ['dir123', 'director123', 'els123'] }
    ];

    for (const tu of testUsers) {
      const user = await User.findOne({ email: tu.email });
      if (!user) {
        console.log(`User ${tu.email} not found.`);
        continue;
      }

      console.log(`\nUser: ${user.email} (Role: ${user.role})`);
      for (const pwd of tu.possiblePasswords) {
        const isMatch = await bcrypt.compare(pwd, user.password);
        if (isMatch) {
          console.log(`  ➔ Password matches: "${pwd}"`);
          break;
        }
      }
    }

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
};

checkPasswords();
