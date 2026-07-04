const mongoose = require('mongoose');

const poRequestSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  requestedBy: {
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
      requestedQty: {
        type: Number,
        required: true
      },
      unit: {
        type: String,
        required: true
      }
    }
  ],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'ordered', 'received'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectionReason: {
    type: String
  },
  notes: {
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model('PORequest', poRequestSchema);