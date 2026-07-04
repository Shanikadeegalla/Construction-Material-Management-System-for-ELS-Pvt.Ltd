import express from 'express';
import {
  getPOs,
  createPO,
  updatePOStatus
} from '../controllers/poController.js';

const router = express.Router();

router.get('/', getPOs);
router.post('/', createPO);
router.put('/:id', updatePOStatus);

export default router;
