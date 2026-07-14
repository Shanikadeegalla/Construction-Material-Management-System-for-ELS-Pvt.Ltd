import mongoose from 'mongoose';

const bomSchema = new mongoose.Schema({
  // Not unique at the document level: every version/resubmission document for a
  // project (Draft -> Submitted -> Rejected -> resubmitted -> Approved, etc.) is
  // its own BOM document but intentionally shares the same bomNumber, so the
  // number stays constant for a project across its whole BOM history. Uniqueness
  // is enforced per-project (not per-document) in bomController's number
  // generator instead.
  bomNumber: {
    type: String,
    index: true,
    trim: true
  },
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
    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ItemMaster',
      default: null
    },
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
  },
  // Set the instant this document's status became 'Submitted'. createdAt (from
  // timestamps) can predate this by days when a Draft sits around before being
  // submitted, and updatedAt keeps moving on later approve/reject actions - so
  // neither is safe to show as "Date Submitted" without this dedicated field.
  submittedAt: {
    type: Date
  }
}, { timestamps: true });

export default mongoose.model('BOM', bomSchema);
