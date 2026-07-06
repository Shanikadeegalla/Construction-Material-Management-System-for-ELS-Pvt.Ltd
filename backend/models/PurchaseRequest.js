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
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'PO Created'],
    default: 'Pending'
  },
  approvedBy: {
    type: String
  },
  rejectionReason: {
    type: String
  },
  notes: {
    type: String,
    trim: true
  }
}, { timestamps: true });

export default mongoose.model('PurchaseRequest', purchaseRequestSchema);
