import mongoose from 'mongoose';
import User from '../models/userModel.js';

export const canonicalTestUsers = [
  {
    name: 'System Admin',
    displayEmail: 'adminO@els.com',
    email: 'adminO@els.com',
    role: 'Admin',
    password: 'admin123',
    employeeId: 'EMP-0001',
    aliases: ['admino@els.com', 'admin@els.com', 'admin@elslanka.com']
  },
  {
    name: 'Executive Director',
    displayEmail: 'director@els.com',
    email: 'director@els.com',
    role: 'Director',
    password: 'dir123',
    employeeId: 'EMP-0002',
    aliases: ['director@els.com', 'director@elslanka.com']
  },
  {
    name: 'Project Manager',
    displayEmail: 'pm@els.com',
    email: 'pm@els.com',
    role: 'ProjectManager',
    password: 'pm123456',
    employeeId: 'EMP-0003',
    aliases: ['pm@els.com', 'pm@elslanka.com']
  },
  {
    name: 'Purchase Manager',
    displayEmail: 'PurchaseManager@els.com',
    email: 'PurchaseManager@els.com',
    role: 'PurchaseManager',
    password: 'Purchase@123',
    employeeId: 'EMP-0004',
    aliases: ['purchasemanager@els.com', 'purchase@els.com', 'purchase@elslanka.com']
  },
  {
    name: 'Main Store Officer',
    displayEmail: 'store@els.com',
    email: 'store@els.com',
    role: 'MainStoreOfficer',
    password: 'store123',
    employeeId: 'EMP-0005',
    aliases: ['store@els.com', 'mainstore@elslanka.com', 'store@elslanka.com']
  },
  {
    name: 'Site Store Officer',
    displayEmail: 'sitestore@els.com',
    email: 'sitestore@els.com',
    role: 'SiteStoreOfficer',
    password: 'site123',
    employeeId: 'EMP-0006',
    aliases: ['sitestore@els.com', 'sitestore@elslanka.com']
  }
];

export const ensureDefaultUsersExist = async () => {
  const seededSummary = [];

  for (const tu of canonicalTestUsers) {
    const primaryCleanEmail = tu.email.toLowerCase().trim();
    const aliasCleanEmails = (tu.aliases || []).map(a => a.toLowerCase().trim());
    const allSearchEmails = Array.from(new Set([primaryCleanEmail, ...aliasCleanEmails]));

    // Find existing users matching primary email or legacy aliases
    let matchingUsers = await User.find({ email: { $in: allSearchEmails } });

    let primaryUser = null;

    if (matchingUsers.length > 0) {
      // Prefer exact match on primary clean email if present
      primaryUser = matchingUsers.find(u => u.email === primaryCleanEmail) || matchingUsers[0];

      primaryUser.name = tu.name.trim();
      primaryUser.email = primaryCleanEmail;
      primaryUser.role = tu.role;
      primaryUser.status = true;
      primaryUser.password = tu.password;

      if (!primaryUser.employeeId && tu.employeeId) {
        const idTaken = await User.findOne({ employeeId: tu.employeeId, _id: { $ne: primaryUser._id } });
        if (!idTaken) {
          primaryUser.employeeId = tu.employeeId;
        }
      }
      await primaryUser.save();

      // Ensure any extra legacy alias user documents found also have password synced & status enabled
      for (const extraUser of matchingUsers) {
        if (extraUser._id.toString() !== primaryUser._id.toString()) {
          extraUser.password = tu.password;
          extraUser.status = true;
          await extraUser.save();
        }
      }
    } else {
      const newUserDoc = {
        name: tu.name.trim(),
        email: primaryCleanEmail,
        password: tu.password,
        role: tu.role,
        status: true
      };
      if (tu.employeeId) {
        const idTaken = await User.findOne({ employeeId: tu.employeeId });
        if (!idTaken) {
          newUserDoc.employeeId = tu.employeeId;
        }
      }
      primaryUser = new User(newUserDoc);
      await primaryUser.save();
    }

    const verified = await primaryUser.matchPassword(tu.password);
    seededSummary.push({
      Role: primaryUser.role,
      Email: tu.displayEmail || primaryUser.email,
      Status: verified ? 'PASS ✅' : 'FAIL ❌'
    });
  }

  return seededSummary;
};
