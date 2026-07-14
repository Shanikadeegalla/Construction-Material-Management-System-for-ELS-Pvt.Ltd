import mongoose from 'mongoose';

const materialIssuanceNoteSchema = new mongoose.Schema({
  minNumber: {
    type: String,
    required: true,
    unique: true
  },
  bomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BOM',
    required: true
  },
  bomNumber: {
    type: String,
    default: ''
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  projectName: {
    type: String,
    required: true
  },
  requestedBy: {
    type: String,
    required: true
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
      default: ''
    }
  }],
  // Pending -> Approved/Rejected -> Issued (deducted from Main Store, in transit) ->
  // Received (Site Store confirmed, added to Site Store stock).
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Issued', 'Received'],
    default: 'Pending'
  },
  notes: {
    type: String,
    default: ''
  },
  rejectionReason: {
    type: String,
    default: ''
  },
  issuedBy: {
    type: String,
    default: ''
  },
  issuedAt: {
    type: Date
  },
  receivedBy: {
    type: String,
    default: ''
  },
  receivedAt: {
    type: Date
  }
}, { timestamps: true });

export default mongoose.model('MaterialIssuanceNote', materialIssuanceNoteSchema);
