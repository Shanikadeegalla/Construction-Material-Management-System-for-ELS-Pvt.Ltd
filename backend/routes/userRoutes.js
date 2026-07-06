import express from 'express';
import { getUsers, createUser, updateUserEmail } from '../controllers/userController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(getUsers)
  .post(createUser);

router.put('/:id/email', protect, admin, updateUserEmail);

export default router;
