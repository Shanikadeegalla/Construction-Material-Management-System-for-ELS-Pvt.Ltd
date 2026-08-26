import express from 'express';
import {
  getMaterials,
  addMaterial,
  updateMaterial,
  deleteMaterial,
  getLowStock,
  createGRN,
  getGRNs,
  getTransfers,
  getNotifications,
  getMaterialUsage,
  createMaterialUsage,
  getStockLedger,
  createStockAdjustment
} from '../controllers/inventoryController.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

// Apply protect middleware to secure all inventory routes
router.get('/', protect, getMaterials);
// Materials are created/removed only via the Item Master (Admin) or system
// transactions (GRN/PO auto-resolution) — never manually from Main Store.
router.post('/add', protect, admin, addMaterial);
router.put('/:id', protect, checkPermission('Manage Materials'), updateMaterial);
router.delete('/:id', protect, admin, deleteMaterial);
router.get('/low-stock', protect, getLowStock);
router.get('/notifications', protect, getNotifications);

// Stock Adjustment — the only sanctioned way to correct current stock
// outside of GRN/MIN/Usage transactions (e.g. after a physical count).
router.post('/adjustments', protect, checkPermission('Stock Adjustments'), createStockAdjustment);

// Usage logging endpoints
router.route('/usage')
  .get(protect, getMaterialUsage)
  .post(protect, checkPermission('Log Material Usage'), createMaterialUsage);

// GRN endpoints
router.get('/grn', protect, getGRNs);
router.get('/grn-list', protect, getGRNs);
router.post('/grn', protect, checkPermission('Create GRN'), createGRN);

// Transfer ledger (populated by the Material Issuance Note issue flow, /api/min)
router.get('/transfers', protect, getTransfers);
router.get('/stock-ledger', protect, getStockLedger);

export default router;