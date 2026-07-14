import express from 'express';
import {
  getItemMasters,
  createItemMaster,
  updateItemMaster,
  deleteItemMaster
} from '../controllers/itemMasterController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, getItemMasters)
  .post(protect, checkPermission('Manage Item Master'), createItemMaster);

router.route('/:id')
  .put(protect, checkPermission('Manage Item Master'), updateItemMaster)
  .delete(protect, checkPermission('Manage Item Master'), deleteItemMaster);

export default router;
