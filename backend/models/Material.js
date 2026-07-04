import mongoose from 'mongoose';

const materialSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Cement', 'Steel', 'Bricks', 'Sand', 'Gravel', 'Wood', 'Paint', 'Other']
  },
  unit: {
    type: String,
    required: true,
    enum: ['kg', 'ton', 'litre', 'piece', 'bag', 'm3']
  },
  quantity: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    default: 0
  },
  minimumStock: {
    type: Number,
    required: true,
    default: 10
  },
  location: {
    type: String,
    enum: ['MainStore', 'SiteStore'],
    default: 'MainStore'
  },
  unitPrice: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    trim: true
  }
}, { timestamps: true });

export default mongoose.model('Material', materialSchema);