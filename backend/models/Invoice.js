import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  po: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder',
    required: true
  },
  grn: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GRN'
  },
  amount: {
    type: Number,
    required: true
  },
  invoiceDate: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date
  },
  file: {
    url: String,
    filename: String
  },
  status: {
    type: String,
    enum: ['Pending Approval', 'Approved', 'Rejected', 'Paid'],
    default: 'Pending Approval'
  },
  submittedBy: {
    type: String
  },
  approvedBy: {
    type: String
  },
  approvedAt: {
    type: Date
  },
  rejectionReason: {
    type: String,
    default: ''
  },
  paidAt: {
    type: Date
  },
  paymentMethod: {
    type: String,
    default: 'Stripe'
  },
  stripeSessionId: {
    type: String
  },
  notes: {
    type: String,
    trim: true
  }
}, { timestamps: true });

export default mongoose.model('Invoice', invoiceSchema);
