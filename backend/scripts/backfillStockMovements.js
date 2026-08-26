// One-time backfill: the Stock Ledger used to be reconstructed on every
// request from GRN + TransferLog documents. Now that stock movements are
// recorded permanently in StockMovement as they happen, this script seeds
// StockMovement rows for GRN/TransferLog history that predates this change,
// so switching over doesn't erase existing movement visibility. Running
// balances are recomputed chronologically per material, starting from 0,
// the same way the old on-the-fly Stock Ledger computed them.
//
// Safe to re-run: each candidate row's `material` + `type` + `reference` is
// checked against what's already in StockMovement before inserting.
//
// Usage: node backend/scripts/backfillStockMovements.js
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import GRN from '../models/GRN.js';
import TransferLog from '../models/TransferLog.js';
import Material from '../models/Material.js';
import StockMovement from '../models/StockMovement.js';
import { decryptDB } from '../utils/cryptoUtils.js';

dotenv.config();

const collectCandidates = async () => {
  const [grns, transfers] = await Promise.all([
    GRN.find().populate('items.material').sort({ receivedDate: 1 }),
    TransferLog.find({ from: 'MainStore' }).sort({ date: 1 })
  ]);

  const candidates = [];

  grns.forEach(grn => {
    (grn.items || []).forEach(item => {
      if (!item.material || !item.receivedQty) return;
      candidates.push({
        material: item.material._id,
        materialName: item.material.location === 'SiteStore' ? decryptDB(item.material.name) : item.material.name,
        unit: item.material.unit,
        location: item.material.location || 'MainStore',
        type: 'GRN Receipt',
        quantityChange: item.receivedQty,
        reference: grn.grnNumber,
        performedBy: grn.receivedBy,
        notes: grn.notes || '',
        date: grn.receivedDate || grn.createdAt
      });
    });
  });

  for (const t of transfers) {
    const material = await Material.findById(t.materialId);
    candidates.push({
      material: t.materialId,
      materialName: decryptDB(t.materialName),
      unit: material ? material.unit : '',
      location: 'MainStore',
      type: 'MIN Issue',
      quantityChange: -(Number(decryptDB(t.quantity)) || 0),
      reference: t.minId ? String(t.minId) : String(t._id),
      performedBy: t.issuedBy,
      notes: `Issued to ${t.to}`,
      date: t.date
    });
  }

  candidates.sort((a, b) => new Date(a.date) - new Date(b.date));
  return candidates;
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ConstructionDB');
  console.log('Connected to MongoDB for backfill.');

  const candidates = await collectCandidates();
  const runningBalance = {};
  let inserted = 0;
  let skipped = 0;

  for (const c of candidates) {
    const materialKey = String(c.material);
    const balanceAfter = (runningBalance[materialKey] || 0) + c.quantityChange;
    runningBalance[materialKey] = balanceAfter;

    const exists = await StockMovement.findOne({ material: c.material, type: c.type, reference: c.reference });
    if (exists) {
      skipped++;
      continue;
    }

    await StockMovement.create({
      material: c.material,
      materialName: c.materialName,
      unit: c.unit,
      location: c.location,
      type: c.type,
      quantityChange: c.quantityChange,
      balanceAfter,
      reference: c.reference,
      performedBy: c.performedBy,
      notes: c.notes,
      createdAt: c.date
    });
    inserted++;
  }

  console.log(`Backfill complete. Inserted ${inserted} movement(s), skipped ${skipped} already-present.`);

  await mongoose.disconnect();
};

run().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
