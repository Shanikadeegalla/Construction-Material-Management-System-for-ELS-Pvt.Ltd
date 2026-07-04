import express from 'express';
import {
  getPurchaseRequests,
  createPurchaseRequest,
  approvePurchaseRequest,
  rejectPurchaseRequest
} from '../controllers/purchaseRequestController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply protect middleware to secure all purchase request routes
router.route('/')
  .get(protect, getPurchaseRequests)
  .post(protect, createPurchaseRequest);

router.put('/:id/approve', protect, approvePurchaseRequest);
router.put('/:id/reject', protect, rejectPurchaseRequest);

export default router;
