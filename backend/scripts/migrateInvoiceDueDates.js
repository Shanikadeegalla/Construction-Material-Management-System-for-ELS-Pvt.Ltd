import 'dotenv/config';
import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import { calculateDueDate } from '../utils/invoiceUtils.js';

/**
 * One-time migration script to populate dueDate on existing invoices where it is missing.
 * Rule:
 *   dueDate = invoiceDate + credit days from linked Purchase Order's Payment Terms.
 *   - "30 Days Credit" = 30 days
 *   - "Cash on Delivery", "Full Payment", "50% Advance" = 0 days (due on invoice date)
 *   - Missing / empty terms = 30 days (default)
 *
 * NOTE: This script does NOT modify any other fields on any invoice.
 *
 * Usage:
 *   node --env-file=backend/.env backend/scripts/migrateInvoiceDueDates.js
 */
async function runMigration() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('Error: MONGO_URI environment variable is missing.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB successfully.\n');

  try {
    // Find only invoices where dueDate is null, undefined, or missing
    const invoicesWithoutDueDate = await Invoice.find({
      $or: [
        { dueDate: null },
        { dueDate: { $exists: false } }
      ]
    });

    console.log(`Found ${invoicesWithoutDueDate.length} invoice(s) without a due date.`);

    if (invoicesWithoutDueDate.length === 0) {
      console.log('No invoices need updating. All existing invoices already have due dates.');
      return;
    }

    let updatedCount = 0;

    for (const inv of invoicesWithoutDueDate) {
      let paymentTerms = null;
      if (inv.po) {
        const poDoc = await PurchaseOrder.findById(inv.po, 'poNumber paymentTerms');
        if (poDoc) {
          paymentTerms = poDoc.paymentTerms;
        }
      }

      const invDate = inv.invoiceDate || inv.createdAt || new Date();
      const calculatedDueDate = calculateDueDate(invDate, paymentTerms);

      // Only update dueDate field, leaving every other field unchanged
      await Invoice.updateOne(
        { _id: inv._id },
        { $set: { dueDate: calculatedDueDate } }
      );

      updatedCount++;
      const invDateStr = new Date(invDate).toISOString().split('T')[0];
      const dueDateStr = calculatedDueDate.toISOString().split('T')[0];
      console.log(`  [${updatedCount}] Invoice ${inv.invoiceNumber}: Invoice Date: ${invDateStr} | Terms: "${paymentTerms || 'Missing (default 30d)'}" | Assigned Due Date: ${dueDateStr}`);
    }

    console.log(`\nMigration complete. Successfully updated ${updatedCount} invoice(s).`);
  } catch (err) {
    console.error('Migration failed with error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

runMigration();

