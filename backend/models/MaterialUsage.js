import mongoose from 'mongoose';

const materialUsageSchema = new mongoose.Schema({
  // Set when this usage record was created by the Site Store's combined
  // "Material Issue & Usage" transaction (siteInventoryController.issueMaterialToProject) -
  // reuses the app-wide MIN-YYYY-NNN numbering format for display/audit.
  minNumber: {
    type: String,
    default: ''
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material'
  },
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
  // Construction activity/purpose the material was issued for (e.g.
  // "Formwork", "Slab plastering") - required by the Material Issue & Usage
  // screen for later BOM-vs-actual tracking.
  activity: {
    type: String,
    default: ''
  },
  notes: {
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
