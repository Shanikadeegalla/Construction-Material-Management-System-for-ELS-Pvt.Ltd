import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import PurchaseOrder from './models/PurchaseOrder.js';

async function checkPOs() {
  await mongoose.connect(process.env.MONGO_URI);
  const pos = await PurchaseOrder.find({});
  console.log(`Total POs: ${pos.length}`);
  pos.forEach(po => {
    console.log(`PO: ${po.poNumber} | Status: ${po.status} | ID: ${po._id}`);
    if (po.items && po.items.length) {
      po.items.forEach(i => console.log(`   - Item: ${i.materialName}, Ordered: ${i.quantity}, Unit: ${i.unit}`));
    }
  });
  await mongoose.disconnect();
}

checkPOs().catch(console.error);
