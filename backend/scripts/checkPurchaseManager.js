import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';

dotenv.config();

const passwordsToTest = [
  'Purchase@123',
  'admin123',
  'dir123',
  'pm123456',
  'store123',
  'site123'
];

async function testPurchaseUsers() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ConstructionDB';
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
    console.log(`Connected to DB: ${mongoose.connection.host}/${mongoose.connection.name}`);

    const users = await User.find({
      $or: [
        { email: /purchase/i },
        { username: /purchase/i },
        { role: 'PurchaseManager' }
      ]
    });

    console.log(`Found ${users.length} Purchase Manager user accounts:\n`);

    for (const u of users) {
      console.log(`User: "${u.name}"`);
      console.log(`  _id: ${u._id}`);
      console.log(`  Email: "${u.email}"`);
      console.log(`  Username: "${u.username}"`);
      console.log(`  Role: "${u.role}"`);
      console.log(`  Status: ${u.status}`);

      const matchingPwds = [];
      for (const p of passwordsToTest) {
        if (await bcrypt.compare(p, u.password)) {
          matchingPwds.push(p);
        }
      }
      console.log(`  Matching Passwords: ${matchingPwds.length > 0 ? matchingPwds.join(', ') : 'NONE ❌'}`);
      console.log('--------------------------------------------------');
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

testPurchaseUsers();
