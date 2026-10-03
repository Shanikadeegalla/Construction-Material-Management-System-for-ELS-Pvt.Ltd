import fs from 'fs';
import path from 'path';
import Invoice from '../models/Invoice.js';
import User from '../models/userModel.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import { createNotificationHelper, notifyRoles } from './notificationController.js';
import { UPLOAD_DIR } from '../config/uploadDir.js';

const attachFileExists = (invoice) => {
  const invObj = invoice.toObject ? invoice.toObject() : { ...invoice };
  const fileUrl = invObj.file?.url || invObj.filePath || invObj.fileUrl;
  if (fileUrl) {
    const filename = path.basename(fileUrl);
    const cleanUrl = fileUrl.replace(/^\/uploads\//, '');
    const fullPath = path.join(UPLOAD_DIR, cleanUrl);
    const basePath = path.join(UPLOAD_DIR, filename);
    invObj.fileExists = fs.existsSync(fullPath) || fs.existsSync(basePath);
  } else {
    invObj.fileExists = false;
  }
  return invObj;
};

const generateNextInvoiceNumber = async () => {
  let next = (await Invoice.countDocuments()) + 1;
  let candidate;
  do {
    candidate = `INV-${String(next).padStart(4, '0')}`;
    next++;
  } while (await Invoice.findOne({ invoiceNumber: candidate }));
  return candidate;
};

// @desc    Record an invoice received from a supplier (MainStore, tied to a GRN/PO)
// @route   POST /api/invoices
// @access  Private (Create Invoice)
export const createInvoice = async (req, res) => {
  try {
    const { supplier, po, grn, amount, invoiceDate, dueDate, notes } = req.body;

    if (!supplier || !po || !amount) {
      return res.status(400).json({ success: false, message: 'Supplier, purchase order and amount are required.' });
    }
    if (!(Number(amount) > 0)) {
      return res.status(400).json({ success: false, message: 'Invoice amount must be greater than 0.' });
    }

    // An invoice is only payable for goods that have actually arrived.
    const poDoc = await PurchaseOrder.findById(po);
    if (!poDoc) {
      return res.status(404).json({ success: false, message: 'Purchase Order not found.' });
    }
    if (!grn && poDoc.status !== 'Delivered') {
      return res.status(400).json({ success: false, message: 'An invoice can only be recorded against a delivered Purchase Order or a GRN.' });
    }

    const invoiceNumber = await generateNextInvoiceNumber();

    if (req.file) {
      const filePathOnDisk = path.join(UPLOAD_DIR, req.file.filename);
      if (!fs.existsSync(filePathOnDisk)) {
        return res.status(400).json({ success: false, message: 'File upload failed. The invoice file was not saved to disk.' });
      }
    }

    const invoice = new Invoice({
      invoiceNumber,
      supplier,
      po,
      grn: grn || undefined,
      amount: Number(amount),
      invoiceDate: invoiceDate || new Date(),
      dueDate: dueDate || undefined,
      notes: notes || '',
      submittedBy: req.user ? req.user.name : '',
      file: req.file ? { url: `/uploads/${req.file.filename}`, filename: req.file.originalname } : undefined
    });

    await invoice.save();

    try {
      const directors = await User.find({ role: 'Director' });
      const msg = `New invoice ${invoice.invoiceNumber} submitted for payment approval`;
      if (directors.length > 0) {
        for (const d of directors) {
          await createNotificationHelper(d._id, msg, 'Invoice_submitted', '/director-dashboard', 'Director', 'Director');
        }
      } else {
        await createNotificationHelper(null, msg, 'Invoice_submitted', '/director-dashboard', 'Director', 'Director');
      }
    } catch (nErr) {
      console.error('Error creating invoice submission notifications:', nErr);
    }

    res.status(201).json({ success: true, message: 'Invoice recorded successfully!', data: attachFileExists(invoice) });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get invoices, optionally filtered by supplier / po / status
// @route   GET /api/invoices
// @access  Private
export const getInvoices = async (req, res) => {
  try {
    const query = {};
    if (req.query.supplier) query.supplier = req.query.supplier;
    if (req.query.po) query.po = req.query.po;
    if (req.query.status) query.status = req.query.status;
    if (req.query.search) {
      query.$or = [
        { invoiceNumber: new RegExp(req.query.search, 'i') },
        { notes: new RegExp(req.query.search, 'i') },
        { submittedBy: new RegExp(req.query.search, 'i') }
      ];
    }

    if (req.query.page || req.query.limit) {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
      const skip = (page - 1) * limit;

      const total = await Invoice.countDocuments(query);
      const totalPages = Math.ceil(total / limit) || 1;

      const invoices = await Invoice.find(query)
        .populate('supplier', 'name supplierId')
        .populate('po', 'poNumber')
        .populate('grn', 'grnNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const formatted = invoices.map(attachFileExists);

      return res.status(200).json({
        success: true,
        count: formatted.length,
        total,
        page,
        limit,
        totalPages,
        data: formatted
      });
    }

    const invoices = await Invoice.find(query)
      .populate('supplier', 'name supplierId')
      .populate('po', 'poNumber')
      .populate('grn', 'grnNumber')
      .sort({ createdAt: -1 });

    const formatted = invoices.map(attachFileExists);

    res.status(200).json({ success: true, count: formatted.length, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get a single invoice
// @route   GET /api/invoices/:id
// @access  Private
export const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('supplier', 'name supplierId')
      .populate('po', 'poNumber')
      .populate('grn', 'grnNumber');
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }
    res.status(200).json({ success: true, data: attachFileExists(invoice) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// The Purchase Manager acts on the decision (pays an approved invoice), the
// Main Store Officer who submitted the invoice is kept informed.
const notifyInvoiceSubmitters = async (invoice, msg, type) => {
  await notifyRoles(['PurchaseManager'], msg, type, '/purchase-orders');
  await notifyRoles(['MainStoreOfficer'], msg, type, '/main-store-dashboard');
};

// @desc    Approve an invoice for payment (Director sign-off)
// @route   PUT /api/invoices/:id/approve-payment
// @access  Private (Approve Payment)
export const approveInvoicePayment = async (req, res) => {
  try {
    const approvedBy = req.user ? req.user.name : 'Director';
    const { note } = req.body;

    // Only an invoice still waiting on the Director can be approved - this
    // stops an already Paid/Rejected invoice being reopened and paid twice.
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, status: 'Pending Approval' },
      { status: 'Approved', approvedBy, approvedAt: new Date(), rejectionReason: note || '' },
      { new: true }
    );

    if (!invoice) {
      const exists = await Invoice.exists({ _id: req.params.id });
      if (!exists) {
        return res.status(404).json({ success: false, message: 'Invoice not found.' });
      }
      return res.status(400).json({ success: false, message: 'Only invoices pending approval can be approved.' });
    }

    await notifyInvoiceSubmitters(
      invoice,
      `Invoice ${invoice.invoiceNumber} approved for payment by Director${approvedBy ? ` (${approvedBy})` : ''} - ready to be paid`,
      'Invoice_approved'
    );

    res.status(200).json({ success: true, message: 'Invoice approved for payment!', data: invoice });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Reject an invoice's payment with a reason (Director sign-off)
// @route   PUT /api/invoices/:id/reject-payment
// @access  Private (Approve Payment)
export const rejectInvoicePayment = async (req, res) => {
  try {
    const approvedBy = req.user ? req.user.name : 'Director';
    const { rejectionReason } = req.body;

    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, status: 'Pending Approval' },
      { status: 'Rejected', approvedBy, rejectionReason: rejectionReason || 'No reason provided' },
      { new: true }
    );

    if (!invoice) {
      const exists = await Invoice.exists({ _id: req.params.id });
      if (!exists) {
        return res.status(404).json({ success: false, message: 'Invoice not found.' });
      }
      return res.status(400).json({ success: false, message: 'Only invoices pending approval can be rejected.' });
    }

    await notifyInvoiceSubmitters(
      invoice,
      `Invoice ${invoice.invoiceNumber} payment rejected by Director${rejectionReason ? `: ${rejectionReason}` : ''}`,
      'Invoice_rejected'
    );

    res.status(200).json({ success: true, message: 'Invoice payment rejected.', data: invoice });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Mark an approved invoice as paid
// @route   PUT /api/invoices/:id/mark-paid
// @access  Private (Approve Payment)
export const markInvoicePaid = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }
    if (invoice.status !== 'Approved') {
      return res.status(400).json({ success: false, message: 'Only approved invoices can be marked as paid.' });
    }

    // Kept for backwards compatibility; payments are normally recorded through
    // POST /api/payments/record (Cash/Cheque) or Stripe checkout, both of
    // which also create the Payment record this shortcut does not.
    invoice.status = 'Paid';
    invoice.paidAt = new Date();
    invoice.paymentMethod = req.body.paymentMethod || 'Cash';
    await invoice.save();

    res.status(200).json({ success: true, message: 'Invoice marked as paid!', data: invoice });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Re-upload invoice file for an existing invoice record
// @route   PUT /api/invoices/:id/reupload
// @access  Private
export const reuploadInvoiceFile = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please attach an invoice file to upload.' });
    }
    const filePathOnDisk = path.join(UPLOAD_DIR, req.file.filename);
    if (!fs.existsSync(filePathOnDisk)) {
      return res.status(400).json({ success: false, message: 'File upload failed. The file was not saved to disk.' });
    }

    invoice.file = {
      url: `/uploads/${req.file.filename}`,
      filename: req.file.originalname
    };
    await invoice.save();

    res.status(200).json({
      success: true,
      message: 'Invoice document re-uploaded successfully!',
      data: attachFileExists(invoice)
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

