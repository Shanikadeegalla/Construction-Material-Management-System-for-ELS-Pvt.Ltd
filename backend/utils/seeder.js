import Role from '../models/Role.js';
import Permission from '../models/Permission.js';
import ItemMaster from '../models/ItemMaster.js';
import { materialMasterData } from './materialMasterData.js';

const defaultRoles = [
  { name: 'Admin', description: 'Administrator with full system access and management capabilities.' },
  { name: 'Director', description: 'Company Director responsible for approvals and viewing reports.' },
  { name: 'ProjectManager', description: 'Project Manager responsible for projects, BOM, and PR creation.' },
  { name: 'PurchaseManager', description: 'Purchase Manager responsible for PO and supplier management.' },
  { name: 'MainStoreOfficer', description: 'Main Store Officer responsible for main store inventory, GRN, and stock.' },
  { name: 'SiteStoreOfficer', description: 'Site Store Officer responsible for site inventory and material receipt.' }
];

// Default permission levels reflect what each role can ACTUALLY do in the app today.
// "None" is the only level that denies access at enforcement time; any other level
// (Full/View/Partial/Approve) grants it. Keep these accurate to reality when you add
// new gated routes, or you'll lock roles out of features they currently rely on.
const defaultPermissions = {
  // User Management
  "Create/Edit Users": { Admin: "Full" },
  "View User List": { Admin: "Full" },
  "Audit Logs": { Admin: "Full" },

  // Project Management
  "Create Project": { Admin: "Full", ProjectManager: "Full" },
  "View Projects": { Admin: "Full", Director: "Full", ProjectManager: "Full", MainStoreOfficer: "Full", SiteStoreOfficer: "Full" },
  "BOM Creation": { Admin: "Full", ProjectManager: "Full" },
  "BOM Approval": { Admin: "Full", Director: "Full" },

  // Procurement
  "Create PR": { Admin: "Full", MainStoreOfficer: "Full" },
  "Create PO": { Admin: "Full", PurchaseManager: "Full" },
  "Approve PO": { Admin: "Full", Director: "Full" },
  "Manage PO Lifecycle": { Admin: "Full", PurchaseManager: "Full" },
  "Supplier Management": { Admin: "Full" },

  // Inventory & Stores
  "Create GRN": { Admin: "Full", MainStoreOfficer: "Full" },
  "View Stock": { Admin: "Full", Director: "Full", ProjectManager: "Full", PurchaseManager: "Full", MainStoreOfficer: "Full", SiteStoreOfficer: "Full" },
  "Issue Materials": { Admin: "Full", MainStoreOfficer: "Full" },
  "Stock Adjustments": { Admin: "Full", MainStoreOfficer: "Full" },
  "Manage Materials": { Admin: "Full", MainStoreOfficer: "Full" },
  "Manage Item Master": { Admin: "Full", MainStoreOfficer: "Full" },
  "Log Material Usage": { Admin: "Full", SiteStoreOfficer: "Full" },
  "Confirm Material Receipt": { Admin: "Full", SiteStoreOfficer: "Full" },

  // Reports & Analytics
  "View Reports": { Admin: "Full", Director: "Full", ProjectManager: "Full" },
  "Export PDF/Excel": { Admin: "Full", Director: "Full", ProjectManager: "Full", PurchaseManager: "Full" },

  // System Administration
  "Manage Roles & Permissions": { Admin: "Full" }
};

const ALL_ROLE_NAMES = defaultRoles.map(r => r.name);

export const seedDatabase = async () => {
  try {
    for (const r of defaultRoles) {
      const exists = await Role.findOne({ name: r.name });
      if (!exists) {
        await Role.create(r);
        console.log(`Seeded Role: ${r.name}`);
      }
    }

    for (const [moduleName, permMap] of Object.entries(defaultPermissions)) {
      for (const role of ALL_ROLE_NAMES) {
        const level = permMap[role] || "None";
        const exists = await Permission.findOne({ role, module: moduleName });
        if (!exists) {
          await Permission.create({ role, module: moduleName, permissionLevel: level });
        }
      }
    }
    let seededMaterials = 0;
    for (const item of materialMasterData) {
      const exists = await ItemMaster.findOne({ materialCode: item.materialCode });
      if (!exists) {
        await ItemMaster.create(item);
        seededMaterials++;
      }
    }
    if (seededMaterials > 0) {
      console.log(`Seeded ${seededMaterials} Item Master material(s).`);
    }

    console.log("Seeding process completed!");
  } catch (error) {
    console.error("Seeding database failed:", error);
  }
};
