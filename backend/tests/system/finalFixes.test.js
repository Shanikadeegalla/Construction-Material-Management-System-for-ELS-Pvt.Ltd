// Tests for the final fixes (see "CMMS Fix Guide"): workflow rules, invoice approval,
// atomic stock updates, safe search and the login attempt limit.
import 'dotenv/config';
import { jest, describe, test, expect, beforeAll, afterEach } from '@jest/globals';
import mongoose from 'mongoose';

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'mysecretkeymustbe32byteslong12345';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const notifyRoles = jest.fn(async () => {});
const createNotificationHelper = jest.fn(async () => {});
jest.unstable_mockModule('../../controllers/notificationController.js', () => ({
  notifyRoles, createNotificationHelper,
  getNotifications: jest.fn(), getNotificationCount: jest.fn(), markAsRead: jest.fn(), markAllAsRead: jest.fn(),
}));
jest.unstable_mockModule('../../utils/mailer.js', () => ({ sendMail: jest.fn(async () => ({})), escapeHtml: (s) => String(s ?? '') }));
const stripeCreate = jest.fn(async () => ({ id: 'cs_test', url: 'https://checkout.stripe.com/x' }));
jest.unstable_mockModule('stripe', () => ({
  default: function Stripe() { return { checkout: { sessions: { create: stripeCreate, retrieve: jest.fn() } }, webhooks: { constructEvent: jest.fn() } }; },
}));

const id = () => new mongoose.Types.ObjectId();
const q = (v) => { const p = Promise.resolve(v); const o = { then: p.then.bind(p), catch: p.catch.bind(p) };
  for (const k of ['populate', 'sort', 'select', 'lean', 'limit', 'exec']) o[k] = () => o; return o; };
const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); r.on = jest.fn(); return r; };
const body = (r) => r.json.mock.calls[0][0];

let MTN, INV, INVOICE, PAY, STOCK, SEARCH, LIMIT, SEED;
let Invoice, GRN, PurchaseOrder, Material, StockMovement, User;

beforeAll(async () => {
  MTN = await import('../../controllers/materialTransferNoteController.js');
  INV = await import('../../controllers/inventoryController.js');
  INVOICE = await import('../../controllers/invoiceController.js');
  PAY = await import('../../controllers/paymentController.js');
  STOCK = await import('../../utils/stockService.js');
  SEARCH = await import('../../utils/searchUtils.js');
  LIMIT = await import('../../middleware/loginRateLimiter.js');
  SEED = await import('../../scripts/verifyAndSeedUsers.js');
  ({ default: Invoice } = await import('../../models/Invoice.js'));
  ({ default: GRN } = await import('../../models/GRN.js'));
  ({ default: PurchaseOrder } = await import('../../models/PurchaseOrder.js'));
  ({ default: Material } = await import('../../models/Material.js'));
  ({ default: StockMovement } = await import('../../models/StockMovement.js'));
  ({ default: User } = await import('../../models/userModel.js'));
});
afterEach(() => { jest.restoreAllMocks(); notifyRoles.mockClear(); stripeCreate.mockClear(); });

const store = { _id: id(), name: 'Main Store Officer', role: 'MainStoreOfficer' };
const buyer = { _id: id(), name: 'Purchase Manager', role: 'PurchaseManager' };

