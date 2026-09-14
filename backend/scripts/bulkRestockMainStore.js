// One-off remediation script: every Main Store material currently sits at
// quantity 0 (provisioned that way by seedMaterialThresholds.js), which blocks
// Material Request / Issuance flows that check stock availability. This tops
// up every MainStore Material row to its own maximumStock level, going
// through stockService.recordMovement() (type 'Adjustment') so the change is
// captured in the StockMovement ledger like any other stock adjustment,
// instead of writing Material.quantity directly.
//
// Safe to re-run: rows already at or above their maximumStock are skipped.
// Usage: node backend/scripts/bulkRestockMainStore.js
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Material from '../models/Material.js';
import ItemMaster from '../models/ItemMaster.js'; // eslint-disable-line no-unused-vars
import { recordMovement, getDecryptedQuantity } from '../utils/stockService.js';

dotenv.config();

const reference = `BULK-RESTOCK-${new Date().toISOString().slice(0, 10)}`;

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ConstructionDB');
  console.log('Connected to MongoDB for Main Store bulk restock.');

  const materials = await Material.find({ location: 'MainStore' });
  let restocked = 0, skipped = 0;

  for (const material of materials) {
    const currentQty = getDecryptedQuantity(material);
    const targetQty = material.maximumStock;
    const quantityChange = targetQty - currentQty;

    if (quantityChange <= 0) {
      skipped++;
      continue;
    }

    await recordMovement({
      materialDoc: material,
      type: 'Adjustment',
      quantityChange,
      reference,
      reason: 'Bulk restock to healthy stock level',
      notes: 'Automated one-off correction: Main Store was fully depleted, blocking store requests.',
      performedBy: 'System'
    });
    console.log(`${material.materialCode || material.name}: ${currentQty} -> ${targetQty}`);
    restocked++;
  }

  console.log(`Done. Restocked ${restocked} material(s), skipped ${skipped} already at/above max.`);
  await mongoose.disconnect();
};

run().catch(err => {
  console.error('Bulk restock script failed:', err);
  process.exit(1);
});
