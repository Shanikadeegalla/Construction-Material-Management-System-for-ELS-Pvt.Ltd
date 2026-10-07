import mongoose from 'mongoose';
import User from '../models/userModel.js';

export const canonicalTestUsers = [
  {
    name: 'System Admin',
    email: 'admin@elslanka.com',
    role: 'Admin',
    password: 'Password123!',
    employeeId: 'EMP-0001'
  },
  {
    name: 'Executive Director',
    email: 'director@elslanka.com',
    role: 'Director',
    password: 'Password123!',
    employeeId: 'EMP-0002'
  },
  {
    name: 'Project Manager',
    email: 'pm@elslanka.com',
    role: 'ProjectManager',
    password: 'Password123!',
    employeeId: 'EMP-0003'
  },
  {
    name: 'Purchase Manager',
    email: 'purchase@elslanka.com',
    role: 'PurchaseManager',
    password: 'Password123!',
    employeeId: 'EMP-0004'
  },
  {
    name: 'Main Store Officer',
    email: 'mainstore@elslanka.com',
    role: 'MainStoreOfficer',
    password: 'Password123!',
    employeeId: 'EMP-0005'
  },
  {
    name: 'Site Store Officer',
    email: 'sitestore@elslanka.com',
    role: 'SiteStoreOfficer',
    password: 'Password123!',
    employeeId: 'EMP-0006'
  },
  // Secondary standard aliases (@els.com)
  {
    name: 'Admin Alias',
    email: 'admin@els.com',
    role: 'Admin',
    password: 'Password123!',
    employeeId: 'EMP-0007'
  },
  {
    name: 'Director Alias',
    email: 'director@els.com',
    role: 'Director',
    password: 'Password123!',
    employeeId: 'EMP-0008'
  },
  {
    name: 'Project Manager Alias',
    email: 'pm@els.com',
    role: 'ProjectManager',
    password: 'Password123!',
    employeeId: 'EMP-0009'
  },
  {
    name: 'Purchase Manager Alias',
    email: 'purchase@els.com',
    role: 'PurchaseManager',
    password: 'Password123!',
    employeeId: 'EMP-0010'
  },
  {
    name: 'Main Store Alias',
    email: 'store@els.com',
    role: 'MainStoreOfficer',
    password: 'Password123!',
    employeeId: 'EMP-0011'
  },
  {
    name: 'Site Store Alias',
    email: 'sitestore@els.com',
    role: 'SiteStoreOfficer',
    password: 'Password123!',
    employeeId: 'EMP-0012'
  }
];

export const ensureDefaultUsersExist = async () => {
  const seededSummary = [];

  for (const tu of canonicalTestUsers) {
    const cleanEmail = tu.email.toLowerCase().trim();
    let user = await User.findOne({ email: cleanEmail });

    if (!user) {
      user = new User({
        name: tu.name.trim(),
        email: cleanEmail,
        password: tu.password,
        role: tu.role,
        status: true,
        employeeId: tu.employeeId
      });
      await user.save();
    } else {
      // Ensure role, status and password are aligned and valid
      user.name = tu.name.trim();
      user.role = tu.role;
      user.status = true;
      user.password = tu.password;
      await user.save();
    }

    const verified = await user.matchPassword(tu.password);
    seededSummary.push({
      Role: user.role,
      Email: user.email,
      Password: tu.password,
      Verified: verified ? 'PASS ✅' : 'FAIL ❌'
    });
  }

  return seededSummary;
};
