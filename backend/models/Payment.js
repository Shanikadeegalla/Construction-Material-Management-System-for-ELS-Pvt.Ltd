import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  purchaseOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder',
    required: true
  },
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
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
  // How the supplier was paid. Stripe payments are settled by the gateway;
  // Cash and Cheque payments are recorded manually by the Purchase Manager.
  method: {
    type: String,
    enum: ['Stripe', 'Cash', 'Cheque'],
    default: 'Stripe'
  },
  // Only set for Stripe payments.
  stripeSessionId: {
    type: String
  },
  // Receipt / voucher number for Cash, cheque number for Cheque.
  reference: {
    type: String,
    default: ''
  },
  bankName: {
    type: String,
    default: ''
  },
  chequeNumber: {
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
  notes: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'completed', 'failed'],
    default: 'pending'
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
