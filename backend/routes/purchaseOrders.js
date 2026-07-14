import express from 'express';
import {
  getPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  getPurchaseOrderById,
  sendPurchaseOrder,
  ratePurchaseOrderDelivery,
  getSupplierPerformance,
  updatePurchaseOrderSupplier,
  approvePurchaseOrder,
  rejectPurchaseOrder
} from '../controllers/purchaseOrderController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, getPurchaseOrders)
  .post(protect, checkPermission('Create PO'), createPurchaseOrder);

router.get('/supplier-performance', protect, getSupplierPerformance);
router.get('/:id', protect, getPurchaseOrderById);
router.put('/:id/status', protect, checkPermission('Manage PO Lifecycle'), updatePurchaseOrderStatus);
router.put('/:id/supplier', protect, checkPermission('Manage PO Lifecycle'), updatePurchaseOrderSupplier);
router.put('/:id/approve', protect, checkPermission('Approve PO'), approvePurchaseOrder);
router.put('/:id/reject', protect, checkPermission('Approve PO'), rejectPurchaseOrder);
router.put('/:id/send', protect, checkPermission('Manage PO Lifecycle'), sendPurchaseOrder);
router.put('/:id/rate-delivery', protect, checkPermission('Manage PO Lifecycle'), ratePurchaseOrderDelivery);

export default router;
