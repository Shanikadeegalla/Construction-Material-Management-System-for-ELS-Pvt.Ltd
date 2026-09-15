import mongoose from 'mongoose';

const purchaseOrderSchema = new mongoose.Schema({
  poNumber: {
    type: String,
    required: true,
    unique: true
  },
  prId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseRequest'
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: false
  },
  items: [{
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
    unitPrice: {
      type: Number,
      required: true
    },
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Material'
    }
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['Draft', 'Pending', 'Approved', 'Rejected', 'Sent', 'Delivered', 'Closed', 'Cancelled'],
    default: 'Draft'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  approvedBy: {
    type: String
  },
  approvedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  notes: {
    type: String,
    trim: true
  },
  expectedDeliveryDate: {
    type: Date
  },
  actualDeliveryDate: {
    type: Date
  },
  receivedQty: {
    type: Number
  },
  deliveryCondition: {
    type: String,
    enum: ['Good', 'Damaged', 'Partial']
  },
  paymentTerms: {
    type: String
  },
  deliveryAddress: {
    type: String
  },
  sentAt: {
    type: Date
  },
  createdBy: {
    type: String,
    required: true
  }
}, { timestamps: true });

export default mongoose.model('PurchaseOrder', purchaseOrderSchema);
