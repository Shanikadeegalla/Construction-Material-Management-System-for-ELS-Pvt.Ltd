import express from 'express';
import { getRoles, createRole, updateRole, deleteRole } from '../controllers/roleController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, admin, getRoles)
  .post(protect, admin, createRole);

router.route('/:id')
  .put(protect, admin, updateRole)
  .delete(protect, admin, deleteRole);

export default router;