describe('Workflow rules', () => {
  test('FIX-01 a Material Transfer Note without a Site Store request is refused', async () => {
    const r = res();
    await MTN.createTransferNote({ user: store, body: { transferDate: '2026-11-21', materials: [{ materialName: 'Cement', quantity: 5 }] } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toMatch(/must be created from a Site Store material request/);
  });

  test('FIX-02 a GRN without a Purchase Order is refused', async () => {
    const r = res();
    await INV.createGRN({ body: { supplier: 'X', receivedBy: 'Main Store Officer', items: [{ materialName: 'Cement', receivedQty: 5 }] } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toMatch(/select the Purchase Order/);
  });

  test('FIX-03 a damaged quantity without a reason, or above the received quantity, is refused', async () => {
    const r1 = res();
    await INV.createGRN({ body: { poReference: 'PO-2026-001', supplier: 'X', receivedBy: 'M', items: [{ materialName: 'Cement', receivedQty: 10, condition: 'Damaged', damagedQty: 2 }] } }, r1);
    expect(body(r1).message).toMatch(/reason for the damaged quantity of Cement/);
    const r2 = res();
    await INV.createGRN({ body: { poReference: 'PO-2026-001', supplier: 'X', receivedBy: 'M', items: [{ materialName: 'Cement', receivedQty: 10, condition: 'Damaged', damagedQty: 12, discrepancyReason: 'Broken bags' }] } }, r2);
    expect(body(r2).message).toMatch(/between 0 and the received quantity/);
  });
});

describe('Invoice approval stays with the Director', () => {
  test('FIX-04 approving a GRN does not approve its invoice; the Director is notified', async () => {
    const grn = { _id: id(), grnNumber: 'GRN-2026-010', poReference: 'PO-2026-010', status: 'Verified', save: jest.fn() };
    const inv = { _id: id(), invoiceNumber: 'INV-0050', status: 'Pending Approval', grn: null, save: jest.fn() };
    jest.spyOn(GRN, 'findById').mockResolvedValue(grn);
    jest.spyOn(Invoice, 'findOne').mockResolvedValue(inv);
    const r = res();
    await INV.updateGRNStatus({ params: { id: grn._id }, body: { status: 'Approved' }, user: store }, r);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(inv.status).toBe('Pending Approval');
    expect(inv.grn).toBe(grn._id);
    expect(notifyRoles).toHaveBeenCalledWith(['Director'], expect.stringMatching(/INV-0050 is waiting for your approval/), 'GRN_Approved', '/director-dashboard');
  });

  test('FIX-05 Stripe and cash/cheque payment are refused until the Director approves the invoice', async () => {
    const po = { _id: id(), poNumber: 'PO-2026-010', totalAmount: 50000 };
    const pending = { _id: id(), invoiceNumber: 'INV-0050', status: 'Pending Approval', po, amount: 50000, supplier: id() };
    jest.spyOn(Invoice, 'findById').mockReturnValue(q(pending));
    const create = jest.spyOn(Invoice.prototype, 'save');
    const r1 = res();
    await PAY.createCheckoutSession({ user: buyer, body: { invoiceId: String(pending._id) } }, r1);
    expect(r1.status).toHaveBeenCalledWith(400);
    expect(body(r1).message).toMatch(/not been approved by the Director/);
    expect(stripeCreate).not.toHaveBeenCalled();
    const r2 = res();
    await PAY.recordManualPayment({ user: buyer, body: { invoiceId: String(pending._id), paymentMethod: 'Cash' } }, r2);
    expect(r2.status).toHaveBeenCalledWith(400);
    expect(body(r2).message).toMatch(/not been approved by the Director/);
    expect(create).not.toHaveBeenCalled();
  });

  test('FIX-06 paying by PO number never creates an invoice when none was recorded', async () => {
    jest.spyOn(Invoice, 'findOne').mockReturnValue(q(null));
    const save = jest.spyOn(Invoice.prototype, 'save');
    const r = res();
    await PAY.recordManualPayment({ user: buyer, body: { purchaseOrderId: String(id()), paymentMethod: 'Cheque' } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toMatch(/no supplier invoice yet/);
    expect(save).not.toHaveBeenCalled();
  });
});

describe('Atomic stock updates', () => {
  const mainStoreRow = (qty) => Material.hydrate({ _id: id(), name: 'Cement', unit: 'bag', location: 'MainStore', quantity: qty, minimumStock: 0 });

  test('FIX-07 the new balance is written only if nobody changed the stock in between', async () => {
    const mat = mainStoreRow(100);
    const swap = jest.spyOn(Material, 'findOneAndUpdate').mockResolvedValue({ quantity: 70 });
    jest.spyOn(StockMovement, 'create').mockImplementation(async (d) => d);
    const { movement } = await STOCK.recordMovement({ materialDoc: mat, type: 'ISSUE', quantityChange: -30 });
    expect(swap.mock.calls[0][0]).toMatchObject({ _id: mat._id, quantity: 100 });   // compare...
    expect(swap.mock.calls[0][1]).toEqual({ $set: { quantity: 70 } });               // ...and set
    expect(movement.balanceAfter).toBe(70);
  });

  test('FIX-08 a simultaneous change is detected: the stock is re-read and the issue re-checked', async () => {
    const mat = mainStoreRow(100);
    jest.spyOn(Material, 'findOneAndUpdate').mockResolvedValueOnce(null);           // someone else issued first
    jest.spyOn(Material, 'findById').mockResolvedValue({ quantity: 20 });           // only 20 left now
    await expect(STOCK.recordMovement({ materialDoc: mat, type: 'ISSUE', quantityChange: -30 }))
      .rejects.toThrow(/Insufficient stock.*Current: 20/);
  });
});

describe('Security helpers', () => {
  test('FIX-09 search text is matched literally', () => {
    expect(SEARCH.searchRegex('PO-2026 (A)').test('po-2026 (a)')).toBe(true);
    expect(SEARCH.searchRegex('.*').test('anything')).toBe(false);
  });

  test('FIX-10 after 5 failed logins the 6th attempt is blocked; a success resets the count', () => {
    LIMIT.resetLoginAttempts();
    const attempt = (status) => {
      const r = res(); let finish; r.on = (e, f) => { finish = f; }; const next = jest.fn();
      LIMIT.loginRateLimiter({ ip: '10.0.0.1', body: { email: 'director@els.com' } }, r, next);
      if (next.mock.calls.length) { r.statusCode = status; finish(); }
      return { r, next };
    };
    for (let i = 0; i < 5; i++) expect(attempt(401).next).toHaveBeenCalled();
    const blocked = attempt(401);
    expect(blocked.next).not.toHaveBeenCalled();
    expect(blocked.r.status).toHaveBeenCalledWith(429);
    LIMIT.resetLoginAttempts();
    attempt(200);
    expect(attempt(401).next).toHaveBeenCalled();
  });

  test('FIX-11 starting the server never changes existing users (passwords and status stay)', async () => {
    const existing = { email: 'director@els.com', role: 'Director', save: jest.fn() };
    jest.spyOn(User, 'findOne').mockImplementation(async (f) => (f.email ? existing : null));
    const create = jest.spyOn(User.prototype, 'save');
    const summary = await SEED.ensureDefaultUsersExist();
    expect(existing.save).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(summary.every((s) => s.Status === 'Exists (unchanged)')).toBe(true);
  });

  test('FIX-12 a missing demo account is created only with a strong DEMO_USER_PASSWORD from .env', async () => {
    jest.spyOn(User, 'findOne').mockResolvedValue(null);
    const save = jest.spyOn(User.prototype, 'save').mockImplementation(async function () { return this; });
    const saved = process.env.DEMO_USER_PASSWORD;
    process.env.DEMO_USER_PASSWORD = 'admin123';                       // too weak
    let summary = await SEED.ensureDefaultUsersExist();
    expect(save).not.toHaveBeenCalled();
    expect(summary[0].Status).toMatch(/Not created/);
    process.env.DEMO_USER_PASSWORD = 'Els@Demo2026';
    summary = await SEED.ensureDefaultUsersExist();
    expect(save).toHaveBeenCalledTimes(6);
    expect(summary.every((x) => x.Status === 'Created')).toBe(true);
    if (saved === undefined) delete process.env.DEMO_USER_PASSWORD; else process.env.DEMO_USER_PASSWORD = saved;
  });
});
