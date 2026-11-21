// Requirement coverage tests for FR-01 to FR-39 that are not already covered by
// remainingWorkflows.test.js or the unit tests. Real controller code is executed;
// the database, notifications, e-mail and real-time events are test doubles.
// Tests named "GAP" use test.failing: they state what the requirement needs and
// currently FAIL because of a known gap (see the Remaining Development Plan).
// When the gap is fixed, Jest reports them as unexpectedly passing: then change
// test.failing to test.
import 'dotenv/config';
import { jest, describe, test, expect, beforeAll, afterEach } from '@jest/globals';
import mongoose from 'mongoose';

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'mysecretkeymustbe32byteslong12345';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const notifyRoles = jest.fn(async () => {});
const createNotificationHelper = jest.fn(async () => ({}));
jest.unstable_mockModule('../../controllers/notificationController.js', () => ({
  notifyRoles, createNotificationHelper,
  getNotifications: jest.fn(), getNotificationCount: jest.fn(), markAsRead: jest.fn(), markAllAsRead: jest.fn(),
}));
jest.unstable_mockModule('../../utils/mailer.js', () => ({ sendMail: jest.fn(async () => ({})), escapeHtml: (s) => String(s ?? '') }));

const id = () => new mongoose.Types.ObjectId();
const q = (v) => { const p = Promise.resolve(v); const o = { then: p.then.bind(p), catch: p.catch.bind(p) };
  for (const k of ['populate', 'sort', 'select', 'lean', 'session', 'limit', 'skip', 'exec']) o[k] = () => o; return o; };
const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
const body = (r) => r.json.mock.calls[0][0];
const doc = (f) => ({ ...f, save: jest.fn(async function () { return this; }), toObject() { return { ...this }; } });
const flush = () => new Promise((r) => setImmediate(() => setTimeout(r, 20)));

let AUTH, BOMC, PRC, SITE, USAGE;
let User, AuditLog, BOM, Project, ItemMaster, Material, PurchaseRequest, PurchaseOrder, MaterialUsage, StockMovement;

beforeAll(async () => {
  AUTH = await import('../../controllers/authController.js');
  BOMC = await import('../../controllers/bomController.js');
  PRC = await import('../../controllers/purchaseRequestController.js');
  SITE = await import('../../controllers/siteInventoryController.js');
  USAGE = await import('../../controllers/materialUsageController.js');
  ({ default: User } = await import('../../models/userModel.js'));
  ({ default: AuditLog } = await import('../../models/AuditLog.js'));
  ({ default: BOM } = await import('../../models/BOM.js'));
  ({ default: Project } = await import('../../models/Project.js'));
  ({ default: ItemMaster } = await import('../../models/ItemMaster.js'));
  ({ default: Material } = await import('../../models/Material.js'));
  ({ default: PurchaseRequest } = await import('../../models/PurchaseRequest.js'));
  ({ default: PurchaseOrder } = await import('../../models/PurchaseOrder.js'));
  ({ default: MaterialUsage } = await import('../../models/MaterialUsage.js'));
  ({ default: StockMovement } = await import('../../models/StockMovement.js'));
});
afterEach(async () => { await flush(); jest.restoreAllMocks(); notifyRoles.mockClear(); createNotificationHelper.mockClear(); });

const pm = { _id: id(), name: 'Project Manager', role: 'ProjectManager' };
const director = { _id: id(), name: 'Executive Director', role: 'Director' };
const storeOfficer = { _id: id(), name: 'Main Store Officer', role: 'MainStoreOfficer' };
const siteOfficer = { _id: id(), name: 'Site Store Officer', role: 'SiteStoreOfficer' };

