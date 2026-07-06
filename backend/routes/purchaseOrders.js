import express from 'express';
import {
  getPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  getPurchaseOrderById,
  sendPurchaseOrder,
  ratePurchaseOrderDelivery,
  getSupplierPerformance
} from '../controllers/purchaseOrderController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, getPurchaseOrders)
  .post(protect, createPurchaseOrder);

router.get('/supplier-performance', protect, getSupplierPerformance);
router.get('/:id', protect, getPurchaseOrderById);
router.put('/:id/status', protect, updatePurchaseOrderStatus);
router.put('/:id/send', protect, sendPurchaseOrder);
router.put('/:id/rate-delivery', protect, ratePurchaseOrderDelivery);

export default router;
