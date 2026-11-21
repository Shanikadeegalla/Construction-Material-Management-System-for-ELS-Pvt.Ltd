// Additional automated API-level test cases (Chapter 5): supplier registry, Item Master and
// categories, permissions, security, purchase orders, goods receipt, site supply, payments,
// invoice due dates and the variance report. The real controller, middleware and utility code
// is executed; only the database (Mongoose model calls), e-mail, notifications and the Stripe
// API are replaced with test doubles.
import 'dotenv/config';
import { jest, describe, test, expect, beforeAll, afterEach } from '@jest/globals';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'mysecretkeymustbe32byteslong12345';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

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
const stripeCreate = jest.fn(async () => ({ id: 'cs_test_002', url: 'https://checkout.stripe.com/c/pay/cs_test_002' }));
jest.unstable_mockModule('stripe', () => ({
  default: function Stripe() { return { checkout: { sessions: { create: stripeCreate, retrieve: jest.fn() } }, webhooks: { constructEvent: jest.fn() } }; },
}));

const id = () => new mongoose.Types.ObjectId();
const q = (v) => { const p = Promise.resolve(v); const o = { then: p.then.bind(p), catch: p.catch.bind(p) };
  for (const k of ['populate', 'sort', 'select', 'lean', 'session', 'limit', 'skip', 'exec']) o[k] = () => o; return o; };
const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); r.write = jest.fn(); r.writeHead = jest.fn(); return r; };
const body = (r) => r.json.mock.calls[0][0];
const doc = (fields) => ({ ...fields, save: jest.fn(async function () { return this; }), toObject() { return { ...this }; } });
const nextErr = () => { const n = jest.fn(); n.err = () => n.mock.calls[0][0]; return n; };

let SUP, IM, CAT, PERMCTRL, PERM, AUTH, ENC, CRYPTO, AUTHCTRL, PO, INVENTORY, MR, MTN, PAY, INVU, USAGE, RT;
let Supplier, ItemMaster, Material, MaterialCategory, Permission, User, PurchaseOrder, PurchaseRequest, GRN,
  MaterialRequest, MaterialTransferNote, Invoice, BOM, MaterialUsage, AuditLog, StockMovement;

beforeAll(async () => {
  SUP = await import('../../controllers/supplierController.js');
  IM = await import('../../controllers/itemMasterController.js');
  CAT = await import('../../controllers/materialCategoryController.js');
  PERMCTRL = await import('../../controllers/permissionController.js');
  PERM = await import('../../middleware/permissionMiddleware.js');
  AUTH = await import('../../middleware/authMiddleware.js');
  ENC = await import('../../middleware/decryptResponses.js');
  CRYPTO = await import('../../utils/cryptoUtils.js');
  AUTHCTRL = await import('../../controllers/authController.js');
  PO = await import('../../controllers/purchaseOrderController.js');
  INVENTORY = await import('../../controllers/inventoryController.js');
  MR = await import('../../controllers/materialRequestController.js');
  MTN = await import('../../controllers/materialTransferNoteController.js');
  PAY = await import('../../controllers/paymentController.js');
  INVU = await import('../../utils/invoiceUtils.js');
  USAGE = await import('../../controllers/materialUsageController.js');
  RT = await import('../../utils/realtimeEvents.js');
  ({ default: Supplier } = await import('../../models/Supplier.js'));
  ({ default: ItemMaster } = await import('../../models/ItemMaster.js'));
  ({ default: Material } = await import('../../models/Material.js'));
  ({ default: MaterialCategory } = await import('../../models/MaterialCategory.js'));
  ({ default: Permission } = await import('../../models/Permission.js'));
  ({ default: User } = await import('../../models/userModel.js'));
  ({ default: PurchaseOrder } = await import('../../models/PurchaseOrder.js'));
  ({ default: PurchaseRequest } = await import('../../models/PurchaseRequest.js'));
  ({ default: GRN } = await import('../../models/GRN.js'));
  ({ default: MaterialRequest } = await import('../../models/MaterialRequest.js'));
  ({ default: MaterialTransferNote } = await import('../../models/MaterialTransferNote.js'));
  ({ default: Invoice } = await import('../../models/Invoice.js'));
  ({ default: BOM } = await import('../../models/BOM.js'));
  ({ default: MaterialUsage } = await import('../../models/MaterialUsage.js'));
  ({ default: AuditLog } = await import('../../models/AuditLog.js'));
  ({ default: StockMovement } = await import('../../models/StockMovement.js'));
});