// ---------------------------------------------------------------------------------------
describe('FR-01 to FR-03: login, users and roles', () => {
  const account = (extra = {}) => doc({ _id: id(), name: 'Kamal Silva', email: 'kamal@els.com', role: 'Director', status: true,
    matchPassword: jest.fn(async (p) => p === 'Strong@Pass1'), ...extra });
  const login = async (user, password) => {
    jest.spyOn(User, 'findOne').mockResolvedValue(user);
    jest.spyOn(User, 'find').mockResolvedValue([]);
    jest.spyOn(AuditLog, 'create').mockResolvedValue({});
    const r = res(); const next = jest.fn();
    await AUTH.loginUser({ body: { email: 'kamal@els.com', password }, headers: {}, socket: {} }, r, next);
    return { r, next };
  };

  test('FR-01 correct e-mail and password returns a token for the role dashboard', async () => {
    const { r } = await login(account(), 'Strong@Pass1');
    expect(r.status).toHaveBeenCalledWith(200);
    expect(body(r).data.token).toEqual(expect.any(String));
    expect(body(r).data.role).toBe('Director');
  });

  test('FR-01 a wrong password is refused with "Invalid credentials"', async () => {
    const { r, next } = await login(account(), 'Wrong@Pass9');
    expect(r.status).toHaveBeenCalledWith(401);
    expect(next.mock.calls[0][0].message).toBe('Invalid credentials');
  });

  test('FR-01 the shared fallback password "password123" is refused (fixed)', async () => {
    const { r } = await login(account(), 'password123');
    expect(r.status).toHaveBeenCalledWith(401);
  });

  test('FR-02 Admin creates a user; duplicate e-mail and weak password are refused', async () => {
    jest.spyOn(User, 'findOne').mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    jest.spyOn(User, 'countDocuments').mockResolvedValue(10);
    jest.spyOn(User, 'find').mockReturnValue(q([]));
    jest.spyOn(User, 'create').mockImplementation(async (d) => ({ _id: id(), ...d }));
    const r = res(); const next = jest.fn();
    await AUTH.registerUser({ body: { name: 'Nimal Perera', email: 'Nimal@els.com', password: 'Strong@Pass1', role: 'PurchaseManager', employeeId: 'EMP-0101' } }, r, next);
    expect(r.status).toHaveBeenCalledWith(201);
    expect(body(r).data).toMatchObject({ email: 'nimal@els.com', role: 'PurchaseManager', status: true });

    jest.spyOn(User, 'findOne').mockResolvedValue({ _id: id() });
    const r2 = res(); const next2 = jest.fn();
    await AUTH.registerUser({ body: { name: 'Nimal', email: 'nimal@els.com', password: 'Strong@Pass1', employeeId: 'EMP-0102' } }, r2, next2);
    expect(next2.mock.calls[0][0].message).toBe('User already exists');

    const r3 = res(); const next3 = jest.fn();
    await AUTH.registerUser({ body: { name: 'Nimal', email: 'n2@els.com', password: 'abc123' } }, r3, next3);
    expect(next3.mock.calls[0][0].message).toMatch(/at least 8 characters/);
  });

  test('FR-02 Admin deactivates a user (status → inactive)', async () => {
    const u = account({ role: 'PurchaseManager' });
    jest.spyOn(User, 'findById').mockReturnValueOnce(Promise.resolve(u)).mockReturnValueOnce(q({ ...u, status: false }));
    const r = res();
    await AUTH.deactivateUser({ params: { id: u._id }, user: { role: 'Admin' } }, r, jest.fn());
    expect(r.status).toHaveBeenCalledWith(200);
    expect(u.status).toBe(false);
  });

  test('FR-02 a deactivated user cannot log in (fixed)', async () => {
    const { r } = await login(account({ status: false }), 'Strong@Pass1');
    expect(r.status).not.toHaveBeenCalledWith(200);
  });

  test('FR-03 exactly the six roles are supported', () => {
    expect(User.schema.path('role').enumValues).toEqual(['Admin', 'Director', 'ProjectManager', 'PurchaseManager', 'MainStoreOfficer', 'SiteStoreOfficer']);
  });
});

