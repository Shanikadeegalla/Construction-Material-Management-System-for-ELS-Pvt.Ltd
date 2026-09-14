import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel.js';
import Material from '../models/Material.js';
import Project from '../models/Project.js';

dotenv.config();

const listStoresAndUsers = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    await mongoose.connect(mongoUri);

    // ---- Stores (locations) ----
    // Main Store: a single logical location, not tied to a project.
    const mainStoreCount = await Material.countDocuments({ location: 'MainStore' });

    // Site Stores: one per project that has SiteStore materials.
    const siteStoreProjectIds = await Material.distinct('projectId', { location: 'SiteStore' });

    const siteStores = [];
    for (const pid of siteStoreProjectIds) {
      const count = await Material.countDocuments({ location: 'SiteStore', projectId: pid });
      let projectLabel = '(no project linked)';
      if (pid) {
        const proj = await Project.findById(pid).select('projectId projectName status');
        projectLabel = proj ? `${proj.projectName} (${proj.projectId}) — ${proj.status}` : `Unknown project (${pid})`;
      }
      siteStores.push({ projectLabel, materialCount: count });
    }

    console.log('\n=== STORES ===');
    console.log(`Main Store — 1 location, ${mainStoreCount} material record(s)`);
    if (siteStores.length === 0) {
      console.log('No Site Store locations found (no materials with location=SiteStore).');
    } else {
      siteStores.forEach((s, i) => {
        console.log(`Site Store #${i + 1}: ${s.projectLabel} — ${s.materialCount} material record(s)`);
      });
    }

    // ---- Users ----
    const users = await User.find({}).select('name email role employeeId status projectId project_id').sort({ role: 1, name: 1 });
    console.log(`\n=== USERS (${users.length}) ===`);
    users.forEach((u, i) => {
      console.log(`${i + 1}. ${u.name} | ${u.email} | ${u.role} | employeeId=${u.employeeId || 'N/A'} | status=${u.status === false ? 'Deactivated' : 'Active'}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
};

listStoresAndUsers();
