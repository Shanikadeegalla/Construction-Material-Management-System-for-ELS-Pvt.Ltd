const mongoose = require('mongoose');

const grnSchema = new mongoose.Schema({
  purchaseOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder',
    required: true
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [
    {
      material: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Material',
        required: true
      },
      receivedQty: {
        type: Number,
        required: true
      },
      condition: {
        type: String,
        enum: ['good', 'damaged', 'partial'],
        default: 'good'
      }
    }
  ],
  notes: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed'],
    default: 'pending'
  }
}, { timestamps: true });

module.exports = mongoose.model('GRN', grnSchema);