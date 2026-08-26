import mongoose from 'mongoose';

const quotationSchema = new mongoose.Schema({
  quotationNumber: {
    type: String,
    required: true,
    unique: true
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  material: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number
  },
  unit: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  poReference: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder'
  },
  status: {
    type: String,
    enum: ['Pending', 'Accepted', 'Rejected', 'Expired'],
    default: 'Pending'
  },
  file: {
    url: String,
    filename: String
  },
  uploadedBy: {
    type: String
  },
  notes: {
    type: String,
    trim: true
  }
}, { timestamps: true });

export default mongoose.model('Quotation', quotationSchema);
