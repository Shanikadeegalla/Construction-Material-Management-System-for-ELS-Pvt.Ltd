import mongoose from 'mongoose';

const purchaseRequestSchema = new mongoose.Schema({
  project: {
    type: String,
    required: true,
    trim: true
  },
  projectName: {
    type: String,
    trim: true
  },
  materials: [{
    materialName: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    unit: {
      type: String,
      required: true
    },
    reason: {
      type: String,
      trim: true
    },
    // Copied from the approved BOM's material at PR-creation time (see
    // createPurchaseRequest), so the price the Director approves on the
    // resulting PO reflects the BOM's actual cost estimate instead of a
    // blind placeholder.
    estimatedUnitCost: {
      type: Number,
      default: 0
    }
  }],
  requestedBy: {
    type: String,
    required: true
  },
  urgency: {
    type: String,
    enum: ['Normal', 'Urgent', 'Critical'],
    default: 'Normal'
  },
  source: {
    type: String,
    enum: ['MainStore', 'Site'],
    default: 'MainStore'
  },
  status: {
    type: String,
    enum: ['Pending', 'PO Created'],
    default: 'Pending'
  },
  notes: {
    type: String,
    trim: true
  }
}, { timestamps: true });

export default mongoose.model('PurchaseRequest', purchaseRequestSchema);
