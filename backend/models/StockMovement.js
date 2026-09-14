import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema({
  material: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
    required: true
  },
  materialName: {
    type: String,
    required: true
  },
  unit: {
    type: String,
    default: ''
  },
  location: {
    type: String,
    enum: ['MainStore', 'SiteStore'],
    default: 'MainStore'
  },
  type: {
    type: String,
    enum: ['GRN Receipt', 'MIN Issue', 'MIN Receipt', 'Usage', 'Adjustment', 'MTN Transfer Out', 'MTN Transfer In'],
    required: true
  },
  quantityChange: {
    type: Number,
    required: true
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  reference: {
    type: String,
    default: ''
  },
  reason: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  performedBy: {
    type: String,
    default: ''
  }
}, { timestamps: true });

export default mongoose.model('StockMovement', stockMovementSchema);
