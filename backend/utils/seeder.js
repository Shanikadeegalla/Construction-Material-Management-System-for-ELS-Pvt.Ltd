import Role from '../models/Role.js';
import Permission from '../models/Permission.js';

const defaultRoles = [
  { name: 'Admin', description: 'Administrator with full system access and management capabilities.' },
  { name: 'Director', description: 'Company Director responsible for approvals and viewing reports.' },
  { name: 'ProjectManager', description: 'Project Manager responsible for projects, BOM, and PR creation.' },
  { name: 'PurchaseOfficer', description: 'Purchase Officer responsible for PO and supplier management.' },
  { name: 'StoreOfficer', description: 'Store Officer responsible for main store inventory, GRN, and stock.' },
  { name: 'SiteStorekeeper', description: 'Site Storekeeper responsible for site inventory and material receipt.' }
];

const defaultPermissions = {
  "Create/Edit Users": { Admin: "Full" },
  "View User List": { Admin: "Full", Director: "View" },
  "Audit Logs": { Admin: "Full", Director: "View" },
  
  "Create Project": { Admin: "Full", Director: "Approve", ProjectManager: "Full" },
  "View Projects": { Admin: "Full", Director: "View", ProjectManager: "Partial", PurchaseOfficer: "View" },
  "BOM Creation": { Admin: "Full", ProjectManager: "Full" },
  "BOM Approval": { Admin: "Full", Director: "Approve" },
  
  "Create PR": { Admin: "Full", ProjectManager: "Full", StoreOfficer: "Partial" },
  "Approve PR": { Admin: "Full", ProjectManager: "Approve" },
  "Create PO": { Admin: "Full", PurchaseOfficer: "Full" },
  "Approve PO": { Admin: "Full", Director: "Approve" },
  "Supplier Management": { Admin: "Full", PurchaseOfficer: "Full", Director: "View" },
  
  "Create GRN": { Admin: "Full", StoreOfficer: "Full", SiteStorekeeper: "Partial" },
  "View Stock": { Admin: "Full", Director: "View", ProjectManager: "Partial", PurchaseOfficer: "View", StoreOfficer: "Full", SiteStorekeeper: "Partial" },
  "Issue Materials": { Admin: "Full", StoreOfficer: "Full" },
  "Stock Adjustments": { Admin: "Full", StoreOfficer: "Full" },
  
  "View Reports": { Admin: "Full", Director: "Full", ProjectManager: "Partial", PurchaseOfficer: "Partial", StoreOfficer: "Partial" },
  "Export PDF/Excel": { Admin: "Full", Director: "Full", ProjectManager: "Partial", PurchaseOfficer: "Partial" }
};

export const seedDatabase = async () => {
  try {
    for (const r of defaultRoles) {
      const exists = await Role.findOne({ name: r.name });
      if (!exists) {
        await Role.create(r);
        console.log(`Seeded Role: ${r.name}`);
      }
    }

    const roles = ['Admin', 'Director', 'ProjectManager', 'PurchaseOfficer', 'StoreOfficer', 'SiteStorekeeper'];
    for (const [moduleName, permMap] of Object.entries(defaultPermissions)) {
      for (const role of roles) {
        const level = permMap[role] || "None";
        const exists = await Permission.findOne({ role, module: moduleName });
        if (!exists) {
          await Permission.create({ role, module: moduleName, permissionLevel: level });
        }
      }
    }
    console.log("Seeding process completed!");
  } catch (error) {
    console.error("Seeding database failed:", error);
  }
};
