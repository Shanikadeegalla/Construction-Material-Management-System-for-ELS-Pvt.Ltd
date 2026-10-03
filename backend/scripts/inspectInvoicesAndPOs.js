import 'dotenv/config';
import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import PurchaseOrder from '../models/PurchaseOrder.js';

async function checkInvoicesAndPOs() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const pos = await PurchaseOrder.find().lean();
    const invoices = await Invoice.find().populate('po').lean();

    console.log(`\nFound ${pos.length} Purchase Orders and ${invoices.length} Invoices.\n`);

    console.log('=== PURCHASE ORDERS ===');
    pos.forEach((po, i) => {
      console.log(`${i + 1}. PO ID: ${po._id} | PONumber: "${po.poNumber}" | Status: "${po.status}" | Supplier: ${po.supplier} | Amount: ${po.totalAmount || po.grandTotal}`);
    });

    console.log('\n=== INVOICES ===');
    let unlinkedCount = 0;
    invoices.forEach((inv, i) => {
      const poLinked = inv.po ? (inv.po._id || inv.po) : null;
      const poNum = inv.po ? inv.po.poNumber : 'UNLINKED / NULL';
      console.log(`${i + 1}. Invoice ID: ${inv._id} | InvoiceNo: "${inv.invoiceNumber}" | Status: "${inv.status}" | Linked PO ID: ${poLinked} (${poNum}) | Amount: ${inv.amount}`);

      if (!inv.po) {
        unlinkedCount++;
      }
    });

    console.log(`\nUnlinked Invoices Count: ${unlinkedCount}`);

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkInvoicesAndPOs();
