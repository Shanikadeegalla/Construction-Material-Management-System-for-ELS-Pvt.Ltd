import express from 'express';
import {
  getUsageRecords,
  addUsageRecord,
  getVarianceReport
} from '../controllers/materialUsageController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, getUsageRecords)
  .post(protect, checkPermission('Log Material Usage'), addUsageRecord);

router.get('/variance', protect, getVarianceReport);

export default router;
