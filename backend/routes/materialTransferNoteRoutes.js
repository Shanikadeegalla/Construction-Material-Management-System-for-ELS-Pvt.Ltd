import express from 'express';
import {
  createTransferNote,
  getTransferNotes,
  getTransferNoteById
} from '../controllers/materialTransferNoteController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, getTransferNotes)
  .post(protect, checkPermission('Issue Materials'), createTransferNote);

router.get('/:id', protect, getTransferNoteById);

export default router;
