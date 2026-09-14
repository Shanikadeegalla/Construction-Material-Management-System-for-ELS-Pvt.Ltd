import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: [
      'info', 'alert',
      'BOM_approved', 'BOM_rejected', 'BOM_SUBMITTED', 'BOM_STOCK_CHECK_REQUIRED',
      'PR_SUBMITTED', 'PR_DECLINED',
      'PO_SUBMITTED', 'PO_approved', 'PO_rejected', 'PO_SENT',
      'Invoice_submitted',
      'MIN_EXCEEDS_BOM', 'MIN_REQUEST_SUBMITTED',
      'SSR_SUBMITTED', 'SSR_TRANSFERRED', 'SSR_REJECTED'
    ],
    default: 'info'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  link: {
    type: String
  }
}, { timestamps: true });

export default mongoose.model('Notification', notificationSchema);
