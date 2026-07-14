import mongoose from 'mongoose';
import { seedDatabase } from '../utils/seeder.js';

// Old seeder used role names that never matched the real userModel.js role enum
// (StoreOfficer/SiteStorekeeper vs. the actual MainStoreOfficer/SiteStoreOfficer).
// Any Role/Permission documents created under those stale names are renamed here
// so the permission matrix actually matches the roles real users have.
const ROLE_RENAMES = [
  ['StoreOfficer', 'MainStoreOfficer'],
  ['SiteStorekeeper', 'SiteStoreOfficer']
];

// PurchaseOfficer was consolidated into PurchaseManager (which already carries
// every permission PurchaseOfficer had, plus more). Users were migrated below;
// this purges the leftover Role/Permission rows so the role stops showing up
// as a separate profile in Roles & Permissions.
const removeDeprecatedPurchaseOfficerRole = async () => {
  const Role = (await import('../models/Role.js')).default;
  const Permission = (await import('../models/Permission.js')).default;

  const deletedRole = await Role.deleteOne({ name: 'PurchaseOfficer' });
  const deletedPerms = await Permission.deleteMany({ role: 'PurchaseOfficer' });

  if (deletedRole.deletedCount > 0 || deletedPerms.deletedCount > 0) {
    console.log(`[Migration] Removed deprecated PurchaseOfficer role (${deletedRole.deletedCount} role, ${deletedPerms.deletedCount} permission entries).`);
  }
};

const fixStaleRoleNames = async () => {
  const Role = (await import('../models/Role.js')).default;
  const Permission = (await import('../models/Permission.js')).default;

  for (const [oldName, newName] of ROLE_RENAMES) {
    const oldRole = await Role.findOne({ name: oldName });
    if (oldRole) {
      const newRoleExists = await Role.findOne({ name: newName });
      if (newRoleExists) {
        await Role.deleteOne({ _id: oldRole._id });
      } else {
        oldRole.name = newName;
        await oldRole.save();
      }
      console.log(`[Migration] Renamed Role "${oldName}" to "${newName}"`);
    }

    const oldPerms = await Permission.find({ role: oldName });
    for (const perm of oldPerms) {
      const newPermExists = await Permission.findOne({ role: newName, module: perm.module });
      if (newPermExists) {
        await Permission.deleteOne({ _id: perm._id });
      } else {
        perm.role = newName;
        await perm.save();
      }
    }
    if (oldPerms.length > 0) {
      console.log(`[Migration] Renamed ${oldPerms.length} Permission entries from "${oldName}" to "${newName}"`);
    }
  }
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ConstructionDB');
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    try {
      await fixStaleRoleNames();
    } catch (err) {
      console.error('[Migration Error - role/permission rename]:', err.message);
    }

    try {
      await removeDeprecatedPurchaseOfficerRole();
    } catch (err) {
      console.error('[Migration Error - remove PurchaseOfficer role]:', err.message);
    }

    await seedDatabase();

    // Database migration: Update existing PurchaseOfficer users to PurchaseManager
    try {
      const User = (await import('../models/userModel.js')).default;
      const result = await User.updateMany({ role: 'PurchaseOfficer' }, { role: 'PurchaseManager' });
      if (result.modifiedCount > 0) {
        console.log(`[Migration] Migrated ${result.modifiedCount} users from PurchaseOfficer to PurchaseManager in userModel.`);
      }
    } catch (err) {
      console.error('[Migration Error - userModel]:', err.message);
    }

    // Database migration: Update existing users still carrying the legacy
    // StoreOfficer/SiteStorekeeper role names to their canonical equivalents
    // (MainStoreOfficer/SiteStoreOfficer). This must run so these users keep
    // matching Permission entries after fixStaleRoleNames() consolidates the
    // Role/Permission documents above - otherwise they'd be left pointing at
    // a role name with no permissions at all.
    try {
      const User = (await import('../models/userModel.js')).default;
      for (const [oldName, newName] of ROLE_RENAMES) {
        const result = await User.updateMany({ role: oldName }, { role: newName });
        if (result.modifiedCount > 0) {
          console.log(`[Migration] Migrated ${result.modifiedCount} users from ${oldName} to ${newName} in userModel.`);
        }
      }
    } catch (err) {
      console.error('[Migration Error - userModel store role rename]:', err.message);
    }
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    console.warn(`Please ensure MongoDB is running locally on 127.0.0.1:27017, or configure MONGO_URI in your backend/.env file.`);
    console.log('Retrying MongoDB connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

export default connectDB;
