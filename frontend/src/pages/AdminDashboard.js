import React, { useState, useEffect } from 'react';
import { 
  Monitor, 
  Users, 
  ShieldAlert, 
  Clock, 
  Settings, 
  Bell, 
  Mail, 
  Pencil, 
  UserMinus, 
  UserPlus, 
  Key, 
  Search, 
  ChevronRight, 
  X, 
  CheckCircle2, 
  AlertTriangle,
  Lock,
  Plus
} from 'lucide-react';
import SettingsPage from './SettingsPage';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const MODULES_MATRIX = [
  {
    category: "User Management",
    actions: [
      {
        name: "Create/Edit Users",
        permissions: { Admin: "Full", Director: "None", ProjectManager: "None", PurchaseOfficer: "None", StoreOfficer: "None", SiteStorekeeper: "None" }
      },
      {
        name: "View User List",
        permissions: { Admin: "Full", Director: "View", ProjectManager: "None", PurchaseOfficer: "None", StoreOfficer: "None", SiteStorekeeper: "None" }
      },
      {
        name: "Audit Logs",
        permissions: { Admin: "Full", Director: "View", ProjectManager: "None", PurchaseOfficer: "None", StoreOfficer: "None", SiteStorekeeper: "None" }
      }
    ]
  },
  {
    category: "Project Management",
    actions: [
      {
        name: "Create Project",
        permissions: { Admin: "Full", Director: "Approve", ProjectManager: "Full", PurchaseOfficer: "None", StoreOfficer: "None", SiteStorekeeper: "None" }
      },
      {
        name: "View Projects",
        permissions: { Admin: "Full", Director: "View", ProjectManager: "Partial", PurchaseOfficer: "View", StoreOfficer: "None", SiteStorekeeper: "None" }
      },
      {
        name: "BOM Creation",
        permissions: { Admin: "Full", ProjectManager: "Full", Director: "None", PurchaseOfficer: "None", StoreOfficer: "None", SiteStorekeeper: "None" }
      },
      {
        name: "BOM Approval",
        permissions: { Admin: "Full", Director: "Approve", ProjectManager: "None", PurchaseOfficer: "None", StoreOfficer: "None", SiteStorekeeper: "None" }
      }
    ]
  },
  {
    category: "Procurement",
    actions: [
      {
        name: "Create PR",
        permissions: { Admin: "Full", ProjectManager: "Full", StoreOfficer: "Partial", Director: "None", PurchaseOfficer: "None", SiteStorekeeper: "None" }
      },
      {
        name: "Approve PR",
        permissions: { Admin: "Full", ProjectManager: "Approve", Director: "None", PurchaseOfficer: "None", StoreOfficer: "None", SiteStorekeeper: "None" }
      },
      {
        name: "Create PO",
        permissions: { Admin: "Full", PurchaseOfficer: "Full", Director: "None", ProjectManager: "None", StoreOfficer: "None", SiteStorekeeper: "None" }
      },
      {
        name: "Approve PO",
        permissions: { Admin: "Full", Director: "Approve", ProjectManager: "None", PurchaseOfficer: "None", StoreOfficer: "None", SiteStorekeeper: "None" }
      },
      {
        name: "Supplier Management",
        permissions: { Admin: "Full", PurchaseOfficer: "Full", Director: "View", ProjectManager: "None", StoreOfficer: "None", SiteStorekeeper: "None" }
      }
    ]
  },
  {
    category: "Inventory & Stores",
    actions: [
      {
        name: "Create GRN",
        permissions: { Admin: "Full", StoreOfficer: "Full", SiteStorekeeper: "Partial", Director: "None", ProjectManager: "None", PurchaseOfficer: "None" }
      },
      {
        name: "View Stock",
        permissions: { Admin: "Full", Director: "View", ProjectManager: "Partial", PurchaseOfficer: "View", StoreOfficer: "Full", SiteStorekeeper: "Partial" }
      },
      {
        name: "Issue Materials",
        permissions: { Admin: "Full", StoreOfficer: "Full", Director: "None", ProjectManager: "None", PurchaseOfficer: "None", SiteStorekeeper: "None" }
      },
      {
        name: "Stock Adjustments",
        permissions: { Admin: "Full", StoreOfficer: "Full", Director: "None", ProjectManager: "None", PurchaseOfficer: "None", SiteStorekeeper: "None" }
      }
    ]
  },
  {
    category: "Reports & Analytics",
    actions: [
      {
        name: "View Reports",
        permissions: { Admin: "Full", Director: "Full", ProjectManager: "Partial", PurchaseOfficer: "Partial", StoreOfficer: "Partial", SiteStorekeeper: "None" }
      },
      {
        name: "Export PDF/Excel",
        permissions: { Admin: "Full", Director: "Full", ProjectManager: "Partial", PurchaseOfficer: "Partial", StoreOfficer: "None", SiteStorekeeper: "None" }
      }
    ]
  }
];

const ALL_MODULE_ACTIONS = [
  "Create/Edit Users", "View User List", "Audit Logs",
  "Create Project", "View Projects", "BOM Creation", "BOM Approval",
  "Create PR", "Approve PR", "Create PO", "Approve PO", "Supplier Management",
  "Create GRN", "View Stock", "Issue Materials", "Stock Adjustments",
  "View Reports", "Export PDF/Excel"
];

