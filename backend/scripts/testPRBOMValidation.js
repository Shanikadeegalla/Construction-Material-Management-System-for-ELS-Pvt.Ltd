import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Project from '../models/Project.js';
import BOM from '../models/BOM.js';
import PurchaseRequest from '../models/PurchaseRequest.js';

dotenv.config();

const testPRBOMValidation = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // 1. Log in as SiteStoreOfficer to get token
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sitestore@els.com', password: 'site123' })
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok || !loginData.success) {
      console.log('Failed to log in:', loginData);
      return;
    }
    const token = loginData.data.token;
    console.log('Logged in successfully.');

    // 2. Find a project and its approved BOM
    const project = await Project.findOne({ projectName: 'Colombo Port Expansion' });
    if (!project) {
      console.log('Project "Colombo Port Expansion" not found.');
      return;
    }
    const approvedBom = await BOM.findOne({ projectId: project._id, status: 'Approved' });
    if (!approvedBom) {
      console.log('No approved BOM found for this project.');
      return;
    }
    console.log(`\nApproved BOM found for project: "${project.projectName}"`);
    console.log('BOM Materials:', JSON.stringify(approvedBom.materials, null, 2));

    const testMaterials = approvedBom.materials;
    if (testMaterials.length === 0) {
      console.log('No materials in approved BOM.');
      return;
    }
    const validMaterialName = testMaterials[0].name;
    const validMaterialLimit = testMaterials[0].plannedQty;

    // SCENARIO A: PR with a material not in the BOM
    console.log(`\n--- SCENARIO A: Submitting PR with invalid material "Unauthorized Gold" ---`);
    const resA = await fetch('http://localhost:5000/api/purchase-requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        project: project.projectName,
        materials: [{ materialName: 'Unauthorized Gold', quantity: 5, unit: 'bag', reason: 'Luxury building' }]
      })
    });
    const dataA = await resA.json();
    console.log('Status Code:', resA.status);
    console.log('Response:', JSON.stringify(dataA, null, 2));

    // SCENARIO B: PR with quantity exceeding the BOM limit
    const excessiveQty = validMaterialLimit + 500;
    console.log(`\n--- SCENARIO B: Submitting PR with excessive qty of "${validMaterialName}" (${excessiveQty} vs limit ${validMaterialLimit}) ---`);
    const resB = await fetch('http://localhost:5000/api/purchase-requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        project: project.projectName,
        materials: [{ materialName: validMaterialName, quantity: excessiveQty, unit: 'bag', reason: 'Extra layout' }]
      })
    });
    const dataB = await resB.json();
    console.log('Status Code:', resB.status);
    console.log('Response:', JSON.stringify(dataB, null, 2));

    // SCENARIO C: Conforming PR (valid material and quantity)
    const conformingQty = Math.max(1, Math.floor(validMaterialLimit / 2));
    console.log(`\n--- SCENARIO C: Submitting conforming PR for "${validMaterialName}" (Qty: ${conformingQty} vs limit ${validMaterialLimit}) ---`);
    const resC = await fetch('http://localhost:5000/api/purchase-requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        project: project.projectName,
        materials: [{ materialName: validMaterialName, quantity: conformingQty, unit: 'bag', reason: 'Standard local store replenishment' }]
      })
    });
    const dataC = await resC.json();
    console.log('Status Code:', resC.status);
    console.log('Response:', JSON.stringify(dataC, null, 2));

  } catch (err) {
    console.error('Error during validation test:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected.');
  }
};

testPRBOMValidation();
