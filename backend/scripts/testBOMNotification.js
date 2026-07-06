import mongoose from 'mongoose';
import dotenv from 'dotenv';
import BOM from '../models/BOM.js';
import Notification from '../models/Notification.js';
import Project from '../models/Project.js';
import User from '../models/userModel.js';


dotenv.config();

const testBOMNotification = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // 1. Get first project
    const project = await Project.findOne({});
    if (!project) {
      console.log('No project found to test.');
      return;
    }
    console.log(`Using project: ${project.projectName} (${project._id})`);

    // 2. Fetch login token for a PM
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pm@els.com', password: 'pm123456' })
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok || !loginData.success) {
      console.log('Failed to log in as PM:', loginData);
      return;
    }
    const token = loginData.data.token;
    console.log('Logged in as PM successfully.');

    // 3. Clear existing BOM notifications to make verification easy
    await Notification.deleteMany({ type: 'BOM_SUBMITTED' });
    console.log('Cleared existing BOM_SUBMITTED notifications.');

    // 4. Submit BOM via API
    const bomRes = await fetch('http://localhost:5000/api/bom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        projectId: project._id,
        status: 'Submitted',
        materials: [
          { name: 'Test Cement', plannedQty: 10, unit: 'bags', category: 'Cement', estimatedUnitCost: 1500 }
        ]
      })
    });

    const bomData = await bomRes.json();
    if (!bomRes.ok || !bomData.success) {
      console.log('Failed to submit BOM:', bomData);
      return;
    }
    console.log('BOM submitted successfully through API!');

    // 5. Query notifications from DB to see if it was created
    const notifications = await Notification.find({ type: 'BOM_SUBMITTED' }).populate('recipientId', 'name role');
    console.log(`\nFound ${notifications.length} BOM_SUBMITTED notification(s) in DB:`);
    notifications.forEach((n, idx) => {
      console.log(`Notification #${idx + 1}:`);
      console.log(`  Recipient: ${n.recipientId?.name} (Role: ${n.recipientId?.role})`);
      console.log(`  Message: "${n.message}"`);
      console.log(`  Link: "${n.link}"`);
      console.log(`  Type: "${n.type}"`);
    });

  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
};

testBOMNotification();
