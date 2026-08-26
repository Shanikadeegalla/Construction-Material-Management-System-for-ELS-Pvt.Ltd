import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  createQuotation,
  getQuotations,
  getQuotationById
} from '../controllers/quotationController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const quotationStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'quotation-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadQuotationFile = multer({
  storage: quotationStorage,
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

router.route('/')
  .get(protect, getQuotations)
  .post(protect, checkPermission('Manage Quotations'), uploadQuotationFile.single('file'), createQuotation);

router.get('/:id', protect, getQuotationById);

export default router;
