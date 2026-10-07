import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import GRN from './models/GRN.js';
import PurchaseOrder from './models/PurchaseOrder.js';

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const po = await PurchaseOrder.findOne({ poNumber: 'PO-2026-025' });
  console.log('PO-2026-025:', po);
  const grns = await GRN.find({ poId: po._id });
  console.log('GRNs for PO-2026-025:', grns);
  await mongoose.disconnect();
}
main().catch(console.error);
