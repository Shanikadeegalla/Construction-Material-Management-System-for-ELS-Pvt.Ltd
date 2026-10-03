import express from 'express';
import {
  getMaterialCategories,
  createMaterialCategory,
  deleteMaterialCategory
} from '../controllers/materialCategoryController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, getMaterialCategories)
  .post(protect, checkPermission('Manage Item Master'), createMaterialCategory);

router.delete('/:name', protect, checkPermission('Manage Item Master'), deleteMaterialCategory);

export default router;
