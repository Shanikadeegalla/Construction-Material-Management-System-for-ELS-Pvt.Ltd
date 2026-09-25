import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel.js';
import Project from '../models/Project.js';
import Material from '../models/Material.js';
import TransferLog from '../models/TransferLog.js';
import MaterialUsage from '../models/MaterialUsage.js';

dotenv.config();

const testRBACAndMultiProject = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // 1. Find Colombo Port Expansion project
    const project = await Project.findOne({ projectName: 'Colombo Port Expansion' });
    if (!project) {
      console.log('Project not found.');
      return;
    }
    console.log(`Using project: ${project.projectName} (${project._id})`);

    // 2. Associate sitestore@els.com with this project
    const siteStoreUser = await User.findOne({ email: 'sitestore@els.com' });
    if (!siteStoreUser) {
      console.log('Site store user not found.');
      return;
    }
    siteStoreUser.project_id = project._id;
    siteStoreUser.projectId = project._id;
    await siteStoreUser.save();
    console.log(`Associated sitestore@els.com with project ${project.projectName}.`);

    // 3. Clear existing test transfer logs & site materials for clean run
    await TransferLog.deleteMany({});
    await Material.deleteMany({ location: 'SiteStore' });
    console.log('Cleaned up SiteStore collections for test execution.');

    // 4. Log in as MainStoreOfficer to issue material
    const mainStoreLogin = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'store@els.com', password: 'store123' })
    });
    const mainStoreLoginData = await mainStoreLogin.json();
    const mainStoreToken = mainStoreLoginData.data.token;
    console.log('Logged in as Main Store Officer.');

    // Ensure we have Portland Cement in MainStore with at least 500 qty
    let cement = await Material.findOne({ name: 'Portland Cement', location: 'MainStore' });
    if (!cement) {
      cement = new Material({
        name: 'Portland Cement',
        category: 'Cement',
        unit: 'bags',
        quantity: 1000,
        minimumStock: 10,
        location: 'MainStore',
        unitPrice: 1850
      });
      await cement.save();
    } else {
      cement.quantity = 1000;
      await cement.save();
    }

    // 5. Issue 200 bags of Portland Cement to Colombo Port Expansion
    console.log('\n--- Test POST /api/main-store/issue-to-site ---');
    const issueRes = await fetch('http://localhost:5000/api/main-store/issue-to-site', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mainStoreToken}`
      },
      body: JSON.stringify({
        materialName: 'Portland Cement',
        quantity: 200,
        target_project_id: project._id
      })
    });
    const issueData = await issueRes.json();
    console.log('Issue status:', issueRes.status);
    console.log('Issue response:', JSON.stringify(issueData, null, 2));

    // 6. Log in as SiteStoreOfficer
    const siteStoreLogin = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sitestore@els.com', password: 'site123' })
    });
    const siteStoreLoginData = await siteStoreLogin.json();
    const siteStoreToken = siteStoreLoginData.data.token;
    console.log('\nLogged in as Site Store Officer.');

    // 7. Get Site Inventory
    console.log('\n--- Test GET /api/site/inventory ---');
    const invRes = await fetch('http://localhost:5000/api/site/inventory', {
      headers: { Authorization: `Bearer ${siteStoreToken}` }
    });
    const invData = await invRes.json();
    console.log('Inventory status:', invRes.status);
    console.log('Inventory response data:', JSON.stringify(invData, null, 2));

    if (invData.success && invData.data.length > 0) {
      const siteMatId = invData.data[0]._id;

      // 8. Log material usage (150 bags - should succeed)
      console.log('\n--- Test POST /api/site/material-usage (Conforming) ---');
      const useResA = await fetch('http://localhost:5000/api/site/material-usage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${siteStoreToken}`
        },
        body: JSON.stringify({
          materialId: siteMatId,
          quantity_used: 150,
          purpose: 'Foundation pouring'
        })
      });
      const useDataA = await useResA.json();
      console.log('Usage A status:', useResA.status);
      console.log('Usage A response:', JSON.stringify(useDataA, null, 2));

      // 9. Log material usage (100 bags - should fail since only 50 remain)
      console.log('\n--- Test POST /api/site/material-usage (Shortage / Insufficient) ---');
      const useResB = await fetch('http://localhost:5000/api/site/material-usage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${siteStoreToken}`
        },
        body: JSON.stringify({
          materialId: siteMatId,
          quantity_used: 100,
          purpose: 'Wall plastering'
        })
      });
      const useDataB = await useResB.json();
      console.log('Usage B status (Expected: 400):', useResB.status);
      console.log('Usage B response (Should include MainStore stock):', JSON.stringify(useDataB, null, 2));
    }

    // 10. Log in as Admin to see projects overview
    const adminLogin = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@els.com', password: 'admin123' })
    });
    const adminLoginData = await adminLogin.json();
    const adminToken = adminLoginData.data.token;
    console.log('\nLogged in as Admin.');

    console.log('\n--- Test GET /api/admin/projects-overview ---');
    const overviewRes = await fetch('http://localhost:5000/api/admin/projects-overview', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const overviewData = await overviewRes.json();
    console.log('Overview status:', overviewRes.status);
    console.log('Overview count:', overviewData.data?.length);

  } catch (err) {
    console.error('Error during integration test:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected.');
  }
};

testRBACAndMultiProject();
