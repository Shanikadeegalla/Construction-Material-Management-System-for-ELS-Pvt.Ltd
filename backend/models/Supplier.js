import mongoose from 'mongoose';
import { MATERIAL_CATEGORIES, isValidCategory } from '../utils/materialCategories.js';

// Suppliers are classified with the same categories as the Item Master
// (these defaults plus any the Admin has added).
const CATEGORY_OPTIONS = MATERIAL_CATEGORIES;

const documentSchema = new mongoose.Schema({
  url: String,
  filename: String
}, { _id: false });

const supplierSchema = new mongoose.Schema({
  supplierId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    trim: true
  },
  contactPerson: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    required: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  address: {
    type: String,
    trim: true
  },
  categories: {
    type: [String],
    validate: {
      validator: async (list) => (await Promise.all((list || []).map(isValidCategory))).every(Boolean),
      message: 'Supplier has a category that is not a valid material category.'
    },
    default: []
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  bankName: { type: String, trim: true, default: '' },
  accountNumber: { type: String, trim: true, default: '' },
  bankBranch: { type: String, trim: true, default: '' },
  businessRegistrationNumber: { type: String, trim: true, default: '' },
  vatNumber: { type: String, trim: true, default: '' },
  documents: {
    businessRegistration: documentSchema,
    taxCertificate: documentSchema,
    supplierAgreement: documentSchema,
    quotationSamples: [documentSchema],
    idPhoto: documentSchema
  }
}, { timestamps: true });

// Unique per non-empty email; multiple suppliers may still have a blank email.
supplierSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string', $gt: '' } } }
);

supplierSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.category = ret.categories?.[0] || '';
    return ret;
  }
});

export const SUPPLIER_CATEGORY_OPTIONS = CATEGORY_OPTIONS;

export default mongoose.model('Supplier', supplierSchema);
