// End-to-end check of FR4-FR6 against a throwaway database. Run with cwd = backend.
import { pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';

const TEST_DB = 'ConstructionDB_e2e_tmp';
const envText = fs.readFileSync('.env', 'utf8');
const uri = envText.match(/^MONGO_URI=(.*)$/m)[1].trim();
const m = uri.match(/^(mongodb(?:\+srv)?:\/\/[^/]+)\/([^?]*)(\?.*)?$/);
if (!m) throw new Error('Could not parse MONGO_URI');
if (m[2] === TEST_DB) throw new Error('refusing: already test db');
process.env.MONGO_URI = `${m[1]}/${TEST_DB}${m[3] || ''}`;
process.env.PORT = '5077';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
process.env.NODE_ENV = 'test';

const imp = (rel) => import(pathToFileURL(path.resolve(rel)).href);
const mongoose = (await imp('node_modules/mongoose/index.js')).default;
await imp('server.js');
const User = (await imp('models/userModel.js')).default;
const Project = (await imp('models/Project.js')).default;
const Supplier = (await imp('models/Supplier.js')).default;
const ItemMaster = (await imp('models/ItemMaster.js')).default;
const Permission = (await imp('models/Permission.js')).default;
const Notification = (await imp('models/Notification.js')).default;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
while (mongoose.connection.readyState !== 1) await sleep(300);
if (mongoose.connection.name !== TEST_DB) throw new Error('wrong db: ' + mongoose.connection.name);
console.log('connected to', mongoose.connection.name);

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, extra); }
};

