import mongoose from 'mongoose';
import { decryptDB } from '../utils/cryptoUtils.js';

const materialSchema = new mongoose.Schema({
  materialCode: {
    type: String,
    default: ''
  },
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
  maximumStock: {
    type: Number,
    required: true,
    default: 100
  },
  reorderLevel: {
    type: Number,
    required: true,
    default: 50
  },
  location: {
    type: String,
    enum: ['MainStore', 'SiteStore'],
    default: 'MainStore'
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null
  },
  project_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null
  },
  status: {
    type: String,
    default: 'In-Stock'
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

materialSchema.pre('save', async function (next) {
  if (this.isNew || this.isModified('name')) {
    try {
      const ItemMaster = mongoose.model('ItemMaster');
      const decryptedName = decryptDB(this.name);
      const master = await ItemMaster.findOne({
        $or: [
          { materialName: this.name },
          { materialName: decryptedName }
        ]
      });
      if (master) {
        this.materialCode = master.materialCode;
        this.minimumStock = master.minimumStock;
        this.maximumStock = master.maximumStock;
        this.reorderLevel = master.reorderLevel;
      }
    } catch (err) {
      // silent fail if model not registered
    }
  }
  next();
});

export default mongoose.model('Material', materialSchema);