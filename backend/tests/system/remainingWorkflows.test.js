// Automated API-level tests for the procurement, goods receipt, invoice/payment,
// site supply, stock, security and notification test cases (Chapter 5, Section 5.5.10).
// The real controller and middleware code is executed; only the database (Mongoose
// model calls), e-mail, notifications and the Stripe API are replaced with test doubles.
import 'dotenv/config';
import { jest, describe, test, expect, beforeAll, afterEach } from '@jest/globals';
import mongoose from 'mongoose';

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'mysecretkeymustbe32byteslong12345';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// ---- external services replaced with test doubles ----------------------------------
const sendMail = jest.fn(async () => ({ messageId: 'test' }));
jest.unstable_mockModule('../../utils/mailer.js', () => ({
  sendMail, escapeHtml: (s) => String(s ?? ''), default: { sendMail },
}));
const notifyRoles = jest.fn(async () => {});
const createNotificationHelper = jest.fn(async () => {});
jest.unstable_mockModule('../../controllers/notificationController.js', () => ({
  notifyRoles, createNotificationHelper,
  getNotifications: jest.fn(), getNotificationCount: jest.fn(), markAsRead: jest.fn(), markAllAsRead: jest.fn(),
}));
const stripeCreate = jest.fn(async () => ({ id: 'cs_test_001', url: 'https://checkout.stripe.com/c/pay/cs_test_001' }));
const stripeRetrieve = jest.fn(async () => ({ id: 'cs_test_001', payment_status: 'paid', metadata: { invoiceId: 'INV1' } }));
jest.unstable_mockModule('stripe', () => ({
  default: function Stripe() { return { checkout: { sessions: { create: stripeCreate, retrieve: stripeRetrieve } }, webhooks: { constructEvent: jest.fn() } }; },
}));

// ---- helpers -------------------------------------------------------------------------
const id = () => new mongoose.Types.ObjectId();
const q = (v) => { const p = Promise.resolve(v); const o = { then: p.then.bind(p), catch: p.catch.bind(p) };
  for (const k of ['populate', 'sort', 'select', 'lean', 'session', 'limit', 'skip', 'exec']) o[k] = () => o; return o; };
const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); r.write = jest.fn(); r.writeHead = jest.fn(); return r; };
const body = (r) => r.json.mock.calls[0][0];
const doc = (fields) => ({ ...fields, save: jest.fn(async function () { return this; }), toObject() { return { ...this }; } });
const today = () => new Date().toISOString().slice(0, 10);

let PO, INV, PAY, INVENTORY, MR, MTN, QUOT, AUTH, PERM, RT, AUTHCTRL;
let PurchaseOrder, PurchaseRequest, Supplier, User, Material, GRN, StockMovement, Invoice, Payment,
  MaterialRequest, MaterialTransferNote, Quotation, Permission, AuditLog, ItemMaster;

beforeAll(async () => {
  PO = await import('../../controllers/purchaseOrderController.js');
  INV = await import('../../controllers/invoiceController.js');
  PAY = await import('../../controllers/paymentController.js');
  INVENTORY = await import('../../controllers/inventoryController.js');
  MR = await import('../../controllers/materialRequestController.js');
  MTN = await import('../../controllers/materialTransferNoteController.js');
  QUOT = await import('../../controllers/quotationController.js');
  AUTH = await import('../../middleware/authMiddleware.js');
  PERM = await import('../../middleware/permissionMiddleware.js');
  RT = await import('../../utils/realtimeEvents.js');
  AUTHCTRL = await import('../../controllers/authController.js');
  ({ default: PurchaseOrder } = await import('../../models/PurchaseOrder.js'));
  ({ default: PurchaseRequest } = await import('../../models/PurchaseRequest.js'));
  ({ default: Supplier } = await import('../../models/Supplier.js'));
  ({ default: User } = await import('../../models/userModel.js'));
  ({ default: Material } = await import('../../models/Material.js'));
  ({ default: GRN } = await import('../../models/GRN.js'));
  ({ default: StockMovement } = await import('../../models/StockMovement.js'));
  ({ default: Invoice } = await import('../../models/Invoice.js'));
  ({ default: Payment } = await import('../../models/Payment.js'));
  ({ default: MaterialRequest } = await import('../../models/MaterialRequest.js'));
  ({ default: MaterialTransferNote } = await import('../../models/MaterialTransferNote.js'));
  ({ default: Quotation } = await import('../../models/Quotation.js'));
  ({ default: Permission } = await import('../../models/Permission.js'));
  ({ default: AuditLog } = await import('../../models/AuditLog.js'));
  ({ default: ItemMaster } = await import('../../models/ItemMaster.js'));
});

