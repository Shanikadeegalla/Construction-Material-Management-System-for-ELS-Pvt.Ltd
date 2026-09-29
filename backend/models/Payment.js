import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  purchaseOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder',
    required: true
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: () => process.env.STRIPE_CURRENCY || 'lkr'
  },
  stripeSessionId: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'completed', 'failed'],
    default: 'pending'
  },
  method: {
    type: String,
    enum: ['Stripe', 'Cash', 'Cheque'],
    default: 'Stripe'
  },
  chequeNumber: {
    type: String,
    default: ''
  },
  bankName: {
    type: String,
    default: ''
  },
  chequeDate: {
    type: Date
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  paidAt: {
    type: Date
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  emailSentAt: {
    type: Date
  }
}, { timestamps: true });

export default mongoose.model('Payment', paymentSchema);
