import Stripe from 'stripe';
import Invoice from '../models/Invoice.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const CURRENCY = (process.env.STRIPE_CURRENCY || 'lkr').toLowerCase();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const markInvoicePaidFromSession = async (session) => {
  const invoiceId = session.metadata?.invoiceId;
  if (!invoiceId) return;

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice || invoice.status === 'Paid') return;

  invoice.status = 'Paid';
  invoice.paidAt = new Date();
  await invoice.save();
};

// @desc    Start a Stripe Checkout session to pay a Director-approved invoice
// @route   POST /api/payments/create-checkout-session
// @access  Private
export const createCheckoutSession = async (req, res) => {
  try {
    const { invoiceId } = req.body;
    if (!invoiceId) {
      return res.status(400).json({ success: false, message: 'invoiceId is required.' });
    }

    const invoice = await Invoice.findById(invoiceId)
      .populate('supplier', 'name')
      .populate('po', 'poNumber');

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }
    if (invoice.status !== 'Approved') {
      return res.status(400).json({ success: false, message: 'Only Director-approved invoices can be paid.' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: CURRENCY,
          product_data: {
            name: `Invoice ${invoice.invoiceNumber}`,
            description: `PO ${invoice.po?.poNumber || '-'} - Supplier: ${invoice.supplier?.name || '-'}`
          },
          unit_amount: Math.round(invoice.amount * 100)
        },
        quantity: 1
      }],
      metadata: { invoiceId: invoice._id.toString() },
      success_url: `${FRONTEND_URL}/?payment=success&invoice=${invoice._id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/?payment=cancelled&invoice=${invoice._id}`
    });

    res.status(200).json({ success: true, url: session.url });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Confirm a Checkout session when the user returns from Stripe
// @route   POST /api/payments/verify-session
// @access  Private
export const verifyCheckoutSession = async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId is required.' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      await markInvoicePaidFromSession(session);
    }

    const invoice = await Invoice.findById(session.metadata?.invoiceId)
      .populate('supplier', 'name supplierId')
      .populate('po', 'poNumber')
      .populate('grn', 'grnNumber');

    res.status(200).json({ success: true, paid: session.payment_status === 'paid', data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Stripe webhook - authoritative payment confirmation
// @route   POST /api/payments/webhook
// @access  Public (Stripe signature verified)
export const stripeWebhookHandler = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    try {
      await markInvoicePaidFromSession(event.data.object);
    } catch (err) {
      console.error('Error marking invoice paid from Stripe webhook:', err);
    }
  }

  res.json({ received: true });
};
