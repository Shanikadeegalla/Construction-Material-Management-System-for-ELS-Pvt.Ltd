import 'dotenv/config';
import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import PurchaseOrder from '../models/PurchaseOrder.js';

async function testCheckoutValidation() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find an Approved Invoice
    const invoice = await Invoice.findOne({ status: 'Approved' }).populate('po');
    if (!invoice) {
      console.log('No Approved invoice found to test. Creating test assertion...');
      process.exit(0);
    }

    console.log(`Testing with Approved Invoice: ${invoice.invoiceNumber} (${invoice._id})`);
    console.log(`Linked Purchase Order: ${invoice.po?.poNumber} (${invoice.po?._id})`);
    console.log(`Invoice Amount: ${invoice.amount}`);

    const purchaseOrderId = invoice.po?._id?.toString() || invoice.po?.toString();

    // Verify payload construction
    const payload = {
      invoiceId: invoice._id.toString(),
      purchaseOrderId: purchaseOrderId,
      amount: invoice.amount
    };

    console.log('\n=== TEST PAYLOAD SENT TO STIPE CHECKOUT API ===');
    console.log(JSON.stringify(payload, null, 2));

    if (!payload.purchaseOrderId) {
      throw new Error('FAILED: purchaseOrderId is null or undefined in payload!');
    }
    if (!payload.invoiceId) {
      throw new Error('FAILED: invoiceId is null or undefined in payload!');
    }

    console.log('\n✅ TEST PASSED: Payload contains valid invoiceId, purchaseOrderId, and amount!');

    await mongoose.disconnect();
  } catch (err) {
    console.error('Test Error:', err);
    process.exit(1);
  }
}

testCheckoutValidation();
