import express from 'express';
import {
  createCheckoutSession,
  confirmPaymentSession,
  getPaymentByPO,
  generatePaymentReport,
  getPaymentReceipt,
  downloadPaymentReceipt,
  recordManualPayment,
  getPayments,
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

// Protected confirmation of a completed Stripe Checkout session (triggers supplier email + PDF receipt)
router.post(
  '/confirm-session',
  protect,
  authorizeRoles('PurchaseManager', 'Admin'),
  confirmPaymentSession
);

// Purchase Manager records an offline Cash / Cheque payment for a Director-approved invoice
router.post(
  '/record',
  protect,
  authorizeRoles('PurchaseManager', 'Admin'),
  recordManualPayment
);

// Same operation under the path used by earlier clients
router.post(
  '/manual',
  protect,
  authorizeRoles('PurchaseManager', 'Admin'),
  recordManualPayment
);

// Payment records list (feeds the Payment report)
router.get(
  '/',
  protect,
  getPayments
);

// Protected PDF payment report generation
router.get(
  '/report',
  protect,
  authorizeRoles('PurchaseManager', 'Director', 'Admin'),
  generatePaymentReport
);

// Protected single PO receipt details lookup
router.get('/:purchaseOrderId/receipt', protect, getPaymentReceipt);

// Protected PDF single PO receipt download
router.get('/:purchaseOrderId/receipt/download', protect, downloadPaymentReceipt);

// Protected payment lookup by PO ID
router.get('/:purchaseOrderId', protect, getPaymentByPO);

export default router;
