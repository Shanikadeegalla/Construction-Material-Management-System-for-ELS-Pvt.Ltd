import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import './models/Supplier.js';
import './models/PurchaseRequest.js';
import PurchaseOrder from './models/PurchaseOrder.js';
import Material from './models/Material.js';
import GRN from './models/GRN.js';
import StockMovement from './models/StockMovement.js';
import MaterialTransferNote from './models/MaterialTransferNote.js';
import MaterialIssuanceNote from './models/MaterialIssuanceNote.js';
import MaterialUsage from './models/MaterialUsage.js';
import Project from './models/Project.js';

async function inspectDB() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('--- PURCHASE ORDERS ---');
  const pos = await PurchaseOrder.find({}).populate('supplier').populate('prId');
  pos.forEach(po => {
    console.log(`ID: ${po._id} | Number: ${po.poNumber} | Status: ${po.status} | Supplier: ${po.supplier?.name || po.supplier} | PR: ${po.prId?.prNumber}`);
    po.items.forEach(i => console.log(`   Item: ${i.materialName}, Qty: ${i.quantity}, Unit: ${i.unit}`));
  });

  console.log('\n--- MAIN STORE MATERIALS ---');
  const materials = await Material.find({});
  materials.forEach(m => {
    console.log(`Material: ${m.name} (${m.materialCode}) | Qty: ${m.quantity} | Unit: ${m.unit} | Min/Reorder: ${m.reorderLevel}`);
  });

  console.log('\n--- PROJECTS ---');
  const projects = await Project.find({});
  projects.forEach(p => console.log(`Project: ${p.projectName} (${p.projectCode}) | ID: ${p._id}`));

  await mongoose.disconnect();
}

inspectDB().catch(console.error);
