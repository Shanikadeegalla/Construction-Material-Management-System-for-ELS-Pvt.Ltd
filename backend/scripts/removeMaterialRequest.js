// One-off remediation script: deletes a Material Request by its request
// number. Safe only when the request has no linked/lingering stock effects
// (no MTNs reference it and every line's fulfilledQty is 0) - this does NOT
// reverse stock, so it will refuse to run against a request that still has
// fulfilled quantity or a linked Material Transfer Note, to avoid silently
// deleting the record of a real stock movement.
//
// Usage: node backend/scripts/removeMaterialRequest.js SSR-2026-001
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import MaterialRequest from '../models/MaterialRequest.js';
import MaterialTransferNote from '../models/MaterialTransferNote.js';

dotenv.config();

const requestNo = process.argv[2];

const run = async () => {
  if (!requestNo) {
    console.error('Usage: node backend/scripts/removeMaterialRequest.js <REQUEST-NO>');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ConstructionDB');
  console.log('Connected to MongoDB.');

  const request = await MaterialRequest.findOne({ requestNo });
  if (!request) {
    console.error(`No Material Request found with number ${requestNo}.`);
    process.exit(1);
  }

  const linkedMtns = await MaterialTransferNote.find({
    $or: [{ sourceRequestId: request._id }, { requestNo }]
  });
  const anyFulfilled = request.materials.some(m => (m.fulfilledQty || 0) > 0);

  if (linkedMtns.length > 0 || anyFulfilled) {
    console.error(
      `Refusing to delete ${requestNo}: it has ${linkedMtns.length} linked MTN(s) and/or fulfilled quantity. ` +
      `Reverse those first (see removeMTN.js) before deleting the request.`
    );
    process.exit(1);
  }

  await MaterialRequest.deleteOne({ _id: request._id });
  console.log(`Deleted Material Request ${requestNo} (status was "${request.status}").`);

  await mongoose.disconnect();
  console.log('Done.');
};

run().catch(err => {
  console.error('Failed to remove Material Request:', err);
  process.exit(1);
});