// ---------------------------------------------------------------------------------------
describe('FR-08 to FR-10: BOM preparation, versions and approval', () => {
  const projectId = id(), masterId = id();
  const setup = (priorBoms) => {
    jest.spyOn(Project, 'findById').mockResolvedValue({ _id: projectId, projectName: 'Ratnapura Road', projectId: 'PRJ-2026-031' });
    jest.spyOn(ItemMaster, 'findOne').mockImplementation(async (f) => (String(f._id) === String(masterId)
      ? { _id: masterId, materialName: 'Bitumen Emulsion', unit: 'Drum', category: 'Road Construction', estimatedUnitCost: 118000 } : null));
    jest.spyOn(BOM, 'findOne').mockImplementation((f) => q(f.status === 'Draft' ? null : null));
    jest.spyOn(BOM, 'exists').mockResolvedValue(null);
    jest.spyOn(BOM, 'find').mockReturnValue(q(priorBoms));
    jest.spyOn(BOM.prototype, 'save').mockImplementation(async function () { return this; });
    jest.spyOn(User, 'find').mockResolvedValue([director]);
  };

  test('FR-08 a BOM must use Item Master materials with a positive quantity', async () => {
    setup([]);
    const r = res();
    await BOMC.createBOM({ body: { projectId, status: 'Submitted', materials: [{ materialId: id(), plannedQty: 5 }] }, user: pm }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toMatch(/not an active Master Material/);
    const r2 = res();
    await BOMC.createBOM({ body: { projectId, status: 'Submitted', materials: [{ materialId: masterId, plannedQty: 0 }] }, user: pm }, r2);
    expect(r2.status).toHaveBeenCalledWith(400);
  });

  test('FR-08 a valid BOM is submitted to the Director with costs from the Item Master', async () => {
    setup([]);
    const r = res();
    await BOMC.createBOM({ body: { projectId, status: 'Submitted', materials: [{ materialId: masterId, plannedQty: 7 }] }, user: pm }, r);
    expect(r.status).toHaveBeenCalledWith(201);
    const bom = body(r).data;
    expect(bom.status).toBe('Submitted');
    expect(bom.version).toBe('v1.0');
    expect(bom.materials[0]).toMatchObject({ name: 'Bitumen Emulsion', plannedQty: 7, totalCost: 826000 });
    expect(createNotificationHelper).toHaveBeenCalledWith(director._id, expect.stringContaining('awaiting approval'), 'BOM_SUBMITTED', expect.any(String), 'Director', 'Director');
  });

  test('FR-09 versions: after an approved v1.0 the next BOM is v2.0; after a rejected v1.0 it is v1.1', async () => {
    setup([{ version: 'v1.0', status: 'Approved' }]);
    const r = res();
    await BOMC.createBOM({ body: { projectId, status: 'Submitted', materials: [{ materialId: masterId, plannedQty: 7 }] }, user: pm }, r);
    expect(body(r).data.version).toBe('v2.0');
    jest.restoreAllMocks();
    setup([{ version: 'v1.0', status: 'Rejected' }]);
    const r2 = res();
    await BOMC.createBOM({ body: { projectId, status: 'Submitted', materials: [{ materialId: masterId, plannedQty: 7 }] }, user: pm }, r2);
    expect(body(r2).data.version).toBe('v1.1');
  });

  test('FR-10 the Director approves a submitted BOM; a BOM not submitted cannot be approved', async () => {
    jest.spyOn(AuditLog, 'create').mockResolvedValue({});
    jest.spyOn(User, 'find').mockResolvedValue([storeOfficer]);
    jest.spyOn(BOM, 'findOneAndUpdate').mockReturnValue(q({ _id: id(), version: 'v1.0', projectName: 'Ratnapura Road', status: 'Approved', createdBy: pm._id }));
    const r = res();
    await BOMC.approveBOM({ params: { id: id().toString() }, body: {}, user: director, headers: {} }, r);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(createNotificationHelper).toHaveBeenCalledWith(storeOfficer._id, expect.stringContaining('check Main Store stock'), 'BOM_STOCK_CHECK_REQUIRED', expect.any(String));
    jest.spyOn(BOM, 'findOneAndUpdate').mockReturnValue(q(null));
    jest.spyOn(BOM, 'exists').mockResolvedValue({ _id: id() });
    const r2 = res();
    await BOMC.approveBOM({ params: { id: id().toString() }, body: {}, user: director, headers: {} }, r2);
    expect(r2.status).toHaveBeenCalledWith(400);
    expect(body(r2).message).toBe('Only a submitted BOM can be approved.');
  });

  test('FR-10 the Director rejects a BOM with a reason', async () => {
    jest.spyOn(AuditLog, 'create').mockResolvedValue({});
    jest.spyOn(BOM, 'findOneAndUpdate').mockReturnValue(q({ _id: id(), version: 'v1.0', projectName: 'Ratnapura Road', status: 'Rejected', createdBy: pm._id }));
    const r = res();
    await BOMC.rejectBOM({ params: { id: id().toString() }, body: { rejectionReason: 'Add drainage items' }, user: director, headers: {} }, r);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(BOM.findOneAndUpdate.mock.calls[0][1]).toMatchObject({ status: 'Rejected', rejectionReason: 'Add drainage items' });
  });
});

// ---------------------------------------------------------------------------------------
describe('FR-13 to FR-15: stock check and purchase requests', () => {
  const masterId = id(), bomId = id(), projectId = id();
  const bom = { _id: bomId, status: 'Approved', version: 'v1.0', bomNumber: 'BOM-PRJ-2026-031', projectName: 'Ratnapura Road',
    projectId: { _id: projectId, projectName: 'Ratnapura Road' },
    materials: [{ materialId: masterId, name: 'Bitumen Emulsion', unit: 'Drum', category: 'Road Construction', plannedQty: 100, estimatedUnitCost: 118000 }] };
  const stock = (activePrQty) => {
    jest.spyOn(Material, 'find').mockResolvedValue([{ name: 'Bitumen Emulsion', materialCode: 'MAT0412', quantity: 40, location: 'MainStore' }]);
    jest.spyOn(ItemMaster, 'find').mockResolvedValue([{ _id: masterId, materialCode: 'MAT0412' }]);
    jest.spyOn(PurchaseRequest, 'find').mockResolvedValue(activePrQty ? [{ _id: id(), status: 'Pending', materials: [{ materialId: masterId, materialName: 'Bitumen Emulsion', quantity: activePrQty }] }] : []);
    jest.spyOn(PurchaseOrder, 'find').mockResolvedValue([]);
  };

  test('FR-13 the stock check shows the shortage of each BOM material against Main Store stock', async () => {
    stock(0);
    const [row] = await BOMC.computeBOMStockCheck(bom);
    expect(row).toMatchObject({ plannedQty: 100, available: 40, shortage: 60, status: 'Shortage', requestableQty: 60 });
  });

  test('FR-13 a shortage already covered by an active PR is not offered again', async () => {
    stock(20);
    const [row] = await BOMC.computeBOMStockCheck(bom);
    expect(row).toMatchObject({ shortage: 60, alreadyRequestedQty: 20, requestableQty: 40 });
  });

  const fromBom = async (qty) => {
    stock(0);
    jest.spyOn(BOM, 'findOne').mockReturnValue(q(bom));
    jest.spyOn(PurchaseRequest, 'findOne').mockResolvedValue(null);
    jest.spyOn(PurchaseRequest.prototype, 'save').mockImplementation(async function () { return this; });
    jest.spyOn(User, 'find').mockResolvedValue([{ _id: id(), role: 'PurchaseManager' }]);
    const r = res();
    await PRC.createPurchaseRequestFromBOM({ body: { bomId: bomId.toString(), materials: [{ materialId: masterId.toString(), materialName: 'Bitumen Emulsion', quantity: qty }] }, user: storeOfficer }, r);
    return r;
  };

  test('FR-14 a PR cannot request more than the remaining shortage', async () => {
    const r = await fromBom(70);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).message).toMatch(/exceeds the remaining shortage \(60\)/);
  });

  test('FR-14/FR-15 a PR for the shortage is created as Pending and the Purchase Manager is notified', async () => {
    const r = await fromBom(60);
    expect(r.status).toHaveBeenCalledWith(201);
    expect(body(r).data).toMatchObject({ status: 'Pending', source: 'MainStore' });
    expect(createNotificationHelper).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('awaiting PO conversion'), 'PR_SUBMITTED', expect.any(String));
  });

  test('FR-15 the Purchase Manager declines a PR with a reason; a PR already converted to a PO cannot be declined', async () => {
    const pr = doc({ _id: id(), status: 'Pending', requestedBy: 'Main Store Officer', projectName: 'Ratnapura Road' });
    jest.spyOn(PurchaseRequest, 'findById').mockResolvedValue(pr);
    jest.spyOn(User, 'findOne').mockResolvedValue({ _id: storeOfficer._id });
    const r = res();
    await PRC.updatePurchaseRequestStatus({ params: { id: pr._id }, body: { status: 'Declined', reason: 'Use stock from another project' } }, r);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(pr).toMatchObject({ status: 'Declined', declineReason: 'Use stock from another project' });
    jest.spyOn(PurchaseRequest, 'findById').mockResolvedValue(doc({ _id: id(), status: 'PO Created' }));
    const r2 = res();
    await PRC.updatePurchaseRequestStatus({ params: { id: id() }, body: { status: 'Declined' } }, r2);
    expect(r2.status).toHaveBeenCalledWith(400);
  });
});

