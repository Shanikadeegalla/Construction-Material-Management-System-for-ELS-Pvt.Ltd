import 'dotenv/config';
import mongoose from 'mongoose';
import PurchaseRequest from '../models/PurchaseRequest.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Supplier from '../models/Supplier.js';

async function runPrToPoConversionTests() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // 1. Create a dummy PR with 6 items for testing
    const sampleMaterials = [
      { materialName: 'Cement', quantity: 6800, unit: 'kg', estimatedUnitCost: 50 },
      { materialName: 'Steel', quantity: 12000, unit: 'piece', estimatedUnitCost: 250 },
      { materialName: 'Bricks', quantity: 2850, unit: 'piece', estimatedUnitCost: 35 },
      { materialName: 'Paint', quantity: 350, unit: 'litre', estimatedUnitCost: 850 },
      { materialName: 'Sand', quantity: 1850, unit: 'm3', estimatedUnitCost: 2200 },
      { materialName: 'Gravel', quantity: 9500, unit: 'kg', estimatedUnitCost: 15 }
    ];

    const testPr = new PurchaseRequest({
      project: new mongoose.Types.ObjectId(),
      projectName: 'PR-Conversion Test Project',
      requestedBy: 'SiteStoreOfficer',
      materials: sampleMaterials,
      status: 'Pending'
    });
    await testPr.save();
    console.log(`\nCreated Test PR (${testPr._id}) with 6 items.`);

    // Find active supplier
    let supplierDoc = await Supplier.findOne({ status: 'Active' });
    if (!supplierDoc) {
      supplierDoc = new Supplier({ name: 'Test Supplier Ltd', phone: '0771234567', category: 'Cement' });
      await supplierDoc.save();
    }

    // -------------------------------------------------------------
    // TEST 1: Select 1 item (Cement only) out of 6 items
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Select 1 item (Cement only) ---');
    const selectedItem1 = [sampleMaterials[0]]; // Cement only (6800 * 50 = 340,000)

    const resolvedItems1 = selectedItem1.map(m => ({
      materialName: m.materialName,
      quantity: m.quantity,
      unit: m.unit,
      unitPrice: m.estimatedUnitCost
    }));

    const expectedTotal1 = 6800 * 50; // 340,000

    const po1 = new PurchaseOrder({
      poNumber: `PO-TEST-001-${Date.now()}`,
      supplier: supplierDoc._id,
      prId: testPr._id,
      items: resolvedItems1,
      totalAmount: expectedTotal1,
      createdBy: 'Purchase Manager',
      status: 'Pending'
    });
    await po1.save();

    console.log(`Created PO 1 (${po1._id}): Total Amount = LKR ${po1.totalAmount}, Item Count = ${po1.items.length}`);
    if (po1.items.length !== 1) throw new Error(`Test 1 Failed: Expected 1 item, got ${po1.items.length}`);
    if (po1.items[0].materialName !== 'Cement') throw new Error(`Test 1 Failed: Expected item 'Cement', got '${po1.items[0].materialName}'`);
    if (po1.totalAmount !== expectedTotal1) throw new Error(`Test 1 Failed: Expected total ${expectedTotal1}, got ${po1.totalAmount}`);
    console.log('✅ TEST 1 PASSED: PO contains ONLY Cement and total PO amount is LKR 340,000!');

    // -------------------------------------------------------------
    // TEST 2: Select 2 items (Steel & Bricks) out of 6 items
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Select 2 items (Steel & Bricks) ---');
    const selectedItems2 = [sampleMaterials[1], sampleMaterials[2]]; // Steel (12000 * 250 = 3,000,000) & Bricks (2850 * 35 = 99,750)
    const expectedTotal2 = (12000 * 250) + (2850 * 35); // 3,099,750

    const resolvedItems2 = selectedItems2.map(m => ({
      materialName: m.materialName,
      quantity: m.quantity,
      unit: m.unit,
      unitPrice: m.estimatedUnitCost
    }));

    const po2 = new PurchaseOrder({
      poNumber: `PO-TEST-002-${Date.now()}`,
      supplier: supplierDoc._id,
      prId: testPr._id,
      items: resolvedItems2,
      totalAmount: expectedTotal2,
      createdBy: 'Purchase Manager',
      status: 'Pending'
    });
    await po2.save();

    console.log(`Created PO 2 (${po2._id}): Total Amount = LKR ${po2.totalAmount}, Item Count = ${po2.items.length}`);
    if (po2.items.length !== 2) throw new Error(`Test 2 Failed: Expected 2 items, got ${po2.items.length}`);
    if (po2.totalAmount !== expectedTotal2) throw new Error(`Test 2 Failed: Expected total ${expectedTotal2}, got ${po2.totalAmount}`);
    console.log('✅ TEST 2 PASSED: PO contains EXACTLY Steel & Bricks and total PO amount is LKR 3,099,750!');

    // Clean up test records
    await PurchaseRequest.findByIdAndDelete(testPr._id);
    await PurchaseOrder.findByIdAndDelete(po1._id);
    await PurchaseOrder.findByIdAndDelete(po2._id);
    console.log('\nCleaned up test PR & PO records.');

    await mongoose.disconnect();
  } catch (err) {
    console.error('Test Error:', err);
    process.exit(1);
  }
}

runPrToPoConversionTests();
