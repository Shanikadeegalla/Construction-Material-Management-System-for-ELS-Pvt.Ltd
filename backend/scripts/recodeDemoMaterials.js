// One-off remediation script: seedDemoData.js originally created four Item
// Master records with their own code style (MAT-CEM-001 ...). This re-codes
// them to the standard sequential MAT0001 style used everywhere else, on the
// Item Master record and on any stock row that already picked the old code up.
//
// Usage (from backend/): node scripts/recodeDemoMaterials.js
import 'dotenv/config';
import mongoose from 'mongoose';
import ItemMaster from '../models/ItemMaster.js';
import Material from '../models/Material.js';

const RECODE = {
  'MAT-CEM-001': 'MAT0145',
  'MAT-STL-001': 'MAT0146',
  'MAT-SND-001': 'MAT0147',
  'MAT-AGG-001': 'MAT0148'
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ConstructionDB');
  console.log(`Connected to MongoDB (${mongoose.connection.db.databaseName}).`);

  for (const [from, to] of Object.entries(RECODE)) {
    if (await ItemMaster.exists({ materialCode: to })) {
      console.warn(`  SKIPPED ${from}: ${to} is already in use.`);
      continue;
    }
    const master = await ItemMaster.updateOne({ materialCode: from }, { $set: { materialCode: to } });
    const stock = await Material.updateMany({ materialCode: from }, { $set: { materialCode: to } });
    console.log(`  ${from} -> ${to} (item master: ${master.modifiedCount}, stock rows: ${stock.modifiedCount})`);
  }

  await mongoose.disconnect();
  console.log('Done.');
};

run().catch(err => {
  console.error('Failed to re-code materials:', err);
  process.exit(1);
});
