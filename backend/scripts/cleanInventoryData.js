import 'dotenv/config';
import mongoose from 'mongoose';
import Material from '../models/Material.js';

const DUMMY_IDS = [
  '6a4beb1ebd21d32c5a9ac392', // sand
  '6a48858079d1e5b99d0bb776', // bricks
  '6a56794a700d653c6d20c0bb', // cement
  '6aa66d8b42284bf73b0e444d', // pvc 10mm
  '6aa66d8c42284bf73b0e4454', // materialtest
  '6abf85be74a4926643f8b6a2', // cement (SiteStore)
];

const DUPLICATE_ORPHAN_IDS = [
  '6a3f7c8b2cc2c988fd01cb4a', // Portland Cement duplicate MAT0135
  '6a3f99ed0b245a667f614281', // River Sand duplicate MAT0101
  '6a3f81042cc2c988fd01cbbc', // Portland Cement duplicate MAT0135
  '6a4bfd542ac033160350dc95', // Portland Cement missing code
  '6a60780a298ad4d589608228', // 20mm TMT Bar duplicate MAT0406
  '6a60847b298ad4d58960fa6a', // 16mm TMT Bar duplicate MAT0405
  '6aa66d1542284bf73b0e40f3', // OPC 50kg duplicate MAT0001
  '6aa66d2242284bf73b0e4152', // 20mm Aggregate duplicate MAT0106
  '6aa66d2c42284bf73b0e41be', // Prestressed Concrete Beam duplicate MAT0301
];

async function cleanInventory() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const totalBefore = await Material.countDocuments();
    console.log(`Initial total inventory count: ${totalBefore}`);

    const targetIds = [...DUMMY_IDS, ...DUPLICATE_ORPHAN_IDS];
    const deleteResult = await Material.deleteMany({ _id: { $in: targetIds } });

    console.log(`Successfully removed ${deleteResult.deletedCount} dummy and duplicate records.`);

    const totalAfter = await Material.countDocuments();
    console.log(`Final total valid inventory count: ${totalAfter}`);

    await mongoose.disconnect();
    console.log('MongoDB connection closed.');
  } catch (err) {
    console.error('Error during cleanup:', err);
    process.exit(1);
  }
}

cleanInventory();
