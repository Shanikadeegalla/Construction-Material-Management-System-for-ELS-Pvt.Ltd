import express from 'express';
import {
  getBOMs,
  createBOM,
  approveBOM,
  rejectBOM,
  getBOMVersions,
  getApprovedBOM,
  getBOMStockCheck
} from '../controllers/bomController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, getBOMs)
  .post(protect, checkPermission('BOM Creation'), createBOM);

router.get('/versions/:projectId', protect, getBOMVersions);
router.get('/approved/:projectId', protect, getApprovedBOM);
router.get('/:bomId/stock-check', protect, getBOMStockCheck);

router.put('/:id/approve', protect, checkPermission('BOM Approval'), approveBOM);
router.put('/:id/reject', protect, checkPermission('BOM Approval'), rejectBOM);

export default router;
