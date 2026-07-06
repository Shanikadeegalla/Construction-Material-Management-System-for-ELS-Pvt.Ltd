import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel.js';

dotenv.config();

const inspectUserEmails = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    await mongoose.connect(mongoUri);

    const users = await User.find({});
    console.log('--- Inspecting user emails (length and characters) ---');
    users.forEach((u) => {
      console.log(`Email: "${u.email}" (Length: ${u.email.length})`);
      const chars = [];
      for (let i = 0; i < u.email.length; i++) {
        chars.push(u.email.charCodeAt(i));
      }
      console.log(`  Char codes: ${chars.join(', ')}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
};

inspectUserEmails();
