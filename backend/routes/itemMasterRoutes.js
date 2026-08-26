import express from 'express';
import {
  getItemMasters,
  createItemMaster,
  updateItemMaster,
  deleteItemMaster,
  getNextMaterialCode
} from '../controllers/itemMasterController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.get('/next-code', protect, checkPermission('Manage Item Master'), getNextMaterialCode);

router.route('/')
  .get(protect, getItemMasters)
  .post(protect, checkPermission('Manage Item Master'), createItemMaster);

router.route('/:id')
  .put(protect, checkPermission('Manage Item Master'), updateItemMaster)
  .delete(protect, checkPermission('Manage Item Master'), deleteItemMaster);

export default router;
