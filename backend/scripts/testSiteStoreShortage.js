import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Material from '../models/Material.js';
import User from '../models/userModel.js';


dotenv.config();

const testSiteStoreShortage = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // 1. Log in as a SiteStoreOfficer
    // Let's find a user with role 'SiteStoreOfficer' or use seed user 'sitestore@els.com' / 'site123'
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sitestore@els.com', password: 'site123' })
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok || !loginData.success) {
      console.log('Failed to log in as SiteStoreOfficer:', loginData);
      return;
    }
    const token = loginData.data.token;
    console.log('Logged in as SiteStoreOfficer successfully.');

    // 2. Find a Site Store material
    const siteMat = await Material.findOne({ location: 'SiteStore' });
    if (!siteMat) {
      console.log('No SiteStore materials found to run lookup test.');
    } else {
      console.log(`\nTesting read-only lookup for material ID: ${siteMat._id}`);
      const lookupRes = await fetch(`http://localhost:5000/api/materials/main-store/${siteMat._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const lookupData = await lookupRes.json();
      console.log('Lookup Response Status:', lookupRes.status);
      console.log('Lookup Response Data:', JSON.stringify(lookupData, null, 2));
    }

    // 3. Try to perform a MainStore write action (POST /api/inventory/add) as SiteStoreOfficer
    console.log('\nTesting role restriction block (POST /api/inventory/add)...');
    const writeRes = await fetch('http://localhost:5000/api/inventory/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'Unauthorized Material Add Attempt',
        category: 'Cement',
        unit: 'bag',
        quantity: 100,
        minimumStock: 10,
        location: 'MainStore'
      })
    });
    const writeData = await writeRes.json();
    console.log('Write Action Response Status (Expected: 403):', writeRes.status);
    console.log('Write Action Response Data:', JSON.stringify(writeData, null, 2));

  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected.');
  }
};

testSiteStoreShortage();
