// Gives the Site Store a small working inventory: a short list of everyday
// materials (far fewer than the Main Store carries), each with Site Store
// sized Min / Pre-Order / Max levels (see utils/siteStoreLevels.js) and
// stocked up to that Site Store maximum. The top-up is posted through
// stockService.recordMovement so the StockMovement ledger explains where the
// quantity came from.
//
// Safe to re-run: existing Site Store rows are reused, and a material that is
// already at (or above) its maximum is left alone.
//
// Usage (from backend/): node scripts/seedSiteStoreInventory.js
import 'dotenv/config';
import mongoose from 'mongoose';
import ItemMaster from '../models/ItemMaster.js';
import Material from '../models/Material.js';
import { encryptDB, decryptDB } from '../utils/cryptoUtils.js';
import { recordMovement, getDecryptedQuantity } from '../utils/stockService.js';
import { levelsForLocation } from '../utils/siteStoreLevels.js';

const SITE_MATERIAL_CODES = [
  'MAT0001', 'MAT0002', 'MAT0101', 'MAT0105', 'MAT0106', 'MAT0301',
  'MAT0304', 'MAT0401', 'MAT0404', 'MAT0405', 'MAT0406', 'MAT0409',
  'MAT0903', 'MAT0904', 'MAT0905', 'MAT1201', 'MAT1204', 'MAT1401'
];

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ConstructionDB');
  console.log(`Connected to MongoDB (${mongoose.connection.db.databaseName}).`);

  const siteRows = await Material.find({ location: 'SiteStore' });

  for (const code of SITE_MATERIAL_CODES) {
    const master = await ItemMaster.findOne({ materialCode: code });
    if (!master) {
      console.warn(`  SKIPPED ${code}: not in the Item Master.`);
      continue;
    }

    const matches = siteRows.filter(r => decryptDB(r.name) === master.materialName);
    let siteMat = matches.find(r => !r.projectId && !r.project_id) || matches[0];

    if (!siteMat) {
      siteMat = new Material({
        name: encryptDB(master.materialName),
        category: master.category,
        unit: master.unit,
        quantity: encryptDB('0'),
        location: 'SiteStore'
      });
    }

    siteMat.materialCode = master.materialCode;
    siteMat.unitPrice = master.estimatedUnitCost;
    Object.assign(siteMat, levelsForLocation(master, 'SiteStore'));
    await siteMat.save();

    const currentQty = getDecryptedQuantity(siteMat);
    const topUpQty = siteMat.maximumStock - currentQty;
    if (topUpQty <= 0) {
      console.log(`  ${code} ${master.materialName}: already has ${currentQty} ${siteMat.unit} at site (max ${siteMat.maximumStock}) - left as is.`);
      continue;
    }

    await recordMovement({
      materialDoc: siteMat,
      type: 'Adjustment',
      quantityChange: topUpQty,
      reference: 'SITE-OPENING',
      performedBy: 'System (Site Store seed)',
      reason: 'Opening balance'
    });
    console.log(`  ${code} ${master.materialName}: ${currentQty} -> ${siteMat.maximumStock} ${siteMat.unit} (min ${siteMat.minimumStock} / pre-order ${siteMat.reorderLevel} / max ${siteMat.maximumStock})`);
  }

  await mongoose.disconnect();
  console.log('Done.');
};

run().catch(err => {
  console.error('Failed to seed Site Store inventory:', err);
  process.exit(1);
});
