import mongoose from 'mongoose';

const permissionSchema = new mongoose.Schema({
  role: {
    type: String,
    required: true
  },
  module: {
    type: String,
    required: true
  },
  permissionLevel: {
    type: String,
    enum: ['Full', 'View', 'Approve', 'Partial', 'None'],
    default: 'None'
  }
}, {
  timestamps: true
});

permissionSchema.index({ role: 1, module: 1 }, { unique: true });

const Permission = mongoose.model('Permission', permissionSchema);
export default Permission;