// ---------------------------------------------------------------------------------------
describe('FR-30 and FR-31: material issue, usage and variance', () => {
  const projectId = id();
  const issue = async (qty, bodyExtra = {}) => {
    const { encryptDB } = await import('../../utils/cryptoUtils.js');
    const siteMat = doc({ _id: id(), name: encryptDB('Portland Cement'), quantity: encryptDB('20'), unit: 'bag', location: 'SiteStore', minimumStock: 5 });
    jest.spyOn(Material, 'findOne').mockResolvedValue(siteMat);
    jest.spyOn(Project, 'findById').mockResolvedValue({ _id: projectId, projectName: 'Colombo City Complex' });
    jest.spyOn(Project, 'findOne').mockResolvedValue({ _id: id(), projectName: 'Some Other Project' });
    jest.spyOn(MaterialUsage, 'countDocuments').mockResolvedValue(4);
    jest.spyOn(BOM, 'findOne').mockReturnValue(q({ materials: [{ name: 'Portland Cement', plannedQty: 100 }], createdBy: pm._id }));
    jest.spyOn(MaterialUsage, 'find').mockResolvedValue([]);
    jest.spyOn(MaterialUsage, 'create').mockImplementation(async (d) => d);
    jest.spyOn(StockMovement, 'create').mockImplementation(async (d) => d);
    const r = res();
    await SITE.issueMaterialToProject({ body: { materialId: siteMat._id.toString(), quantityUsed: qty, activity: 'Foundation pour', ...bodyExtra }, user: siteOfficer }, r);
    return { r, siteMat };
  };

  test('FR-30 issue and usage are recorded against the project and activity, and site stock is reduced', async () => {
    const { decryptDB } = await import('../../utils/cryptoUtils.js');
    const { r, siteMat } = await issue(18, { projectId: projectId.toString() });
    expect(r.status).toHaveBeenCalledWith(201);
    expect(body(r).data).toMatchObject({ projectName: 'Colombo City Complex', actualQty: 18, plannedQty: 100, activity: 'Foundation pour' });
    expect(Number(decryptDB(siteMat.quantity))).toBe(2);
  });

  test('FR-30 issuing more than the Site Store holds is refused', async () => {
    const { r } = await issue(25, { projectId: projectId.toString() });
    expect(r.status).toHaveBeenCalledWith(400);
    expect(body(r).insufficient).toBe(true);
  });

  test('FR-30 usage without a selected project is refused (fixed)', async () => {
    const { r } = await issue(5);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  test('FR-31 the variance report compares planned BOM quantities with actual usage', async () => {
    jest.spyOn(BOM, 'find').mockReturnValue(q([{ projectId, projectName: 'Colombo City Complex', bomNumber: 'BOM-PRJ-2026-021', version: 'v1.0',
      materials: [{ name: 'Portland Cement', unit: 'bag', plannedQty: 100, estimatedUnitCost: 2650 }] }]));
    jest.spyOn(ItemMaster, 'find').mockReturnValue(q([]));
    jest.spyOn(Material, 'find').mockReturnValue(q([]));
    jest.spyOn(MaterialUsage, 'find').mockResolvedValue([
      { toObject: () => ({ projectName: 'Colombo City Complex', materialName: 'Portland Cement', actualQty: 60, unit: 'bag' }) },
      { toObject: () => ({ projectName: 'Colombo City Complex', materialName: 'Portland Cement', actualQty: 55, unit: 'bag' }) },
    ]);
    const r = res();
    await USAGE.getVarianceReport({}, r);
    expect(r.status).toHaveBeenCalledWith(200);
    const row = body(r).report.find((x) => x.materialName === 'Portland Cement');
    expect(row).toMatchObject({ plannedQty: 100, actualQty: 115, varianceQty: 15, variancePct: 15, status: 'Overused', wastageCost: 39750, issueCount: 2 });
  });
});
