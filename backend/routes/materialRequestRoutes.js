import express from 'express';
import {
  createMaterialRequest,
  getMyRequests,
  getMaterialRequests,
  getMaterialRequestById,
  rejectMaterialRequest,
  cancelMaterialRequest
} from '../controllers/materialRequestController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, getMaterialRequests)
  .post(protect, createMaterialRequest);

router.get('/my-requests', protect, getMyRequests);
router.get('/:id', protect, getMaterialRequestById);
router.put('/:id/reject', protect, rejectMaterialRequest);
router.put('/:id/cancel', protect, cancelMaterialRequest);

export default router;
