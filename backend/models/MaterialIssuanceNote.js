import mongoose from 'mongoose';

const materialIssuanceNoteSchema = new mongoose.Schema({
  minNumber: {
    type: String,
    required: true,
    unique: true
  },
  // Free-form Request Materials submissions aren't raised against a BOM, so
  // bomId is only required for the legacy BOM-gated creation path.
  bomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BOM'
  },
  bomNumber: {
    type: String,
    default: ''
  },
  // 'BOM' = raised against an approved BOM (createMIN); 'FreeForm' = raised
  // from the Site Store "Request Materials" screen with no BOM gating.
  requestType: {
    type: String,
    enum: ['BOM', 'FreeForm'],
    default: 'BOM'
  },
  requiredDate: {
    type: Date
  },
  // Set when Main Store originates (or fulfils) the note from its own
  // "Create Material Transfer Note" screen.
  transferDate: {
    type: Date
  },
  // Free-text document reference (e.g. a BOM code) shown on the Main Store
  // Material Transfer Note screen - distinct from bomNumber, which is only
  // populated for the legacy BOM-gated creation path.
  reference: {
    type: String,
    default: ''
  },
  // 'SiteStore' = raised by Site Store's Request Materials screen (the
  // default, and the only option before this field existed); 'MainStore' =
  // pushed directly by Main Store's Create Material Transfer Note screen.
  initiatedBy: {
    type: String,
    enum: ['SiteStore', 'MainStore'],
    default: 'SiteStore'
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
    },
    // Snapshot of the site's on-hand quantity at the time the request was
    // raised, so Main Store can see it without re-querying live stock.
    availableAtSite: {
      type: Number,
      default: 0
    },
    // Set when this line's cumulative requested quantity exceeds the
    // approved BOM's planned quantity - the BOM check is a soft limit that
    // flags rather than blocks the request.
    exceedsBom: {
      type: Boolean,
      default: false
    },
    exceedAmount: {
      type: Number,
      default: 0
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
