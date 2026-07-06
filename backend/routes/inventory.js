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
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply protect middleware to secure all inventory routes
router.get('/', protect, getMaterials);
router.post('/add', protect, authorizeRoles('MainStoreOfficer', 'Admin'), addMaterial);
router.put('/:id', protect, authorizeRoles('MainStoreOfficer', 'Admin'), updateMaterial);
router.delete('/:id', protect, authorizeRoles('MainStoreOfficer', 'Admin'), deleteMaterial);
router.get('/low-stock', protect, getLowStock);
router.get('/notifications', protect, getNotifications);

// Usage logging endpoints
router.route('/usage')
  .get(protect, getMaterialUsage)
  .post(protect, authorizeRoles('SiteStoreOfficer', 'Admin'), createMaterialUsage);

// GRN endpoints
router.get('/grn', protect, getGRNs);
router.get('/grn-list', protect, getGRNs);
router.post('/grn', protect, authorizeRoles('MainStoreOfficer', 'Admin'), createGRN);

// Issuance / Transfer endpoints
router.post('/issue', protect, authorizeRoles('MainStoreOfficer', 'Admin'), issueMaterial);
router.get('/transfers', protect, getTransfers);

export default router;