const AdminDashboard = ({ user, onLogout }) => {
  const [activePage, setActivePage] = useState('dashboard');
  const [userViewMode, setUserViewMode] = useState('list'); // 'list', 'details'
  const [selectedUser, setSelectedUser] = useState(null); // User for Details page
  
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logStatusFilter, setLogStatusFilter] = useState('All');
  const [logModuleFilter, setLogModuleFilter] = useState('All');

  // Clickable stats modal state
  const [activeStatsModal, setActiveStatsModal] = useState(null); // 'total' | 'active' | 'deactivated' | 'logs'
  const [statsSearchTerm, setStatsSearchTerm] = useState('');
  const [statsLogStartDate, setStatsLogStartDate] = useState('');
  const [statsLogEndDate, setStatsLogEndDate] = useState('');
  const [statsLogActionFilter, setStatsLogActionFilter] = useState('All');

  // Roles & Permissions matrix states
  const [rolesViewMode, setRolesViewMode] = useState('module'); // 'module' | 'role'
  const [matrixModuleFilter, setMatrixModuleFilter] = useState('All');
  const [matrixSelectedRole, setMatrixSelectedRole] = useState('All');

  // Role CRUD States
  const [dbRoles, setDbRoles] = useState([]);
  const [dbPermissions, setDbPermissions] = useState([]);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleFormName, setRoleFormName] = useState('');
  const [roleFormDesc, setRoleFormDesc] = useState('');
  const [roleFormStatus, setRoleFormStatus] = useState('Active');
  const [roleFormPermissions, setRoleFormPermissions] = useState({});
  const [showRoleViewModal, setShowRoleViewModal] = useState(false);
  const [viewingRole, setViewingRole] = useState(null);
  const [showPermissionCellModal, setShowPermissionCellModal] = useState(false);
  const [selectedPermissionCell, setSelectedPermissionCell] = useState(null);
  const [permissionFormLevel, setPermissionFormLevel] = useState('None');
  const [selectedModulesList, setSelectedModulesList] = useState([]);
  const [roleSearchTerm, setRoleSearchTerm] = useState('');
  const [roleToDelete, setRoleToDelete] = useState(null);

  const getBadgeStyle = (level) => {
    switch (level) {
      case 'Full':
        return { backgroundColor: '#2e7d32', color: '#ffffff', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', display: 'inline-block' };
      case 'View':
        return { backgroundColor: '#1565c0', color: '#ffffff', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', display: 'inline-block' };
      case 'Approve':
        return { backgroundColor: '#6a1b9a', color: '#ffffff', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', display: 'inline-block' };
      case 'Partial':
        return { backgroundColor: '#f57f17', color: '#ffffff', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', display: 'inline-block' };
      case 'None':
      default:
        return { backgroundColor: '#f1f5f9', color: '#94a3b8', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', display: 'inline-block' };
    }
  };

  const getPermissionDescription = (level, actionName) => {
    switch (level) {
      case 'Full':
        return `Full control: Can view, create, update, and manage all aspects of ${actionName}.`;
      case 'View':
        return `View access: Can read and check details of ${actionName} without permission to edit or create.`;
      case 'Approve':
        return `Approve access: Authorized to review, reject, or approve entries within ${actionName}.`;
      case 'Partial':
        return `Partial access: Limited capability to perform specific actions inside ${actionName}.`;
      case 'None':
      default:
        return `No access: This role is entirely blocked from performing or viewing ${actionName}.`;
    }
  };

  const exportLogsToPDF = (filteredLogs) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("ELS Construction (Pvt) Ltd", 14, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("SYSTEM AUDIT LOGS REPORT", 14, 26);
    
    doc.setDrawColor(13, 27, 75);
    doc.setLineWidth(1);
    doc.line(14, 28, 196, 28);

    const tableColumn = ["User", "Action Executed", "System Module", "Timestamp", "Status"];
    const tableRows = filteredLogs.map(log => [
      log.userName || log.userId?.name || 'System',
      log.action || '',
      log.module || '',
      new Date(log.timestamp || log.time).toLocaleString(),
      log.status || ''
    ]);

    doc.autoTable({
      startY: 32,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [13, 27, 75] },
      margin: { left: 14, right: 14 }
    });

    doc.save("system_audit_logs.pdf");
  };

  const renderStatsDrawer = () => {
    if (!activeStatsModal) return null;

    let drawerTitle = '';
    let tableContent = null;
    let searchBar = null;
    const userSearchQuery = statsSearchTerm.toLowerCase();
    
    if (activeStatsModal === 'total' || activeStatsModal === 'active' || activeStatsModal === 'deactivated') {
      let filteredList = [];
      if (activeStatsModal === 'total') {
        drawerTitle = `Total Accounts Directory (${users.length})`;
        filteredList = users;
      } else if (activeStatsModal === 'active') {
        const activeUsersCount = users.filter(u => u.status !== false).length;
        drawerTitle = `Active Accounts Directory (Count: ${activeUsersCount})`;
        filteredList = users.filter(u => u.status !== false);
      } else {
        drawerTitle = `Deactivated Accounts Directory (${users.filter(u => u.status === false).length})`;
        filteredList = users.filter(u => u.status === false);
      }

      filteredList = filteredList.filter(u => 
        (u.name || '').toLowerCase().includes(userSearchQuery) ||
        (u.email || '').toLowerCase().includes(userSearchQuery) ||
        (u.role || '').toLowerCase().includes(userSearchQuery)
      );

      searchBar = (
        <div style={{ position: 'relative', marginBottom: '20px' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input 
            placeholder="Search accounts by name, email, or role..." 
            value={statsSearchTerm} 
            onChange={e => setStatsSearchTerm(e.target.value)}
            style={{ padding: '12px 16px 12px 42px', border: '1px solid #e2e8f0', borderRadius: '12px', width: '100%', fontSize: '14px', background: 'white', color: '#0f172a', outline: 'none' }} 
          />
        </div>
      );

      tableContent = (
        <div style={{ overflowX: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#0d1b4b', color: 'white' }}>
                {['Name', 'Email Address', 'Workspace Role', 'Status', 'Created Date', ...(activeStatsModal === 'deactivated' ? ['Actions'] : [])].map(h => (
                  <th key={h} style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={activeStatsModal === 'deactivated' ? 6 : 5} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No matching users found.</td>
                </tr>
              ) : (
                filteredList.map((u, i) => {
                  const rColor = getRoleColor(u.role);
                  return (
                    <tr key={u._id || i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#1e3a5f' }}>{u.name}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#475569' }}>{u.email}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: rColor.bg, color: rColor.text, padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>{getStatusBadge(u.status)}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b' }}>
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                      </td>
                      {activeStatsModal === 'deactivated' && (
                        <td style={{ padding: '12px 16px' }}>
                          <button 
                            onClick={() => handleToggleStatus(u)} 
                            style={{ background: '#ecfdf5', color: '#10b981', border: '1px solid #10b98130', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: '600', transition: 'all 0.2s' }}
                          >
                            Activate
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      );
    } else if (activeStatsModal === 'logs') {
      drawerTitle = `System Audit Logs Directory (${auditLogs.length})`;

      const filteredList = auditLogs.filter(log => {
        if (statsLogStartDate) {
          const start = new Date(statsLogStartDate);
          start.setHours(0,0,0,0);
          if (new Date(log.timestamp) < start) return false;
        }
        if (statsLogEndDate) {
          const end = new Date(statsLogEndDate);
          end.setHours(23,59,59,999);
          if (new Date(log.timestamp) > end) return false;
        }
        if (statsLogActionFilter !== 'All' && log.action !== statsLogActionFilter) return false;
        
        if (statsSearchTerm) {
          const q = statsSearchTerm.toLowerCase();
          const userName = log.userName || log.userId?.name || 'System';
          return userName.toLowerCase().includes(q) ||
                 (log.action || '').toLowerCase().includes(q) ||
                 (log.module || '').toLowerCase().includes(q);
        }
        return true;
      });

      const uniqueActions = Array.from(new Set(auditLogs.map(l => l.action))).filter(Boolean);

      searchBar = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              placeholder="Search logs by user, action, or module..." 
              value={statsSearchTerm} 
              onChange={e => setStatsSearchTerm(e.target.value)}
              style={{ padding: '12px 16px 12px 42px', border: '1px solid #e2e8f0', borderRadius: '12px', width: '100%', fontSize: '14px', background: 'white', color: '#0f172a', outline: 'none' }} 
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Start Date</label>
              <input 
                type="date" 
                value={statsLogStartDate} 
                onChange={e => setStatsLogStartDate(e.target.value)} 
                style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>End Date</label>
              <input 
                type="date" 
                value={statsLogEndDate} 
                onChange={e => setStatsLogEndDate(e.target.value)} 
                style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Action Type</label>
              <select 
                value={statsLogActionFilter} 
                onChange={e => setStatsLogActionFilter(e.target.value)} 
                style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', background: 'white', width: '100%', cursor: 'pointer' }}
              >
                <option value="All">All Actions</option>
                {uniqueActions.map(action => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
            </div>
            <button 
              onClick={() => exportLogsToPDF(filteredList)} 
              style={{ background: '#ff9800', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              Export PDF
            </button>
          </div>
        </div>
      );

      tableContent = (
        <div style={{ overflowX: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#0d1b4b', color: 'white' }}>
                {['User', 'Action', 'Module', 'Timestamp', 'Status'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No system logs found matching criteria.</td>
                </tr>
              ) : (
                filteredList.map((log, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
                      {log.userName || log.userId?.name || 'System'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#334155' }}>{log.action}</td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b' }}>{log.module}</td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#475569' }}>
                      {new Date(log.timestamp || log.time).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ 
                        background: log.status === 'Success' ? '#dcfce7' : '#fee2e2', 
                        color: log.status === 'Success' ? '#166534' : '#991b1b', 
                        padding: '2px 8px', 
                        borderRadius: '9999px', 
                        fontSize: '10px', 
                        fontWeight: '700' 
                      }}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'flex-end',
          animation: 'fadeIn 0.2s ease-out'
        }} 
        onClick={() => setActiveStatsModal(null)}
      >
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>
        <div 
          style={{
            width: '850px',
            maxWidth: '95%',
            height: '100%',
            backgroundColor: '#ffffff',
            boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideIn 0.3s ease-out',
            color: '#1e293b'
          }} 
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ background: '#0d1b4b', color: 'white', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', borderLeft: '4px solid #ff9800', paddingLeft: '12px' }}>{drawerTitle}</h3>
            <button 
              onClick={() => setActiveStatsModal(null)} 
              style={{ background: 'transparent', border: 'none', color: '#ff9800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', borderRadius: '50%', transition: 'all 0.2s' }}
              className="close-drawer-btn"
            >
              <style>{`
                .close-drawer-btn:hover {
                  background-color: rgba(255, 152, 0, 0.15);
                  transform: scale(1.1);
                }
              `}</style>
              <X size={22} />
            </button>
          </div>

          <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            {searchBar}
            {tableContent}
          </div>
        </div>
      </div>
    );
  };

  // New User Form State
  const [newUser, setNewUser] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    role: 'MainStoreOfficer', 
    phone: '+94 77 123 4567' 
  });
  
  // Edit User Form State
  const [editForm, setEditForm] = useState({ 
    name: '', 
    email: '', 
    role: 'MainStoreOfficer', 
    phone: '+94 77 123 4567',
    status: true 
  });
  const [isEditing, setIsEditing] = useState(false);
  const [passwordResetOpen, setPasswordResetOpen] = useState(false);
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState('');



  const [message, setMessage] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Roles & Permissions state
  const [rolesPermissions, setRolesPermissions] = useState({
    Admin: [
      { name: 'Access Dashboard', enabled: true },
      { name: 'Manage Users', enabled: true },
      { name: 'Configure Settings', enabled: true },
      { name: 'View Audit Logs', enabled: true }
    ],
    Director: [
      { name: 'View Reports', enabled: true },
      { name: 'Approve Purchase Orders', enabled: true },
      { name: 'View Inventory', enabled: true },
      { name: 'Approve Budget', enabled: true }
    ],
    ProjectManager: [
      { name: 'Create BOM', enabled: true },
      { name: 'Approve Purchase Requests', enabled: true },
      { name: 'View Inventory', enabled: true },
      { name: 'Request Material', enabled: true }
    ],
    PurchaseOfficer: [
      { name: 'Create Purchase Orders', enabled: true },
      { name: 'View GRN', enabled: true },
      { name: 'Manage Suppliers', enabled: true },
      { name: 'View Inventory', enabled: true }
    ],
    MainStoreOfficer: [
      { name: 'Issue Material', enabled: true },
      { name: 'View Low Stock', enabled: true },
      { name: 'Create GRN', enabled: true }
    ],
    SiteStoreOfficer: [
      { name: 'Log Usage', enabled: true },
      { name: 'View Inventory', enabled: true }
    ]
  });

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/inventory/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data);
      }

      const countRes = await fetch('http://localhost:5000/api/notifications/count', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const countData = await countRes.json();
      if (countData.success) {
        setUnreadCount(countData.count);
      }
    } catch (err) {
      setNotifications([
        { materialName: 'Portland Cement OPC', currentQty: 0, minimumStock: 10, location: 'MainStore', alertLevel: 'Critical' },
        { materialName: 'Steel Bars 12mm', currentQty: 2, minimumStock: 2, location: 'SiteStore', alertLevel: 'Low' }
      ]);
      setUnreadCount(2);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchAuditLogs();
    fetchNotifications();
    fetchRoles();
    fetchPermissions();

    const interval = setInterval(() => {
      fetchUsers();
      fetchAuditLogs();
      fetchNotifications();
      fetchRoles();
      fetchPermissions();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchUsers = async () => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/auth/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        // Hydrate users with local phone numbers
        const mappedUsers = data.data.map(u => ({
          ...u,
          phone: u.phone || '+94 77 ' + Math.floor(1000000 + Math.random() * 9000000),
          lastLogin: u.lastLogin || new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000).toISOString()
        }));
        setUsers(mappedUsers);
      }
    } catch (err) {
      const mockUsers = [
        { _id: '1', name: 'John Smith', email: 'john@els.com', role: 'ProjectManager', status: true, phone: '+94 77 987 6543', createdAt: new Date(Date.now() - 30*24*60*60*1000).toISOString(), lastLogin: new Date(Date.now() - 2*60*60*1000).toISOString() },
        { _id: '2', name: 'Sarah Johnson', email: 'sarah@els.com', role: 'Director', status: true, phone: '+94 77 123 4567', createdAt: new Date(Date.now() - 60*24*60*60*1000).toISOString(), lastLogin: new Date(Date.now() - 4*60*60*1000).toISOString() },
        { _id: '3', name: 'Mike Davis', email: 'mike@els.com', role: 'MainStoreOfficer', status: false, phone: '+94 77 444 5555', createdAt: new Date(Date.now() - 10*24*60*60*1000).toISOString(), lastLogin: new Date(Date.now() - 24*60*60*1000).toISOString() },
        { _id: '4', name: 'Emily Brown', email: 'emily@els.com', role: 'PurchaseOfficer', status: true, phone: '+94 77 888 9999', createdAt: new Date(Date.now() - 15*24*60*60*1000).toISOString(), lastLogin: new Date(Date.now() - 12*60*60*1000).toISOString() },
      ];
      setUsers(mockUsers);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/auth/audit-logs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setAuditLogs(data.data);
      }
    } catch (err) {
      setAuditLogs([
        { userName: 'Admin User', action: 'User Login', module: 'Authentication', timestamp: new Date(Date.now() - 30*60*1000).toISOString(), status: 'Success' },
        { userName: 'Admin User', action: 'Created User', module: 'User Management', timestamp: new Date(Date.now() - 2*60*60*1000).toISOString(), status: 'Success' },
        { userName: 'Director User', action: 'BOM Approved', module: 'BOM Approvals', timestamp: new Date(Date.now() - 4*60*60*1000).toISOString(), status: 'Success' },
        { userName: 'Purchase Officer', action: 'Created PO', module: 'Purchase Orders', timestamp: new Date(Date.now() - 8*60*60*1000).toISOString(), status: 'Success' },
        { userName: 'Store Officer', action: 'Login Attempt', module: 'Authentication', timestamp: new Date(Date.now() - 10*60*60*1000).toISOString(), status: 'Failed' }
      ]);
    }
  };

  const fetchRoles = async () => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/roles', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setDbRoles(data.data);
      }
    } catch (err) {
      console.error('Error fetching roles:', err);
    }
  };

  const fetchPermissions = async () => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/permissions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setDbPermissions(data.data);
      }
    } catch (err) {
      console.error('Error fetching permissions:', err);
    }
  };

  const getPermissionLevel = (roleName, moduleName) => {
    const perm = dbPermissions.find(p => p.role === roleName && p.module === moduleName);
    return perm ? perm.permissionLevel : 'None';
  };

  const handleCreateRoleClick = () => {
    setEditingRole(null);
    setRoleFormName('');
    setRoleFormDesc('');
    setRoleFormStatus('Active');
    const perms = {};
    ALL_MODULE_ACTIONS.forEach(mod => { perms[mod] = 'None'; });
    setRoleFormPermissions(perms);
    setShowRoleModal(true);
  };

  const handleEditRoleClick = (role) => {
    setEditingRole(role);
    setRoleFormName(role.name);
    setRoleFormDesc(role.description || '');
    setRoleFormStatus(role.status || 'Active');
    const perms = {};
    ALL_MODULE_ACTIONS.forEach(mod => {
      const match = dbPermissions.find(p => p.role === role.name && p.module === mod);
      perms[mod] = match ? match.permissionLevel : 'None';
    });
    setRoleFormPermissions(perms);
    setShowRoleModal(true);
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!roleFormName.trim()) {
      showErrorMessage('Please enter a role name');
      return;
    }
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const url = editingRole 
        ? `http://localhost:5000/api/roles/${editingRole._id}`
        : 'http://localhost:5000/api/roles';
      const method = editingRole ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          name: roleFormName.trim(),
          description: roleFormDesc,
          status: roleFormStatus
        })
      });
      const data = await res.json();
      if (data.success) {
        const roleName = roleFormName.trim();
        for (const [moduleName, level] of Object.entries(roleFormPermissions)) {
          await fetch('http://localhost:5000/api/permissions/edit', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ role: roleName, module: moduleName, permissionLevel: level })
          });
        }
        showSuccessMessage(`✅ Role ${editingRole ? 'updated' : 'created'} successfully!`);
        setShowRoleModal(false);
        fetchRoles();
        fetchPermissions();
      } else {
        showErrorMessage(`❌ ${data.message || 'Failed to save role'}`);
      }
    } catch (err) {
      showErrorMessage('❌ Error connecting to server');
    }
  };

  const handleToggleRoleStatus = async (role) => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const newStatus = role.status === 'Active' ? 'Inactive' : 'Active';
      const res = await fetch(`http://localhost:5000/api/roles/${role._id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        showSuccessMessage(`✅ Role status updated to ${newStatus}!`);
        fetchRoles();
      } else {
        showErrorMessage(`❌ ${data.message || 'Failed to toggle status'}`);
      }
    } catch (err) {
      showErrorMessage('❌ Error connecting to server');
    }
  };

  const handleDeleteRoleConfirm = async () => {
    if (!roleToDelete) return;
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch(`http://localhost:5000/api/roles/${roleToDelete._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        showSuccessMessage('✅ Role deleted successfully!');
        fetchRoles();
        fetchPermissions();
      } else {
        showErrorMessage(`❌ ${data.message || 'Failed to delete role'}`);
      }
    } catch (err) {
      showErrorMessage('❌ Error connecting to server');
    } finally {
      setRoleToDelete(null);
    }
  };

  const handleSavePermission = async () => {
    if (!selectedPermissionCell) return;
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/permissions/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          role: selectedPermissionCell.role,
          module: selectedPermissionCell.module,
          permissionLevel: permissionFormLevel
        })
      });
      const data = await res.json();
      if (data.success) {
        showSuccessMessage(`✅ Permission updated successfully!`);
        setShowPermissionCellModal(false);
        fetchPermissions();
      } else {
        showErrorMessage(`❌ ${data.message || 'Failed to save permission'}`);
      }
    } catch (err) {
      showErrorMessage('❌ Error connecting to server');
    }
  };

  const handleBulkEditPermissions = async (roleName, level) => {
    if (selectedModulesList.length === 0) {
      showErrorMessage('No modules selected');
      return;
    }
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/permissions/bulk-edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          role: roleName,
          modules: selectedModulesList,
          permissionLevel: level
        })
      });
      const data = await res.json();
      if (data.success) {
        showSuccessMessage(`✅ Bulk permissions updated successfully!`);
        setSelectedModulesList([]);
        fetchPermissions();
      } else {
        showErrorMessage(`❌ ${data.message || 'Failed to bulk update permissions'}`);
      }
    } catch (err) {
      showErrorMessage('❌ Error connecting to server');
    }
  };

  const handleDirectPermissionEdit = async (role, module, level) => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/permissions/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          role,
          module,
          permissionLevel: level
        })
      });
      const data = await res.json();
      if (data.success) {
        showSuccessMessage(`✅ Permission for ${role} on ${module} updated to ${level}!`);
        fetchPermissions();
      } else {
        showErrorMessage(`❌ ${data.message || 'Failed to update permission'}`);
      }
    } catch (err) {
      showErrorMessage('❌ Error connecting to server');
    }
  };

  const handleResetFilters = () => {
    setStatsSearchTerm('');
    setMatrixModuleFilter('All');
    setMatrixSelectedRole('All');
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(newUser)
      });
      const data = await res.json();
      if (data.success) {
        showSuccessMessage(`✅ User "${newUser.name}" added successfully!`);
        setNewUser({ name: '', email: '', password: '', role: 'MainStoreOfficer', phone: '+94 77 123 4567' });
        setUserViewMode('list');
        fetchUsers();
        fetchAuditLogs();
      } else {
        showErrorMessage(`❌ ${data.message || 'Failed to add user'}`);
      }
    } catch (err) {
      showErrorMessage('❌ Error connecting to server');
    }
  };

  const handleToggleStatus = async (targetUser) => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const endpoint = `http://localhost:5000/api/auth/users/${targetUser._id}/${targetUser.status !== false ? 'deactivate' : 'activate'}`;
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        showSuccessMessage(`✅ User status updated successfully!`);
        fetchUsers();
        fetchAuditLogs();
        if (selectedUser && selectedUser._id === targetUser._id) {
          setSelectedUser({ ...selectedUser, status: !targetUser.status });
        }
      } else {
        showErrorMessage(`❌ ${data.message || 'Failed to change status'}`);
      }
    } catch (err) {
      showErrorMessage('❌ Error connecting to server');
    }
  };

  const handleEditClick = (u) => {
    setSelectedUser(u);
    setEditForm({ 
      name: u.name, 
      email: u.email, 
      role: u.role, 
      phone: u.phone || '+94 77 123 4567',
      status: u.status !== false 
    });
    setIsEditing(true);
    setUserViewMode('details');
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;

      // If email changed, call the specific update-email endpoint first
      if (editForm.email.trim().toLowerCase() !== selectedUser.email.toLowerCase()) {
        const emailRes = await fetch(`http://localhost:5000/api/users/${selectedUser._id}/email`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ newEmail: editForm.email.trim() })
        });
        const emailData = await emailRes.json();
        if (!emailRes.ok || !emailData.success) {
          showErrorMessage(`❌ Email update failed: ${emailData.message || 'Email already in use'}`);
          return;
        }
      }

      // Then save the remaining fields (name, role, phone, etc.)
      const res = await fetch(`http://localhost:5000/api/auth/users/${selectedUser._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      });
      const data = await res.json();
      if (data.success) {
        showSuccessMessage('✅ User profile updated successfully!');
        setIsEditing(false);
        setUserViewMode('list');
        fetchUsers();
        fetchAuditLogs();
      } else {
        showErrorMessage(`❌ ${data.message || 'Failed to update user'}`);
      }
    } catch (err) {
      showErrorMessage('❌ Error connecting to server');
    }
  };

  const handlePasswordReset = async () => {
    if (!newPasswordVal) {
      showErrorMessage('Please enter a valid password.');
      return;
    }
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch(`http://localhost:5000/api/auth/users/${selectedUser._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword: newPasswordVal })
      });
      if (res.ok) {
        showSuccessMessage('🔑 Password reset completed successfully!');
        setPasswordResetOpen(false);
        setNewPasswordVal('');
      } else {
        showErrorMessage('❌ Failed to reset password.');
      }
    } catch (err) {
      showErrorMessage('❌ Network error resetting password.');
    }
  };

  const handleResetPasswordClick = (u) => {
    setResetPasswordUser(u);
    setNewPassword('');
    setConfirmPassword('');
    setResetPasswordError('');
  };



  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setResetPasswordError('');
    
    if (newPassword.length < 6) {
      setResetPasswordError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetPasswordError('Passwords do not match.');
      return;
    }
    
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch(`http://localhost:5000/api/auth/users/${resetPasswordUser._id}/reset-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ password: newPassword })
      });
      const data = await res.json();
      if (data.success) {
        showSuccessMessage(`🔑 Password reset successfully for user "${resetPasswordUser.name}"`);
        setResetPasswordUser(null);
      } else {
        setResetPasswordError(data.message || 'Failed to reset password.');
      }
    } catch (err) {
      setResetPasswordError('Server connection error.');
    }
  };

  const showSuccessMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 5000);
  };

  const showErrorMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 5000);
  };

  const togglePermission = (role, permIdx) => {
    const updated = { ...rolesPermissions };
    updated[role][permIdx].enabled = !updated[role][permIdx].enabled;
    setRolesPermissions(updated);
    showSuccessMessage(`🛡️ Permissions updated for ${role}!`);
  };

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLogs = auditLogs.filter(log => {
    const nameMatch = log.userName?.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
                      log.action?.toLowerCase().includes(logSearchQuery.toLowerCase());
    const statusMatch = logStatusFilter === 'All' || log.status === logStatusFilter;
    const moduleMatch = logModuleFilter === 'All' || log.module === logModuleFilter;
    return nameMatch && statusMatch && moduleMatch;
  });

  const getRoleColor = (role) => {
    switch (role) {
      case 'Admin': return { bg: '#e0f2fe', text: '#0369a1' };
      case 'Director': return { bg: '#faf5ff', text: '#7e22ce' };
      case 'ProjectManager': return { bg: '#ecfdf5', text: '#047857' };
      case 'PurchaseOfficer': return { bg: '#fff7ed', text: '#c2410c' };
      default: return { bg: '#f1f5f9', text: '#475569' };
    }
  };

  const getStatusBadge = (status) => {
    const isActive = status !== false;
    return (
      <span style={{
        padding: '4px 10px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: '600',
        backgroundColor: isActive ? '#dcfce7' : '#fee2e2',
        color: isActive ? '#15803d' : '#b91c1c'
      }}>
        {isActive ? 'Active' : 'Inactive'}
      </span>
    );
  };

  const activePageStyle = (page) => ({
    padding: '12px 20px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '14px',
    fontWeight: activePage === page ? '600' : '500',
    backgroundColor: activePage === page ? 'rgba(255,152,0,0.2)' : 'transparent',
    borderLeft: activePage === page ? '3px solid #ff9800' : '3px solid transparent',
    color: activePage === page ? '#ff9800' : '#ccc',
    transition: 'all 0.2s ease',
    marginBottom: '6px'
  });

  // Breadcrumbs
  const renderBreadcrumbs = () => {
    let parts = [];
    if (activePage === 'dashboard') parts = ['Dashboard', 'Overview'];
    if (activePage === 'users') {
      parts = ['User Management', userViewMode === 'details' ? (selectedUser ? 'User Details' : 'Create User') : 'User Account Directory'];
    }
    if (activePage === 'roles') parts = ['Roles Management', 'System Role Profiles'];
    if (activePage === 'permissions') parts = ['Permissions Matrix', 'Workspace Access Matrix'];
    if (activePage === 'activity') parts = ['Activity Log', 'System Audit Trails'];
    if (activePage === 'settings') parts = ['System Settings', 'User Preferences'];

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
        <span>ELS Panel</span>
        <ChevronRight size={14} />
        {parts.map((p, i) => (
          <React.Fragment key={p}>
            <span style={{ color: i === parts.length - 1 ? '#1e3a5f' : '#64748b', fontWeight: i === parts.length - 1 ? '600' : '400' }}>{p}</span>
            {i < parts.length - 1 && <ChevronRight size={14} />}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const renderRoleModal = () => {
    if (!showRoleModal) return null;
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
        <div style={{ background: 'white', padding: '32px', borderRadius: '16px', width: '650px', maxWidth: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '16px', marginBottom: '20px' }}>
            <h3 style={{ color: '#0d1b4b', margin: 0, fontSize: '18px', fontWeight: '700' }}>
              {editingRole ? `Edit Role: ${editingRole.name}` : 'Create New Role'}
            </h3>
            <button onClick={() => setShowRoleModal(false)} style={{ background: 'transparent', border: 'none', color: '#ff9800', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSaveRole} style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1 }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Role Name</label>
              <input 
                type="text" 
                value={roleFormName} 
                onChange={e => setRoleFormName(e.target.value)} 
                required 
                placeholder="e.g. Estimator"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Description</label>
              <textarea 
                value={roleFormDesc} 
                onChange={e => setRoleFormDesc(e.target.value)} 
                placeholder="Brief description of responsibilities..."
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', minHeight: '80px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Status</label>
              <select 
                value={roleFormStatus} 
                onChange={e => setRoleFormStatus(e.target.value)} 
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', background: 'white' }}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '700', color: '#0d1b4b' }}>Assign Permissions</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px' }}>
                {ALL_MODULE_ACTIONS.map(mod => (
                  <div key={mod} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>{mod}</span>
                    <select 
                      value={roleFormPermissions[mod] || 'None'}
                      onChange={(e) => {
                        const newPerms = { ...roleFormPermissions };
                        newPerms[mod] = e.target.value;
                        setRoleFormPermissions(newPerms);
                      }}
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', outline: 'none', background: 'white' }}
                    >
                      <option value="Full">Full</option>
                      <option value="View">View</option>
                      <option value="Approve">Approve</option>
                      <option value="Partial">Partial</option>
                      <option value="None">None</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: 'auto' }}>
              <button type="button" onClick={() => setShowRoleModal(false)} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>Cancel</button>
              <button type="submit" style={{ background: '#ff9800', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderRoleViewModal = () => {
    if (!showRoleViewModal || !viewingRole) return null;
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
        <div style={{ background: 'white', padding: '32px', borderRadius: '16px', width: '550px', maxWidth: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '16px', marginBottom: '20px' }}>
            <h3 style={{ color: '#0d1b4b', margin: 0, fontSize: '18px', fontWeight: '700' }}>
              🔍 Role Details: {viewingRole.name}
            </h3>
            <button onClick={() => setShowRoleViewModal(false)} style={{ background: 'transparent', border: 'none', color: '#ff9800', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1 }}>
            <div>
              <strong style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase' }}>Description</strong>
              <p style={{ fontSize: '14px', color: '#1e293b', margin: '4px 0 0 0' }}>{viewingRole.description || 'No description provided.'}</p>
            </div>
            <div>
              <strong style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase' }}>Status</strong>
              <div style={{ margin: '4px 0 0 0' }}>
                <span style={{ 
                  padding: '4px 10px', 
                  borderRadius: '9999px', 
                  fontSize: '11px', 
                  fontWeight: '700', 
                  backgroundColor: viewingRole.status === 'Active' ? '#dcfce7' : '#fee2e2', 
                  color: viewingRole.status === 'Active' ? '#166534' : '#991b1b' 
                }}>
                  {viewingRole.status || 'Active'}
                </span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
              <strong style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>Role Permissions</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px' }}>
                {ALL_MODULE_ACTIONS.map(mod => {
                  const level = getPermissionLevel(viewingRole.name, mod);
                  return (
                    <div key={mod} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>{mod}</span>
                      <span style={getBadgeStyle(level)}>
                        {level}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: 'auto' }}>
              <button onClick={() => setShowRoleViewModal(false)} style={{ background: '#0d1b4b', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
                Close Details
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPermissionCellModal = () => {
    if (!showPermissionCellModal || !selectedPermissionCell) return null;
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
        <div style={{ background: 'white', padding: '32px', borderRadius: '16px', width: '400px', boxSizing: 'border-box', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '16px', marginBottom: '20px' }}>
            <h3 style={{ color: '#0d1b4b', margin: 0, fontSize: '17px', fontWeight: '700' }}>✏️ Edit Permission Badge</h3>
            <button onClick={() => setShowPermissionCellModal(false)} style={{ background: 'transparent', border: 'none', color: '#ff9800', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <strong style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Selected Role</strong>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#0d1b4b', marginTop: '4px' }}>{selectedPermissionCell.role}</div>
            </div>
            <div>
              <strong style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Selected Module / Action</strong>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#0d1b4b', marginTop: '4px' }}>{selectedPermissionCell.module}</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Permission Level</label>
              <select 
                value={permissionFormLevel} 
                onChange={e => setPermissionFormLevel(e.target.value)} 
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none', background: 'white', cursor: 'pointer' }}
              >
                <option value="Full">Full</option>
                <option value="View">View</option>
                <option value="Approve">Approve</option>
                <option value="Partial">Partial</option>
                <option value="None">None</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: '8px' }}>
              <button onClick={() => setShowPermissionCellModal(false)} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>Cancel</button>
              <button onClick={handleSavePermission} style={{ background: '#ff9800', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>Save Permission</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc', color: '#0f172a', fontFamily: "'Inter', sans-serif" }}>
      
      {/* Sidebar */}
      <div style={{ width: '240px', background: '#0d1b4b', color: 'white', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh', zIndex: 10, boxShadow: '4px 0 10px rgba(0,0,0,0.05)' }}>
        
        {/* Logo area */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img 
            src="/els-logo.png" 
            alt="ELS Logo" 
            style={{ width: '38px', height: '38px', objectFit: 'contain' }} 
          />
          <div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#ff9800' }}>ELS Construction</div>
            <div style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: '500' }}>Admin Panel</div>
          </div>
        </div>

        {/* Current user context */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#ff9800', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px', color: 'white' }}>
            {user?.name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: 'white' }}>{user?.name || 'Administrator'}</div>
            <div style={{ fontSize: '11px', color: '#cbd5e1' }}>{user?.role || 'Super Administrator'}</div>
          </div>
        </div>

        {/* Nav Items */}
        <nav style={{ flex: 1, padding: '20px 12px' }}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: <Monitor size={18} /> },
            { id: 'users', label: 'User Management', icon: <Users size={18} /> },
            { id: 'roles', label: 'Roles', icon: <ShieldAlert size={18} /> },
            { id: 'permissions', label: 'Permissions', icon: <Lock size={18} /> },
            { id: 'activity', label: 'Activity Log', icon: <Clock size={18} /> },
            { id: 'settings', label: 'System Settings', icon: <Settings size={18} /> }
          ].map(item => (
            <div key={item.id} onClick={() => {
              setActivePage(item.id);
              if (item.id === 'users') setUserViewMode('list');
            }} style={activePageStyle(item.id)} className="sidebar-item">
              <style>{`
                .sidebar-item:hover {
                  background-color: rgba(255,255,255,0.05);
                }
              `}</style>
              {item.icon}
              <span style={{ fontSize: '14px', fontWeight: activePage === item.id ? '600' : '500' }}>{item.label}</span>
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={onLogout} style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid #ef4444', color: '#fca5a5', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
            🚪 Logout Session
          </button>
        </div>
      </div>

      {/* Main Content wrapper */}
      <div style={{ marginLeft: '240px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        
        {/* Top Navbar */}
        <header style={{ height: '70px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 32px', position: 'sticky', top: 0, zIndex: 5, boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1e3a5f' }}>
            {activePage === 'dashboard' && 'Dashboard Overview'}
            {activePage === 'users' && 'User Management Console'}
            {activePage === 'roles' && 'Roles Management'}
            {activePage === 'permissions' && 'Permissions Matrix'}
            {activePage === 'activity' && 'Activity Logs & Audit Trails'}
            {activePage === 'settings' && 'System Settings & Controls'}
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            
            {/* Header Utility Icons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              
              <div style={{ position: 'relative', cursor: 'pointer', width: '38px', height: '38px', borderRadius: '50%', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Mail size={18} style={{ color: '#475569' }} />
              </div>

              {/* Notifications dropdown bell */}
              <div style={{ position: 'relative', cursor: 'pointer', width: '38px', height: '38px', borderRadius: '50%', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowNotifications(!showNotifications)}>
                <Bell size={18} style={{ color: '#475569' }} />
                 {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: '2px', right: '2px', background: '#ef4444', color: 'white', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px #fff' }}>
                    {unreadCount}
                  </span>
                )}
                
                {showNotifications && (
                  <div style={{ position: 'absolute', top: '48px', right: '0', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', width: '320px', maxHeight: '400px', overflowY: 'auto', zIndex: 100, cursor: 'default', padding: '8px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ padding: '12px', borderBottom: '1px solid #f1f5f9', fontWeight: '700', color: '#1e3a5f', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>System Inventory Alerts</span>
                      <span style={{ fontSize: '11px', background: '#fee2e2', color: '#ef4444', padding: '2px 8px', borderRadius: '9999px', fontWeight: '600' }}>Stock alerts</span>
                    </div>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '24px', color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
                        All stock thresholds normal.
                      </div>
                    ) : (
                      notifications.map((notif, idx) => (
                        <div key={idx} style={{ padding: '12px', borderBottom: idx === notifications.length - 1 ? 'none' : '1px solid #f1f5f9', fontSize: '13px', borderRadius: '8px', transition: 'background 0.2s', ':hover': { background: '#f8fafc' } }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600', marginBottom: '4px' }}>
                            <span style={{ color: '#0f172a' }}>{notif.materialName}</span>
                            <span style={{ color: notif.alertLevel === 'Critical' ? '#ef4444' : '#f59e0b', background: notif.alertLevel === 'Critical' ? '#fef2f2' : '#fef3c7', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>
                              {notif.alertLevel}
                            </span>
                          </div>
                          <div style={{ color: '#475569', fontSize: '12px' }}>
                            Current: <strong>{notif.currentQty}</strong> | Threshold: {notif.minimumStock}
                          </div>
                          <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>📍</span> {notif.location}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

            </div>

            <div style={{ width: '1px', height: '24px', backgroundColor: '#e2e8f0' }} />

            {/* Time display */}
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', textAlign: 'right' }}>
              <div style={{ fontWeight: '600', color: '#1e3a5f' }}>{currentTime.toLocaleTimeString()}</div>
              <div style={{ fontSize: '11px' }}>{currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
            </div>

          </div>
        </header>

        {/* Content Body */}
        <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
          
          {/* Breadcrumbs */}
          {renderBreadcrumbs()}

          {/* Banner messages */}
          {message && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: message.includes('✅') || message.includes('🔑') ? '#dcfce7' : '#fee2e2', border: `1px solid ${message.includes('✅') || message.includes('🔑') ? '#86efac' : '#fca5a5'}`, color: message.includes('✅') || message.includes('🔑') ? '#166534' : '#991b1b', padding: '14px 20px', borderRadius: '12px', marginBottom: '24px', fontSize: '14px', fontWeight: '500', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              {message.includes('✅') || message.includes('🔑') ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
              <span>{message}</span>
            </div>
          )}

          {/* DASHBOARD PAGE */}
          {activePage === 'dashboard' && (
            <div>
              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '32px' }}>
                {[
                  { label: 'Total Accounts', value: users.length, icon: <Users size={22} />, color: '#3b82f6', border: '#cbd5e1', keyType: 'total' },
                  { label: 'Active Users', value: users.filter(u => u.status !== false).length, icon: <CheckCircle2 size={22} />, color: '#10b981', border: '#cbd5e1', keyType: 'active' },
                  { label: 'Deactivated Accounts', value: users.filter(u => u.status === false).length, icon: <UserMinus size={22} />, color: '#ef4444', border: '#cbd5e1', keyType: 'deactivated' },
                  { label: 'System Logs Recorded', value: auditLogs.length, icon: <Clock size={22} />, color: '#6366f1', border: '#cbd5e1', keyType: 'logs' }
                ].map((stat, i) => (
                  <div 
                    key={i} 
                    onClick={() => {
                      setActiveStatsModal(stat.keyType);
                      setStatsSearchTerm('');
                      if (stat.keyType === 'logs') {
                        setStatsLogStartDate('');
                        setStatsLogEndDate('');
                        setStatsLogActionFilter('All');
                      }
                    }}
                    style={{
                      background: 'white',
                      borderRadius: '16px',
                      padding: '24px',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -2px rgba(0,0,0,0.02)',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    className="clickable-stat-card"
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{stat.label}</div>
                      <div style={{ fontSize: '28px', fontWeight: '800', color: '#1e3a5f', marginTop: '8px' }}>{stat.value}</div>
                    </div>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${stat.color}15`, color: stat.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {stat.icon}
                    </div>
                  </div>
                ))}
                <style>{`
                  .clickable-stat-card {
                    transition: all 0.2s ease;
                  }
                  .clickable-stat-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.08) !important;
                    border-color: #ff9800 !important;
                  }
                `}</style>
              </div>

              {/* Quick Actions & Recent Activity layout */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '24px' }}>
                
                {/* Recent Activity */}
                <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, color: '#1e3a5f', fontSize: '16px', fontWeight: '700' }}>Recent Audit Activities</h3>
                    <span onClick={() => setActivePage('activity')} style={{ fontSize: '12px', color: '#2563eb', fontWeight: '600', cursor: 'pointer' }}>View All</span>
                  </div>
                  {auditLogs.slice(0, 5).length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', padding: '40px' }}>No system logs yet.</div>
                  ) : (
                    auditLogs.slice(0, 5).map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 0', borderBottom: i === 4 ? 'none' : '1px solid #f1f5f9' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.status === 'Success' ? '#10b981' : '#ef4444', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: '600', fontSize: '14px', color: '#0f172a' }}>{item.userName || item.userId?.name || 'System'}</span>
                          <span style={{ fontSize: '13px', color: '#475569' }}> performed <strong style={{ color: '#1e3a5f' }}>{item.action}</strong> in <strong style={{ color: '#2563eb' }}>{item.module}</strong></span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* System Stats / Chart Wrapper info */}
                <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ margin: '0 0 16px', color: '#1e3a5f', fontSize: '16px', fontWeight: '700' }}>Admin Quick Links</h3>
                    <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.6', marginBottom: '20px' }}>Use these links to quickly jump to common management configurations and user credentials directories.</p>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button onClick={() => { setActivePage('users'); setUserViewMode('list'); }} style={{ width: '100%', padding: '12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', transition: 'background 0.2s' }}>
                      👥 Manage User Accounts
                    </button>
                    <button onClick={() => setActivePage('roles')} style={{ width: '100%', padding: '12px', background: '#f1f5f9', color: '#1e3a5f', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s' }}>
                      🛡️ Edit Role Permissions
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* USER MANAGEMENT PAGE */}
          {activePage === 'users' && (
            <div>
              {/* LIST VIEW */}
              {userViewMode === 'list' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    
                    {/* Search Bar */}
                    <div style={{ position: 'relative', width: '320px' }}>
                      <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input placeholder="Search users by name or email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        style={{ padding: '12px 16px 12px 42px', border: '1px solid #e2e8f0', borderRadius: '12px', width: '100%', fontSize: '14px', background: 'white', color: '#0f172a', outline: 'none', transition: 'border 0.2s' }} />
                    </div>

                    {/* Add New User Button */}
                    <button onClick={() => { setSelectedUser(null); setIsEditing(false); setUserViewMode('details'); }}
                      style={{ background: '#2563eb', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(37,99,235,0.2)' }}>
                      <Plus size={16} /> Add New User
                    </button>
                  </div>

                  {/* Users Table */}
                  <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#1e3a5f', color: 'white' }}>
                          {['Name', 'Email Address', 'Workspace Role', 'Status', 'Last Login', 'Actions'].map(h => (
                            <th key={h} style={{ padding: '16px 20px', fontSize: '13px', fontWeight: '600', letterSpacing: '0.5px' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>No users match your search.</td>
                          </tr>
                        ) : (
                          filteredUsers.map((u, i) => {
                            const rColor = getRoleColor(u.role);
                            return (
                              <tr key={u._id || i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#f8fafc', transition: 'background 0.2s' }} className="table-row">
                                <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: '600', color: '#1e3a5f', cursor: 'pointer' }} onClick={() => { setSelectedUser(u); setIsEditing(false); setUserViewMode('details'); }}>
                                  {u.name}
                                </td>
                                <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{u.email}</td>
                                <td style={{ padding: '16px 20px' }}>
                                  <span style={{ background: rColor.bg, color: rColor.text, padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>
                                    {u.role}
                                  </span>
                                </td>
                                <td style={{ padding: '16px 20px' }}>{getStatusBadge(u.status)}</td>
                                <td style={{ padding: '16px 20px', fontSize: '13px', color: '#64748b' }}>
                                  {u.lastLogin ? new Date(u.lastLogin).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}
                                </td>
                                <td style={{ padding: '16px 20px', display: 'flex', gap: '8px' }}>
                                  <button onClick={() => handleEditClick(u)} style={{ background: '#eff6ff', color: '#2563eb', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Pencil size={12} /> Edit
                                  </button>

                                  <button onClick={() => handleToggleStatus(u)} style={{ background: u.status !== false ? '#fef2f2' : '#ecfdf5', color: u.status !== false ? '#ef4444' : '#10b981', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', minWidth: '95px' }}>
                                    {u.status !== false ? 'Deactivate' : 'Activate'}
                                  </button>
                                  <button onClick={() => handleResetPasswordClick(u)} style={{ background: '#fff7ed', color: '#ea580c', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Key size={12} /> Reset PW
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* USER DETAILS / CREATE VIEW */}
              {userViewMode === 'details' && (
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                  
                  {/* User details card header */}
                  <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', marginBottom: '24px', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      
                      {/* Avatar placeholder */}
                      <div style={{ width: '70px', height: '70px', borderRadius: '50%', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: '#94a3b8', fontWeight: 'bold' }}>
                        {selectedUser ? selectedUser.name.charAt(0).toUpperCase() : 'N'}
                      </div>

                      <div>
                        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#1e3a5f' }}>
                          {selectedUser ? selectedUser.name : 'New Account profile'}
                        </h2>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                          <span style={{ fontSize: '12px', background: '#eff6ff', color: '#2563eb', padding: '4px 8px', borderRadius: '6px', fontWeight: '700', textTransform: 'uppercase' }}>
                            {selectedUser ? selectedUser.role : newUser.role}
                          </span>
                          {selectedUser && (
                            <span style={{ fontSize: '12px', background: selectedUser.status !== false ? '#dcfce7' : '#fee2e2', color: selectedUser.status !== false ? '#15803d' : '#b91c1c', padding: '4px 8px', borderRadius: '9999px', fontWeight: '700' }}>
                              {selectedUser.status !== false ? 'Active' : 'Inactive'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Actions (top right) */}
                    {selectedUser && (
                      <div style={{ position: 'absolute', top: '24px', right: '24px', display: 'flex', gap: '8px' }}>
                        <button onClick={() => setIsEditing(true)} style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #2563eb30', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Pencil size={14} /> Edit User
                        </button>
                        <button onClick={() => handleToggleStatus(selectedUser)} style={{ background: selectedUser.status !== false ? '#fef2f2' : '#ecfdf5', color: selectedUser.status !== false ? '#ef4444' : '#10b981', border: '1px solid #ef444430', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <UserMinus size={14} /> {selectedUser.status !== false ? 'Deactivate User' : 'Activate User'}
                        </button>
                        <button onClick={() => setPasswordResetOpen(!passwordResetOpen)} style={{ background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Key size={14} /> Password Reset
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Password Reset Modal section */}
                  {passwordResetOpen && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '12px', padding: '20px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ fontWeight: '700', color: '#b45309', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Lock size={16} /> Reset User Password
                      </div>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <input type="password" placeholder="Enter new password (min 6 characters)" value={newPasswordVal} onChange={e => setNewPasswordVal(e.target.value)}
                          style={{ flex: 1, padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px' }} />
                        <button onClick={handlePasswordReset} style={{ background: '#d97706', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
                          Confirm Reset
                        </button>
                        <button onClick={() => setPasswordResetOpen(false)} style={{ background: 'transparent', border: '1px solid #cbd5e1', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', color: '#64748b', fontSize: '13px' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Form Container */}
                  <div style={{ background: 'white', borderRadius: '16px', padding: '32px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                    <form onSubmit={selectedUser ? handleEditSave : handleAddUser}>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                        
                        {/* Left Column */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Full Name</label>
                            <input 
                              type="text" 
                              value={selectedUser ? editForm.name : newUser.name} 
                              onChange={e => selectedUser ? setEditForm({...editForm, name: e.target.value}) : setNewUser({...newUser, name: e.target.value})}
                              required 
                              disabled={selectedUser && !isEditing}
                              style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', fontSize: '14px', color: '#0f172a', fontWeight: '500', outline: 'none' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Email Address</label>
                            <input 
                              type="email" 
                              value={selectedUser ? editForm.email : newUser.email} 
                              onChange={e => selectedUser ? setEditForm({...editForm, email: e.target.value}) : setNewUser({...newUser, email: e.target.value})}
                              required 
                              disabled={selectedUser && !isEditing}
                              style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', fontSize: '14px', color: '#0f172a', fontWeight: '500', outline: 'none' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Phone Number</label>
                            <input 
                              type="text" 
                              value={selectedUser ? editForm.phone : newUser.phone} 
                              onChange={e => selectedUser ? setEditForm({...editForm, phone: e.target.value}) : setNewUser({...newUser, phone: e.target.value})}
                              required 
                              disabled={selectedUser && !isEditing}
                              style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', fontSize: '14px', color: '#0f172a', fontWeight: '500', outline: 'none' }}
                            />
                          </div>
                        </div>

                        {/* Right Column */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Workspace Role</label>
                            <select 
                              value={selectedUser ? editForm.role : newUser.role}
                              onChange={e => selectedUser ? setEditForm({...editForm, role: e.target.value}) : setNewUser({...newUser, role: e.target.value})}
                              disabled={selectedUser && !isEditing}
                              style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', fontSize: '14px', color: '#0f172a', fontWeight: '500', outline: 'none', cursor: 'pointer' }}
                            >
                              <option value="Director">Director</option>
                              <option value="ProjectManager">Project Manager</option>
                              <option value="PurchaseOfficer">Purchase Officer</option>
                              <option value="MainStoreOfficer">Main Store Officer</option>
                              <option value="SiteStoreOfficer">Site Store Officer</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Phone Number (Alt)</label>
                            <input 
                              type="text" 
                              value={selectedUser ? editForm.phone : newUser.phone}
                              disabled
                              style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', fontSize: '14px', color: '#64748b', outline: 'none' }}
                            />
                          </div>
                          {selectedUser ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Created Date</label>
                                <div style={{ padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', fontSize: '13px', color: '#64748b' }}>
                                  {new Date(selectedUser.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Last Login</label>
                                <div style={{ padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', fontSize: '13px', color: '#64748b' }}>
                                  {selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleDateString() : 'N/A'}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Create Password</label>
                              <input 
                                type="password" 
                                placeholder="•••••••• (min 6 chars)"
                                value={newUser.password}
                                onChange={e => setNewUser({...newUser, password: e.target.value})}
                                required
                                style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', fontSize: '14px', color: '#0f172a', outline: 'none' }}
                              />
                            </div>
                          )}
                        </div>

                      </div>

                      {/* Bottom Action Buttons */}
                      <div style={{ display: 'flex', gap: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '24px' }}>
                        <button type="button" onClick={() => { setUserViewMode('list'); setIsEditing(false); }}
                          style={{ padding: '12px 24px', background: 'transparent', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>
                          Cancel
                        </button>
                        
                        {(!selectedUser || isEditing) && (
                          <button type="submit" 
                            style={{ background: '#1e3a5f', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <UserPlus size={16} /> {selectedUser ? 'Save Changes' : 'Create User'}
                          </button>
                        )}
                      </div>

                    </form>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* ROLES PAGE */}
          {activePage === 'roles' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ position: 'relative', width: '320px' }}>
                  <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input 
                    placeholder="Search roles..." 
                    value={roleSearchTerm} 
                    onChange={e => setRoleSearchTerm(e.target.value)}
                    style={{ padding: '12px 16px 12px 42px', border: '1px solid #e2e8f0', borderRadius: '12px', width: '100%', fontSize: '14px', background: 'white', color: '#0f172a', outline: 'none' }} 
                  />
                </div>
                <button 
                  onClick={handleCreateRoleClick}
                  style={{ background: '#2563eb', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(37,99,235,0.2)' }}
                >
                  <Plus size={16} /> Create New Role
                </button>
              </div>

              <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#0d1b4b', color: 'white' }}>
                      {['Role Name', 'Description', 'Number of Users', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '16px 20px', fontSize: '13px', fontWeight: '600' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dbRoles.filter(r => r.name.toLowerCase().includes(roleSearchTerm.toLowerCase())).length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>No roles found.</td>
                      </tr>
                    ) : (
                      dbRoles.filter(r => r.name.toLowerCase().includes(roleSearchTerm.toLowerCase())).map((role, idx) => (
                        <tr key={role._id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#f8fafc' }}>
                          <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: '700', color: '#0d1b4b' }}>{role.name}</td>
                          <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{role.description || 'No description provided.'}</td>
                          <td style={{ padding: '16px 20px', fontSize: '13px', color: '#1e3a5f', fontWeight: '600' }}>{role.userCount || 0}</td>
                          <td style={{ padding: '16px 20px' }}>
                            <span style={{ 
                              padding: '4px 10px', 
                              borderRadius: '9999px', 
                              fontSize: '11px', 
                              fontWeight: '700', 
                              backgroundColor: role.status === 'Active' ? '#dcfce7' : '#fee2e2', 
                              color: role.status === 'Active' ? '#166534' : '#991b1b' 
                            }}>
                              {role.status || 'Active'}
                            </span>
                          </td>
                          <td style={{ padding: '16px 20px', display: 'flex', gap: '8px' }}>
                            <button 
                              onClick={() => {
                                setViewingRole(role);
                                setShowRoleViewModal(true);
                              }}
                              style={{ background: '#f1f5f9', color: '#1e3a5f', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                            >
                              View
                            </button>
                            <button 
                              onClick={() => handleEditRoleClick(role)}
                              style={{ background: '#eff6ff', color: '#2563eb', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => handleToggleRoleStatus(role)}
                              style={{ background: role.status === 'Active' ? '#fff7ed' : '#ecfdf5', color: role.status === 'Active' ? '#ea580c' : '#10b981', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                            >
                              {role.status === 'Active' ? 'Disable' : 'Enable'}
                            </button>
                            <button 
                              onClick={() => setRoleToDelete(role)}
                              disabled={role.userCount > 0}
                              style={{ 
                                background: role.userCount > 0 ? '#f1f5f9' : '#fef2f2', 
                                color: role.userCount > 0 ? '#94a3b8' : '#ef4444', 
                                border: 'none', 
                                padding: '6px 12px', 
                                borderRadius: '8px', 
                                cursor: role.userCount > 0 ? 'not-allowed' : 'pointer', 
                                fontSize: '12px', 
                                fontWeight: '600' 
                              }}
                              title={role.userCount > 0 ? 'Cannot delete role with assigned users' : 'Delete Role'}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PERMISSIONS PAGE */}
          {activePage === 'permissions' && (
            <div>
              {/* View Toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                  <button 
                    onClick={() => setRolesViewMode('module')} 
                    style={{
                      padding: '10px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px',
                      backgroundColor: rolesViewMode === 'module' ? '#0d1b4b' : 'transparent',
                      color: rolesViewMode === 'module' ? '#ffffff' : '#475569',
                      transition: 'all 0.2s'
                    }}
                  >
                    By Module
                  </button>
                  <button 
                    onClick={() => setRolesViewMode('role')} 
                    style={{
                      padding: '10px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px',
                      backgroundColor: rolesViewMode === 'role' ? '#0d1b4b' : 'transparent',
                      color: rolesViewMode === 'role' ? '#ffffff' : '#475569',
                      transition: 'all 0.2s'
                    }}
                  >
                    By Role
                  </button>
                </div>

                {/* Filters */}
                {rolesViewMode === 'module' ? (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', width: '220px' }}>
                      <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input 
                        placeholder="Search modules..." 
                        value={statsSearchTerm} 
                        onChange={e => setStatsSearchTerm(e.target.value)}
                        style={{ padding: '8px 12px 8px 34px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', width: '100%', outline: 'none' }} 
                      />
                    </div>
                    <select 
                      value={matrixModuleFilter} 
                      onChange={e => setMatrixModuleFilter(e.target.value)}
                      style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', background: 'white', cursor: 'pointer', outline: 'none' }}
                    >
                      <option value="All">All Categories</option>
                      <option value="User Management">User Management</option>
                      <option value="Project Management">Project Management</option>
                      <option value="Procurement">Procurement</option>
                      <option value="Inventory & Stores">Inventory & Stores</option>
                      <option value="Reports & Analytics">Reports & Analytics</option>
                    </select>
                    <select 
                      value={matrixSelectedRole} 
                      onChange={e => setMatrixSelectedRole(e.target.value)}
                      style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', background: 'white', cursor: 'pointer', outline: 'none' }}
                    >
                      <option value="All">All Roles</option>
                      {dbRoles.filter(r => r.status === 'Active').map(r => (
                        <option key={r.name} value={r.name}>{r.name}</option>
                      ))}
                    </select>
                    <button 
                      onClick={handleResetFilters}
                      style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', color: '#475569', fontWeight: '600', cursor: 'pointer' }}
                    >
                      Reset
                    </button>
                  </div>
                ) : (
                  <div>
                    <select 
                      value={matrixSelectedRole === 'All' ? (dbRoles.filter(r => r.status === 'Active')[0]?.name || 'Admin') : matrixSelectedRole} 
                      onChange={e => setMatrixSelectedRole(e.target.value)}
                      style={{ padding: '10px 16px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '14px', background: 'white', cursor: 'pointer', outline: 'none' }}
                    >
                      {dbRoles.filter(r => r.status === 'Active').map(r => (
                        <option key={r.name} value={r.name}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Bulk Action Panel */}
              {rolesViewMode === 'module' && selectedModulesList.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#fff7ed', border: '1px solid #ffedd5', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#c2410c' }}>
                    Bulk Action: {selectedModulesList.length} modules selected
                  </span>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginLeft: 'auto' }}>
                    <span style={{ fontSize: '13px', color: '#475569' }}>Set Role:</span>
                    <select id="bulkRoleSelect" style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white' }}>
                      {dbRoles.filter(r => r.status === 'Active').map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                    </select>
                    <span style={{ fontSize: '13px', color: '#475569' }}>To Level:</span>
                    <select id="bulkLevelSelect" style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white' }}>
                      <option value="Full">Full</option>
                      <option value="View">View</option>
                      <option value="Approve">Approve</option>
                      <option value="Partial">Partial</option>
                      <option value="None">None</option>
                    </select>
                    <button 
                      onClick={() => {
                        const role = document.getElementById('bulkRoleSelect').value;
                        const level = document.getElementById('bulkLevelSelect').value;
                        handleBulkEditPermissions(role, level);
                      }}
                      style={{ background: '#ff9800', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}
                    >
                      Apply to Selected
                    </button>
                    <button 
                      onClick={() => setSelectedModulesList([])}
                      style={{ background: 'transparent', border: '1px solid #cbd5e1', color: '#475569', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {/* VIEW 1 - By Module (Matrix) */}
              {rolesViewMode === 'module' && (
                <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#0d1b4b', color: 'white' }}>
                        <th style={{ padding: '16px 20px', fontSize: '13px', fontWeight: '600' }}>
                          <input 
                            type="checkbox" 
                            checked={
                              selectedModulesList.length > 0 && 
                              MODULES_MATRIX.filter(cat => matrixModuleFilter === 'All' || cat.category === matrixModuleFilter)
                                .flatMap(cat => cat.actions)
                                .filter(act => act.name.toLowerCase().includes(statsSearchTerm.toLowerCase()))
                                .every(act => selectedModulesList.includes(act.name))
                            }
                            onChange={(e) => {
                              const visibleActions = MODULES_MATRIX.filter(cat => matrixModuleFilter === 'All' || cat.category === matrixModuleFilter)
                                .flatMap(cat => cat.actions)
                                .filter(act => act.name.toLowerCase().includes(statsSearchTerm.toLowerCase()))
                                .map(act => act.name);
                              if (e.target.checked) {
                                setSelectedModulesList(visibleActions);
                              } else {
                                setSelectedModulesList([]);
                              }
                            }}
                            style={{ marginRight: '10px', cursor: 'pointer' }}
                          />
                          Module / Action
                        </th>
                        {dbRoles.filter(r => r.status === 'Active' && (matrixSelectedRole === 'All' || r.name === matrixSelectedRole)).map(role => (
                          <th key={role.name} style={{ padding: '16px 20px', fontSize: '13px', fontWeight: '600' }}>{role.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MODULES_MATRIX.filter(cat => matrixModuleFilter === 'All' || cat.category === matrixModuleFilter).map((cat, catIdx) => {
                        const matchedActions = cat.actions.filter(act => act.name.toLowerCase().includes(statsSearchTerm.toLowerCase()));
                        if (matchedActions.length === 0) return null;
                        
                        return (
                          <React.Fragment key={catIdx}>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                              <td colSpan={1 + dbRoles.filter(r => r.status === 'Active' && (matrixSelectedRole === 'All' || r.name === matrixSelectedRole)).length} style={{ padding: '12px 20px', fontSize: '12px', fontWeight: '700', color: '#0d1b4b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                📁 {cat.category}
                              </td>
                            </tr>
                            {matchedActions.map((act, actIdx) => (
                              <tr key={actIdx} style={{ borderBottom: '1px solid #f1f5f9', background: 'white' }}>
                                <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: '600', color: '#334155', paddingLeft: '24px' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={selectedModulesList.includes(act.name)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedModulesList(prev => [...prev, act.name]);
                                      } else {
                                        setSelectedModulesList(prev => prev.filter(m => m !== act.name));
                                      }
                                    }}
                                    style={{ marginRight: '10px', cursor: 'pointer' }}
                                  />
                                  {act.name}
                                </td>
                                {dbRoles.filter(r => r.status === 'Active' && (matrixSelectedRole === 'All' || r.name === matrixSelectedRole)).map(role => {
                                  const level = getPermissionLevel(role.name, act.name);
                                  return (
                                    <td 
                                      key={role.name} 
                                      style={{ padding: '14px 20px', cursor: 'pointer' }}
                                      onClick={() => {
                                        setSelectedPermissionCell({ role: role.name, module: act.name, level });
                                        setPermissionFormLevel(level);
                                        setShowPermissionCellModal(true);
                                      }}
                                      className="matrix-cell"
                                    >
                                      <style>{`
                                        .matrix-cell:hover {
                                          background-color: #f8fafc;
                                        }
                                      `}</style>
                                      <span style={getBadgeStyle(level)}>
                                        {level === 'None' ? '✕' : level}
                                      </span>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* VIEW 2 - By Role */}
              {rolesViewMode === 'role' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {MODULES_MATRIX.map((cat, catIdx) => {
                    const activeRoleForView = matrixSelectedRole === 'All' ? (dbRoles.filter(r => r.status === 'Active')[0]?.name || 'Admin') : matrixSelectedRole;
                    return (
                      <div key={catIdx} style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', padding: '24px' }}>
                        <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700', color: '#0d1b4b', borderBottom: '2px solid #ff9800', paddingBottom: '8px', textTransform: 'uppercase', display: 'inline-block' }}>
                          📁 {cat.category}
                        </h4>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          {cat.actions.map((act, actIdx) => {
                            const level = getPermissionLevel(activeRoleForView, act.name);
                            return (
                              <div key={actIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '70%' }}>
                                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#1e3a5f' }}>{act.name}</span>
                                  <span style={{ fontSize: '13px', color: '#64748b' }}>
                                    {getPermissionDescription(level, act.name)}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                  <select 
                                    value={level} 
                                    onChange={(e) => handleDirectPermissionEdit(activeRoleForView, act.name, e.target.value)}
                                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', cursor: 'pointer', outline: 'none', background: 'white' }}
                                  >
                                    <option value="Full">Full</option>
                                    <option value="View">View</option>
                                    <option value="Approve">Approve</option>
                                    <option value="Partial">Partial</option>
                                    <option value="None">None</option>
                                  </select>
                                  <span style={{ ...getBadgeStyle(level), width: '80px', textAlign: 'center' }}>
                                    {level === 'None' ? '✕' : level}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ACTIVITY LOG PAGE */}
          {activePage === 'activity' && (
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
              
              {/* Header Controls */}
              <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                <h3 style={{ margin: 0, color: '#1e3a5f', fontSize: '16px', fontWeight: '700' }}>System Audit Logs</h3>
                
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  
                  {/* Search */}
                  <div style={{ position: 'relative', width: '220px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input placeholder="Search logs..." value={logSearchQuery} onChange={e => setLogSearchQuery(e.target.value)}
                      style={{ padding: '8px 12px 8px 34px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', width: '100%', outline: 'none' }} />
                  </div>

                  {/* Status filter */}
                  <select value={logStatusFilter} onChange={e => setLogStatusFilter(e.target.value)}
                    style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', background: 'white', outline: 'none', cursor: 'pointer' }}>
                    <option value="All">All Statuses</option>
                    <option value="Success">Success</option>
                    <option value="Failed">Failed</option>
                  </select>

                  {/* Module filter */}
                  <select value={logModuleFilter} onChange={e => setLogModuleFilter(e.target.value)}
                    style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', background: 'white', outline: 'none', cursor: 'pointer' }}>
                    <option value="All">All Modules</option>
                    <option value="Authentication">Authentication</option>
                    <option value="User Management">User Management</option>
                    <option value="BOM Approvals">BOM Approvals</option>
                    <option value="Purchase Orders">Purchase Orders</option>
                  </select>

                  {/* Refresh */}
                  <button onClick={fetchAuditLogs} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', color: '#1e3a5f', fontWeight: '600', cursor: 'pointer' }}>
                    🔄 Refresh
                  </button>

                </div>
              </div>

              {/* Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#1e3a5f', color: 'white' }}>
                    {['User', 'Action Executed', 'System Module', 'Real Timestamp', 'Status'].map(h => (
                      <th key={h} style={{ padding: '16px 24px', fontSize: '13px', fontWeight: '600' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>No audit logs matching selection.</td>
                    </tr>
                  ) : (
                    filteredLogs.map((log, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                        <td style={{ padding: '14px 24px', fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>{log.userName || log.userId?.name || 'System'}</td>
                        <td style={{ padding: '14px 24px', fontSize: '13px', color: '#334155' }}>{log.action}</td>
                        <td style={{ padding: '14px 24px', fontSize: '13px', color: '#64748b' }}>{log.module}</td>
                        <td style={{ padding: '14px 24px', fontSize: '13px', color: '#475569' }}>
                          {new Date(log.timestamp || log.time).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'medium' })}
                        </td>
                        <td style={{ padding: '14px 24px' }}>
                          <span style={{ 
                            background: log.status === 'Success' ? '#dcfce7' : '#fee2e2', 
                            color: log.status === 'Success' ? '#166534' : '#991b1b', 
                            padding: '4px 10px', 
                            borderRadius: '9999px', 
                            fontSize: '11px', 
                            fontWeight: '700' 
                          }}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

            </div>
          )}

          {/* SETTINGS PAGE */}
          {activePage === 'settings' && (
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '32px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <SettingsPage user={user} onLogout={onLogout} />
            </div>
          )}

        </main>
      </div>

      {resetPasswordUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '16px', width: '420px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <h3 style={{ color: '#0d1b4b', marginTop: 0, marginBottom: '20px', fontSize: '18px', fontWeight: '700' }}>🔑 Reset Password</h3>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>Set a new password for <strong>{resetPasswordUser.name}</strong> ({resetPasswordUser.email}).</p>
            
            {resetPasswordError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                {resetPasswordError}
              </div>
            )}
            
            <form onSubmit={handleResetPasswordSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', fontWeight: '600', marginBottom: '6px', textTransform: 'uppercase' }}>New Password</label>
                <input
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '14px', outline: 'none' }}
                  required
                />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', fontWeight: '600', marginBottom: '6px', textTransform: 'uppercase' }}>Confirm Password</label>
                <input
                  type="password"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '14px', outline: 'none' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setResetPasswordUser(null)} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>Cancel</button>
                <button type="submit" style={{ background: '#ff9800', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', boxShadow: '0 4px 12px rgba(255,152,0,0.2)' }}>Save Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {renderStatsDrawer()}
      {renderRoleModal()}
      {renderRoleViewModal()}
      {renderPermissionCellModal()}

      {roleToDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '16px', width: '400px', boxSizing: 'border-box', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <h3 style={{ color: '#0d1b4b', marginTop: 0, marginBottom: '16px', fontSize: '18px', fontWeight: '700' }}>⚠️ Delete Role Profile</h3>
            <p style={{ fontSize: '14px', color: '#475569', marginBottom: '24px', lineHeight: '1.5' }}>
              Are you sure you want to delete the role <strong>{roleToDelete.name}</strong>? This action will permanently remove the role and all associated permission mappings.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setRoleToDelete(null)} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>Cancel</button>
              <button onClick={handleDeleteRoleConfirm} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>Delete Role</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;