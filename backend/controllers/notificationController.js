import Notification from '../models/Notification.js';

// @desc    Get user notifications by recipientId / userId
// @route   GET /api/notifications
// @access  Private
export const getNotifications = async (req, res) => {
  try {
    const userId = req.query.userId || req.query.recipientId || req.user?._id;

    if (!userId) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    const filter = { recipientId: userId };
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
    if (!userId) {
      return res.status(200).json({ success: true, count: 0 });
    }

    const count = await Notification.countDocuments({
      recipientId: userId,
      isRead: false
    });

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
    if (userId) filter.recipientId = userId;

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
    const filter = { isRead: false };
    if (userId) filter.recipientId = userId;

    await Notification.updateMany(filter, { isRead: true });
    res.status(200).json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Utility helper to create notification programmatically
export const createNotificationHelper = async (recipientId, message, type = 'info', link = '') => {
  try {
    const notif = new Notification({
      recipientId,
      message,
      type,
      link
    });
    await notif.save();
    return notif;
  } catch (err) {
    console.error('Error creating notification:', err);
    return null;
  }
};
