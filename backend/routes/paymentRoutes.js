import express from 'express';
import {
  createCheckoutSession,
  getPaymentByPO,
  generatePaymentReport,
  getPaymentReceipt,
  downloadPaymentReceipt,
  handleWebhook
} from '../controllers/paymentController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Protected PO payment checkout session creation (Purchase Manager & Admin only)
router.post(
  '/create-checkout-session',
  protect,
  authorizeRoles('PurchaseManager', 'Admin'),
  createCheckoutSession
);

// Protected PDF payment report generation (Purchase Manager & Admin only)
router.get(
  '/report',
  protect,
  authorizeRoles('PurchaseManager', 'Admin'),
  generatePaymentReport
);

// Protected single PO receipt details lookup
router.get('/:purchaseOrderId/receipt', protect, getPaymentReceipt);

// Protected PDF single PO receipt download
router.get('/:purchaseOrderId/receipt/download', protect, downloadPaymentReceipt);

// Protected payment lookup by PO ID
router.get('/:purchaseOrderId', protect, getPaymentByPO);

export default router;
