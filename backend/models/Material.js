import mongoose from 'mongoose';
import { decryptDB } from '../utils/cryptoUtils.js';
import { levelsForLocation } from '../utils/siteStoreLevels.js';

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
    required: true
  },
  unit: {
    type: String,
    required: true
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
  try {
    const isCodeMissing = !this.materialCode || String(this.materialCode).trim() === '' || this.materialCode === '-';

    // 1. If new, name modified, or code missing, attempt to sync with ItemMaster first
    if (this.isNew || this.isModified('name') || isCodeMissing) {
      try {
        const ItemMaster = mongoose.model('ItemMaster');
        const decryptedName = decryptDB(this.name);
        const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const master = await ItemMaster.findOne({
          $or: [
            { materialName: this.name },
            { materialName: decryptedName },
            { materialName: new RegExp(`^${escapeRegex(this.name)}$`, 'i') },
            { materialName: new RegExp(`^${escapeRegex(decryptedName)}$`, 'i') }
          ]
        });

        if (master) {
          this.materialCode = master.materialCode;
          this.category = master.category;
          Object.assign(this, levelsForLocation(master, this.location));
        }
      } catch (err) {
        // silent fail if ItemMaster not registered
      }
    }

    // 2. Safe-Check: Never allow empty, null, or invisible materialCode to save
    if (!this.materialCode || String(this.materialCode).trim() === '' || this.materialCode === '-') {
      try {
        const MaterialModel = this.constructor;
        const existingDocs = await MaterialModel.find({
          materialCode: /^MAT\d+$/i
        }).select('materialCode').lean();

        let maxNum = 0;
        for (const doc of existingDocs) {
          const num = parseInt(String(doc.materialCode).replace(/\D/g, ''), 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }

        try {
          const ItemMaster = mongoose.model('ItemMaster');
          const masterDocs = await ItemMaster.find({
            materialCode: /^MAT\d+$/i
          }).select('materialCode').lean();
          for (const doc of masterDocs) {
            const num = parseInt(String(doc.materialCode).replace(/\D/g, ''), 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
          }
        } catch (e) {}

        this.materialCode = `MAT${String(maxNum + 1).padStart(4, '0')}`;
      } catch (genErr) {
        const suffix = this._id ? String(this._id).slice(-4).toUpperCase() : Date.now().toString().slice(-4);
        this.materialCode = `MAT-${suffix}`;
      }
    }
  } catch (error) {
    if (!this.materialCode || String(this.materialCode).trim() === '') {
      this.materialCode = `MAT-${String(this._id || Date.now()).slice(-4).toUpperCase()}`;
    }
  }
  next();
});

export default mongoose.model('Material', materialSchema);