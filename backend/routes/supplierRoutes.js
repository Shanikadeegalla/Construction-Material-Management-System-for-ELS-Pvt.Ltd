import express from 'express';
import {
  getSuppliers,
  addSupplier,
  updateSupplier,
  deleteSupplier
} from '../controllers/supplierController.js';

const router = express.Router();

router.get('/', getSuppliers);
router.post('/', addSupplier);
router.put('/:id', updateSupplier);
router.delete('/:id', deleteSupplier);

export default router;
