import mongoose from 'mongoose';

const bomSchema = new mongoose.Schema({
  projectName: {
    type: String,
    required: true,
    trim: true
  },
  version: {
    type: String,
    required: true,
    trim: true
  },
  createdBy: {
    type: String,
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
    }
  }],
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  rejectionReason: {
    type: String
  },
  approvedBy: {
    type: String
  }
}, { timestamps: true });

export default mongoose.model('BOM', bomSchema);