const flush = () => new Promise((r) => setImmediate(() => setTimeout(r, 30)));
afterEach(async () => { await flush(); jest.restoreAllMocks(); sendMail.mockClear(); notifyRoles.mockClear(); createNotificationHelper.mockClear(); });

const common = () => {
  jest.spyOn(User, 'find').mockReturnValue(q([]));
  jest.spyOn(AuditLog, 'create').mockResolvedValue({});
  jest.spyOn(User, 'findOne').mockResolvedValue(null);
  jest.spyOn(User, 'findById').mockResolvedValue(null);
  jest.spyOn(Supplier, 'findOne').mockResolvedValue(null);
  jest.spyOn(StockMovement, 'create').mockImplementation(async (d) => d);
};
const director = { _id: id(), name: 'Executive Director', role: 'Director' };
const purchaseMgr = { _id: id(), name: 'Purchase Manager', role: 'PurchaseManager', email: 'pm@els.com' };
const storeOfficer = { _id: id(), name: 'Main Store Officer', role: 'MainStoreOfficer' };
const siteOfficer = { _id: id(), name: 'Site Store Officer', role: 'SiteStoreOfficer' };

// =====================================================================================
describe('Purchase orders and quotations', () => {
  test('PO_PU_001 record a quotation with a document', async () => {
    jest.spyOn(Quotation, 'countDocuments').mockResolvedValue(4);
    jest.spyOn(Quotation, 'findOne').mockReturnValue(q(null));
    const save = jest.spyOn(Quotation.prototype, 'save').mockImplementation(async function () { return this; });
    const r = res();
    await QUOT.createQuotation({ body: { supplier: id().toString(), material: 'Bitumen Emulsion', quantity: 2, unit: 'Drum', price: 118000 },
      file: { filename: 'q.pdf', originalname: 'quotation.pdf' }, user: purchaseMgr }, r);
    expect(r.status).toHaveBeenCalledWith(201);
    expect(body(r).data.quotationNumber).toBe('QT-0005');
    expect(body(r).data.file.filename).toBe('quotation.pdf');
    expect(save).toHaveBeenCalled();
  });

  test('PO_PU_003 create a PO without a supplier is rejected', async () => {
    const r = res();
    await PO.createPurchaseOrder({ body: { items: [{ materialName: 'Cement', quantity: 5, unitPrice: 2500 }] }, user: purchaseMgr }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toBe('Please select a supplier.');
  });

  test('PO_D_001 Director approves a pending PO (status Pending → Approved, action audited)', async () => {
    common();
    const po = doc({ _id: id(), poNumber: 'PO-2026-046', status: 'Approved', supplier: id(), items: [], totalAmount: 236000 });
    jest.spyOn(PurchaseOrder, 'findOneAndUpdate').mockResolvedValue(po);
    jest.spyOn(Supplier, 'findById').mockResolvedValue({ name: 'Sathiduni Tharushya', email: '' });
    const r = res();
    await PO.approvePurchaseOrder({ params: { id: po._id }, body: {}, user: director, headers: {} }, r);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(PurchaseOrder.findOneAndUpdate.mock.calls[0][1].status).toBe('Approved');
    expect(AuditLog.create.mock.calls[0][0].action).toMatch(/PO-2026-046 approved/);
  });

  test('PO_D_002 Director rejects a PO with a reason; it cannot then be sent', async () => {
    common();
    const po = doc({ _id: id(), poNumber: 'PO-2026-047', status: 'Rejected', supplier: id(), items: [] });
    jest.spyOn(PurchaseOrder, 'findOneAndUpdate').mockResolvedValue(po);
    const r = res();
    await PO.rejectPurchaseOrder({ params: { id: po._id }, body: { rejectionReason: 'Price too high' }, user: director, headers: {} }, r);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(PurchaseOrder.findOneAndUpdate.mock.calls[0][1]).toMatchObject({ status: 'Rejected', rejectionReason: 'Price too high' });
    jest.spyOn(PurchaseOrder, 'findById').mockResolvedValue(po);
    const r2 = res();
    await PO.sendPurchaseOrder({ params: { id: po._id } }, r2);
    expect(r2.status).toHaveBeenCalledWith(400);
  });

  test('PO_PU_004 send an approved PO to the supplier by e-mail (status → Sent)', async () => {
    common();
    const po = doc({ _id: id(), poNumber: 'PO-2026-045', status: 'Approved', supplier: id(), totalAmount: 1080000,
      items: [{ materialName: 'Bitumen Emulsion', quantity: 2, unit: 'Drum', unitPrice: 118000 }] });
    jest.spyOn(PurchaseOrder, 'findById').mockResolvedValue(po);
    jest.spyOn(Supplier, 'findById').mockResolvedValue({ name: 'Melwa Steel', email: 'sales@melwa.lk' });
    const r = res();
    await PO.sendPurchaseOrder({ params: { id: po._id } }, r);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(po.status).toBe('Sent');
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'sales@melwa.lk', subject: expect.stringContaining('PO-2026-045') }));
  });

  test('PO_PU_005 sending a Pending PO is refused', async () => {
    const po = doc({ _id: id(), poNumber: 'PO-2026-048', status: 'Pending', items: [] });
    jest.spyOn(PurchaseOrder, 'findById').mockResolvedValue(po);
    const r = res();
    await PO.sendPurchaseOrder({ params: { id: po._id } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toMatch(/must be Approved by the Director/);
    expect(sendMail).not.toHaveBeenCalled();
  });

  test('PO_PU_006 cancel a Sent PO (status → Cancelled)', async () => {
    const po = { _id: id(), status: 'Sent' };
    jest.spyOn(PurchaseOrder, 'findById').mockResolvedValue(po);
    jest.spyOn(PurchaseOrder, 'findByIdAndUpdate').mockReturnValue(q({ ...po, status: 'Cancelled' }));
    const r = res();
    await PO.updatePurchaseOrderStatus({ params: { id: po._id }, body: { status: 'Cancelled' } }, r);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(body(r).data.status).toBe('Cancelled');
  });

  test('PO_PU_007 close a Delivered PO (status → Closed)', async () => {
    const po = { _id: id(), status: 'Delivered' };
    jest.spyOn(PurchaseOrder, 'findById').mockResolvedValue(po);
    jest.spyOn(PurchaseOrder, 'findByIdAndUpdate').mockReturnValue(q({ ...po, status: 'Closed' }));
    const r = res();
    await PO.updatePurchaseOrderStatus({ params: { id: po._id }, body: { status: 'Closed' } }, r);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(body(r).data.status).toBe('Closed');
  });
});

