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
  // The approved BOM this PR was raised against (set when Main Store creates a
  // PR from a BOM shortage). Optional so older PR documents stay valid.
  bomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BOM',
    default: null
  },
  materials: [{
    // ItemMaster reference copied from the BOM line, used to detect a PR that
    // already covers the same BOM material. Optional for older documents.
    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ItemMaster',
      default: null
    },
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
    enum: ['Pending', 'PO Created', 'Declined'],
    default: 'Pending'
  },
  declineReason: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  }
}, { timestamps: true });

export default mongoose.model('PurchaseRequest', purchaseRequestSchema);
