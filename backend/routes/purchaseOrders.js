import express from 'express';
import {
  getPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  getPurchaseOrderById
} from '../controllers/purchaseOrderController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, getPurchaseOrders)
  .post(protect, createPurchaseOrder);

router.get('/:id', protect, getPurchaseOrderById);
router.put('/:id/status', protect, updatePurchaseOrderStatus);

export default router;
