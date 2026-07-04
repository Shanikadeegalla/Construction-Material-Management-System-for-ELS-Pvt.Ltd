import express from 'express';
import {
  getBOMs,
  createBOM,
  approveBOM,
  rejectBOM
} from '../controllers/bomController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, getBOMs)
  .post(protect, createBOM);

router.put('/:id/approve', protect, approveBOM);
router.put('/:id/reject', protect, rejectBOM);

export default router;
