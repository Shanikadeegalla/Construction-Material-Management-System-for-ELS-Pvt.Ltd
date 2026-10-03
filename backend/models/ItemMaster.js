import mongoose from 'mongoose';
import { isValidCategory } from '../utils/materialCategories.js';

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
    validate: {
      validator: isValidCategory,
      message: props => `"${props.value}" is not a valid material category.`
    },
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
