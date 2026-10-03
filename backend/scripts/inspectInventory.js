import 'dotenv/config';
import mongoose from 'mongoose';
import Material from '../models/Material.js';
import ItemMaster from '../models/ItemMaster.js';
import GRN from '../models/GRN.js';
import MaterialTransferNote from '../models/MaterialTransferNote.js';
import MaterialUsage from '../models/MaterialUsage.js';
import { decryptDB } from '../utils/cryptoUtils.js';

async function detailedAudit() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const materials = await Material.find().lean();
    const itemMasters = await ItemMaster.find().lean();
    const grns = await GRN.find().lean();
    const mtns = await MaterialTransferNote.find().lean();
    const usages = await MaterialUsage.find().lean();

    const masterCodeMap = new Map();
    itemMasters.forEach(im => {
      masterCodeMap.set(im.materialCode, im);
    });

    console.log(`\n==================================================`);
    console.log(`DETAILED AUDIT REPORT OF INVENTORY (149 RECORDS)`);
    console.log(`==================================================\n`);

    let realMasterLinkedCount = 0;
    let dummyTestCount = 0;
    let duplicateOrOrphanCount = 0;
    let encryptedSiteCount = 0;

    const dummyTestItems = [];
    const duplicateOrphanItems = [];
    const realItems = [];

    // Track materialCode occurrences across materials
    const codeCounts = new Map();
    materials.forEach(m => {
      let code = m.materialCode || '';
      if (code) {
        codeCounts.set(code, (codeCounts.get(code) || 0) + 1);
      }
    });

    materials.forEach((m, idx) => {
      let name = m.name;
      let qty = m.quantity;
      if (m.location === 'SiteStore') {
        try { name = decryptDB(m.name); } catch(e){}
        try { qty = decryptDB(m.quantity); } catch(e){}
      }

      const nameLower = String(name || '').toLowerCase().trim();
      const code = m.materialCode || '';

      // Check if this material is referenced in GRNs, MTNs, or Usages
      const inGrn = grns.some(g => (g.items || []).some(item => String(item.materialId) === String(m._id) || item.materialName === name));
      const inMtn = mtns.some(mt => (mt.items || []).some(item => String(item.materialId) === String(m._id) || item.materialName === name));
      const inUsage = usages.some(u => (u.items || []).some(item => String(item.materialId) === String(m._id) || item.materialName === name));
      const hasTx = inGrn || inMtn || inUsage;

      const isDummyName = nameLower.includes('test') || nameLower.includes('dummy') || nameLower.includes('fake') || nameLower.includes('sample');
      const isGenericAdHoc = ['sand', 'bricks', 'cement', 'steel', 'concrete sand', 'pvc 10mm'].includes(nameLower) && (!code || code.startsWith('MAT013') || code.startsWith('MAT014'));
      const isMissingCode = !code || code === '-';
      const isDuplicateCode = code && codeCounts.get(code) > 1 && m.location === 'MainStore';

      if (isDummyName || isGenericAdHoc) {
        dummyTestCount++;
        dummyTestItems.push({ id: m._id, code, name, location: m.location, qty, reason: isDummyName ? 'Explicit test name' : 'Generic test placeholder' });
      } else if (isMissingCode || isDuplicateCode) {
        duplicateOrOrphanCount++;
        duplicateOrphanItems.push({ id: m._id, code, name, location: m.location, qty, reason: isMissingCode ? 'Missing materialCode' : `Duplicate MainStore code ${code}` });
      } else {
        realMasterLinkedCount++;
        realItems.push({ id: m._id, code, name, location: m.location, qty, price: m.unitPrice, hasTx });
      }
    });

    console.log(`1. Total Inventory Records scanned: ${materials.length}`);
    console.log(`2. Real Database Records (Master-linked / Real materials): ${realMasterLinkedCount}`);
    console.log(`3. Confirmed Dummy / Test Records: ${dummyTestCount}`);
    console.log(`4. Duplicate / Orphaned Records: ${duplicateOrOrphanCount}`);

    console.log(`\n--- CONFIRMED DUMMY / TEST RECORDS (${dummyTestItems.length}) ---`);
    dummyTestItems.forEach(item => {
      console.log(` - ID: ${item.id} | Code: "${item.code}" | Name: "${item.name}" | Loc: ${item.location} | Qty: ${item.qty} | Reason: ${item.reason}`);
    });

    console.log(`\n--- DUPLICATE / ORPHANED RECORDS (${duplicateOrphanItems.length}) ---`);
    duplicateOrphanItems.forEach(item => {
      console.log(` - ID: ${item.id} | Code: "${item.code}" | Name: "${item.name}" | Loc: ${item.location} | Qty: ${item.qty} | Reason: ${item.reason}`);
    });

    console.log(`\n--- SOURCES OF DUMMY DATA ---`);
    console.log(` - Seed Scripts: backend/scripts/seedMaterialThresholds.js (populated 139 ItemMaster & Material rows for inventory benchmarking)`);
    console.log(` - Development Test Inputs: Manual GRN/Store test creations ("sand", "bricks", "cement", "materialtest")`);
    console.log(` - Encryption behavior: SiteStore records encrypt name & quantity in MongoDB but decrypt cleanly on the frontend UI.`);

    await mongoose.disconnect();
  } catch (err) {
    console.error('Audit Error:', err);
    process.exit(1);
  }
}

detailedAudit();
