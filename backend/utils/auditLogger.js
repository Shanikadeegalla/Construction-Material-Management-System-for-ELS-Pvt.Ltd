import AuditLog from '../models/AuditLog.js';

export const logAction = async (req, action, module, status = 'Success') => {
  try {
    await AuditLog.create({
      userId: req.user?._id,
      userName: req.user?.name || 'System',
      action,
      module,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
      status
    });
  } catch (err) {
    console.error('Audit logging failed:', err);
  }
};
