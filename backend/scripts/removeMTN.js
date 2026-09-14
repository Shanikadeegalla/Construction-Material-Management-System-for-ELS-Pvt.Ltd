// One-off remediation script: fully reverses and deletes a specific Material
// Transfer Note. Reversing means undoing every stock movement it caused
// (Main Store gets its quantity back, Site Store loses it - via
// stockService.recordMovement so the StockMovement ledger stays accurate),
// rolling back the source MaterialRequest's per-line fulfilledQty/status if
// it was linked to one, then deleting the MTN document itself.
//
// Usage: node backend/scripts/removeMTN.js MTN-2026-002
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import MaterialTransferNote from '../models/MaterialTransferNote.js';
import MaterialRequest from '../models/MaterialRequest.js';
import Material from '../models/Material.js';
import { recordMovement } from '../utils/stockService.js';

dotenv.config();

const mtnNumber = process.argv[2];

const run = async () => {
  if (!mtnNumber) {
    console.error('Usage: node backend/scripts/removeMTN.js <MTN-NUMBER>');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ConstructionDB');
  console.log('Connected to MongoDB.');

  const mtn = await MaterialTransferNote.findOne({ mtnNumber });
  if (!mtn) {
    console.error(`No Material Transfer Note found with number ${mtnNumber}.`);
    process.exit(1);
  }

  console.log(`Reversing ${mtn.mtnNumber} (Site Store: ${mtn.siteStoreName}, ${mtn.materials.length} material line(s))...`);

  for (const line of mtn.materials) {
    const qty = Number(line.transferQty);

    const mainMat = await Material.findOne({ name: line.materialName, location: 'MainStore' });
    if (mainMat) {
      await recordMovement({
        materialDoc: mainMat,
        type: 'MTN Transfer Out',
        quantityChange: qty,
        reference: `${mtn.mtnNumber}-REMOVED`,
        performedBy: 'System (MTN removal)'
      });
      console.log(`  Main Store: +${qty} ${line.unit} ${line.materialName}`);
    } else {
      console.warn(`  WARNING: Main Store material "${line.materialName}" not found - could not restore stock.`);
    }

    const siteMats = await Material.find({
      location: 'SiteStore',
      $or: [{ project_id: mtn.siteStoreId }, { projectId: mtn.siteStoreId }]
    });
    const { decryptDB } = await import('../utils/cryptoUtils.js');
    const siteMat = siteMats.find(sm => decryptDB(sm.name) === line.materialName);
    if (siteMat) {
      await recordMovement({
        materialDoc: siteMat,
        type: 'MTN Transfer In',
        quantityChange: -qty,
        reference: `${mtn.mtnNumber}-REMOVED`,
        performedBy: 'System (MTN removal)'
      });
      console.log(`  Site Store: -${qty} ${line.unit} ${line.materialName}`);
    } else {
      console.warn(`  WARNING: Site Store material "${line.materialName}" not found - could not reverse site stock.`);
    }
  }

  if (mtn.sourceRequestId) {
    const sourceRequest = await MaterialRequest.findById(mtn.sourceRequestId);
    if (sourceRequest) {
      for (const line of mtn.materials) {
        const reqLine = sourceRequest.materials.find(m => m.materialName === line.materialName);
        if (reqLine) {
          reqLine.fulfilledQty = Math.max(0, (reqLine.fulfilledQty || 0) - Number(line.transferQty));
        }
      }
      const anyFulfilled = sourceRequest.materials.some(m => (m.fulfilledQty || 0) > 0);
      const allFulfilled = sourceRequest.materials.every(m => (m.fulfilledQty || 0) >= m.quantity);
      if (['Transferred', 'Partially Transferred'].includes(sourceRequest.status)) {
        sourceRequest.status = allFulfilled ? 'Transferred' : (anyFulfilled ? 'Partially Transferred' : 'Pending');
      }
      if (sourceRequest.mtnNumber === mtn.mtnNumber) {
        sourceRequest.mtnNumber = '';
        sourceRequest.transferNoteId = null;
      }
      await sourceRequest.save();
      console.log(`  Rolled back fulfilledQty on request ${sourceRequest.requestNo}; status is now "${sourceRequest.status}".`);
    } else {
      console.warn(`  WARNING: Source request ${mtn.sourceRequestId} not found - could not roll back its fulfilledQty.`);
    }
  }

  await MaterialTransferNote.deleteOne({ _id: mtn._id });
  console.log(`Deleted ${mtn.mtnNumber}.`);

  await mongoose.disconnect();
  console.log('Done.');
};

run().catch(err => {
  console.error('Failed to remove MTN:', err);
  process.exit(1);
});
