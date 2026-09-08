import express from 'express';
import {
  getMINs,
  createMIN,
  createMaterialRequest,
  transferMIN,
  updateMINStatus,
  issueMIN,
  confirmMINReceipt
} from '../controllers/materialIssuanceController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, getMINs)
  .post(protect, createMIN);

router.post('/request', protect, createMaterialRequest);
router.post('/transfer', protect, checkPermission('Issue Materials'), transferMIN);

router.put('/:id/status', protect, checkPermission('Issue Materials'), updateMINStatus);
router.post('/:id/issue', protect, checkPermission('Issue Materials'), issueMIN);
router.post('/:id/confirm-receipt', protect, checkPermission('Confirm Material Receipt'), confirmMINReceipt);

export default router;
