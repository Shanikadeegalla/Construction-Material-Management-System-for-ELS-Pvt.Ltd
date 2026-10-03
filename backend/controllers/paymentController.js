import Stripe from 'stripe';
import PDFDocument from 'pdfkit';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Supplier from '../models/Supplier.js';
import Payment from '../models/Payment.js';
import Invoice from '../models/Invoice.js';
import { sendMail, escapeHtml } from '../utils/mailer.js';
import { notifyRoles } from './notificationController.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const CURRENCY = (process.env.STRIPE_CURRENCY || 'lkr').toLowerCase();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Draws the payment receipt content onto a given PDFKit document instance.
// Shared by the downloadable receipt endpoint and the buffer used for email attachments.
const drawReceiptContent = (doc, fields) => {
  const {
    invoiceNumber, poNumber, grnNumber, supplierName, supplierEmail,
    amountPaid, currency, paidAt, stripeRef, paidByName,
    method = 'Stripe', reference = '', bankName = ''
  } = fields;
  const isStripe = method === 'Stripe';
  const refLabel = isStripe ? 'Stripe Reference ID:' : method === 'Cheque' ? 'Cheque No. / Bank:' : 'Cash Voucher / Ref No.:';
  const refValue = isStripe
    ? (stripeRef || '-')
    : [reference, bankName].filter(Boolean).join(' / ') || '-';

  doc.fillColor('#0d1b4b').fontSize(22).font('Helvetica-Bold').text('ELS Construction', 40, 40);
  doc.fillColor('#64748b').fontSize(11).font('Helvetica').text('Official Payment Receipt', 40, 68);

  doc.moveTo(40, 90).lineTo(555, 90).strokeColor('#cbd5e1').stroke();

  doc.rect(390, 42, 165, 34).fill('#dcfce7');
  doc.fillColor('#15803d').fontSize(11).font('Helvetica-Bold').text('✓ PAYMENT CONFIRMED', 402, 54);

  let y = 110;
  doc.rect(40, y, 515, 270).fillAndStroke('#f8fafc', '#cbd5e1');

  const addField = (label, value, yPos, isBold = false) => {
    doc.fillColor('#475569').fontSize(10).font('Helvetica-Bold').text(label, 60, yPos);
    doc.fillColor('#0f172a').fontSize(10).font(isBold ? 'Helvetica-Bold' : 'Helvetica').text(String(value), 220, yPos);
  };

  addField('Invoice Number:', invoiceNumber, y + 16);
  addField('Purchase Order No:', poNumber, y + 42);
  addField('Goods Received Note (GRN):', grnNumber, y + 68);
  addField('Supplier Name:', supplierName, y + 94);
  addField('Supplier Contact:', supplierEmail, y + 120);
  addField('Amount Paid:', `${currency} ${Number(amountPaid).toLocaleString()}`, y + 146, true);
  addField('Payment Date & Time:', new Date(paidAt).toLocaleString(), y + 172);
  addField('Payment Status:', isStripe ? 'PAID (Verified via Stripe Gateway)' : `PAID (${method})`, y + 198, true);
  addField(refLabel, refValue, y + 224);
  addField('Paid By (Authorized Manager):', paidByName, y + 250);

  doc.fillColor('#0d1b4b').fontSize(11).font('Helvetica-Bold').text('Transaction Summary & Acknowledgement', 40, y + 300);
  doc.fillColor('#475569').fontSize(9.5).font('Helvetica').text(
    `This receipt confirms that payment of ${currency} ${Number(amountPaid).toLocaleString()} for Purchase Order ${poNumber} has been successfully settled with ${supplierName}.`,
    40, y + 320, { width: 515, align: 'left', lineGap: 4 }
  );

  doc.moveTo(40, 780).lineTo(555, 780).strokeColor('#e2e8f0').stroke();
  doc.fillColor('#94a3b8').fontSize(8.5).font('Helvetica').text(
    'This is a system-generated receipt from ELS Construction Material Management System. No signature required.',
    40, 792, { align: 'center', width: 515 }
  );
};

