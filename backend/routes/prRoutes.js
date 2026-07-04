import express from 'express';
import {
  getPRs,
  createPR,
  updatePRStatus
} from '../controllers/prController.js';

const router = express.Router();

router.get('/', getPRs);
router.post('/', createPR);
router.put('/:id', updatePRStatus);

export default router;
