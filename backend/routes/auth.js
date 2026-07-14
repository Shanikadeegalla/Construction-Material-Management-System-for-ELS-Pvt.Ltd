import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  registerUser,
  loginUser,
  getUserProfile,
  getUsers,
  updateUser,
  deactivateUser,
  activateUser,
  getAuditLogs,
  resetUserPassword,
  deleteUser,
  getNextEmployeeId
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images (jpg/jpeg/png) are allowed!'));
    }
  }
});

const router = express.Router();

router.post('/upload-avatar', protect, upload.single('avatar'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a file' });
    }
    const avatarUrl = `/uploads/${req.file.filename}`;
    res.status(200).json({ success: true, avatarUrl });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getUserProfile);

// User management (gated by the Roles & Permissions matrix)
router.get('/next-employee-id', protect, checkPermission('Create/Edit Users'), getNextEmployeeId);
router.get('/users', protect, checkPermission('View User List'), getUsers);
router.put('/users/:id', protect, updateUser);
router.put('/users/:id/deactivate', protect, checkPermission('Create/Edit Users'), deactivateUser);
router.put('/users/:id/activate', protect, checkPermission('Create/Edit Users'), activateUser);
router.put('/users/:id/reset-password', protect, checkPermission('Create/Edit Users'), resetUserPassword);
router.delete('/users/:id', protect, checkPermission('Create/Edit Users'), deleteUser);

// Audit logs
router.get('/audit-logs', protect, checkPermission('Audit Logs'), getAuditLogs);

export default router;
