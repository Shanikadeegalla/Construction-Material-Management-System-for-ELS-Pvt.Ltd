import Notification from '../models/Notification.js';

/**
 * Utility helper to create notification programmatically.
 * Ensures Director-specific alerts are created with role: 'Director' / targetRole: 'Director'.
 */
export const createNotificationHelper = async (recipientId, message, type = 'info', link = '', role = null, targetRole = null) => {
  try {
    const directorTypes = ['BOM_submitted', 'BOM_SUBMITTED', 'PO_submitted', 'PO_SUBMITTED', 'Invoice_submitted', 'Payment_approval'];
    
    let assignedRole = role;
    let assignedTargetRole = targetRole;

    if (directorTypes.includes(type)) {
      if (!assignedRole) assignedRole = 'Director';
      if (!assignedTargetRole) assignedTargetRole = 'Director';
    }

    const notifData = {
      message,
      type,
      link
    };

    if (recipientId) notifData.recipientId = recipientId;
    if (assignedRole) notifData.role = assignedRole;
    if (assignedTargetRole) notifData.targetRole = assignedTargetRole;

    const notif = new Notification(notifData);
    await notif.save();
    return notif;
  } catch (err) {
    console.error('Error creating notification:', err);
    return null;
  }
};

export default createNotificationHelper;
