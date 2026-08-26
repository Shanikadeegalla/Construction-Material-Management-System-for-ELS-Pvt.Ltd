import mongoose from 'mongoose';

const grnSchema = new mongoose.Schema({
  grnNumber: {
    type: String,
    required: true,
    unique: true
  },
  poReference: {
    type: String
  },
  supplier: {
    type: String,
    required: true
  },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  receivedBy: {
    type: String,
    required: true
  },
  receivedDate: {
    type: Date,
    default: Date.now
  },
  items: [{
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Material',
      required: true
    },
    expectedQty: {
      type: Number,
      required: true
    },
    receivedQty: {
      type: Number,
      required: true
    },
    condition: {
      type: String,
      enum: ['Good', 'Damaged', 'Partial', 'Shortage', 'Other'],
      default: 'Good'
    }
  }],
  poId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder'
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Verified', 'Partial'],
    default: 'Completed'
  },
  notes: {
    type: String,
    trim: true
  }
}, { timestamps: true });

export default mongoose.model('GRN', grnSchema);
