import Notification from '../models/Notification.js';
import { createNotificationHelper } from '../utils/notificationHelper.js';

// @desc    Get user notifications by recipientId / userId / role
// @route   GET /api/notifications
// @access  Private
export const getNotifications = async (req, res) => {
  try {
    const userId = req.query.userId || req.query.recipientId || req.user?._id;
    const userRole = req.user?.role;

    let filter = {};

    if (userRole === 'Director') {
      const directorTypes = ['BOM_submitted', 'BOM_SUBMITTED', 'PO_submitted', 'PO_SUBMITTED', 'Invoice_submitted', 'Payment_approval'];
      const nonDirectorTypes = [
        'alert', 'info',
        'MIN_EXCEEDS_BOM', 'MIN_REQUEST_SUBMITTED',
        'SSR_SUBMITTED', 'SSR_TRANSFERRED', 'SSR_REJECTED',
        'BOM_STOCK_CHECK_REQUIRED', 'PR_SUBMITTED', 'PR_DECLINED'
      ];

      filter = {
        $and: [
          {
            $or: [
              { recipientId: userId, type: { $in: directorTypes } },
              { role: 'Director' },
              { targetRole: 'Director' },
              { type: { $in: directorTypes } }
            ]
          },
          {
            type: { $nin: nonDirectorTypes }
          }
        ]
      };
    } else {
      if (!userId) {
        return res.status(200).json({ success: true, count: 0, data: [] });
      }
      filter = { recipientId: userId };
    }

    if (req.query.isRead !== undefined) {
      filter.isRead = req.query.isRead === 'true';
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    res.status(200).json({ success: true, count: unreadCount, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get count of unread notifications for user
// @route   GET /api/notifications/count
// @access  Private
export const getNotificationCount = async (req, res) => {
  try {
    const userId = req.query.userId || req.query.recipientId || req.user?._id;
    const userRole = req.user?.role;

    if (!userId && userRole !== 'Director') {
      return res.status(200).json({ success: true, count: 0 });
    }

    let filter = { isRead: false };

    if (userRole === 'Director') {
      const directorTypes = ['BOM_submitted', 'BOM_SUBMITTED', 'PO_submitted', 'PO_SUBMITTED', 'Invoice_submitted', 'Payment_approval'];
      const nonDirectorTypes = [
        'alert', 'info',
        'MIN_EXCEEDS_BOM', 'MIN_REQUEST_SUBMITTED',
        'SSR_SUBMITTED', 'SSR_TRANSFERRED', 'SSR_REJECTED',
        'BOM_STOCK_CHECK_REQUIRED', 'PR_SUBMITTED', 'PR_DECLINED'
      ];

      filter = {
        isRead: false,
        $and: [
          {
            $or: [
              { recipientId: userId, type: { $in: directorTypes } },
              { role: 'Director' },
              { targetRole: 'Director' },
              { type: { $in: directorTypes } }
            ]
          },
          {
            type: { $nin: nonDirectorTypes }
          }
        ]
      };
    } else {
      filter.recipientId = userId;
    }

    const count = await Notification.countDocuments(filter);

    res.status(200).json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markAsRead = async (req, res) => {
  try {
    const userId = req.query.userId || req.query.recipientId || req.user?._id;
    const filter = { _id: req.params.id };

    let notification = await Notification.findOneAndUpdate(
      filter,
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      notification = await Notification.findByIdAndUpdate(
        req.params.id,
        { isRead: true },
        { new: true }
      );
    }

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    res.status(200).json({ success: true, data: notification });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Mark all of the current user's notifications as read
// @route   PUT /api/notifications/mark-all-read
// @access  Private
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.body?.userId || req.body?.recipientId || req.query?.userId || req.query?.recipientId || req.user?._id;
    const userRole = req.user?.role;

    let filter = { isRead: false };

    if (userRole === 'Director') {
      const directorTypes = ['BOM_submitted', 'BOM_SUBMITTED', 'PO_submitted', 'PO_SUBMITTED', 'Invoice_submitted', 'Payment_approval'];
      const nonDirectorTypes = [
        'alert', 'info',
        'MIN_EXCEEDS_BOM', 'MIN_REQUEST_SUBMITTED',
        'SSR_SUBMITTED', 'SSR_TRANSFERRED', 'SSR_REJECTED',
        'BOM_STOCK_CHECK_REQUIRED', 'PR_SUBMITTED', 'PR_DECLINED'
      ];

      filter = {
        isRead: false,
        $and: [
          {
            $or: [
              { recipientId: userId, type: { $in: directorTypes } },
              { role: 'Director' },
              { targetRole: 'Director' },
              { type: { $in: directorTypes } }
            ]
          },
          {
            type: { $nin: nonDirectorTypes }
          }
        ]
      };
    } else if (userId) {
      filter.recipientId = userId;
    }

    await Notification.updateMany(filter, { isRead: true });
    res.status(200).json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export { createNotificationHelper };

