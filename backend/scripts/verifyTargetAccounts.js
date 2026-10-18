import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ensureDefaultUsersExist } from './verifyAndSeedUsers.js';
import User from '../models/userModel.js';
import generateToken from '../utils/generateToken.js';

dotenv.config();

const targetAccounts = [
  { role: 'Admin', email: 'adminO@els.com', password: 'admin123' },
  { role: 'PurchaseManager', email: 'PurchaseManager@els.com', password: 'Purchase@123' },
  { role: 'Director', email: 'director@els.com', password: 'dir123' },
  { role: 'ProjectManager', email: 'pm@els.com', password: 'pm123456' },
  { role: 'MainStoreOfficer', email: 'store@els.com', password: 'store123' },
  { role: 'SiteStoreOfficer', email: 'sitestore@els.com', password: 'site123' }
];

async function testAllTargetLogins() {
  try {
    const primaryUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ConstructionDB';
    const localUri = 'mongodb://127.0.0.1:27017/ConstructionDB';

    try {
      console.log(`Connecting to primary MongoDB...`);
      await mongoose.connect(primaryUri, { serverSelectionTimeoutMS: 3000, socketTimeoutMS: 5000 });
    } catch (primaryErr) {
      console.warn(`Primary MongoDB connection failed (${primaryErr.message}). Attempting local fallback...`);
      await mongoose.connect(localUri, { serverSelectionTimeoutMS: 3000, socketTimeoutMS: 5000 });
    }
    console.log(`Connected to Host: ${mongoose.connection.host}, Database: ${mongoose.connection.name}`);

    console.log('\n--- Running ensureDefaultUsersExist() ---');
    const summary = await ensureDefaultUsersExist();
    console.table(summary);

    console.log('\n--- Testing Authentication & Login for all 6 Target Accounts ---');
    let allPassed = true;

    for (const acc of targetAccounts) {
      const cleanEmail = acc.email.toLowerCase().trim();
      const user = await User.findOne({ email: cleanEmail });

      if (!user) {
        console.error(`❌ FAIL: User not found for email ${acc.email}`);
        allPassed = false;
        continue;
      }

      const isPasswordValid = await user.matchPassword(acc.password);
      if (!isPasswordValid) {
        console.error(`❌ FAIL: Password mismatch for ${acc.role} (${acc.email})`);
        allPassed = false;
        continue;
      }

      if (user.role !== acc.role) {
        console.error(`❌ FAIL: Role mismatch for ${acc.email}: expected ${acc.role}, found ${user.role}`);
        allPassed = false;
        continue;
      }

      const token = generateToken(user._id);
      const isTokenValid = typeof token === 'string' && token.split('.').length === 3;

      if (!isTokenValid) {
        console.error(`❌ FAIL: JWT Token generation failed for ${acc.email}`);
        allPassed = false;
        continue;
      }

      console.log(`✅ SUCCESS: [${user.role}] ${acc.email} -> password verified, JWT generated!`);
    }

    console.log('\n--------------------------------------------------');
    if (allPassed) {
      console.log('🎉 ALL 6 TARGET ACCOUNTS VERIFIED SUCCESSFULLY!');
    } else {
      console.error('⚠️ SOME ACCOUNTS FAILED VERIFICATION.');
    }
    console.log('--------------------------------------------------\n');

    await mongoose.disconnect();
    process.exit(allPassed ? 0 : 1);
  } catch (err) {
    console.error('Error during test execution:', err);
    process.exit(1);
  }
}

testAllTargetLogins();
