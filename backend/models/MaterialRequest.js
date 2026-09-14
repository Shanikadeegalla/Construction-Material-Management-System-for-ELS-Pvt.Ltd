import mongoose from 'mongoose';

// A Site Store's request to Main Store for additional stock. This is a pure
// store-to-store replenishment request - it is NOT tied to a project's BOM
// or material usage (that's handled separately by the Material Issuance
// Note flow). siteStoreId/siteStoreName identify which Site Store is asking,
// derived automatically from the requesting user's assigned project - the
// requester never picks a project.
const materialRequestSchema = new mongoose.Schema({
  requestNo: {
    type: String,
    required: true,
    unique: true
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
  requestedBy: {
    type: String,
    required: true
  },
  requestedByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  materials: [{
    materialName: {
      type: String,
      required: true
    },
    category: {
      type: String,
      default: 'Other'
    },
    unit: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    // Snapshot of the site's on-hand quantity at the time the request was
    // raised, so Main Store can see it without re-querying live stock.
    availableAtSite: {
      type: Number,
      default: 0
    },
    // How much of `quantity` has actually been moved to the Site Store so far,
    // across one or more auto-generated/manual Material Transfer Notes -
    // (quantity - fulfilledQty) is the outstanding shortfall for this line.
    fulfilledQty: {
      type: Number,
      default: 0
    }
  }],
  requiredDate: {
    type: Date,
    required: true
  },
  notes: {
    type: String,
    default: ''
  },
  // Pending -> Processing (Main Store opened the Create MTN screen for it) ->
  // Transferred (every line fully moved) / Partially Transferred (some stock
  // moved via one or more MTNs, but at least one line still has a shortfall -
  // stays actionable so Main Store can fulfil the rest once more stock is in)
  // / Rejected / Cancelled.
  status: {
    type: String,
    enum: ['Pending', 'Processing', 'Transferred', 'Partially Transferred', 'Rejected', 'Cancelled'],
    default: 'Pending'
  },
  transferNoteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MaterialTransferNote',
    default: null
  },
  mtnNumber: {
    type: String,
    default: ''
  },
  rejectionReason: {
    type: String,
    default: ''
  }
}, { timestamps: true });

export default mongoose.model('MaterialRequest', materialRequestSchema);
