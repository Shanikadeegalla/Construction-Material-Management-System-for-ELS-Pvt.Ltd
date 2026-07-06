import express from 'express';
import {
  registerUser,
  loginUser,
  getUserProfile,
  getUsers,
  updateUser,
  deactivateUser,
  activateUser,
  getAuditLogs,
  resetUserPassword
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
router.put('/users/:id/reset-password', protect, admin, resetUserPassword);

// Audit logs
router.get('/audit-logs', protect, getAuditLogs);

export default router;
