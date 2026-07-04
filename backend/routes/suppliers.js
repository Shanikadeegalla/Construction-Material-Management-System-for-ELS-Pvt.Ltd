import express from 'express';
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deactivateSupplier
} from '../controllers/supplierController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Secure all supplier routes with JWT
router.route('/')
  .get(protect, getSuppliers)
  .post(protect, createSupplier);

router.post('/add', protect, createSupplier);

router.route('/:id')
  .put(protect, updateSupplier)
  .delete(protect, deactivateSupplier);

router.put('/:id/deactivate', protect, deactivateSupplier);

export default router;
