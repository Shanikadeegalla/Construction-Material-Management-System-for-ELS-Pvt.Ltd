// End-to-end check of the PM dashboard KPI endpoint (GET /api/projects/pm-stats)
// against a throwaway database. Run with cwd = backend.
import { pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';

const TEST_DB = 'ConstructionDB_e2e_pmstats_tmp';
const envText = fs.readFileSync('.env', 'utf8');
const uri = envText.match(/^MONGO_URI=(.*)$/m)[1].trim();
const m = uri.match(/^(mongodb(?:\+srv)?:\/\/[^/]+)\/([^?]*)(\?.*)?$/);
if (!m) throw new Error('Could not parse MONGO_URI');
if (m[2] === TEST_DB) throw new Error('refusing: already test db');
process.env.MONGO_URI = `${m[1]}/${TEST_DB}${m[3] || ''}`;
process.env.PORT = '5078';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
process.env.NODE_ENV = 'test';

const imp = (rel) => import(pathToFileURL(path.resolve(rel)).href);
const mongoose = (await imp('node_modules/mongoose/index.js')).default;
await imp('server.js');
const User = (await imp('models/userModel.js')).default;
const Project = (await imp('models/Project.js')).default;
const BOM = (await imp('models/BOM.js')).default;
const ItemMaster = (await imp('models/ItemMaster.js')).default;
const Permission = (await imp('models/Permission.js')).default;

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

  const base = 'http://localhost:5078/api';
  const roles = { dir: 'Director', pm: 'ProjectManager', pm2: 'ProjectManager', site: 'SiteStoreOfficer' };
  const users = {}, tokens = {};
  for (const [k, role] of Object.entries(roles)) {
    users[k] = await User.create({ name: `E2E ${k}`, email: `e2e_${k}@test.lk`, password: 'Test@12345', role, employeeId: `E2E-${k}` });
    const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `e2e_${k}@test.lk`, password: 'Test@12345' }) });
    const d = await r.json();
    tokens[k] = d.data?.token;
    if (!tokens[k]) throw new Error('login failed for ' + k + ': ' + JSON.stringify(d));
  }
  const api = async (who, method, url, body) => {
    const res = await fetch(`${base}${url}`, { method, headers: { 'Content-Type': 'application/json', ...(who ? { Authorization: `Bearer ${tokens[who]}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const ct = res.headers.get('content-type') || '';
    return { status: res.status, data: ct.includes('json') ? await res.json() : {} };
  };
  const stats = async (who) => (await api(who, 'GET', '/projects/pm-stats')).data.data || {};
  const show = (s) => JSON.stringify(s);

  let n = 0;
  const mkProject = (owner, status) => Project.create({
    projectId: `PRJ-E2E-${++n}`, projectName: `E2E Project ${n}`, clientName: 'Client', location: 'Colombo',
    startDate: new Date(), expectedEndDate: new Date(Date.now() + 9e9), budget: 5000000, createdBy: users[owner]._id, status
  });

  let s = await stats('pm');
  check('No projects -> both cards are 0', s.activeProjects === 0 && s.pendingBomApprovals === 0, show(s));

  // PM 1: 2 Active, 1 each of the non-active statuses. PM 2: 1 Active.
  const a1 = await mkProject('pm', 'Active');
  const a2 = await mkProject('pm', 'Active');
  const planning = await mkProject('pm', 'Planning');
  await mkProject('pm', 'On Hold');
  await mkProject('pm', 'Completed');
  const other = await mkProject('pm2', 'Active');

  s = await stats('pm');
  check('Active Projects counts only Active status', s.activeProjects === 2, show(s));
  s = await stats('pm2');
  check('Active Projects is scoped to the logged-in PM', s.activeProjects === 1, show(s));

  const list = await api('pm', 'GET', '/projects');
  check('Card agrees with the project list the PM sees', list.data.data.filter(p => p.status === 'Active').length === 2);

  const [im] = await ItemMaster.find({ status: 'Active' }).limit(1);
  const bomBody = (project, status) => ({ projectId: project._id, status, materials: [{ materialId: im._id, plannedQty: 5 }] });

  let r = await api('pm', 'POST', '/bom', bomBody(a1, 'Draft'));
  s = await stats('pm');
  check('Draft BOM is not counted as pending', r.data.success && s.pendingBomApprovals === 0, show(s));

  r = await api('pm', 'POST', '/bom', bomBody(a1, 'Submitted'));
  const bom1 = r.data.data;
  s = await stats('pm');
  check('Submitting the BOM makes it pending', bom1?.status === 'Submitted' && s.pendingBomApprovals === 1, show(s));

  r = await api('pm', 'POST', '/bom', bomBody(a2, 'Submitted'));
  const bom2 = r.data.data;
  r = await api('pm', 'POST', '/bom', bomBody(planning, 'Submitted'));
  const bom3 = r.data.data;
  s = await stats('pm');
  check('Three submitted BOMs -> 3 pending', s.pendingBomApprovals === 3, show(s));

  await api('pm2', 'POST', '/bom', bomBody(other, 'Submitted'));
  s = await stats('pm');
  const s2 = await stats('pm2');
  check("Another PM's BOM is not counted", s.pendingBomApprovals === 3 && s2.pendingBomApprovals === 1, show(s) + show(s2));

  r = await api('dir', 'PUT', `/bom/${bom1._id}/approve`, { note: 'ok' });
  s = await stats('pm');
  check('Director approval removes it from pending', r.data.success && s.pendingBomApprovals === 2, show(s));

  r = await api('dir', 'PUT', `/bom/${bom2._id}/reject`, { rejectionReason: 'revise' });
  s = await stats('pm');
  check('Director rejection removes it from pending', r.data.success && s.pendingBomApprovals === 1, show(s));

  r = await api('pm', 'POST', '/bom', bomBody(a2, 'Submitted'));
  s = await stats('pm');
  check('Resubmitting the rejected BOM makes it pending again', r.data.success && s.pendingBomApprovals === 2, show(s));

  await BOM.updateOne({ _id: bom3._id }, { status: 'Pending' });
  s = await stats('pm');
  check("Legacy 'Pending' status still counts as awaiting approval", s.pendingBomApprovals === 2, show(s));

  s = await stats('pm');
  check('Active Projects unchanged by BOM activity', s.activeProjects === 2, show(s));

  r = await api(null, 'GET', '/projects/pm-stats');
  check('No token -> 401', r.status === 401, String(r.status));
  r = await api('site', 'GET', '/projects/pm-stats');
  check('Site Store Officer -> 403', r.status === 403, String(r.status));
  r = await api('dir', 'GET', '/projects/pm-stats');
  check('Director -> 403', r.status === 403, String(r.status));
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
