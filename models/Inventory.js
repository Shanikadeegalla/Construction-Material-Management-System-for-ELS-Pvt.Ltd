const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  material: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
    required: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  location: {
    type: String,
    enum: ['main-store', 'site-store'],
    required: true
  },
  currentQty: {
    type: Number,
    required: true,
    default: 0
  },
  minThreshold: {
    type: Number,
    required: true,
    default: 0
  },
  maxThreshold: {
    type: Number,
    required: true,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('Inventory', inventorySchema);