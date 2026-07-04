import express from 'express';
import {
  getMaterials,
  addMaterial,
  updateMaterial,
  deleteMaterial,
  getLowStock,
  createGRN,
  getGRNs,
  issueMaterial,
  getTransfers,
  getNotifications,
  getMaterialUsage,
  createMaterialUsage
} from '../controllers/inventoryController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply protect middleware to secure all inventory routes
router.get('/', protect, getMaterials);
router.post('/add', protect, addMaterial);
router.put('/:id', protect, updateMaterial);
router.delete('/:id', protect, deleteMaterial);
router.get('/low-stock', protect, getLowStock);
router.get('/notifications', protect, getNotifications);

// Usage logging endpoints
router.route('/usage')
  .get(protect, getMaterialUsage)
  .post(protect, createMaterialUsage);

// GRN endpoints
router.get('/grn', protect, getGRNs);
router.get('/grn-list', protect, getGRNs);
router.post('/grn', protect, createGRN);

// Issuance / Transfer endpoints
router.post('/issue', protect, issueMaterial);
router.get('/transfers', protect, getTransfers);

export default router;