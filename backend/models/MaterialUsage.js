import mongoose from 'mongoose';

const materialUsageSchema = new mongoose.Schema({
  projectName: {
    type: String,
    required: true,
    trim: true
  },
  materialName: {
    type: String,
    required: true,
    trim: true
  },
  unit: {
    type: String,
    default: ''
  },
  plannedQty: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    default: 0
  },
  actualQty: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    default: 0
  },
  usageDate: {
    type: Date,
    default: Date.now
  },
  recordedBy: {
    type: String,
    required: true
  },
  variance: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    default: 0
  }
}, { timestamps: true });

export default mongoose.model('MaterialUsage', materialUsageSchema);
