import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deactivateSupplier,
  activateSupplier,
  getNextSupplierId
} from '../controllers/supplierController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'supplier-doc-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadDocument = multer({
  storage: documentStorage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|pdf/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = /jpeg|jpg|pdf/.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only PDF or JPG files are allowed!'));
  }
});

const router = express.Router();

router.post('/upload-document', protect, checkPermission('Supplier Management'), uploadDocument.single('document'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a file' });
    }
    res.status(200).json({ success: true, url: `/uploads/${req.file.filename}`, filename: req.file.originalname });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/next-id', protect, checkPermission('Supplier Management'), getNextSupplierId);

// Secure all supplier routes with JWT
router.route('/')
  .get(protect, getSuppliers)
  .post(protect, checkPermission('Supplier Management'), createSupplier);

router.post('/add', protect, checkPermission('Supplier Management'), createSupplier);

router.route('/:id')
  .put(protect, checkPermission('Supplier Management'), updateSupplier)
  .delete(protect, checkPermission('Supplier Management'), deactivateSupplier);

router.put('/:id/deactivate', protect, checkPermission('Supplier Management'), deactivateSupplier);
router.put('/:id/activate', protect, checkPermission('Supplier Management'), activateSupplier);

export default router;
