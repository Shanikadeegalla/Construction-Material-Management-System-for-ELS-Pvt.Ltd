import express from 'express';
import {
  registerUser,
  loginUser,
  getUserProfile,
  getUsers,
  updateUser,
  deactivateUser,
  activateUser,
  getAuditLogs
} from '../controllers/authController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getUserProfile);

// Admin-only user management
router.get('/users', protect, admin, getUsers);
router.put('/users/:id', protect, updateUser);
router.put('/users/:id/deactivate', protect, admin, deactivateUser);
router.put('/users/:id/activate', protect, admin, activateUser);

// Audit logs
router.get('/audit-logs', protect, getAuditLogs);

export default router;
