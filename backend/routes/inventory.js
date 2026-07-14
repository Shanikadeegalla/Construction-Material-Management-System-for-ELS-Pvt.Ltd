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
  createMaterialUsage
} from '../controllers/inventoryController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

// Apply protect middleware to secure all inventory routes
router.get('/', protect, getMaterials);
router.post('/add', protect, checkPermission('Manage Materials'), addMaterial);
router.put('/:id', protect, checkPermission('Manage Materials'), updateMaterial);
router.delete('/:id', protect, checkPermission('Manage Materials'), deleteMaterial);
router.get('/low-stock', protect, getLowStock);
router.get('/notifications', protect, getNotifications);

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

export default router;