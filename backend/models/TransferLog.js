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
    enum: ['In-Transit', 'Received'],
    default: 'In-Transit'
  }
});

const TransferLog = mongoose.model('TransferLog', transferLogSchema);
export default TransferLog;
