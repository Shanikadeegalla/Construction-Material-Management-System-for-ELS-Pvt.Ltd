const mongoose = require('mongoose');

const purchaseOrderSchema = new mongoose.Schema({
  poRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PORequest',
    required: true
  },
  supplier: {
    name: { type: String, required: true },
    contactPerson: { type: String },
    phone: { type: String },
    email: { type: String }
  },
  items: [
    {
      material: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Material',
        required: true
      },
      orderedQty: {
        type: Number,
        required: true
      },
      unitPrice: {
        type: Number,
        required: true
      }
    }
  ],
  totalAmount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'cheque'],
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid'],
    default: 'pending'
  },
  status: {
    type: String,
    enum: ['ordered', 'delivered'],
    default: 'ordered'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expectedDelivery: {
    type: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);