import mongoose from 'mongoose';

const bomSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  projectName: {
    type: String,
    trim: true
  },
  version: {
    type: String,
    default: 'v1.0',
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  materials: [{
    name: {
      type: String,
      required: true
    },
    unit: {
      type: String,
      required: true
    },
    plannedQty: {
      type: Number,
      required: true
    },
    category: {
      type: String,
      required: true
    },
    estimatedUnitCost: {
      type: Number,
      default: 0
    },
    totalCost: {
      type: Number,
      default: 0
    },
    supplierRef: {
      type: String,
      default: ''
    },
    remarks: {
      type: String,
      default: ''
    }
  }],
  status: {
    type: String,
    enum: ['Draft', 'Submitted', 'Approved', 'Rejected', 'Pending'],
    default: 'Draft'
  },
  rejectionReason: {
    type: String
  },
  approvedBy: {
    type: String
  }
}, { timestamps: true });

export default mongoose.model('BOM', bomSchema);