try {
  // wait for seeding (roles, permissions, item master) to settle
  let prev = -1;
  for (let i = 0; i < 120; i++) {
    const c = (await Permission.countDocuments()) + (await ItemMaster.countDocuments());
    if (c > 0 && c === prev) break;
    prev = c; await sleep(2500);
  }
  console.log('seeded: permissions', await Permission.countDocuments(), 'items', await ItemMaster.countDocuments());

  const base = 'http://localhost:5077/api';
  const roles = { dir: 'Director', pm: 'ProjectManager', buy: 'PurchaseManager', main: 'MainStoreOfficer', site: 'SiteStoreOfficer' };
  const users = {}, tokens = {};
  for (const [k, role] of Object.entries(roles)) {
    users[k] = await User.create({ name: `E2E ${role}`, email: `e2e_${k}@test.lk`, password: 'Test@12345', role, employeeId: `E2E-${k}` });
    const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `e2e_${k}@test.lk`, password: 'Test@12345' }) });
    const d = await r.json();
    tokens[k] = d.data?.token;
    if (!tokens[k]) throw new Error('login failed for ' + k + ': ' + JSON.stringify(d));
  }
  const api = async (who, method, url, body) => {
    const res = await fetch(`${base}${url}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens[who]}` }, body: body ? JSON.stringify(body) : undefined });
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('json') ? await res.json() : { _binary: (await res.arrayBuffer()).byteLength, _type: ct };
    return { status: res.status, data };
  };
  const notifs = async (k, type) => Notification.find({ recipientId: users[k]._id, ...(type ? { type } : {}) });

  const project = await Project.create({ projectId: 'PRJ-E2E-001', projectName: 'E2E Tower', clientName: 'Client', location: 'Colombo', startDate: new Date(), expectedEndDate: new Date(Date.now() + 9e9), budget: 5000000, createdBy: users.pm._id, status: 'Active' });
  const supplier = await Supplier.create({ name: 'E2E Supplier', phone: '0711234567', category: 'Other', supplierId: 'SUP-E2E-1' }).catch(async () => Supplier.create({ name: 'E2E Supplier', phone: '0711234567', category: 'Other' }));
  const [im1, im2] = await ItemMaster.find({ status: 'Active' }).limit(2);
  const R = im1.reorderLevel;
  const P1 = R + 50, P2 = 10;
  console.log(`materials: ${im1.materialName} (reorder ${R}, min ${im1.minimumStock}), ${im2.materialName}`);

  console.log('\n[BOM -> approve -> Main Store notified]');
  let r = await api('pm', 'POST', '/bom', { projectId: project._id, status: 'Submitted', materials: [{ materialId: im1._id, plannedQty: P1 }, { materialId: im2._id, plannedQty: P2 }] });
  check('BOM submitted', r.status < 300, JSON.stringify(r.data));
  const bomId = r.data.data._id;
  r = await api('dir', 'PUT', `/bom/${bomId}/approve`, {});
  check('BOM approved', r.status === 200, JSON.stringify(r.data));
  check('Main Store notified of approved BOM', (await notifs('main', 'BOM_STOCK_CHECK_REQUIRED')).length === 1);
  r = await api('main', 'GET', `/bom/${bomId}/stock-check`);
  check('BOM stock visibility shows shortage', r.data.data?.[0]?.shortage === P1, JSON.stringify(r.data.data?.[0]));

  console.log('\n[PR -> PO -> Director approval]');
  r = await api('main', 'POST', '/purchase-requests/from-bom', { bomId, materials: [{ materialId: im1._id, quantity: P1 }, { materialId: im2._id, quantity: P2 }] });
  check('PR created from BOM shortage', r.status === 201, JSON.stringify(r.data));
  const pr = r.data.data;
  check('Purchase Manager notified of PR', (await notifs('buy', 'PR_SUBMITTED')).length === 1);
  const items = pr.materials.map(x => ({ materialName: x.materialName, quantity: x.quantity, unit: x.unit, unitPrice: 100 }));
  const total = items.reduce((s, i) => s + i.quantity * 100, 0);
  r = await api('buy', 'POST', '/purchase-orders', { prId: pr._id, supplier: String(supplier._id), items, totalAmount: total });
  check('PO created', r.status === 201, JSON.stringify(r.data));
  const po = r.data.data;
  check('Director notified of PO', (await notifs('dir', 'PO_SUBMITTED')).length === 1);
  r = await api('dir', 'PUT', `/purchase-orders/${po._id}/approve`, {});
  check('PO approved', r.status === 200);
  check('PO without supplier email stays Approved for manual send', r.data.data.status === 'Approved' && /sent manually/.test(r.data.message), r.data.message);
  check('Purchase Manager notified PO approved', (await notifs('buy', 'PO_approved')).length === 1);
  check('Main Store notified PO approved', (await notifs('main', 'PO_approved')).length === 1);
  r = await api('buy', 'PUT', `/purchase-orders/${po._id}/status`, { status: 'Sent' });
  check('PO marked Sent', r.status === 200, JSON.stringify(r.data));

  console.log('\n[GRN -> invoice -> Director approval -> payment]');
  r = await api('main', 'POST', '/invoices', { supplier: supplier._id, po: po._id, amount: total });
  check('Invoice blocked before delivery', r.status === 400, JSON.stringify(r.data));
  r = await api('main', 'POST', '/inventory/grn', { poReference: po.poNumber, supplier: 'E2E Supplier', receivedBy: 'E2E Main', items: items.map(i => ({ materialName: i.materialName, expectedQty: i.quantity, receivedQty: i.quantity })) });
  check('GRN recorded', r.status === 201, JSON.stringify(r.data).slice(0, 300));
  const grn = r.data.grn;
  r = await api('main', 'GET', '/inventory?location=MainStore');
  const mainMat1 = r.data.find(x => x.name === im1.materialName);
  check('Main Store stock increased by GRN', mainMat1?.quantity === P1, JSON.stringify(mainMat1));
  r = await api('main', 'POST', '/invoices', { supplier: supplier._id, po: po._id, grn: grn._id, amount: total });
  check('Invoice recorded', r.status === 201, JSON.stringify(r.data));
  const inv = r.data.data;
  check('Director notified of invoice', (await notifs('dir', 'Invoice_submitted')).length === 1);
  r = await api('dir', 'GET', '/invoices');
  const fullInv = r.data.data.find(x => x._id === inv._id);
  check('Registry row carries its GRN', fullInv?.grn?.grnNumber === grn.grnNumber && fullInv?.po?.totalAmount === total, JSON.stringify(fullInv?.grn));
  check('Full delivery: no warnings', fullInv?.deliveryCheck?.status === 'Full' && fullInv.deliveryCheck.warnings.length === 0 && fullInv.deliveryCheck.lines.length === 2 && fullInv.deliveryCheck.acceptedValue === total, JSON.stringify(fullInv?.deliveryCheck));
  r = await api('buy', 'POST', '/payments/record', { invoiceId: inv._id, method: 'Cash' });
  check('Payment blocked before Director approval', r.status === 400, JSON.stringify(r.data));
  r = await api('dir', 'PUT', `/invoices/${inv._id}/approve-payment`, {});
  check('Invoice approved by Director', r.status === 200);
  check('Purchase Manager notified invoice approved', (await notifs('buy', 'Invoice_approved')).length === 1);
  r = await api('dir', 'PUT', `/invoices/${inv._id}/approve-payment`, {});
  check('Second approval rejected', r.status === 400);
  const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const today = now.toISOString().substring(0, 10);
  r = await api('main', 'POST', '/payments/record', { invoiceId: inv._id, method: 'Cash' });
  check('Main Store cannot record payment', r.status === 403, String(r.status));
  r = await api('buy', 'POST', '/payments/record', { invoiceId: inv._id, method: 'Cheque' });
  check('Cheque without number rejected', r.status === 400);
  r = await api('buy', 'POST', '/payments/record', { invoiceId: inv._id, method: 'Cheque', reference: '004512', bankName: 'Commercial Bank', chequeDate: today, paidAt: today });
  check('Cheque payment recorded', r.status === 201, JSON.stringify(r.data));
  r = await api('buy', 'POST', '/payments/record', { invoiceId: inv._id, method: 'Cash' });
  check('Double payment rejected', r.status === 400);
  r = await api('buy', 'GET', '/invoices');
  const paidInv = r.data.data.find(x => x._id === inv._id);
  check('Invoice is Paid via Cheque', paidInv.status === 'Paid' && paidInv.paymentMethod === 'Cheque', JSON.stringify(paidInv));
  r = await api('dir', 'PUT', `/invoices/${inv._id}/reject-payment`, { rejectionReason: 'x' });
  check('Paid invoice cannot be rejected', r.status === 400);
  check('Director notified of payment', (await notifs('dir', 'PAYMENT_RECORDED')).length === 1);
  r = await api('buy', 'GET', `/payments/${po._id}/receipt`);
  check('Receipt shows cheque details', r.data.data?.method === 'Cheque' && r.data.data?.reference === '004512', JSON.stringify(r.data));
  r = await api('buy', 'GET', `/payments/${po._id}/receipt/download`);
  check('Receipt PDF downloads', r.status === 200 && r.data._binary > 1000, JSON.stringify(r.data));
  r = await api('buy', 'GET', `/payments/${new mongoose.Types.ObjectId()}/receipt`);
  check('No fake receipt for unpaid PO', r.status === 404);
  r = await api('buy', 'GET', '/payments/report');
  check('Payment report PDF', r.status === 200 && r.data._binary > 1000);
  r = await api('dir', 'GET', '/payments');
  check('Payments list', r.data.count === 1 && r.data.data[0].status === 'paid', JSON.stringify(r.data).slice(0, 200));

  console.log('\n[Site request -> MTN in transit -> receipt]');
  const sid = String(project._id);
  r = await api('site', 'POST', '/material-requests', { requiredDate: new Date(), materials: [{ materialName: im1.materialName, quantity: 60 }] });
  check('Site Store request created', r.status === 201, JSON.stringify(r.data));
  const ssr = r.data.data;
  check('Request is for the general Site Store, not a project', ssr.siteStoreId === null && ssr.siteStoreName === 'Site Store', JSON.stringify(ssr));
  check('Main Store notified of site request', (await notifs('main', 'SSR_SUBMITTED')).length === 1);
  r = await api('main', 'POST', '/material-transfer-notes', { sourceRequestId: ssr._id, transferDate: new Date(), materials: [{ materialName: im1.materialName, quantity: 60, unit: im1.unit }] });
  check('MTN issued In Transit', r.status === 201 && r.data.data.status === 'In Transit', JSON.stringify(r.data));
  const mtn = r.data.data;
  r = await api('main', 'GET', '/inventory?location=MainStore');
  check('Main Store stock deducted on issue', r.data.find(x => x.name === im1.materialName).quantity === P1 - 60);
  r = await api('site', 'GET', `/site/inventory`);
  check('Site stock NOT increased before receipt', r.data.length === 0, JSON.stringify(r.data));
  check('Requester notified of transfer', (await notifs('site', 'SSR_TRANSFERRED')).length === 1);
  check('Low stock -> Purchase Manager', (await notifs('buy', 'LOW_STOCK')).length === 1, String((await notifs('buy', 'LOW_STOCK')).length));
  r = await api('main', 'POST', `/material-transfer-notes/${mtn._id}/receive`);
  check('Main Store cannot confirm site receipt', r.status === 403, String(r.status));
  r = await api('site', 'GET', '/material-transfer-notes');
  check('Site Store sees its in-transit MTN', r.data.data.length === 1 && r.data.data[0].status === 'In Transit');
  r = await api('site', 'POST', `/material-transfer-notes/${mtn._id}/receive`);
  check('Site Store confirms receipt', r.status === 200 && r.data.data.status === 'Received', JSON.stringify(r.data));
  r = await api('site', 'POST', `/material-transfer-notes/${mtn._id}/receive`);
  check('Double receipt rejected', r.status === 400);
  r = await api('site', 'GET', `/site/inventory`);
  check('Site inventory updated on receipt', r.data.length === 1 && r.data[0].quantity === 60 && !r.data[0].projectId, JSON.stringify(r.data));
  const siteMat1 = r.data[0];
  check('Main Store notified of receipt', (await notifs('main', 'MTN_RECEIVED')).length === 1);

  console.log('\n[Ad hoc transfer + adjustment]');
  r = await api('main', 'GET', '/inventory?location=MainStore');
  const mainMat2 = r.data.find(x => x.name === im2.materialName);
  r = await api('main', 'POST', '/inventory/adjustments', { materialId: mainMat2._id, physicalCount: 40, reason: 'Physical count' });
  check('Stock adjustment', r.status === 201 && r.data.material.quantity === 40, JSON.stringify(r.data).slice(0, 200));
  r = await api('main', 'POST', '/material-transfer-notes', { transferDate: new Date(), materials: [{ materialName: im2.materialName, quantity: 999, unit: im2.unit }] });
  check('Transfer above stock rejected', r.status === 400);
  r = await api('main', 'POST', '/material-transfer-notes', { transferDate: new Date(), materials: [{ materialName: im2.materialName, quantity: 30, unit: im2.unit }] });
  check('Ad hoc MTN issued', r.status === 201, JSON.stringify(r.data));
  check('Site Store notified of ad hoc transfer', (await notifs('site', 'MTN_ISSUED')).length === 1);
  r = await api('site', 'POST', `/material-transfer-notes/${r.data.data._id}/receive`);
  check('Ad hoc MTN received', r.status === 200);
  r = await api('site', 'GET', `/site/inventory`);
  const siteMat2 = r.data.find(x => x.name === im2.materialName);
  check('Second material at site', siteMat2?.quantity === 30, JSON.stringify(r.data));

  console.log('\n[MIN issue to project, planned vs actual, overuse]');
  r = await api('site', 'POST', '/site/material-usage', { projectId: sid, materialId: siteMat1._id, quantity: 25, activity: 'Slab concreting' });
  check('MIN issue recorded', r.status === 201 && /^MIN-/.test(r.data.data.minNumber), JSON.stringify(r.data));
  check('Within plan: no warning', r.data.warning === '' && r.data.summary.plannedQty === P1 && r.data.summary.cumulativeActual === 25, JSON.stringify(r.data.summary));
  r = await api('site', 'POST', '/site/material-usage', { projectId: sid, materialId: siteMat1._id, quantity: 9999, activity: 'x' });
  check('Issue above site stock rejected', r.status === 400);
  r = await api('main', 'POST', '/site/material-usage', { projectId: sid, materialId: siteMat1._id, quantity: 1, activity: 'x' });
  check('Main Store cannot issue from site', r.status === 403, String(r.status));
  r = await api('site', 'POST', '/site/material-usage', { projectId: sid, materialId: siteMat2._id, quantity: 8, activity: 'Plastering' });
  check('Usage 8/10 no warning', r.data.warning === '', r.data.warning);
  r = await api('site', 'POST', '/site/material-usage', { projectId: sid, materialId: siteMat2._id, quantity: 7, activity: 'Plastering' });
  check('Usage 15/10 flags overuse of 5', r.data.summary?.overuseQty === 5 && r.data.warning.length > 0, JSON.stringify(r.data.summary));
  check('PM notified of overuse', (await notifs('pm', 'USAGE_EXCEEDS_BOM')).length === 1);
  r = await api('site', 'GET', `/site/inventory`);
  check('Site stock reduced by usage', r.data.find(x => x.name === im1.materialName).quantity === 35 && r.data.find(x => x.name === im2.materialName).quantity === 15, JSON.stringify(r.data.map(x => [x.name, x.quantity])));

  console.log('\n[Shared Site Store stock -> a second project]');
  const project2 = await Project.create({ projectId: 'PRJ-E2E-002', projectName: 'E2E Bridge', clientName: 'Client', location: 'Kandy', startDate: new Date(), expectedEndDate: new Date(Date.now() + 9e9), budget: 1000000, createdBy: users.pm._id, status: 'Active' });
  r = await api('site', 'POST', '/site/material-usage', { projectId: String(project2._id), materialId: siteMat1._id, quantity: 5, activity: 'Pier formwork' });
  check('Same site stock issued to another project', r.status === 201 && r.data.data.projectName === 'E2E Bridge', JSON.stringify(r.data));
  r = await api('site', 'GET', '/site/inventory');
  check('Shared stock reduced by both projects', r.data.find(x => x.name === im1.materialName).quantity === 30, JSON.stringify(r.data.map(x => [x.name, x.quantity])));
  r = await api('site', 'POST', '/material-requests', { requiredDate: new Date(), materials: [{ materialName: im1.materialName, quantity: 10 }] });
  check('New request snapshots shared site stock', r.status === 201 && r.data.data.materials[0].availableAtSite === 30, JSON.stringify(r.data));

  console.log('\n[Reports]');
  r = await api('dir', 'GET', '/material-usage/variance');
  const v1 = r.data.report.find(x => x.materialName === im1.materialName), v2 = r.data.report.find(x => x.materialName === im2.materialName);
  check('BOM vs Actual: within plan row', v1 && v1.plannedQty === P1 && v1.actualQty === 25 && v1.status === 'Within Plan', JSON.stringify(v1));
  check('BOM vs Actual: overused row', v2 && v2.varianceQty === 5 && v2.variancePct === 50 && v2.status === 'Overused' && v2.severity === 'Significant', JSON.stringify(v2));
  r = await api('dir', 'GET', `/material-usage?projectId=${sid}`);
  check('Usage history (3 records)', r.data.count === 3, String(r.data.count));
  r = await api('main', 'GET', '/inventory/stock-ledger');
  const types = new Set(r.data.data.map(x => x.type));
  check('Stock ledger has all movement types', ['GRN Receipt', 'MTN Transfer Out', 'MTN Transfer In', 'Usage', 'Adjustment'].every(t => types.has(t)), [...types].join(','));
  r = await api('buy', 'GET', '/inventory/notifications');
  check('Low-stock warnings list', r.data.success === true, JSON.stringify(r.data).slice(0, 200));
  r = await api('buy', 'GET', '/notifications');
  check('Purchase Manager notification feed', r.data.count >= 4, String(r.data.count));

  console.log('\n[Invoice vs PO vs GRN: short, damaged and over-billed delivery]');
  const items2 = [
    { materialName: im1.materialName, quantity: 100, unit: im1.unit, unitPrice: 100 },
    { materialName: im2.materialName, quantity: 20, unit: im2.unit, unitPrice: 100 }
  ];
  r = await api('buy', 'POST', '/purchase-orders', { supplier: String(supplier._id), items: items2, totalAmount: 12000 });
  check('Second PO created', r.status === 201, JSON.stringify(r.data));
  const po2 = r.data.data;
  await api('dir', 'PUT', `/purchase-orders/${po2._id}/approve`, {});
  await api('buy', 'PUT', `/purchase-orders/${po2._id}/status`, { status: 'Sent' });
  r = await api('main', 'POST', '/inventory/grn', { poReference: po2.poNumber, supplier: 'E2E Supplier', receivedBy: 'E2E Main', items: [
    { materialName: im1.materialName, expectedQty: 100, receivedQty: 80 },
    { materialName: im2.materialName, expectedQty: 20, receivedQty: 20, condition: 'Damaged', damagedQty: 5 }
  ] });
  check('Short + damaged GRN recorded as Partial', r.status === 201 && r.data.grn.status === 'Partial', JSON.stringify(r.data).slice(0, 300));
  const grn2 = r.data.grn;
  r = await api('main', 'POST', '/invoices', { supplier: supplier._id, po: po2._id, grn: grn2._id, amount: 12000 });
  check('Invoice recorded against partial GRN', r.status === 201, JSON.stringify(r.data));
  const inv2 = r.data.data;
  r = await api('dir', 'GET', `/invoices/${inv2._id}`);
  const dc = r.data.data?.deliveryCheck;
  check('Partial delivery flagged', dc?.status === 'Partial' && dc.acceptedValue === 9500, JSON.stringify(dc));
  check('Short line shows ordered vs received', dc?.lines?.[0]?.orderedQty === 100 && dc.lines[0].receivedQty === 80, JSON.stringify(dc?.lines?.[0]));
  check('Damaged line shows accepted qty', dc?.lines?.[1]?.damagedQty === 5 && dc.lines[1].acceptedQty === 15, JSON.stringify(dc?.lines?.[1]));
  check('Warnings: short, damaged, amount above accepted value', dc?.warnings?.length === 3 && /short/.test(dc.warnings[0]) && /damaged/.test(dc.warnings[1]) && /goods accepted/.test(dc.warnings[2]), JSON.stringify(dc?.warnings));
  r = await api('main', 'POST', '/invoices', { supplier: supplier._id, po: po2._id, grn: grn2._id, amount: 13000 });
  r = await api('dir', 'GET', `/invoices/${r.data.data._id}`);
  check('Amount above PO total flagged', r.data.data?.deliveryCheck?.warnings?.some(w => /higher than the PO total/.test(w)), JSON.stringify(r.data.data?.deliveryCheck?.warnings));
  r = await api('dir', 'PUT', `/invoices/${inv2._id}/approve-payment`, {});
  check('Director can still approve a flagged invoice', r.status === 200, JSON.stringify(r.data));

  console.log('\n[Partial delivery, damaged stock, status guards, Director feed]');
  r = await api('main', 'GET', `/inventory/stock-ledger?type=${encodeURIComponent('GRN Receipt')}`);
  const dmgMove = r.data.data.find(e => e.reference === grn2.grnNumber && e.materialName === im2.materialName);
  check('Damaged units kept out of stock (15 of 20)', dmgMove?.inQty === 15, JSON.stringify(dmgMove));
  r = await api('buy', 'GET', `/purchase-orders/${po2._id}`);
  check('PO stays Sent after a partial delivery', r.data.data.status === 'Sent' && r.data.data.receivedQty === 100, JSON.stringify({ s: r.data.data.status, q: r.data.data.receivedQty }));
  r = await api('main', 'POST', '/inventory/grn', { poReference: po2.poNumber, supplier: 'E2E Supplier', receivedBy: 'E2E Main', items: [
    { materialName: im1.materialName, expectedQty: 20, receivedQty: 50 }
  ] });
  check('GRN above the outstanding balance rejected', r.status === 400 && /outstanding/.test(r.data.message || ''), JSON.stringify(r.data));
  r = await api('main', 'POST', '/inventory/grn', { poReference: po2.poNumber, supplier: 'E2E Supplier', receivedBy: 'E2E Main', items: [
    { materialName: im1.materialName, expectedQty: 20, receivedQty: 20 }
  ] });
  check('Second GRN for the outstanding balance is Verified', r.status === 201 && r.data.grn.status === 'Verified', JSON.stringify(r.data).slice(0, 300));
  r = await api('buy', 'GET', `/purchase-orders/${po2._id}`);
  check('PO Delivered once deliveries add up', r.data.data.status === 'Delivered' && r.data.data.receivedQty === 120 && !!r.data.data.actualDeliveryDate, JSON.stringify({ s: r.data.data.status, q: r.data.data.receivedQty, d: r.data.data.actualDeliveryDate }));
  r = await api('dir', 'PUT', `/purchase-orders/${po2._id}/approve`, {});
  check('Delivered PO cannot be re-approved', r.status === 400, JSON.stringify(r.data));
  r = await api('buy', 'POST', '/purchase-orders', { supplier: String(supplier._id), items: items2, totalAmount: 12000 });
  const po3 = r.data.data;
  r = await api('main', 'POST', '/inventory/grn', { poReference: po3.poNumber, supplier: 'E2E Supplier', receivedBy: 'E2E Main', items: [
    { materialName: im1.materialName, expectedQty: 100, receivedQty: 100 }
  ] });
  check('GRN against an unsent PO rejected', r.status === 400, JSON.stringify(r.data));
  r = await api('dir', 'PUT', `/purchase-orders/${po3._id}/reject`, { rejectionReason: 'e2e' });
  check('Pending PO can be rejected', r.status === 200, JSON.stringify(r.data));
  r = await api('dir', 'PUT', `/purchase-orders/${po3._id}/approve`, {});
  check('Rejected PO cannot be approved', r.status === 400, JSON.stringify(r.data));
  r = await api('dir', 'PUT', `/bom/${bomId}/reject`, { rejectionReason: 'e2e' });
  check('Approved BOM cannot be rejected', r.status === 400, JSON.stringify(r.data));
  r = await api('main', 'GET', '/bom/stock-summary');
  const bomSummary = r.data.data?.[bomId];
  check('BOM stock summary lists the approved BOM', r.status === 200 && bomSummary && bomSummary.shortageCount >= 0 && bomSummary.toRequestCount <= bomSummary.shortageCount, JSON.stringify(r.data).slice(0, 200));
  r = await api('dir', 'GET', '/notifications');
  check('Director feed shows payment notification', r.data.data.some(n => n.type === 'PAYMENT_RECORDED'), r.data.data.map(n => n.type).join(','));

  console.log('[Invoice file re-upload, PO validation, paged lists]');
  r = await api('main', 'GET', '/invoices');
  check('Invoice without a file is flagged', r.data.data.find(x => x._id === inv._id)?.fileExists === false);
  const fd = new FormData();
  fd.append('file', new Blob(['%PDF-1.4 e2e'], { type: 'application/pdf' }), 'e2e-invoice.pdf');
  let up = await fetch(`${base}/invoices/${inv._id}/reupload`, { method: 'PUT', headers: { Authorization: `Bearer ${tokens.main}` }, body: fd });
  const upData = await up.json();
  check('Invoice file re-uploaded', up.status === 200 && upData.data?.fileExists === true, JSON.stringify(upData));
  r = await api('dir', 'GET', '/invoices');
  const reInv = r.data.data.find(x => x._id === inv._id);
  check('Re-uploaded file is visible to the Director with its delivery check', reInv?.fileExists === true && !!reInv?.deliveryCheck, JSON.stringify(reInv?.file));
  // The upload lands in the real uploads folder, so remove the test file again.
  if (upData.data?.file?.url) {
    const { UPLOAD_DIR } = await imp('config/uploadDir.js');
    fs.rmSync(path.join(UPLOAD_DIR, path.basename(upData.data.file.url)), { force: true });
  }
  r = await api('buy', 'POST', '/purchase-orders', { supplier: String(supplier._id), items: [], totalAmount: 0 });
  check('PO without items rejected', r.status === 400, JSON.stringify(r.data));
  r = await api('buy', 'GET', '/purchase-orders?page=1&limit=1');
  check('Paged PO list returns one row and the page count', r.data.data?.length === 1 && r.data.totalPages >= 2, JSON.stringify({ n: r.data.data?.length, tp: r.data.totalPages }));
  r = await api('buy', 'GET', '/invoices?page=1&limit=1');
  check('Paged invoice list returns one row and the page count', r.data.data?.length === 1 && r.data.totalPages >= 2, JSON.stringify({ n: r.data.data?.length, tp: r.data.totalPages }));

  console.log('[PO from selected PR items, supplier bank account]');
  r = await api('buy', 'POST', '/purchase-orders', { prId: pr._id, supplier: String(supplier._id), items: [items[0]], totalAmount: 1 });
  check('PO from one selected PR item, total recalculated', r.status === 201 && r.data.data?.items?.length === 1 && r.data.data.totalAmount === items[0].quantity * 100, JSON.stringify({ s: r.status, t: r.data.data?.totalAmount, m: r.data.message }));
  r = await api('buy', 'POST', '/purchase-orders', { prId: pr._id, supplier: String(supplier._id), items: [{ materialName: 'Not On This Request', quantity: 1, unit: 'bag', unitPrice: 1 }], totalAmount: 1 });
  check('PO item outside its Purchase Request rejected', r.status === 400 && /not part of Purchase Request/.test(r.data.message || ''), JSON.stringify(r.data));
  const badAcc = await Supplier.create({ name: 'E2E Bad Account', phone: '0711234568', category: 'Other', supplierId: 'SUP-E2E-BAD', accountNumber: 'AB-12' }).then(() => null, e => e);
  check('Supplier bank account with letters rejected', !!badAcc && /numeric digits/.test(badAcc.message), String(badAcc && badAcc.message));
  const okAcc = await Supplier.create({ name: 'E2E Good Account', phone: '0711234569', category: 'Other', supplierId: 'SUP-E2E-OK', accountNumber: '8001234567' }).then(d => d, e => e);
  check('Supplier bank account with 10 digits accepted', okAcc?.accountNumber === '8001234567', String(okAcc && okAcc.message));
} catch (err) {
  fail++;
  console.log('ERROR', err.stack || err);
} finally {
  if (mongoose.connection.name === TEST_DB) {
    await mongoose.connection.dropDatabase();
    console.log('\ndropped', TEST_DB);
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
