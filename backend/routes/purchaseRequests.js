import express from 'express';
import {
  getPurchaseRequests,
  createPurchaseRequest,
  updatePurchaseRequestStatus
} from '../controllers/purchaseRequestController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

// Apply protect middleware to secure all purchase request routes
// PRs no longer require an approval step: they go straight from Main Store
// to the Purchase Manager, who converts them into a Purchase Order.
router.route('/')
  .get(protect, getPurchaseRequests)
  .post(protect, checkPermission('Create PR'), createPurchaseRequest);

router.put('/:id/status', protect, checkPermission('Manage PO Lifecycle'), updatePurchaseRequestStatus);

export default router;
