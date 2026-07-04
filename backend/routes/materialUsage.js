import express from 'express';
import {
  getUsageRecords,
  addUsageRecord,
  getVarianceReport
} from '../controllers/materialUsageController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, getUsageRecords)
  .post(protect, addUsageRecord);

router.get('/variance', protect, getVarianceReport);

export default router;
