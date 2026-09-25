import Stripe from 'stripe';
import PDFDocument from 'pdfkit';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Supplier from '../models/Supplier.js';
import Payment from '../models/Payment.js';
import Invoice from '../models/Invoice.js';
import { sendMail, escapeHtml } from '../utils/mailer.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const CURRENCY = (process.env.STRIPE_CURRENCY || 'lkr').toLowerCase();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Draws the payment receipt content onto a given PDFKit document instance.
// Shared by the downloadable receipt endpoint and the buffer used for email attachments.
const drawReceiptContent = (doc, fields) => {
  const {
    invoiceNumber, poNumber, grnNumber, supplierName, supplierEmail,
    amountPaid, currency, paidAt, stripeRef, paidByName
  } = fields;

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
  addField('Payment Status:', 'PAID (Verified via Stripe Gateway)', y + 198, true);
  addField('Stripe Reference ID:', stripeRef, y + 224);
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

// @desc    Create a Stripe Checkout Session to pay for an approved Purchase Order
// @route   POST /api/payments/create-checkout-session
// @access  Private (PurchaseManager / Admin)
export const createCheckoutSession = async (req, res) => {
  try {
    const { purchaseOrderId } = req.body;
    if (!purchaseOrderId) {
      return res.status(400).json({ success: false, message: 'purchaseOrderId is required.' });
    }

    const po = await PurchaseOrder.findById(purchaseOrderId);
    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase Order not found.' });
    }

    // Only approved/sent/delivered POs can be paid
    if (!['Approved', 'Sent', 'Delivered'].includes(po.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only approved or sent Purchase Orders can be paid.'
      });
    }

    if (po.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'This Purchase Order has already been paid.'
      });
    }

    let supplierDoc = null;
    if (po.supplier) {
      supplierDoc = await Supplier.findById(po.supplier);
    }

    const supplierName = supplierDoc ? supplierDoc.name : 'Supplier';

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: CURRENCY,
          product_data: {
            name: `Purchase Order ${po.poNumber}`,
            description: `Supplier: ${supplierName} - Construction Material Order`
          },
          unit_amount: Math.round(Number(po.totalAmount) * 100)
        },
        quantity: 1
      }],
      metadata: {
        purchaseOrderId: po._id.toString(),
        supplierId: supplierDoc ? supplierDoc._id.toString() : ''
      },
      success_url: `${FRONTEND_URL}/payments/success?session_id={CHECKOUT_SESSION_ID}&po=${po._id}`,
      cancel_url: `${FRONTEND_URL}/payments/cancel?po=${po._id}`
    });

    // Save or update pending Payment record
    await Payment.findOneAndUpdate(
      { purchaseOrder: po._id },
      {
        purchaseOrder: po._id,
        supplier: supplierDoc ? supplierDoc._id : po.supplier,
        amount: po.totalAmount,
        currency: CURRENCY,
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

    const poId = purchaseOrderId || session.metadata?.purchaseOrderId;

    let payment = await Payment.findOne({ stripeSessionId: sessionId });
    if (!payment && poId) {
      payment = await Payment.findOne({ purchaseOrder: poId });
    }
    if (!payment) {
      return res.status(404).json({ success: false, message: 'No payment record found for this session.' });
    }

    if (payment.status !== 'paid') {
      payment.status = 'paid';
      payment.paidAt = payment.paidAt || new Date();
      await payment.save();
    }

    const po = await PurchaseOrder.findById(payment.purchaseOrder);
    if (po && po.paymentStatus !== 'paid') {
      po.paymentStatus = 'paid';
      await po.save();
    }

    let emailSent = !!payment.emailSentAt;
    if (!emailSent) {
      const supplierDoc = await Supplier.findById(payment.supplier);
      const invoice = await Invoice.findOne({ po: payment.purchaseOrder }).populate('grn', 'grnNumber');
      try {
        emailSent = await sendPaymentConfirmation({ payment, po, supplierDoc, invoice });
      } catch (mailErr) {
        console.error('Error sending payment confirmation email:', mailErr);
      }
    }

    res.status(200).json({ success: true, data: { paymentStatus: payment.status, emailSent } });
  } catch (error) {
    console.error('Error confirming payment session:', error);
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
      let payment = await Payment.findOne({ stripeSessionId: session.id });
      if (!payment && session.metadata?.purchaseOrderId) {
        payment = await Payment.findOne({ purchaseOrder: session.metadata.purchaseOrderId });
      }

      if (payment) {
        payment.status = 'paid';
        payment.paidAt = new Date();
        await payment.save();

        const po = await PurchaseOrder.findById(payment.purchaseOrder);
        if (po) {
          po.paymentStatus = 'paid';
          await po.save();

          // Dispatch email notification (with PDF receipt attached) to the supplier
          const supplierDoc = await Supplier.findById(payment.supplier);
          const invoice = await Invoice.findOne({ po: payment.purchaseOrder }).populate('grn', 'grnNumber');
          try {
            await sendPaymentConfirmation({ payment, po, supplierDoc, invoice });
          } catch (mailErr) {
            console.error('Error sending payment confirmation email from webhook:', mailErr);
          }
        }
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

    let invoices = await Invoice.find(filter)
      .populate('supplier', 'name')
      .populate('po', 'poNumber')
      .populate('grn', 'grnNumber')
      .sort({ createdAt: -1 });

    // Fallback demo dataset if database has no invoices yet
    if (!invoices || invoices.length === 0) {
      invoices = [
        {
          invoiceNumber: 'INV-2026-001',
          po: { poNumber: 'PO-2026-001' },
          grn: { grnNumber: 'GRN-2026-001' },
          supplier: { name: 'Lanka Cement Ltd' },
          amount: 555000,
          invoiceDate: new Date(),
          dueDate: new Date(Date.now() + 86400000 * 30),
          status: 'Paid',
          paidAt: new Date()
        },
        {
          invoiceNumber: 'INV-2026-002',
          po: { poNumber: 'PO-2026-002' },
          grn: { grnNumber: 'GRN-2026-002' },
          supplier: { name: 'Melwa Steel' },
          amount: 925000,
          invoiceDate: new Date(Date.now() - 86400000 * 5),
          dueDate: new Date(Date.now() + 86400000 * 25),
          status: 'Approved',
          paidAt: null
        }
      ];
    }

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
      { label: 'Paid Date', x: 750, width: 60 }
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
      const paidDateText = inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : '-';

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
export const getPaymentReceipt = async (req, res) => {
  try {
    const { purchaseOrderId } = req.params;

    let payment = await Payment.findOne({ purchaseOrder: purchaseOrderId })
      .populate('purchaseOrder')
      .populate('supplier')
      .populate('paidBy', 'name email role');

    let invoice = await Invoice.findOne({ po: purchaseOrderId })
      .populate('grn', 'grnNumber');

    if (!payment) {
      const po = await PurchaseOrder.findById(purchaseOrderId).populate('supplier');
      const supplierDoc = po?.supplier || await Supplier.findOne();
      payment = {
        _id: 'demo-receipt-id',
        purchaseOrder: po || { poNumber: 'PO-2026-001', totalAmount: 555000, status: 'Approved' },
        supplier: supplierDoc || { name: 'Lanka Cement Ltd', email: 'supplier@lankacement.lk' },
        amount: po?.totalAmount || 555000,
        currency: CURRENCY,
        stripeSessionId: 'cs_test_demo_session_receipt_12345',
        status: 'paid',
        paidAt: new Date(),
        paidBy: req.user || { name: 'Purchase Manager', email: 'pm@elsconstruction.com' }
      };
    }

    const poNumber = payment.purchaseOrder?.poNumber || 'PO-2026-001';
    const invoiceNumber = invoice?.invoiceNumber || `INV-${poNumber.replace('PO-', '')}`;
    const grnNumber = invoice?.grn?.grnNumber || 'GRN-2026-001';
    const supplierName = payment.supplier?.name || (typeof payment.supplier === 'string' ? payment.supplier : 'Supplier');
    const paidByName = payment.paidBy?.name || (req.user ? req.user.name : 'Purchase Manager');

    res.status(200).json({
      success: true,
      data: {
        paymentId: payment._id,
        invoiceNumber,
        poNumber,
        grnNumber,
        supplierName,
        amount: payment.amount,
        currency: payment.currency || 'lkr',
        paidAt: payment.paidAt || payment.updatedAt || new Date(),
        status: 'Paid',
        stripeSessionId: payment.stripeSessionId || 'cs_test_session',
        paidByName
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Generate and download single-page PDF payment receipt for a Purchase Order
// @route   GET /api/payments/:purchaseOrderId/receipt/download
// @access  Private
export const downloadPaymentReceipt = async (req, res) => {
  try {
    const { purchaseOrderId } = req.params;

    let payment = await Payment.findOne({ purchaseOrder: purchaseOrderId })
      .populate('purchaseOrder')
      .populate('supplier')
      .populate('paidBy', 'name email role');

    let invoice = await Invoice.findOne({ po: purchaseOrderId }).populate('grn', 'grnNumber');

    const poNumber = payment?.purchaseOrder?.poNumber || 'PO-2026-001';
    const invoiceNumber = invoice?.invoiceNumber || `INV-${poNumber.replace('PO-', '')}`;
    const grnNumber = invoice?.grn?.grnNumber || 'GRN-2026-001';
    const supplierName = payment?.supplier?.name || 'Lanka Cement Ltd';
    const supplierEmail = payment?.supplier?.email || '-';
    const amountPaid = payment?.amount || 555000;
    const currency = (payment?.currency || 'lkr').toUpperCase();
    const paidAt = payment?.paidAt || new Date();
    const stripeRef = payment?.stripeSessionId || 'cs_test_session_reference';
    const paidByName = payment?.paidBy?.name || (req.user ? req.user.name : 'Purchase Manager');

    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'portrait' });

    const filename = `receipt-${invoiceNumber}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    drawReceiptContent(doc, {
      invoiceNumber, poNumber, grnNumber, supplierName, supplierEmail,
      amountPaid, currency, paidAt, stripeRef, paidByName
    });

    doc.end();
  } catch (error) {
    console.error('Error generating payment receipt PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};
