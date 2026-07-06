import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getNotificationCount } from '../controllers/inventoryController.js';
import { getNotifications, markAsRead } from '../controllers/notificationController.js';

const router = express.Router();

router.get('/count', protect, getNotificationCount);
router.get('/', protect, getNotifications);
router.put('/:id/read', protect, markAsRead);

export default router;
