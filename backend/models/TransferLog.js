import mongoose from 'mongoose';

const transferLogSchema = new mongoose.Schema({
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
    required: true
  },
  materialName: {
    type: String,
    required: true
  },
  quantity: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  from: {
    type: String,
    default: 'MainStore'
  },
  to: {
    type: String,
    default: 'SiteStore'
  },
  issuedBy: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  }
});

const TransferLog = mongoose.model('TransferLog', transferLogSchema);
export default TransferLog;