// =====================================================================================
describe('Goods received notes', () => {
  const setup = (poStatus, received, damaged = 0) => {
    common();
    const matId = id();
    const mat = doc({ _id: matId, name: 'Portland Cement', location: 'MainStore', quantity: 100, unit: 'bag', minimumStock: 10, reorderLevel: 20 });
    const po = doc({ _id: id(), poNumber: 'PO-2026-050', status: poStatus, supplier: id(), items: [{ material: matId, materialName: 'Portland Cement', quantity: 50 }] });
    jest.spyOn(PurchaseOrder, 'findOne').mockResolvedValue(po);
    jest.spyOn(GRN, 'find').mockReturnValue(q([]));
    jest.spyOn(GRN.prototype, 'save').mockImplementation(async function () { return this; });
    jest.spyOn(Material, 'findById').mockResolvedValue(mat);
    jest.spyOn(Material, 'find').mockReturnValue(q([mat]));
    const req = { body: { poReference: 'PO-2026-050', supplier: 'Lanka Cement Ltd', receivedBy: 'Main Store Officer', receivedDate: today(),
      items: [{ material: matId.toString(), materialName: 'Portland Cement', receivedQty: received, condition: damaged ? 'Damaged' : 'Good', damagedQty: damaged, discrepancyReason: damaged ? 'Torn bags' : '' }] } };
    return { mat, po, req };
  };

  test('GRN_MS_001 a GRN can only be recorded against a Sent PO', async () => {
    const { req } = setup('Approved', 50);
    const r = res();
    await INVENTORY.createGRN(req, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toMatch(/can only be received against a Purchase Order that has been sent/);
  });

  test('GRN_MS_002 full delivery: stock increases and PO becomes Delivered', async () => {
    const { mat, po, req } = setup('Sent', 50);
    const r = res();
    await INVENTORY.createGRN(req, r);
    expect(r.status).toHaveBeenCalledWith(201);
    expect(mat.quantity).toBe(150);
    expect(po.status).toBe('Delivered');
    expect(body(r).grn.status).toBe('Verified');
  });

  test('GRN_MS_003 partial delivery with damage: only accepted quantity added, PO stays Sent', async () => {
    const { mat, po, req } = setup('Sent', 40, 2);
    const r = res();
    await INVENTORY.createGRN(req, r);
    expect(r.status).toHaveBeenCalledWith(201);
    expect(mat.quantity).toBe(138);
    expect(po.status).toBe('Sent');
    expect(body(r).grn.status).toBe('Partial');
  });

  test('GRN_MS_004 receiving more than the outstanding quantity is rejected', async () => {
    const { mat, req } = setup('Sent', 60);
    const r = res();
    await INVENTORY.createGRN(req, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toMatch(/more than the 50 still outstanding/);
    expect(mat.quantity).toBe(100);
  });

  test('GRN_MS_005 a GRN receipt is written to the stock ledger with the new balance', async () => {
    const { req } = setup('Sent', 50);
    const r = res();
    await INVENTORY.createGRN(req, r);
    expect(StockMovement.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'GRN Receipt', quantityChange: 50, balanceAfter: 150 }));
  });
});

