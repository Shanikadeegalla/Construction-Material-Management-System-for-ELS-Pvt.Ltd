import mongoose from 'mongoose';
import User from '../models/userModel.js';

// The six demo accounts (one per role). No password is written in the code: a missing
// account is created with the password in DEMO_USER_PASSWORD (backend/.env), which must
// follow the password policy. Change each password from the Admin screen afterwards.
export const canonicalTestUsers = [
  {
    name: 'System Admin',
    displayEmail: 'adminO@els.com',
    email: 'adminO@els.com',
    role: 'Admin',
    employeeId: 'EMP-0001',
    aliases: ['admino@els.com', 'admin@els.com', 'admin@elslanka.com']
  },
  {
    name: 'Executive Director',
    displayEmail: 'director@els.com',
    email: 'director@els.com',
    role: 'Director',
    employeeId: 'EMP-0002',
    aliases: ['director@els.com', 'director@elslanka.com']
  },
  {
    name: 'Project Manager',
    displayEmail: 'pm@els.com',
    email: 'pm@els.com',
    role: 'ProjectManager',
    employeeId: 'EMP-0003',
    aliases: ['pm@els.com', 'pm@elslanka.com']
  },
  {
    name: 'Purchase Manager',
    displayEmail: 'PurchaseManager@els.com',
    email: 'PurchaseManager@els.com',
    role: 'PurchaseManager',
    employeeId: 'EMP-0004',
    aliases: ['purchasemanager@els.com', 'purchase@els.com', 'purchase@elslanka.com']
  },
  {
    name: 'Main Store Officer',
    displayEmail: 'store@els.com',
    email: 'store@els.com',
    role: 'MainStoreOfficer',
    employeeId: 'EMP-0005',
    aliases: ['store@els.com', 'mainstore@elslanka.com', 'store@elslanka.com']
  },
  {
    name: 'Site Store Officer',
    displayEmail: 'sitestore@els.com',
    email: 'sitestore@els.com',
    role: 'SiteStoreOfficer',
    employeeId: 'EMP-0006',
    aliases: ['sitestore@els.com', 'sitestore@elslanka.com']
  }
];

// Creates any of the six demo accounts that do not exist yet.
// Existing users are NEVER changed: their passwords, roles and active/deactivated
// status stay exactly as the Admin or the user set them.
const isStrong = (p) => typeof p === 'string' && p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p)
  && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p);

export const ensureDefaultUsersExist = async () => {
  const seededSummary = [];
  const demoPassword = process.env.DEMO_USER_PASSWORD;

  for (const tu of canonicalTestUsers) {
    const primaryCleanEmail = tu.email.toLowerCase().trim();
    const aliasCleanEmails = (tu.aliases || []).map(a => a.toLowerCase().trim());
    const allSearchEmails = Array.from(new Set([primaryCleanEmail, ...aliasCleanEmails]));

    const existing = await User.findOne({ email: { $in: allSearchEmails } });
    if (existing) {
      seededSummary.push({ Role: existing.role, Email: existing.email, Status: 'Exists (unchanged)' });
      continue;
    }

    if (!isStrong(demoPassword)) {
      seededSummary.push({ Role: tu.role, Email: primaryCleanEmail,
        Status: 'Not created: set a strong DEMO_USER_PASSWORD in .env' });
      continue;
    }
    const newUserDoc = {
      name: tu.name.trim(),
      email: primaryCleanEmail,
      password: demoPassword,
      role: tu.role,
      status: true
    };
    if (tu.employeeId && !(await User.findOne({ employeeId: tu.employeeId }))) {
      newUserDoc.employeeId = tu.employeeId;
    }
    const created = new User(newUserDoc);
    await created.save();
    seededSummary.push({ Role: created.role, Email: created.email, Status: 'Created' });
  }

  return seededSummary;
};