// Renders the same receipt content into an in-memory PDF buffer (used for email attachments).
const buildReceiptPdfBuffer = (fields) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'portrait' });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);
  drawReceiptContent(doc, fields);
  doc.end();
});

// Sends the "payment received" email (with PDF receipt attached) to the supplier for a paid PO.
// Idempotent: skips silently if this payment has already triggered a notification.
const sendPaymentConfirmation = async ({ payment, po, supplierDoc, invoice }) => {
  if (payment.emailSentAt) return false;
  if (!supplierDoc || !supplierDoc.email) {
    console.warn(`Skipping payment confirmation email: no supplier email on file for payment ${payment._id}`);
    return false;
  }

  const poNumber = po?.poNumber || 'N/A';
  const invoiceNumber = invoice?.invoiceNumber || `INV-${poNumber.replace('PO-', '')}`;
  const grnNumber = invoice?.grn?.grnNumber || 'N/A';
  const currency = (payment.currency || CURRENCY).toUpperCase();

  const pdfBuffer = await buildReceiptPdfBuffer({
    invoiceNumber,
    poNumber,
    grnNumber,
    supplierName: supplierDoc.name,
    supplierEmail: supplierDoc.email,
    amountPaid: payment.amount,
    currency,
    paidAt: payment.paidAt || new Date(),
    stripeRef: payment.stripeSessionId,
    method: payment.method || 'Stripe',
    reference: payment.reference,
    bankName: payment.bankName,
    paidByName: 'Purchase Manager'
  });

  const html = `
    <div style="font-family:Arial,sans-serif;color:#0d1b4b;padding:20px;border:1px solid #e2e8f0;border-radius:8px;">
      <h2 style="color:#0d1b4b;">Payment Confirmation - PO ${escapeHtml(poNumber)}</h2>
      <p>Dear ${escapeHtml(supplierDoc.name)},</p>
      <p>We are pleased to inform you that payment for <strong>Purchase Order ${escapeHtml(poNumber)}</strong> has been processed successfully. Please find the official payment receipt attached to this email.</p>
      <div style="background:#f8fafc;padding:16px;border-radius:6px;margin:16px 0;">
        <p style="margin:4px 0;"><strong>PO Number:</strong> ${escapeHtml(poNumber)}</p>
        <p style="margin:4px 0;"><strong>Amount Paid:</strong> ${escapeHtml(currency)} ${Number(payment.amount).toLocaleString()}</p>
        <p style="margin:4px 0;"><strong>Payment Date:</strong> ${new Date(payment.paidAt || Date.now()).toLocaleDateString()}</p>
        <p style="margin:4px 0;"><strong>Status:</strong> <span style="color:#16a34a;font-weight:bold;">PAID</span></p>
      </div>
      <p>Thank you for your partnership with ELS Construction.</p>
      <p>Regards,<br/>ELS Construction Procurement Team</p>
    </div>`;

  await sendMail({
    to: supplierDoc.email,
    subject: `Payment Received - Purchase Order ${poNumber}`,
    html,
    attachments: [{
      filename: `receipt-${invoiceNumber}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }]
  });

  payment.emailSentAt = new Date();
  await payment.save();
  return true;
};

// Finds the Payment record belonging to a Stripe Checkout session.
const findPaymentForSession = async (session, fallbackPoId) => {
  let payment = await Payment.findOne({ stripeSessionId: session.id });
  if (!payment && session.metadata?.invoiceId) {
    payment = await Payment.findOne({ invoice: session.metadata.invoiceId });
  }
  const poId = fallbackPoId || session.metadata?.purchaseOrderId;
  if (!payment && poId) {
    payment = await Payment.findOne({ purchaseOrder: poId }).sort({ updatedAt: -1 });
  }
  return payment;
};

// Applies a completed payment (Stripe, Cash or Cheque) to the Payment record, its Invoice and
// its PO, then notifies the supplier and the internal approvers. Idempotent: safe to call from
// both the Stripe success page and the webhook. `session` is only present for Stripe.
const settlePayment = async (payment, session = null) => {
  const wasAlreadyPaid = payment.status === 'paid';
  if (!wasAlreadyPaid) {
    payment.status = 'paid';
    payment.paidAt = payment.paidAt || new Date();
    await payment.save();
  }
  const method = payment.method || 'Stripe';

  const invoiceId = payment.invoice || session?.metadata?.invoiceId;
  const invoice = invoiceId
    ? await Invoice.findById(invoiceId).populate('grn', 'grnNumber')
    : await Invoice.findOne({ po: payment.purchaseOrder }).populate('grn', 'grnNumber');

  if (invoice && invoice.status !== 'Paid') {
    invoice.status = 'Paid';
    invoice.paidAt = payment.paidAt;
    invoice.paymentMethod = method;
    if (session) invoice.stripeSessionId = session.id;
    await invoice.save();
  }

  // The PO only counts as paid once none of its invoices are still awaiting payment.
  const po = await PurchaseOrder.findById(payment.purchaseOrder);
  if (po && po.paymentStatus !== 'paid') {
    const unpaidCount = await Invoice.countDocuments({
      po: po._id,
      status: { $in: ['Pending Approval', 'Approved'] }
    });
    if (unpaidCount === 0) {
      po.paymentStatus = 'paid';
      await po.save();
    }
  }

  // Tell the Director (who approved it) and Main Store (who submitted the invoice) once.
  if (!wasAlreadyPaid) {
    const currency = (payment.currency || CURRENCY).toUpperCase();
    const msg = `Payment of ${currency} ${Number(payment.amount).toLocaleString()} recorded for invoice ${invoice?.invoiceNumber || ''} (PO ${po?.poNumber || 'N/A'}) via ${method}.`;
    await notifyRoles(['Director'], msg, 'PAYMENT_RECORDED', '/director-dashboard');
    await notifyRoles(['MainStoreOfficer'], msg, 'PAYMENT_RECORDED', '/main-store-dashboard');
  }

  let emailSent = !!payment.emailSentAt;
  if (!emailSent) {
    const supplierDoc = await Supplier.findById(payment.supplier);
    try {
      emailSent = await sendPaymentConfirmation({ payment, po, supplierDoc, invoice });
    } catch (mailErr) {
      console.error('Error sending payment confirmation email:', mailErr);
    }
  }

  return emailSent;
};

// @desc    Create a Stripe Checkout Session to pay a Director-approved supplier invoice
// @route   POST /api/payments/create-checkout-session
// @access  Private (PurchaseManager / Admin)
export const createCheckoutSession = async (req, res) => {
  try {
    let { invoiceId, purchaseOrderId, amount } = req.body;

    if (!invoiceId && !purchaseOrderId) {
      return res.status(400).json({ success: false, message: 'invoiceId or purchaseOrderId is required.' });
    }

    let invoice;
    if (invoiceId) {
      invoice = await Invoice.findById(invoiceId);
    } else if (purchaseOrderId) {
      invoice = await Invoice.findOne({ po: purchaseOrderId, status: 'Approved' })
        || await Invoice.findOne({ po: purchaseOrderId }).sort({ createdAt: -1 });
    }

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    const targetPoId = purchaseOrderId || (invoice.po ? invoice.po.toString() : null);
    if (!targetPoId) {
      return res.status(400).json({ success: false, message: 'purchaseOrderId is required.' });
    }

    const po = await PurchaseOrder.findById(targetPoId);
    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase Order for this invoice was not found.' });
    }

    if (invoice.po && invoice.po.toString() !== po._id.toString()) {
      return res.status(400).json({ success: false, message: 'Invoice does not belong to the specified Purchase Order.' });
    }

    if (invoice.status === 'Paid') {
      return res.status(400).json({ success: false, message: 'This invoice has already been paid.' });
    }

    // Payment is gated on the Director's approval of the invoice
    if (invoice.status !== 'Approved') {
      return res.status(400).json({
        success: false,
        message: 'Only Director-approved invoices can be paid.'
      });
    }

    if (amount !== undefined && amount !== null && Math.abs(Number(amount) - Number(invoice.amount)) > 0.01) {
      return res.status(400).json({ success: false, message: `Provided payment amount (${amount}) does not match invoice amount (${invoice.amount}).` });
    }

    const supplierDoc = await Supplier.findById(invoice.supplier);
    const supplierName = supplierDoc ? supplierDoc.name : 'Supplier';

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      // Hide the green "Link" button so the page only offers the card form.
      wallet_options: { link: { display: 'never' } },
      line_items: [{
        price_data: {
          currency: CURRENCY,
          product_data: {
            name: `Invoice ${invoice.invoiceNumber}`,
            description: `PO ${po.poNumber} - Supplier: ${supplierName}`
          },
          unit_amount: Math.round(Number(invoice.amount) * 100)
        },
        quantity: 1
      }],
      metadata: {
        invoiceId: invoice._id.toString(),
        purchaseOrderId: po._id.toString(),
        supplierId: supplierDoc ? supplierDoc._id.toString() : ''
      },
      success_url: `${FRONTEND_URL}/payments/success?session_id={CHECKOUT_SESSION_ID}&po=${po._id}`,
      cancel_url: `${FRONTEND_URL}/payments/cancel?po=${po._id}`
    });

    // Save or update pending Payment record
    await Payment.findOneAndUpdate(
      { invoice: invoice._id },
      {
        invoice: invoice._id,
        purchaseOrder: po._id,
        supplier: invoice.supplier,
        amount: invoice.amount,
        currency: CURRENCY,
        method: 'Stripe',
        stripeSessionId: session.id,
        status: 'pending',
        paidBy: req.user ? req.user._id : undefined
      },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, url: session.url });
  } catch (error) {
    console.error('Error creating Stripe checkout session:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Confirm a completed Stripe Checkout session and (idempotently) trigger the
//          supplier payment notification email + PDF receipt. Called from the frontend
//          success page as soon as Stripe redirects back — this does not depend on the
//          Stripe webhook reaching the server, which local/dev environments often can't do
//          without running `stripe listen`.
// @route   POST /api/payments/confirm-session
// @access  Private (PurchaseManager / Admin)
export const confirmPaymentSession = async (req, res) => {
  try {
    const { sessionId, purchaseOrderId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId is required.' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ success: false, message: 'Payment has not completed yet.' });
    }

    const payment = await findPaymentForSession(session, purchaseOrderId);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'No payment record found for this session.' });
    }

    const emailSent = await settlePayment(payment, session);

    res.status(200).json({ success: true, data: { paymentStatus: payment.status, emailSent } });
  } catch (error) {
    console.error('Error confirming payment session:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Purchase Manager records an offline (Cash or Cheque) payment against a
//          Director-approved supplier invoice.
// @route   POST /api/payments/record
// @access  Private (PurchaseManager / Admin)
export const recordManualPayment = async (req, res) => {
  try {
    if (req.user && !['PurchaseManager', 'Admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only Purchase Manager or Admin can record payments.' });
    }

    const { purchaseOrderId, paidAt, notes: inputNotes, chequeDate: inputChequeDate } = req.body;
    let { invoiceId } = req.body;

    // A caller that only knows the Purchase Order pays that PO's approved invoice.
    if (!invoiceId && purchaseOrderId) {
      const poInvoice = await Invoice.findOne({ po: purchaseOrderId, status: 'Approved' })
        || await Invoice.findOne({ po: purchaseOrderId }).sort({ createdAt: -1 });
      if (!poInvoice) {
        return res.status(400).json({ success: false, message: 'This Purchase Order has no supplier invoice yet. An invoice must be recorded and approved by the Director before payment.' });
      }
      invoiceId = poInvoice._id;
    }

    if (!invoiceId) {
      return res.status(400).json({ success: false, message: 'invoiceId or purchaseOrderId is required.' });
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }
    if (invoice.status === 'Paid') {
      return res.status(400).json({ success: false, message: 'This invoice has already been paid.' });
    }
    if (invoice.status !== 'Approved') {
      return res.status(400).json({ success: false, message: 'Only Director-approved invoices can be paid.' });
    }

    // Amount safeguard: never take amount from client; if provided, must match database amount
    if (req.body.amount !== undefined && req.body.amount !== null) {
      if (Math.abs(Number(req.body.amount) - Number(invoice.amount)) > 0.01) {
        return res.status(400).json({
          success: false,
          message: `Provided payment amount (${req.body.amount}) does not match invoice amount (${invoice.amount}).`
        });
      }
    }

    const method = (req.body.method || '').trim();
    if (!['Cash', 'Cheque'].includes(method)) {
      return res.status(400).json({ success: false, message: 'Payment method must be Cash or Cheque.' });
    }

    // Payment Date validation
    if (!paidAt) {
      return res.status(400).json({ success: false, message: 'Payment date is required.' });
    }
    const paidDate = new Date(paidAt);
    if (Number.isNaN(paidDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid payment date.' });
    }
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    if (paidDate > endOfToday) {
      return res.status(400).json({ success: false, message: 'Payment date cannot be in the future.' });
    }
    if (invoice.invoiceDate) {
      const invDateStart = new Date(invoice.invoiceDate);
      invDateStart.setHours(0, 0, 0, 0);
      const paidDateStart = new Date(paidDate);
      paidDateStart.setHours(0, 0, 0, 0);
      if (paidDateStart < invDateStart) {
        return res.status(400).json({ success: false, message: 'Payment date cannot be earlier than invoice date.' });
      }
    }

    let reference = (req.body.reference || '').trim();
    let bankName = (req.body.bankName || '').trim();
    let chequeNumber = (req.body.chequeNumber || req.body.reference || '').trim();
    let chequeDate = inputChequeDate ? new Date(inputChequeDate) : null;

    if (method === 'Cash') {
      if (reference.length > 50) {
        return res.status(400).json({ success: false, message: 'Voucher / Receipt No cannot exceed 50 characters.' });
      }
      if (reference && !/^[a-zA-Z0-9\-_/]+$/.test(reference)) {
        return res.status(400).json({ success: false, message: 'Voucher / Receipt No contains invalid characters. Only letters, numbers, -, _ and / are allowed.' });
      }
    }

    if (method === 'Cheque') {
      if (!chequeNumber) {
        return res.status(400).json({ success: false, message: 'Cheque number is required for cheque payments.' });
      }
      if (!/^\d{6}$/.test(chequeNumber)) {
        return res.status(400).json({ success: false, message: 'Cheque number must be exactly 6 digits.' });
      }
      if (!bankName) {
        return res.status(400).json({ success: false, message: 'Bank name is required for cheque payments.' });
      }
      if (!inputChequeDate || Number.isNaN(chequeDate?.getTime())) {
        return res.status(400).json({ success: false, message: 'Cheque date is required for cheque payments.' });
      }

      // Duplicate Cheque check (same cheque number and bank name for paid payments)
      const duplicateCheque = await Payment.findOne({
        method: 'Cheque',
        chequeNumber: chequeNumber,
        bankName: new RegExp(`^${bankName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        status: { $in: ['paid', 'completed'] }
      });
      if (duplicateCheque) {
        return res.status(400).json({
          success: false,
          message: `A cheque with number "${chequeNumber}" for bank "${bankName}" has already been recorded.`
        });
      }
      reference = chequeNumber;
    }

    // Notes sanitization and length check
    let rawNotes = (inputNotes || '').trim();
    if (rawNotes.length > 500) {
      return res.status(400).json({ success: false, message: 'Notes cannot exceed 500 characters.' });
    }
    const safeNotes = rawNotes
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    const po = await PurchaseOrder.findById(invoice.po);
    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase Order for this invoice was not found.' });
    }

    // Idempotency check: prevent duplicate payment creation for already paid invoice
    const existingPaid = await Payment.findOne({ invoice: invoice._id, status: { $in: ['paid', 'completed'] } });
    if (existingPaid) {
      return res.status(400).json({ success: false, message: 'This invoice has already been paid.' });
    }

    // Reuses the pending Payment row left behind by an abandoned Stripe checkout, if any.
    const payment = await Payment.findOneAndUpdate(
      { invoice: invoice._id },
      {
        invoice: invoice._id,
        purchaseOrder: po._id,
        supplier: invoice.supplier,
        amount: invoice.amount, // Always derived from the database invoice document
        currency: CURRENCY,
        method,
        reference,
        bankName: method === 'Cheque' ? bankName : '',
        chequeNumber: method === 'Cheque' ? chequeNumber : '',
        ...(method === 'Cheque' && chequeDate ? { chequeDate } : {}),
        recordedBy: req.user ? req.user._id : undefined,
        notes: safeNotes,
        paidAt: paidDate,
        paidBy: req.user ? req.user._id : undefined,
        $unset: { stripeSessionId: 1 }
      },
      { upsert: true, new: true }
    );

    const emailSent = await settlePayment(payment);

    res.status(201).json({
      success: true,
      message: `${method} payment recorded for invoice ${invoice.invoiceNumber}.`,
      data: { payment, emailSent }
    });
  } catch (error) {
    console.error('Error recording manual payment:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    List payment records (newest first) for the payment report. Optional
//          ?status= / ?method= / ?from= / ?to= filters.
// @route   GET /api/payments
// @access  Private
export const getPayments = async (req, res) => {
  try {
    const { status, method, from, to } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (method) filter.method = method;
    if (from || to) {
      filter.paidAt = {};
      if (from) filter.paidAt.$gte = new Date(from);
      if (to) filter.paidAt.$lte = new Date(to);
    }

    const payments = await Payment.find(filter)
      .populate('purchaseOrder', 'poNumber totalAmount paymentStatus status')
      .populate('supplier', 'name email')
      .populate('invoice', 'invoiceNumber amount status invoiceDate dueDate')
      .populate('paidBy', 'name role')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: payments.length, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Stripe Webhook handler for checkout.session.completed
// @route   POST /api/payments/webhook
// @access  Public (Stripe Signature Verified)
export const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    try {
      const payment = await findPaymentForSession(session);
      if (payment) {
        await settlePayment(payment, session);
      }
    } catch (err) {
      console.error('Error handling webhook payment completion:', err);
    }
  }

  res.status(200).json({ received: true });
};

// @desc    Get payment status/history for a Purchase Order
// @route   GET /api/payments/:purchaseOrderId
// @access  Private
export const getPaymentByPO = async (req, res) => {
  try {
    const { purchaseOrderId } = req.params;
    const payment = await Payment.findOne({ purchaseOrder: purchaseOrderId })
      .populate('purchaseOrder', 'poNumber totalAmount paymentStatus status')
      .populate('supplier', 'name email phone');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'No payment record found for this Purchase Order.' });
    }

    res.status(200).json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Generate and stream PDF report of payments/invoices
// @route   GET /api/payments/report
// @access  Private (PurchaseManager / Admin)
export const generatePaymentReport = async (req, res) => {
  try {
    const { from, to, status } = req.query;

    const filter = {};

    if (status) {
      if (status.toLowerCase() === 'paid') {
        filter.status = 'Paid';
      } else if (status.toLowerCase() === 'pending') {
        filter.status = { $in: ['Pending Approval', 'Approved'] };
      } else {
        filter.status = status;
      }
    }

    if (from || to) {
      filter.invoiceDate = {};
      if (from) filter.invoiceDate.$gte = new Date(from);
      if (to) filter.invoiceDate.$lte = new Date(to);
    }

    const invoices = await Invoice.find(filter)
      .populate('supplier', 'name')
      .populate('po', 'poNumber')
      .populate('grn', 'grnNumber')
      .sort({ createdAt: -1 });

    const totalInvoices = invoices.length;
    const totalAmount = invoices.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
    const totalPaidAmount = invoices
      .filter(i => i.status === 'Paid')
      .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
    const totalPendingAmount = invoices
      .filter(i => i.status !== 'Paid')
      .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });

    const filename = `payment-report-${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Document Header
    doc.fillColor('#0d1b4b').fontSize(18).text('ELS Construction — Payment Report', { align: 'left' });
    doc.fillColor('#64748b').fontSize(9).text(`Generated Date: ${new Date().toLocaleString()}`, { align: 'left' });
    if (from || to || status) {
      doc.fontSize(8).text(`Filters: ${status ? `Status: ${status} ` : ''}${from ? `From: ${from} ` : ''}${to ? `To: ${to}` : ''}`);
    }
    doc.moveDown(0.8);

    // Executive Summary Card
    const summaryY = doc.y;
    doc.rect(30, summaryY, 782, 40).fillAndStroke('#f8fafc', '#cbd5e1');
    doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold');
    doc.text(`Total Invoices: ${totalInvoices}`, 45, summaryY + 14);
    doc.text(`Total Amount: LKR ${totalAmount.toLocaleString()}`, 190, summaryY + 14);
    doc.text(`Total Paid: LKR ${totalPaidAmount.toLocaleString()}`, 390, summaryY + 14);
    doc.text(`Total Pending: LKR ${totalPendingAmount.toLocaleString()}`, 590, summaryY + 14);

    doc.moveDown(2);

    // Table Header
    const tableTop = doc.y + 15;
    const cols = [
      { label: 'Invoice No', x: 30, width: 85 },
      { label: 'PO Number', x: 120, width: 85 },
      { label: 'GRN No', x: 210, width: 85 },
      { label: 'Supplier', x: 300, width: 130 },
      { label: 'Amount (LKR)', x: 435, width: 95 },
      { label: 'Invoice Date', x: 535, width: 70 },
      { label: 'Due Date', x: 610, width: 70 },
      { label: 'Status', x: 685, width: 60 },
      { label: 'Paid / Method', x: 750, width: 62 }
    ];

    doc.rect(30, tableTop, 782, 20).fill('#0d1b4b');
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
    cols.forEach(c => {
      doc.text(c.label, c.x + 3, tableTop + 5, { width: c.width, align: 'left' });
    });

    let y = tableTop + 22;
    doc.font('Helvetica').fontSize(8);

    invoices.forEach((inv, index) => {
      if (y > 510) {
        doc.addPage({ margin: 30, size: 'A4', layout: 'landscape' });
        y = 40;

        // Draw header again on new page
        doc.rect(30, y, 782, 20).fill('#0d1b4b');
        doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
        cols.forEach(c => {
          doc.text(c.label, c.x + 3, y + 5, { width: c.width, align: 'left' });
        });
        y += 22;
        doc.font('Helvetica').fontSize(8);
      }

      const bg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
      doc.rect(30, y, 782, 18).fill(bg);

      const invNo = inv.invoiceNumber || '-';
      const poNo = inv.po?.poNumber || '-';
      const grnNo = inv.grn?.grnNumber || '-';
      const supName = inv.supplier?.name || (typeof inv.supplier === 'string' ? inv.supplier : '-');
      const amt = Number(inv.amount || 0).toLocaleString();
      const invDate = inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '-';
      const dueDate = inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '-';
      const statusText = inv.status || 'Pending';
      const paidDateText = inv.paidAt
        ? `${new Date(inv.paidAt).toLocaleDateString()} ${inv.status === 'Paid' ? (inv.paymentMethod || '') : ''}`.trim()
        : '-';

      doc.fillColor('#0f172a');
      doc.text(invNo, cols[0].x + 3, y + 4, { width: cols[0].width, ellipsis: true });
      doc.text(poNo, cols[1].x + 3, y + 4, { width: cols[1].width, ellipsis: true });
      doc.text(grnNo, cols[2].x + 3, y + 4, { width: cols[2].width, ellipsis: true });
      doc.text(supName, cols[3].x + 3, y + 4, { width: cols[3].width, ellipsis: true });
      doc.text(amt, cols[4].x + 3, y + 4, { width: cols[4].width, ellipsis: true });
      doc.text(invDate, cols[5].x + 3, y + 4, { width: cols[5].width, ellipsis: true });
      doc.text(dueDate, cols[6].x + 3, y + 4, { width: cols[6].width, ellipsis: true });

      if (statusText === 'Paid') doc.fillColor('#16a34a');
      else if (statusText === 'Rejected') doc.fillColor('#dc2626');
      else doc.fillColor('#d97706');
      doc.text(statusText, cols[7].x + 3, y + 4, { width: cols[7].width, ellipsis: true });

      doc.fillColor('#0f172a');
      doc.text(paidDateText, cols[8].x + 3, y + 4, { width: cols[8].width, ellipsis: true });

      y += 18;
    });

    if (invoices.length === 0) {
      doc.fillColor('#64748b').fontSize(10).text('No invoices match the selected filters.', 30, y + 10, { width: 782, align: 'center' });
    }

    doc.end();
  } catch (error) {
    console.error('Error generating payment PDF report:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

// @desc    Get populated payment receipt details for a Purchase Order
// @route   GET /api/payments/:purchaseOrderId/receipt
// @access  Private
// Loads the settled payment for a PO together with everything a receipt needs.
// Returns null when the PO has no completed payment - a receipt is never
// produced for money that was not actually paid.
const loadPaidReceipt = async (purchaseOrderId) => {
  const payment = await Payment.findOne({ purchaseOrder: purchaseOrderId, status: 'paid' })
    .sort({ paidAt: -1, updatedAt: -1 })
    .populate('purchaseOrder')
    .populate('supplier')
    .populate('paidBy', 'name email role');
  if (!payment) return null;

  const invoice = await Invoice.findOne(payment.invoice ? { _id: payment.invoice } : { po: purchaseOrderId })
    .populate('grn', 'grnNumber');

  const poNumber = payment.purchaseOrder?.poNumber || 'N/A';
  return {
    paymentId: payment._id,
    invoiceNumber: invoice?.invoiceNumber || 'N/A',
    poNumber,
    grnNumber: invoice?.grn?.grnNumber || 'N/A',
    supplierName: payment.supplier?.name || 'Supplier',
    supplierEmail: payment.supplier?.email || '-',
    amount: payment.amount,
    currency: payment.currency || CURRENCY,
    paidAt: payment.paidAt || payment.updatedAt,
    status: 'Paid',
    method: payment.method || 'Stripe',
    reference: payment.reference || '',
    bankName: payment.bankName || '',
    stripeSessionId: payment.stripeSessionId || '',
    paidByName: payment.paidBy?.name || 'Purchase Manager'
  };
};

export const getPaymentReceipt = async (req, res) => {
  try {
    const receipt = await loadPaidReceipt(req.params.purchaseOrderId);
    if (!receipt) {
      return res.status(404).json({ success: false, message: 'No completed payment found for this Purchase Order.' });
    }
    res.status(200).json({ success: true, data: receipt });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Generate and download single-page PDF payment receipt for a Purchase Order
// @route   GET /api/payments/:purchaseOrderId/receipt/download
// @access  Private
export const downloadPaymentReceipt = async (req, res) => {
  try {
    const receipt = await loadPaidReceipt(req.params.purchaseOrderId);
    if (!receipt) {
      return res.status(404).json({ success: false, message: 'No completed payment found for this Purchase Order.' });
    }

    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'portrait' });

    const filename = `receipt-${receipt.invoiceNumber}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    drawReceiptContent(doc, {
      invoiceNumber: receipt.invoiceNumber,
      poNumber: receipt.poNumber,
      grnNumber: receipt.grnNumber,
      supplierName: receipt.supplierName,
      supplierEmail: receipt.supplierEmail,
      amountPaid: receipt.amount,
      currency: String(receipt.currency).toUpperCase(),
      paidAt: receipt.paidAt,
      stripeRef: receipt.stripeSessionId,
      method: receipt.method,
      reference: receipt.reference,
      bankName: receipt.bankName,
      paidByName: receipt.paidByName
    });

    doc.end();
  } catch (error) {
    console.error('Error generating payment receipt PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};