// =====================================================================================
describe('Invoices and payments', () => {
  const approvedInvoice = (extra = {}) => doc({ _id: id(), invoiceNumber: 'INV-0012', status: 'Approved', amount: 236000,
    invoiceDate: new Date(Date.now() - 3 * 864e5), po: id(), supplier: id(), ...extra });

  test('INV_MS_001 record a supplier invoice against a PO and its GRN (Pending Approval, due date set)', async () => {
    common();
    const po = { _id: id(), status: 'Delivered', totalAmount: 236000, paymentTerms: '30 Days Credit' };
    jest.spyOn(PurchaseOrder, 'findById').mockResolvedValue(po);
    jest.spyOn(Invoice, 'countDocuments').mockResolvedValue(11);
    jest.spyOn(Invoice, 'findOne').mockResolvedValue(null);
    jest.spyOn(GRN, 'findById').mockResolvedValue({ _id: id(), status: 'Verified' });
    jest.spyOn(Invoice.prototype, 'save').mockImplementation(async function () { return this; });
    const r = res();
    await INV.createInvoice({ body: { supplier: id().toString(), po: po._id.toString(), grn: id().toString(), invoiceDate: today() }, user: storeOfficer }, r);
    expect(r.status).toHaveBeenCalledWith(201);
    const inv = body(r).data;
    expect(inv.status).toBe('Pending Approval');
    expect(inv.amount).toBe(236000);
    expect(new Date(inv.dueDate) > new Date(inv.invoiceDate)).toBe(true);
  });

  test('INV_D_001 Director approves an invoice for payment (audited)', async () => {
    common();
    jest.spyOn(Invoice, 'findOneAndUpdate').mockResolvedValue({ _id: id(), invoiceNumber: 'INV-0012', status: 'Approved' });
    const r = res();
    await INV.approveInvoicePayment({ params: { id: id() }, body: {}, user: director, headers: {} }, r);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(Invoice.findOneAndUpdate.mock.calls[0][1].status).toBe('Approved');
    expect(AuditLog.create).toHaveBeenCalled();
  });

  test('INV_D_002 Director rejects an invoice with a reason (status → Rejected)', async () => {
    common();
    jest.spyOn(Invoice, 'findOneAndUpdate').mockResolvedValue({ _id: id(), invoiceNumber: 'INV-0013', status: 'Rejected' });
    const r = res();
    await INV.rejectInvoicePayment({ params: { id: id() }, body: { rejectionReason: 'Amount mismatch' }, user: director, headers: {} }, r);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(Invoice.findOneAndUpdate.mock.calls[0][1]).toMatchObject({ status: 'Rejected', rejectionReason: 'Amount mismatch' });
  });

  test('PAY_PU_001 pay an approved invoice through Stripe and confirm (invoice → Paid)', async () => {
    common();
    const po = doc({ _id: id(), poNumber: 'PO-2026-046', totalAmount: 236000 });
    const inv = approvedInvoice({ po });
    jest.spyOn(Invoice, 'findById').mockReturnValue(q(inv));
    jest.spyOn(Supplier, 'findById').mockResolvedValue({ _id: id(), name: 'Sathiduni Tharushya', email: 's@x.lk' });
    jest.spyOn(Payment, 'findOneAndUpdate').mockReturnValue(q({}));
    const r = res();
    await PAY.createCheckoutSession({ body: { invoiceId: inv._id.toString() }, user: purchaseMgr }, r);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(body(r).url).toMatch(/checkout\.stripe\.com/);
    expect(stripeCreate.mock.calls[0][0].line_items[0].price_data.unit_amount).toBe(23600000);

    const payment = doc({ _id: id(), invoice: inv._id, purchaseOrder: po._id, amount: 236000, method: 'Stripe', status: 'pending', emailSentAt: new Date() });
    jest.spyOn(Payment, 'findOne').mockResolvedValue(payment);
    jest.spyOn(PurchaseOrder, 'findById').mockResolvedValue(po);
    jest.spyOn(Invoice, 'countDocuments').mockResolvedValue(0);
    const r2 = res();
    await PAY.confirmPaymentSession({ body: { sessionId: 'cs_test_001' }, user: purchaseMgr }, r2);
    expect(r2.status).toHaveBeenCalledWith(200);
    expect(payment.status).toBe('paid');
    expect(inv.status).toBe('Paid');
    expect(po.paymentStatus).toBe('paid');
  });

  const manual = async (bodyExtra, invoice = approvedInvoice()) => {
    common();
    jest.spyOn(Invoice, 'findById').mockReturnValue(q(invoice));
    jest.spyOn(GRN, 'findById').mockResolvedValue(null);
    jest.spyOn(GRN, 'findOne').mockResolvedValue(null);
    jest.spyOn(Payment, 'findOne').mockResolvedValue(null);
    const po = doc({ _id: invoice.po, poNumber: 'PO-2026-041' });
    jest.spyOn(PurchaseOrder, 'findById').mockResolvedValue(po);
    jest.spyOn(Invoice, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(Supplier, 'findById').mockResolvedValue(null);
    const payment = doc({ _id: id(), invoice: invoice._id, purchaseOrder: po._id, amount: invoice.amount, status: 'pending', emailSentAt: new Date() });
    jest.spyOn(Payment, 'findOneAndUpdate').mockResolvedValue(payment);
    const r = res();
    await PAY.recordManualPayment({ body: { invoiceId: invoice._id.toString(), paidAt: today(), ...bodyExtra }, user: purchaseMgr }, r);
    return { r, invoice, payment };
  };

  test('PAY_PU_002 record a cheque payment (invoice → Paid)', async () => {
    const { r, invoice, payment } = await manual({ paymentMethod: 'Cheque', chequeNumber: '123456', bankName: 'Bank of Ceylon', chequeDate: today() });
    expect(r.status).toHaveBeenCalledWith(201);
    expect(payment.status).toBe('paid');
    expect(invoice.status).toBe('Paid');
  });

  test('PAY_PU_003 an invalid cheque number is rejected', async () => {
    const { r } = await manual({ paymentMethod: 'Cheque', chequeNumber: '12AB5', bankName: 'Bank of Ceylon', chequeDate: today() });
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toBe('Cheque number must be exactly 6 digits.');
  });

  test('PAY_PU_004 a future payment date is rejected', async () => {
    const tomorrow = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
    const { r } = await manual({ paymentMethod: 'Cash', paidAt: tomorrow });
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toBe('Payment date cannot be in the future.');
  });

  test('PAY_PU_005 an invoice that is not approved cannot be paid', async () => {
    const { r } = await manual({ paymentMethod: 'Cash' }, approvedInvoice({ status: 'Pending Approval' }));
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toMatch(/Only Director-approved invoices/);
  });
});

// =====================================================================================
describe('Site supply', () => {
  test('MR_SS_001 Site Store raises a material request (Pending, Main Store notified)', async () => {
    jest.spyOn(ItemMaster, 'find').mockResolvedValue([{ materialName: 'Portland Cement', category: 'Cement & Concrete', unit: 'Bag' }]);
    jest.spyOn(Material, 'find').mockResolvedValue([]);
    jest.spyOn(MaterialRequest, 'countDocuments').mockResolvedValue(6);
    jest.spyOn(MaterialRequest.prototype, 'save').mockImplementation(async function () { return this; });
    jest.spyOn(User, 'find').mockResolvedValue([storeOfficer]);
    const r = res();
    await MR.createMaterialRequest({ body: { requiredDate: today(), materials: [{ materialName: 'Portland Cement', quantity: 30 }] }, user: siteOfficer }, r);
    expect(r.status).toHaveBeenCalledWith(201);
    expect(body(r).data.status).toBe('Pending');
    expect(createNotificationHelper).toHaveBeenCalledWith(storeOfficer._id, expect.stringContaining('SSR-'), 'SSR_SUBMITTED', expect.any(String));
  });

  test('MR_SS_002 a zero quantity is rejected', async () => {
    const r = res();
    await MR.createMaterialRequest({ body: { requiredDate: today(), materials: [{ materialName: 'Portland Cement', quantity: 0 }] }, user: siteOfficer }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toMatch(/Invalid request quantity/);
  });

  test('MR_SS_003 the Site Store Officer cancels their own pending request', async () => {
    const reqDoc = doc({ _id: id(), status: 'Pending', requestedByUserId: siteOfficer._id });
    jest.spyOn(MaterialRequest, 'findById').mockResolvedValue(reqDoc);
    const r = res();
    await MR.cancelMaterialRequest({ params: { id: reqDoc._id }, user: siteOfficer }, r);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(reqDoc.status).toBe('Cancelled');
  });

  const mtnSetup = (mainQty) => {
    common();
    const reqDoc = doc({ _id: id(), requestNo: 'SSR-2026-007', status: 'Pending', requestedByUserId: siteOfficer._id,
      materials: [{ materialName: 'Portland Cement', unit: 'Bag', quantity: 30, fulfilledQty: 0 }] });
    const mainMat = doc({ _id: id(), name: 'Portland Cement', location: 'MainStore', quantity: mainQty, unit: 'bag', minimumStock: 10, reorderLevel: 20 });
    jest.spyOn(MaterialRequest, 'findById').mockResolvedValue(reqDoc);
    jest.spyOn(Material, 'findOne').mockResolvedValue(mainMat);
    jest.spyOn(MaterialTransferNote, 'find').mockReturnValue(q([]));
    jest.spyOn(MaterialTransferNote, 'findOne').mockResolvedValue(null);
    jest.spyOn(MaterialTransferNote.prototype, 'save').mockImplementation(async function () { return this; });
    return { reqDoc, mainMat, req: { body: { sourceRequestId: reqDoc._id.toString(), transferDate: today(), materials: [{ materialName: 'Portland Cement', quantity: 30, unit: 'Bag' }] }, user: storeOfficer } };
  };

  test('MTN_MS_001 Main Store issues a transfer note (stock deducted, MTN In Transit, request Transferred)', async () => {
    const { reqDoc, mainMat, req } = mtnSetup(100);
    const r = res();
    await MTN.createTransferNote(req, r);
    expect(r.status).toHaveBeenCalledWith(201);
    expect(mainMat.quantity).toBe(70);
    expect(body(r).data.status).toBe('In Transit');
    expect(reqDoc.status).toBe('Transferred');
  });

  test('MTN_MS_002 insufficient Main Store stock: whole transfer refused, nothing deducted', async () => {
    const { mainMat, req } = mtnSetup(10);
    const r = res();
    await MTN.createTransferNote(req, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toMatch(/Insufficient Main Store stock/);
    expect(mainMat.quantity).toBe(10);
  });

  test('MTN_MS_003 Main Store rejects a request with a reason (Site Store notified)', async () => {
    const reqDoc = doc({ _id: id(), requestNo: 'SSR-2026-008', status: 'Pending', requestedByUserId: siteOfficer._id });
    jest.spyOn(MaterialRequest, 'findById').mockResolvedValue(reqDoc);
    const r = res();
    await MR.rejectMaterialRequest({ params: { id: reqDoc._id }, body: { reason: 'Not in approved BOM' }, user: storeOfficer }, r);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(reqDoc).toMatchObject({ status: 'Rejected', rejectionReason: 'Not in approved BOM' });
    expect(createNotificationHelper).toHaveBeenCalledWith(siteOfficer._id, expect.stringContaining('rejected'), 'SSR_REJECTED', expect.any(String));
  });

  test('MTN_SS_004 Site Store confirms receipt (Site Store stock increased, MTN Received)', async () => {
    common();
    const { encryptDB, decryptDB } = await import('../../utils/cryptoUtils.js');
    const siteMat = doc({ _id: id(), name: encryptDB('Portland Cement'), location: 'SiteStore', quantity: encryptDB('5'), unit: 'bag', minimumStock: 5 });
    jest.spyOn(MaterialTransferNote, 'findOneAndUpdate').mockResolvedValue({ _id: id(), mtnNumber: 'MTN-2026-004', siteStoreName: 'Site Store', status: 'Received',
      materials: [{ materialName: 'Portland Cement', unit: 'Bag', transferQty: 30 }] });
    jest.spyOn(Material, 'find').mockResolvedValue([siteMat]);
    const r = res();
    await MTN.receiveTransferNote({ params: { id: id() }, user: siteOfficer }, r);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(body(r).data.status).toBe('Received');
    expect(Number(decryptDB(siteMat.quantity))).toBe(35);
  });
});

// =====================================================================================
describe('Stock control, security and notifications', () => {
  test('ST_MS_001 stock adjustment with a reason (stock reduced, adjustment logged)', async () => {
    common();
    const mat = doc({ _id: id(), name: 'Portland Cement', location: 'MainStore', quantity: 100, unit: 'bag', minimumStock: 10, reorderLevel: 20 });
    jest.spyOn(Material, 'findById').mockResolvedValue(mat);
    jest.spyOn(StockMovement, 'countDocuments').mockResolvedValue(2);
    const r = res();
    await INVENTORY.createStockAdjustment({ body: { materialId: mat._id.toString(), physicalCount: 95, reason: 'Breakage' }, user: storeOfficer }, r);
    expect(r.status).toHaveBeenCalledWith(201);
    expect(mat.quantity).toBe(95);
    expect(StockMovement.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'Adjustment', quantityChange: -5, reason: 'Breakage' }));
  });

  test('ST_MS_002 stock falling to the reorder level raises a low-stock alert', async () => {
    common();
    const mat = doc({ _id: id(), name: 'Portland Cement', location: 'MainStore', quantity: 25, unit: 'bag', minimumStock: 10, reorderLevel: 20 });
    jest.spyOn(Material, 'findById').mockResolvedValue(mat);
    jest.spyOn(StockMovement, 'countDocuments').mockResolvedValue(0);
    const r = res();
    await INVENTORY.createStockAdjustment({ body: { materialId: mat._id.toString(), physicalCount: 18, reason: 'Physical count' }, user: storeOfficer }, r);
    expect(r.status).toHaveBeenCalledWith(201);
    expect(notifyRoles).toHaveBeenCalledWith(['MainStoreOfficer'], expect.stringMatching(/Low stock in Main Store: Portland Cement/), 'LOW_STOCK', expect.any(String));
  });

  test('SEC_001 a Site Store Officer cannot perform a Director-only action (HTTP 403)', async () => {
    jest.spyOn(Permission, 'findOne').mockResolvedValue({ permissionLevel: 'None' });
    const r = res(); const next = jest.fn();
    await PERM.checkPermission('Approve PO')({ user: siteOfficer, method: 'PUT' }, r, next);
    expect(r.status).toHaveBeenCalledWith(403);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    const r2 = res(); const next2 = jest.fn();
    AUTH.authorizeRoles('Director')({ user: siteOfficer }, r2, next2);
    expect(r2.status).toHaveBeenCalledWith(403);
  });

  test('SEC_002 a request without a token is refused (HTTP 401)', async () => {
    const r = res(); const next = jest.fn();
    await AUTH.protect({ headers: {} }, r, next);
    expect(r.status).toHaveBeenCalledWith(401);
    expect(next.mock.calls[0][0].message).toBe('Not authorized, no token');
  });

  test('AUD_A_001 logins and approvals are written to the audit trail', async () => {
    common();
    jest.spyOn(AuditLog, 'find').mockReturnValue(q([{ action: 'User Login' }, { action: 'Purchase Order PO-2026-046 approved' }]));
    jest.spyOn(PurchaseOrder, 'findOneAndUpdate').mockResolvedValue(doc({ _id: id(), poNumber: 'PO-2026-046', status: 'Approved', items: [] }));
    jest.spyOn(Supplier, 'findById').mockResolvedValue(null);
    await PO.approvePurchaseOrder({ params: { id: id() }, body: {}, user: director, headers: {} }, res());
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ userName: 'Executive Director', action: 'Purchase Order PO-2026-046 approved' }));
    const r = res();
    await AUTHCTRL.getAuditLogs({}, r, jest.fn());
    expect(body(r).count).toBe(2);
  });

  test('SET_001 a user changes their own password (old password required, strong policy)', async () => {
    const user = doc({ _id: id(), name: 'Purchase Manager', email: 'pm@els.com', role: 'PurchaseManager',
      matchPassword: jest.fn(async (p) => p === 'Old@Pass1') });
    jest.spyOn(User, 'findById').mockResolvedValue(user);
    jest.spyOn(AuditLog, 'create').mockResolvedValue({});
    const r = res();
    await AUTHCTRL.updateUserProfile({ user: { _id: user._id }, body: { currentPassword: 'Old@Pass1', newPassword: 'New@Pass2026' }, headers: {} }, r, jest.fn());
    expect(r.status).toHaveBeenCalledWith(200);
    expect(user.password).toBe('New@Pass2026');
    expect(user.passwordChangedAt).toBeInstanceOf(Date);
    const r2 = res(); const next = jest.fn();
    await AUTHCTRL.updateUserProfile({ user: { _id: user._id }, body: { currentPassword: 'Wrong@1', newPassword: 'New@Pass2026' }, headers: {} }, r2, next);
    expect(next.mock.calls[0][0].message).toBe('Incorrect current password');
  });

  test('NOT_001 an approval is pushed to open dashboards in real time (Server-Sent Events)', async () => {
    const stream = res(); const listeners = {};
    const viewer = { _id: id(), name: 'Director', role: 'Director', status: true };
    jest.spyOn(User, 'findById').mockReturnValue(q(viewer));
    const { default: jwt } = await import('jsonwebtoken');
    const token = jwt.sign({ id: String(viewer._id) }, process.env.JWT_SECRET);
    await RT.handleSSEConnection({ query: { token }, headers: {}, on: (e, f) => { listeners[e] = f; } }, stream);
    RT.broadcastRealtimeEvent('PO_STATUS_CHANGED', { poNumber: 'PO-2026-046', status: 'Approved' });
    const written = stream.write.mock.calls.map(c => c[0]).join('');
    expect(written).toContain('event: PO_STATUS_CHANGED');
    expect(written).toContain('"status":"Approved"');
    listeners.close && listeners.close();
  });

  test('NOT_003 a connection without a valid login token receives no live events', async () => {
    const r = res();
    await RT.handleSSEConnection({ query: {}, headers: {}, on: jest.fn() }, r);
    expect(r.status).toHaveBeenCalledWith(401);
    expect(r.writeHead).not.toHaveBeenCalled();
  });
});
