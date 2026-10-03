// One-off remediation script: fully reverses and deletes a specific Material
// Transfer Note. Reversing means undoing every stock movement it caused
// (Main Store gets its quantity back; Site Store loses it, but only if the
// note was actually received - an In Transit note never reached site stock -
// via stockService.recordMovement so the StockMovement ledger stays accurate),
// rolling back the source MaterialRequest's per-line fulfilledQty/status if
// it was linked to one, then deleting the MTN document itself.
//
// Every line is checked before anything is changed, so a note whose stock has
// already been issued/used at site is refused outright rather than half
// reversed.
//
// Usage (from backend/): node scripts/removeMTN.js MTN-2026-002
// dotenv/config must stay the first import: cryptoUtils reads ENCRYPTION_KEY
// when it is imported.
import 'dotenv/config';
import mongoose from 'mongoose';
import MaterialTransferNote from '../models/MaterialTransferNote.js';
import MaterialRequest from '../models/MaterialRequest.js';
import Material from '../models/Material.js';
import Notification from '../models/Notification.js';
import { recordMovement, getDecryptedQuantity } from '../utils/stockService.js';
import { decryptDB } from '../utils/cryptoUtils.js';

const mtnNumber = process.argv[2];

const fail = async (message) => {
  console.error(message);
  await mongoose.disconnect();
  process.exit(1);
};

// Same rule receiveTransferNote uses to pick the Site Store line (general
// pool line first, else any line with that name), except that a legacy note
// issued to a project's own Site Store prefers that project's line.
const findSiteMaterial = (siteMats, materialName, siteStoreId) => {
  const matches = siteMats.filter(sm => decryptDB(sm.name) === materialName);
  if (siteStoreId) {
    const forProject = matches.find(sm => String(sm.project_id || sm.projectId || '') === String(siteStoreId));
    if (forProject) return forProject;
  }
  return matches.find(sm => !sm.projectId && !sm.project_id) || matches[0] || null;
};

const run = async () => {
  if (!mtnNumber) {
    console.error('Usage: node scripts/removeMTN.js <MTN-NUMBER>');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ConstructionDB');
  console.log('Connected to MongoDB.');

  const mtn = await MaterialTransferNote.findOne({ mtnNumber });
  if (!mtn) {
    await fail(`No Material Transfer Note found with number ${mtnNumber}.`);
  }

  // In Transit = Main Store stock deducted, nothing added at site yet.
  const reachedSite = ['Received', 'Transferred'].includes(mtn.status);
  console.log(`Reversing ${mtn.mtnNumber} (${mtn.status}, Site Store: ${mtn.siteStoreName}, ${mtn.materials.length} material line(s))...`);

  // Plan and validate every line before mutating anything.
  const siteMats = reachedSite ? await Material.find({ location: 'SiteStore' }) : [];
  const plan = [];
  const problems = [];
  const siteQtyNeeded = {};
  for (const line of mtn.materials) {
    const qty = Number(line.transferQty);

    const mainMat = await Material.findOne({ name: line.materialName, location: 'MainStore' });
    if (!mainMat) problems.push(`Main Store material "${line.materialName}" not found - cannot restore its stock.`);

    let siteMat = null;
    if (reachedSite) {
      siteMat = findSiteMaterial(siteMats, line.materialName, mtn.siteStoreId);
      if (!siteMat) {
        problems.push(`Site Store material "${line.materialName}" not found - cannot reverse its stock.`);
      } else {
        const key = String(siteMat._id);
        siteQtyNeeded[key] = (siteQtyNeeded[key] || 0) + qty;
        const available = getDecryptedQuantity(siteMat);
        if (available < siteQtyNeeded[key]) {
          problems.push(`Site Store only holds ${available} ${line.unit} of "${line.materialName}" but ${siteQtyNeeded[key]} must be taken back - some was already issued or used.`);
        }
      }
    }

    plan.push({ line, qty, mainMat, siteMat });
  }

  if (problems.length > 0) {
    await fail(`Refusing to remove ${mtn.mtnNumber}; nothing was changed:\n  - ${problems.join('\n  - ')}`);
  }

  const startedAt = new Date();
  for (const { line, qty, mainMat, siteMat } of plan) {
    await recordMovement({
      materialDoc: mainMat,
      type: 'MTN Transfer Out',
      quantityChange: qty,
      reference: `${mtn.mtnNumber}-REMOVED`,
      performedBy: 'System (MTN removal)'
    });
    console.log(`  Main Store: +${qty} ${line.unit} ${line.materialName}`);

    if (siteMat) {
      await recordMovement({
        materialDoc: siteMat,
        type: 'MTN Transfer In',
        quantityChange: -qty,
        reference: `${mtn.mtnNumber}-REMOVED`,
        performedBy: 'System (MTN removal)'
      });
      console.log(`  Site Store: -${qty} ${line.unit} ${line.materialName}`);
    }
  }

  // Taking stock back off the site can cross a reorder/minimum level and make
  // recordMovement raise a low-stock alert. That alert is an artefact of the
  // removal, not a real shortage, so drop the ones this run just created.
  const siteNames = plan.filter(p => p.siteMat).map(p => p.line.materialName);
  if (siteNames.length > 0) {
    const raised = await Notification.find({ type: 'LOW_STOCK', createdAt: { $gte: startedAt } });
    const stale = raised.filter(n => siteNames.some(name => n.message.includes(`stock in Site Store: ${name} is at`)));
    if (stale.length > 0) {
      await Notification.deleteMany({ _id: { $in: stale.map(n => n._id) } });
      console.log(`  Removed ${stale.length} low-stock notification(s) raised by this reversal.`);
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
