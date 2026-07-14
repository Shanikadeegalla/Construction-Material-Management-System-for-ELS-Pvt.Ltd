import mongoose from 'mongoose';

const CATEGORY_OPTIONS = ['Cement', 'Sand', 'Steel', 'Bricks', 'Paint', 'Electrical', 'Plumbing', 'Tiles', 'Hardware', 'Aggregate', 'Timber'];

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
    enum: CATEGORY_OPTIONS,
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
  rating: { type: Number, min: 0, max: 5, default: 0 },
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
