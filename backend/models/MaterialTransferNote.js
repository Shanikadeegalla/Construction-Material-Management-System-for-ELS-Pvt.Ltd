import mongoose from 'mongoose';

// Main Store -> Site Store stock transfer. Either fulfils a Pending
// MaterialRequest (sourceRequestId set) or is pushed ad hoc by Main Store.
// There is no project field here by design - the transfer is between two
// stores only; project association happens later, separately, through
// Material Issuance.
const materialTransferNoteSchema = new mongoose.Schema({
  mtnNumber: {
    type: String,
    required: true,
    unique: true
  },
  sourceRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MaterialRequest',
    default: null
  },
  requestNo: {
    type: String,
    default: ''
  },
  siteStoreId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  siteStoreName: {
    type: String,
    required: true
  },
  transferDate: {
    type: Date,
    required: true
  },
  reference: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  materials: [{
    materialName: {
      type: String,
      required: true
    },
    unit: {
      type: String,
      required: true
    },
    requestedQty: {
      type: Number,
      default: 0
    },
    transferQty: {
      type: Number,
      required: true
    }
  }],
  // In Transit = Main Store has issued the note and its stock is already
  // deducted, but the Site Store has not confirmed receipt yet, so nothing has
  // been added to site inventory. Received = Site Store confirmed receipt and
  // its inventory was increased. 'Transferred' is the legacy single-step
  // status of notes created before the receipt step existed (stock already
  // at site) - treated the same as Received.
  status: {
    type: String,
    enum: ['In Transit', 'Received', 'Transferred'],
    default: 'In Transit'
  },
  receivedBy: {
    type: String,
    default: ''
  },
  receivedAt: {
    type: Date
  },
  createdBy: {
    type: String,
    required: true
  }
}, { timestamps: true });

export default mongoose.model('MaterialTransferNote', materialTransferNoteSchema);
