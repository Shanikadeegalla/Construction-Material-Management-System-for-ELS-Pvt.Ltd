import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel.js';
import Project from '../models/Project.js';
import Material from '../models/Material.js';
import TransferLog from '../models/TransferLog.js';

dotenv.config();

const testInTransitAndUsageShortage = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    const project = await Project.findOne({ projectName: 'Colombo Port Expansion' });
    if (!project) {
      console.log('Project "Colombo Port Expansion" not found.');
      return;
    }

    // 1. Get tokens
    const msLogin = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'store@els.com', password: 'store123' })
    });
    const msToken = (await msLogin.json()).data.token;

    const ssLogin = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sitestore@els.com', password: 'site123' })
    });
    const ssToken = (await ssLogin.json()).data.token;

    // Reset stock and logs
    await Material.deleteMany({ location: 'SiteStore' });
    await TransferLog.deleteMany({});
    await Material.updateOne(
      { name: 'Portland Cement', location: 'MainStore' },
      { $set: { quantity: 500 } },
      { upsert: true }
    );
    console.log('Reset completed. MainStore has 500 bags of Portland Cement.');

    // 2. Issue 100 bags (Stock Transfer)
    console.log('\n--- SCENARIO 1: Process Stock Transfer (100 bags) ---');
    const issueRes = await fetch('http://localhost:5000/api/inventory/issue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${msToken}`
      },
      body: JSON.stringify({
        materialId: (await Material.findOne({ name: 'Portland Cement', location: 'MainStore' }))._id,
        quantity: 100,
        projectId: project._id,
        projectName: project.projectName
      })
    });
    const issueData = await issueRes.json();
    console.log('Issue response status:', issueRes.status);
    console.log('Transfer log details (Expected: In-Transit):', JSON.stringify(issueData.transferLog, null, 2));

    // Verify Site Store inventory has NOT increased
    const siteInvCountBefore = await Material.countDocuments({ location: 'SiteStore' });
    console.log('SiteStore materials count immediately after transfer (Expected: 0):', siteInvCountBefore);

    // 3. Confirm receipt
    const txId = issueData.transferLog._id;
    console.log(`\n--- SCENARIO 2: Site Storekeeper Confirms Receipt of Transfer ${txId} ---`);
    const confirmRes = await fetch(`http://localhost:5000/api/site/confirm-transfer/${txId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ssToken}`
      }
    });
    const confirmData = await confirmRes.json();
    console.log('Confirm response status:', confirmRes.status);
    console.log('Confirm response payload:', JSON.stringify(confirmData, null, 2));

    // Verify Site Store inventory HAS increased
    const siteMat = await Material.findOne({ location: 'SiteStore' });
    const cryptoUtils = await import('../utils/cryptoUtils.js');
    const siteQty = siteMat ? Number(cryptoUtils.decryptDB(siteMat.quantity)) : 0;
    console.log('SiteStore material status after confirm receipt (Expected: 100):', siteQty);

    const logAfter = await TransferLog.findById(txId);
    console.log('Transfer log status after receipt (Expected: Received):', logAfter.status);

    // 4. Try to record usage exceeding available stock (e.g. 150 bags)
    console.log('\n--- SCENARIO 3: Site Storekeeper logs usage of 150 bags (exceeds site stock 100) ---');
    const usageRes = await fetch('http://localhost:5000/api/site/material-usage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ssToken}`
      },
      body: JSON.stringify({
        materialId: siteMat._id,
        quantity_used: 150,
        purpose: 'Foundation'
      })
    });
    const usageData = await usageRes.json();
    console.log('Usage log response status (Expected: 400):', usageRes.status);
    console.log('Usage log response (Expected Main Store available stock reference):', JSON.stringify(usageData, null, 2));

  } catch (err) {
    console.error('Error in test:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected.');
  }
};

testInTransitAndUsageShortage();
