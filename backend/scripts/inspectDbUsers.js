import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';

dotenv.config();

const passwordsToTest = [
  'admin123',
  'Purchase@123',
  'dir123',
  'pm123456',
  'store123',
  'site123'
];

async function inspectUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`Connected to DB: ${mongoose.connection.host}/${mongoose.connection.name}`);
    
    const users = await User.find({});
    console.log(`Total users found: ${users.length}\n`);

    for (const u of users) {
      const matches = [];
      for (const pwd of passwordsToTest) {
        if (await bcrypt.compare(pwd, u.password)) {
          matches.push(pwd);
        }
      }
      console.log(`User: ${u.name}`);
      console.log(`  Email: "${u.email}" | Username: "${u.username}" | Role: "${u.role}" | Status: ${u.status}`);
      console.log(`  Password Match(es): ${matches.length > 0 ? matches.join(', ') : 'NONE ❌ (hash: ' + u.password.substring(0, 20) + '...)'}`);
      console.log('--------------------------------------------------');
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

inspectUsers();
