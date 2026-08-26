import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  createInvoice,
  getInvoices,
  getInvoiceById,
  approveInvoicePayment,
  rejectInvoicePayment,
  markInvoicePaid
} from '../controllers/invoiceController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const invoiceStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'invoice-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadInvoiceFile = multer({
  storage: invoiceStorage,
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
  .get(protect, getInvoices)
  .post(protect, checkPermission('Create Invoice'), uploadInvoiceFile.single('file'), createInvoice);

router.get('/:id', protect, getInvoiceById);
router.put('/:id/approve-payment', protect, checkPermission('Approve Payment'), approveInvoicePayment);
router.put('/:id/reject-payment', protect, checkPermission('Approve Payment'), rejectInvoicePayment);
router.put('/:id/mark-paid', protect, checkPermission('Approve Payment'), markInvoicePaid);

export default router;
