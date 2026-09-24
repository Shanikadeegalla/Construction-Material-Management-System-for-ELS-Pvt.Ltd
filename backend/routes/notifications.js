import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getNotifications, getNotificationCount, markAsRead, markAllAsRead } from '../controllers/notificationController.js';

const router = express.Router();

router.get('/count', protect, getNotificationCount);
router.get('/', protect, getNotifications);
router.put('/mark-all-read', protect, markAllAsRead);
router.put('/:id/read', protect, markAsRead);

export default router;