const flush = () => new Promise((r) => setImmediate(() => setTimeout(r, 30)));
afterEach(async () => { await flush(); jest.restoreAllMocks(); sendMail.mockClear(); notifyRoles.mockClear(); createNotificationHelper.mockClear(); stripeCreate.mockClear(); });

const admin = { _id: id(), name: 'System Admin', role: 'Admin' };
const purchaseMgr = { _id: id(), name: 'Purchase Manager', role: 'PurchaseManager', email: 'pm@els.com' };
const storeOfficer = { _id: id(), name: 'Main Store Officer', role: 'MainStoreOfficer' };
const siteOfficer = { _id: id(), name: 'Site Store Officer', role: 'SiteStoreOfficer' };
const projectMgr = { _id: id(), name: 'Project Manager', role: 'ProjectManager' };

// =====================================================================================
describe('Supplier registry', () => {
  test('SUP_AT_001 register a supplier: the next supplier ID (SUP-0013) is generated', async () => {
    jest.spyOn(Supplier, 'countDocuments').mockResolvedValue(12);
    jest.spyOn(Supplier, 'findOne').mockResolvedValue(null);
    const save = jest.spyOn(Supplier.prototype, 'save').mockImplementation(async function () { return this; });
    const r = res();
    await SUP.createSupplier({ headers: { authorization: 'Bearer t' }, body: { name: 'Lanka Cement Traders', phone: '0771234567', email: 'sales@lankacement.lk', categories: [] } }, r);
    expect(r.status).toHaveBeenCalledWith(201);
    expect(body(r).data.supplierId).toBe('SUP-0013');
    expect(save).toHaveBeenCalled();
  });

  test('SUP_AT_002 a bank account number with letters is refused through the API', async () => {
    const save = jest.spyOn(Supplier.prototype, 'save');
    const r = res();
    await SUP.createSupplier({ headers: { authorization: 'Bearer t' }, body: { name: 'X Traders', phone: '0771234567', accountNumber: 'AB12-99' } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toMatch(/only numeric digits/);
    expect(save).not.toHaveBeenCalled();
  });

  test('SUP_AT_003 update the contact details of a supplier', async () => {
    const updated = doc({ _id: id(), supplierId: 'SUP-0004', name: 'Dialog Hardware', phone: '0112345678', email: 'new@dialoghw.lk', categories: [] });
    jest.spyOn(Supplier, 'findByIdAndUpdate').mockResolvedValue(updated);
    const r = res();
    await SUP.updateSupplier({ headers: { authorization: 'Bearer t' }, params: { id: updated._id }, body: { email: 'new@dialoghw.lk' } }, r);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(Supplier.findByIdAndUpdate.mock.calls[0][1].email).toBe('new@dialoghw.lk');
    expect(body(r).message).toBe('Supplier updated successfully!');
  });

  test('SUP_AT_004 updating a supplier that does not exist returns 404', async () => {
    jest.spyOn(Supplier, 'findByIdAndUpdate').mockResolvedValue(null);
    const r = res();
    await SUP.updateSupplier({ headers: { authorization: 'Bearer t' }, params: { id: id() }, body: { phone: '0110000000' } }, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  test('SUP_AT_005 the Supplier model requires a supplier ID and phone number', () => {
    const err = new Supplier({ name: 'No Phone Ltd' }).validateSync();
    expect(err.errors.supplierId).toBeDefined();
    expect(err.errors.phone).toBeDefined();
  });
});

// =====================================================================================
describe('Item Master and material categories', () => {
  test('IM_A_001 add a material: saved and a zero-stock Main Store row is created', async () => {
    const save = jest.spyOn(ItemMaster.prototype, 'save').mockImplementation(async function () { return this; });
    jest.spyOn(Material, 'updateMany').mockResolvedValue({});
    jest.spyOn(Material, 'findOne').mockResolvedValue(null);
    const create = jest.spyOn(Material, 'create').mockResolvedValue({});
    const r = res();
    await IM.createItemMaster({ body: { materialCode: 'MAT0101', materialName: 'Tile Adhesive', category: 'Finishing Materials', unit: 'Bag', estimatedUnitCost: 1850, minimumStock: 20, reorderLevel: 40, maximumStock: 200 } }, r);
    expect(r.status).toHaveBeenCalledWith(201);
    expect(save).toHaveBeenCalled();
    expect(create.mock.calls[0][0]).toMatchObject({ name: 'Tile Adhesive', location: 'MainStore', quantity: 0 });
  });

  test('IM_A_002 a material without code, name, category or unit is refused', async () => {
    const r = res();
    await IM.createItemMaster({ body: { materialName: 'Unnamed' } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toMatch(/material code, name, category, and unit/);
  });

  test('CAT_A_001 add a new material category', async () => {
    jest.spyOn(MaterialCategory, 'find').mockReturnValue(q([]));
    const create = jest.spyOn(MaterialCategory, 'create').mockResolvedValue({});
    const r = res();
    await CAT.createMaterialCategory({ body: { name: 'Waterproofing' }, user: admin }, r);
    expect(r.status).toHaveBeenCalledWith(201);
    expect(create.mock.calls[0][0].name).toBe('Waterproofing');
  });

  test('CAT_A_002 a duplicate category name is refused regardless of letter case', async () => {
    jest.spyOn(MaterialCategory, 'find').mockReturnValue(q([{ name: 'Waterproofing' }]));
    const r = res();
    await CAT.createMaterialCategory({ body: { name: 'waterproofing' }, user: admin }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toMatch(/already exists/);
  });

  test('CAT_A_003 an empty or over-long category name is refused', async () => {
    const r1 = res(); await CAT.createMaterialCategory({ body: { name: '   ' } }, r1);
    expect(r1.status).toHaveBeenCalledWith(400);
    const r2 = res(); await CAT.createMaterialCategory({ body: { name: 'x'.repeat(41) } }, r2);
    expect(body(r2).message).toMatch(/40 characters or fewer/);
  });

  test('CAT_A_004 a category still used by materials cannot be removed', async () => {
    jest.spyOn(MaterialCategory, 'findOne').mockResolvedValue({ name: 'Waterproofing', deleteOne: jest.fn() });
    jest.spyOn(ItemMaster, 'countDocuments').mockResolvedValue(2);
    jest.spyOn(Material, 'countDocuments').mockResolvedValue(1);
    jest.spyOn(Supplier, 'countDocuments').mockResolvedValue(0);
    const r = res();
    await CAT.deleteMaterialCategory({ params: { name: 'Waterproofing' } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toMatch(/still used by 2 material/);
  });
});

// =====================================================================================
describe('Roles and permissions', () => {
  test('PRM_A_001 the Admin changes a permission level in the matrix', async () => {
    const saved = { role: 'ProjectManager', module: 'Create Project', permissionLevel: 'Full' };
    jest.spyOn(Permission, 'findOneAndUpdate').mockResolvedValue(saved);
    const r = res();
    await PERMCTRL.editPermission({ body: saved, user: admin }, r, nextErr());
    expect(r.status).toHaveBeenCalledWith(200);
    expect(Permission.findOneAndUpdate.mock.calls[0][2]).toMatchObject({ upsert: true });
  });

  test('PRM_A_002 a permission change without a level is refused', async () => {
    const r = res(); const n = nextErr();
    await PERMCTRL.editPermission({ body: { role: 'Director', module: 'Approve PO' } }, r, n);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(n.err().message).toMatch(/required/);
  });

  test('PRM_A_003 a role whose level is "None" is blocked (HTTP 403)', async () => {
    jest.spyOn(Permission, 'findOne').mockResolvedValue({ permissionLevel: 'None' });
    const r = res(); const n = nextErr();
    await PERM.checkPermission('Approve PO')({ user: projectMgr, method: 'PUT' }, r, n);
    expect(r.status).toHaveBeenCalledWith(403);
    expect(n.err().message).toMatch(/does not have permission/);
  });

  test('PRM_A_004 the Admin passes every permission check', async () => {
    const find = jest.spyOn(Permission, 'findOne');
    const n = nextErr();
    await PERM.checkPermission('Approve PO')({ user: admin, method: 'PUT' }, res(), n);
    expect(n).toHaveBeenCalledWith();
    expect(find).not.toHaveBeenCalled();
  });
});

// =====================================================================================
describe('Authentication and data protection', () => {
  const tokenFor = (u, iat) => jwt.sign({ id: String(u._id), ...(iat ? { iat } : {}) }, process.env.JWT_SECRET);
  const withUser = (u) => jest.spyOn(User, 'findById').mockReturnValue(q(u));

  test('SEC_003 a valid token for an active user is accepted', async () => {
    withUser({ ...projectMgr, status: true });
    const req = { headers: { authorization: `Bearer ${tokenFor(projectMgr)}` } }; const n = nextErr();
    await AUTH.protect(req, res(), n);
    expect(n).toHaveBeenCalledWith();
    expect(req.user.role).toBe('ProjectManager');
  });

  test('SEC_004 the token of a deactivated account is refused (HTTP 401)', async () => {
    withUser({ ...projectMgr, status: false });
    const r = res(); const n = nextErr();
    await AUTH.protect({ headers: { authorization: `Bearer ${tokenFor(projectMgr)}` } }, r, n);
    expect(r.status).toHaveBeenCalledWith(401);
    expect(n.err().message).toMatch(/deactivated/);
  });

  test('SEC_005 a token issued before the last password change is refused', async () => {
    const iat = Math.floor(Date.now() / 1000) - 3600;
    withUser({ ...projectMgr, status: true, passwordChangedAt: new Date() });
    const r = res(); const n = nextErr();
    await AUTH.protect({ headers: { authorization: `Bearer ${tokenFor(projectMgr, iat)}` } }, r, n);
    expect(r.status).toHaveBeenCalledWith(401);
    expect(n.err().message).toMatch(/recently changed password/);
  });

  test('SEC_006 a tampered or forged token is refused', async () => {
    const forged = jwt.sign({ id: String(admin._id) }, 'not-the-server-secret');
    const r = res(); const n = nextErr();
    await AUTH.protect({ headers: { authorization: `Bearer ${forged}` } }, r, n);
    expect(r.status).toHaveBeenCalledWith(401);
    expect(n.err().message).toMatch(/token failed/);
  });

  test('SEC_007 role-restricted routes allow only the listed roles', () => {
    const guard = AUTH.authorizeRoles('Director');
    const n1 = nextErr(); guard({ user: { role: 'Director' } }, res(), n1);
    expect(n1).toHaveBeenCalledWith();
    const r2 = res(); const n2 = nextErr(); guard({ user: { role: 'SiteStoreOfficer' } }, r2, n2);
    expect(r2.status).toHaveBeenCalledWith(403);
  });

  test('SEC_008 password policy: short passwords and passwords without a symbol are refused', () => {
    expect(AUTHCTRL.isStrongPassword('Ab1!xyz')).toBe(false);      // 7 characters
    expect(AUTHCTRL.isStrongPassword('Abcdefg12')).toBe(false);    // no symbol
    expect(AUTHCTRL.isStrongPassword('abcdef1!')).toBe(false);     // no upper case
    expect(AUTHCTRL.isStrongPassword('Els@Store2026')).toBe(true);
  });

  test('SEC_009 encrypted Site Store fields are decrypted on the server before a response is sent', () => {
    const r = res(); const original = r.json; const n = jest.fn();
    ENC.decryptResponses({ headers: {} }, r, n);
    expect(n).toHaveBeenCalled();
    r.json({ success: true, data: [{ _id: '64f1c2a9b3e4d5f6a7b8c9d0', name: CRYPTO.encryptDB('River Sand'), quantity: CRYPTO.encryptDB('42'), unit: 'Cu.M' }] });
    expect(original.mock.calls[0][0].data[0]).toEqual({ _id: '64f1c2a9b3e4d5f6a7b8c9d0', name: 'River Sand', quantity: 42, unit: 'Cu.M' });
  });

  test('SEC_010 usage and transfer records reach the browser decrypted, other values untouched', () => {
    const r = res(); const original = r.json;
    ENC.decryptResponses({ headers: {} }, r, jest.fn());
    r.json({ success: true, data: { materialName: CRYPTO.encryptDB('Portland Cement'), actualQty: CRYPTO.encryptDB('18'), variance: CRYPTO.encryptDB('3'),
      projectName: 'Colombo City Complex', notes: 'deadbeefdeadbeefdeadbeefdeadbeef' } });
    expect(original.mock.calls[0][0].data).toEqual({ materialName: 'Portland Cement', actualQty: 18, variance: 3,
      projectName: 'Colombo City Complex', notes: 'deadbeefdeadbeefdeadbeefdeadbeef' });
  });

  test('SEC_011 no response ever contains an encrypted value or a key; error messages pass unchanged', () => {
    const r = res(); const original = r.json;
    ENC.decryptResponses({ headers: {} }, r, jest.fn());
    r.json([{ name: CRYPTO.encryptDB('Steel Bars'), location: 'SiteStore' }]);
    expect(JSON.stringify(original.mock.calls[0][0])).not.toMatch(/[0-9a-f]{32}/);
    const e = res(); const eo = e.json;
    ENC.decryptResponses({ headers: {} }, e, jest.fn());
    e.json({ success: false, message: 'Bad input' });
    expect(eo.mock.calls[0][0]).toEqual({ success: false, message: 'Bad input' });
  });

  test('SEC_012 Site Store data stored in the database is encrypted and restored exactly', () => {
    const stored = CRYPTO.encryptDB('Portland Cement 50kg');
    expect(stored).not.toContain('Cement');
    expect(CRYPTO.decryptDB(stored)).toBe('Portland Cement 50kg');
  });
});

// =====================================================================================
describe('Purchase orders and goods receipt', () => {
  const pr = () => ({ _id: id(), prNumber: 'PR-2026-014', materials: [{ materialName: 'Cement' }, { materialName: 'Sand' }] });

  test('PO_PU_008 the PO total is recalculated on the server from quantities and unit prices', async () => {
    const prDoc = pr();
    jest.spyOn(PurchaseRequest, 'findById').mockResolvedValue(prDoc);
    jest.spyOn(PurchaseRequest, 'findByIdAndUpdate').mockResolvedValue({});
    const yr = new Date().getFullYear();
    jest.spyOn(PurchaseOrder, 'findOne').mockImplementation((f) => q(f && f.poNumber ? null : { poNumber: `PO-${yr}-041` }));
    jest.spyOn(PurchaseOrder, 'find').mockReturnValue(q([]));
    jest.spyOn(Material, 'findOne').mockResolvedValue({ _id: id() });
    jest.spyOn(User, 'find').mockReturnValue(q([]));
    const save = jest.spyOn(PurchaseOrder.prototype, 'save').mockImplementation(async function () { return this; });
    const r = res();
    await PO.createPurchaseOrder({ user: purchaseMgr, body: { prId: String(prDoc._id), supplier: String(id()), totalAmount: 1,
      items: [{ materialName: 'Cement', quantity: 100, unitPrice: 2500, unit: 'bag' }, { materialName: 'Sand', quantity: 10, unitPrice: 9000, unit: 'm3' }] } }, r);
    expect(r.status).toHaveBeenCalledWith(201);
    expect(body(r).data.totalAmount).toBe(340000);
    expect(body(r).data.poNumber).toBe(`PO-${yr}-042`);
    expect(body(r).data.status).toBe('Pending');
    expect(save).toHaveBeenCalled();
  });

  test('PO_PU_009 an item that is not on the purchase request cannot be ordered', async () => {
    jest.spyOn(PurchaseRequest, 'findById').mockResolvedValue(pr());
    const r = res();
    await PO.createPurchaseOrder({ user: purchaseMgr, body: { prId: String(id()), supplier: String(id()),
      items: [{ materialName: 'Steel Bars', quantity: 5, unitPrice: 120000 }] } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toMatch(/is not part of Purchase Request PR-2026-014/);
  });

  test('PO_PU_010 a PO without any items is refused', async () => {
    const r = res();
    await PO.createPurchaseOrder({ user: purchaseMgr, body: { supplier: String(id()), items: [] } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toBe('Please select at least one item.');
  });

  test('GRN_MS_006 a second GRN against a fully delivered PO is refused', async () => {
    jest.spyOn(PurchaseOrder, 'findOne').mockResolvedValue({ poNumber: 'PO-2026-030', status: 'Delivered', items: [] });
    const r = res();
    await INVENTORY.createGRN({ body: { poReference: 'PO-2026-030', supplier: 'Lanka Cement Traders', receivedBy: 'Main Store Officer', items: [{ materialName: 'Cement', receivedQty: 10 }] } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toMatch(/already been fully received/);
  });

  test('GRN_MS_007 a GRN for a PO number that does not exist is refused', async () => {
    jest.spyOn(PurchaseOrder, 'findOne').mockResolvedValue(null);
    const r = res();
    await INVENTORY.createGRN({ body: { poReference: 'PO-2026-999', supplier: 'X', receivedBy: 'Main Store Officer', items: [{ materialName: 'Cement', receivedQty: 1 }] } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toMatch(/not found/);
  });

  test('GRN_MS_008 a GRN without the receiver or items is refused', async () => {
    const r = res();
    await INVENTORY.createGRN({ body: { poReference: 'PO-2026-030', supplier: 'X', items: [] } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toBe('Missing required GRN information');
  });
});

// =====================================================================================
describe('Site supply', () => {
  const masterRow = (n) => ({ materialName: n, category: 'Cement & Concrete', unit: 'Bag' });

  test('MR_SS_004 only the Site Store Officer can raise a material request', async () => {
    const r = res();
    await MR.createMaterialRequest({ user: projectMgr, body: { requiredDate: '2026-12-01', materials: [{ materialName: 'Cement', quantity: 5 }] } }, r);
    expect(r.status).toHaveBeenCalledWith(403);
  });

  test('MR_SS_005 the same material twice in one request is refused', async () => {
    const r = res();
    await MR.createMaterialRequest({ user: siteOfficer, body: { requiredDate: '2026-12-01', materials: [{ materialName: 'Cement', quantity: 5 }, { materialName: 'cement ', quantity: 3 }] } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toMatch(/Duplicate material/);
  });

  test('MR_SS_006 a material that is not in the Item Master is refused', async () => {
    jest.spyOn(ItemMaster, 'find').mockResolvedValue([masterRow('Cement')]);
    const r = res();
    await MR.createMaterialRequest({ user: siteOfficer, body: { requiredDate: '2026-12-01', materials: [{ materialName: 'Unobtainium', quantity: 1 }] } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toMatch(/not a recognized material/);
  });

  test('MR_SS_007 a request without a required date is refused', async () => {
    const r = res();
    await MR.createMaterialRequest({ user: siteOfficer, body: { materials: [{ materialName: 'Cement', quantity: 5 }] } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toMatch(/required date/);
  });

  test('MTN_MS_005 a transfer that does not cover every requested line in full is refused', async () => {
    jest.spyOn(MaterialRequest, 'findById').mockResolvedValue({ _id: id(), status: 'Pending',
      materials: [{ materialName: 'Cement', unit: 'Bag', quantity: 50, fulfilledQty: 0 }, { materialName: 'Sand', unit: 'm3', quantity: 4, fulfilledQty: 0 }] });
    const findMat = jest.spyOn(Material, 'findOne');
    const r = res();
    await MTN.createTransferNote({ user: storeOfficer, body: { sourceRequestId: String(id()), transferDate: '2026-11-20', materials: [{ materialName: 'Cement', quantity: 50 }] } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toMatch(/Still short: Sand \(needs 4 m3\)/);
    expect(findMat).not.toHaveBeenCalled();     // stock untouched
  });

  test('MTN_MS_006 a request that is already fully transferred cannot be transferred again', async () => {
    jest.spyOn(MaterialRequest, 'findById').mockResolvedValue({ _id: id(), status: 'Transferred', materials: [] });
    const r = res();
    await MTN.createTransferNote({ user: storeOfficer, body: { sourceRequestId: String(id()), transferDate: '2026-11-20', materials: [{ materialName: 'Cement', quantity: 5 }] } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toMatch(/Only Pending or Partially Transferred/);
  });

  test('MTN_SS_007 a transfer note that was already received cannot be received twice', async () => {
    jest.spyOn(MaterialTransferNote, 'findOneAndUpdate').mockResolvedValue(null);
    jest.spyOn(MaterialTransferNote, 'exists').mockResolvedValue({ _id: id() });
    const r = res();
    await MTN.receiveTransferNote({ user: siteOfficer, params: { id: id() } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toMatch(/already been received/);
  });
});

// =====================================================================================
describe('Invoices, payments and reports', () => {
  test('PAY_PU_006 a payment amount that differs from the PO total is refused', async () => {
    const po = { _id: id(), poNumber: 'PO-2026-022', totalAmount: 125000 };
    jest.spyOn(Invoice, 'findById').mockReturnValue(q({ _id: id(), invoiceNumber: 'INV-0031', status: 'Approved', po, supplier: id() }));
    const r = res();
    await PAY.createCheckoutSession({ user: purchaseMgr, body: { invoiceId: String(id()), amount: 120000 } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toMatch(/does not match PO total/);
    expect(stripeCreate).not.toHaveBeenCalled();
  });

  test('PAY_PU_007 an invoice that is already paid cannot be paid again', async () => {
    const po = { _id: id(), poNumber: 'PO-2026-022', totalAmount: 125000 };
    jest.spyOn(Invoice, 'findById').mockReturnValue(q({ _id: id(), invoiceNumber: 'INV-0031', status: 'Paid', po, supplier: id() }));
    const r = res();
    await PAY.createCheckoutSession({ user: purchaseMgr, body: { invoiceId: String(id()) } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toBe('This invoice has already been paid.');
    expect(stripeCreate).not.toHaveBeenCalled();
  });

  test('INV_U_001 the invoice due date follows the payment terms of the PO', () => {
    const d = (t) => INVU.calculateDueDate('2026-11-01', t).toISOString().slice(0, 10);
    expect(d('30 Days Credit')).toBe('2026-12-01');
    expect(d('45 Days Credit')).toBe('2026-12-16');
    expect(d('Cash on Delivery')).toBe('2026-11-01');
    expect(d(undefined)).toBe('2026-12-01');
  });

  test('INV_U_002 a manual due date earlier than the invoice date is refused', () => {
    expect(INVU.validateDueDate('2026-11-10', '2026-11-05')).toEqual({ valid: false, message: 'Due date cannot be earlier than invoice date.' });
    expect(INVU.validateDueDate('2026-11-10', '2026-11-10').valid).toBe(true);
  });

  test('VAR_001 the variance report classifies overuse as Significant (>10%) or Moderate and costs the wastage', async () => {
    const bom = { projectId: id(), projectName: 'Colombo Port Expansion', bomNumber: 'BOM-001', version: 'v1.0',
      materials: [{ name: 'Cement', unit: 'Bag', plannedQty: 100, estimatedUnitCost: 2500 },
                  { name: 'Sand', unit: 'm3', plannedQty: 20, estimatedUnitCost: 9000 },
                  { name: 'Steel Bars', unit: 'Ton', plannedQty: 5, estimatedUnitCost: 300000 }] };
    jest.spyOn(BOM, 'find').mockReturnValue(q([bom]));
    jest.spyOn(ItemMaster, 'find').mockReturnValue(q([]));
    jest.spyOn(Material, 'find').mockReturnValue(q([]));
    const use = (n, qty) => ({ toObject: () => ({ projectName: 'Colombo Port Expansion', materialName: n, actualQty: qty, plannedQty: 0, variance: 0, unit: '' }) });
    jest.spyOn(MaterialUsage, 'find').mockResolvedValue([use('Cement', 115), use('Sand', 21), use('Steel Bars', 4)]);
    const r = res();
    await USAGE.getVarianceReport({ query: {}, user: projectMgr }, r);
    const rows = Object.fromEntries(body(r).report.map((x) => [x.materialName, x]));
    expect(rows.Cement).toMatchObject({ variancePct: 15, severity: 'Significant', wastageQty: 15, wastageCost: 37500, status: 'Overused' });
    expect(rows.Sand).toMatchObject({ variancePct: 5, severity: 'Moderate', wastageCost: 9000 });
    expect(rows['Steel Bars']).toMatchObject({ severity: 'None', status: 'Within Plan', remainingQty: 1 });
    expect(body(r).totalWastageCost).toBe(46500);
  });

  test('NOT_002 a real-time event sent to one role reaches only users of that role', async () => {
    const tokenFor = (u) => jwt.sign({ id: String(u._id) }, process.env.JWT_SECRET);
    const conns = [];
    for (const u of [purchaseMgr, storeOfficer]) {
      jest.spyOn(User, 'findById').mockReturnValueOnce(q(u));
      const r = res(); const req = { query: { token: tokenFor(u) }, headers: {}, on: jest.fn() };
      await RT.handleSSEConnection(req, r); conns.push({ r, req });
    }
    RT.broadcastRealtimeEvent('LOW_STOCK', { material: 'Cement' }, { targetRole: 'PurchaseManager' });
    const got = (c) => c.r.write.mock.calls.some(([m]) => String(m).startsWith('event: LOW_STOCK'));
    expect(got(conns[0])).toBe(true);
    expect(got(conns[1])).toBe(false);
    conns.forEach((c) => c.req.on.mock.calls.find(([e]) => e === 'close')[1]());
  });
});
