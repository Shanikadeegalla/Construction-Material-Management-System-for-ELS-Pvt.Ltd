import mongoose from 'mongoose';

const itemMasterSchema = new mongoose.Schema({
  materialCode: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  materialName: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'Cement & Concrete',
      'Aggregates',
      'Road Construction',
      'Bridge Construction',
      'Reinforcement Steel',
      'Structural Steel',
      'Railway Materials',
      'Drainage & Culvert',
      'Geotechnical',
      'Formwork & Scaffolding',
      'Fasteners & Hardware',
      'Waterproofing & Joints',
      'Safety Materials',
      'Survey & Site',
      'Miscellaneous',
      'Other'
    ],
    default: 'Other'
  },
  unit: {
    type: String,
    required: true
  },
  estimatedUnitCost: {
    type: Number,
    required: true,
    default: 0
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  minimumStock: {
    type: Number,
    default: 10
  },
  maximumStock: {
    type: Number,
    default: 100
  },
  reorderLevel: {
    type: Number,
    default: 50
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  }
}, { timestamps: true });

export default mongoose.model('ItemMaster', itemMasterSchema);
