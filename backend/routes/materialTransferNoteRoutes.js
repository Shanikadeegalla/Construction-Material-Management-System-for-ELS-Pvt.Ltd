import express from 'express';
import {
  createTransferNote,
  getTransferNotes,
  getTransferNoteById,
  receiveTransferNote
} from '../controllers/materialTransferNoteController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, getTransferNotes)
  .post(protect, checkPermission('Issue Materials'), createTransferNote);

router.get('/:id', protect, getTransferNoteById);
router.post('/:id/receive', protect, checkPermission('Confirm Material Receipt'), receiveTransferNote);

export default router;
