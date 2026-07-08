import express from 'express';
import { getPermissions, editPermission, bulkEditPermissions } from '../controllers/permissionController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, admin, getPermissions);

router.post('/edit', protect, admin, editPermission);
router.post('/bulk-edit', protect, admin, bulkEditPermissions);

export default router;
