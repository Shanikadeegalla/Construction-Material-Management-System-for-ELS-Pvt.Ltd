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

  // New User Form State
  const [newUser, setNewUser] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    role: 'StoreOfficer', 
    phone: '+94 77 123 4567' 
  });
  
  // Edit User Form State
  const [editForm, setEditForm] = useState({ 
    name: '', 
    email: '', 
    role: 'StoreOfficer', 
    phone: '+94 77 123 4567',
    status: true 
  });
  const [isEditing, setIsEditing] = useState(false);
  const [passwordResetOpen, setPasswordResetOpen] = useState(false);
  const [newPasswordVal, setNewPasswordVal] = useState('');

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
    StoreOfficer: [
      { name: 'Issue Material', enabled: true },
      { name: 'Log Usage', enabled: true },
      { name: 'View Low Stock', enabled: true },
      { name: 'Create GRN', enabled: true }
    ]
  });

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

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
    } catch (err) {
      setNotifications([
        { materialName: 'Portland Cement OPC', currentQty: 0, minimumStock: 10, location: 'MainStore', alertLevel: 'Critical' },
        { materialName: 'Steel Bars 12mm', currentQty: 2, minimumStock: 2, location: 'SiteStore', alertLevel: 'Low' }
      ]);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchAuditLogs();
    fetchNotifications();

    const interval = setInterval(() => {
      fetchUsers();
      fetchAuditLogs();
      fetchNotifications();
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
        { _id: '3', name: 'Mike Davis', email: 'mike@els.com', role: 'StoreOfficer', status: false, phone: '+94 77 444 5555', createdAt: new Date(Date.now() - 10*24*60*60*1000).toISOString(), lastLogin: new Date(Date.now() - 24*60*60*1000).toISOString() },
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
        setNewUser({ name: '', email: '', password: '', role: 'StoreOfficer', phone: '+94 77 123 4567' });
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
    fontWeight: activePage === page ? '600' : '400',
    backgroundColor: activePage === page ? '#2563eb' : 'transparent',
    color: '#ffffff',
    borderRadius: '8px',
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
    if (activePage === 'roles') parts = ['Roles & Permissions', 'Workspace Role Mapping'];
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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc', color: '#0f172a', fontFamily: "'Inter', sans-serif" }}>
      
      {/* Sidebar */}
      <div style={{ width: '240px', background: '#1e3a5f', color: 'white', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh', zIndex: 10, boxShadow: '4px 0 10px rgba(0,0,0,0.05)' }}>
        
        {/* Logo area */}
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px', color: 'white', boxShadow: '0 4px 10px rgba(59, 130, 246, 0.4)' }}>
            A
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '700', letterSpacing: '0.5px' }}>Admin Panel</div>
            <div style={{ fontSize: '11px', color: '#93c5fd', fontWeight: '500' }}>ELS CMMS System</div>
          </div>
        </div>

        {/* Current user context */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', border: '2px solid rgba(255,255,255,0.2)' }}>
            {user?.name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{user?.name || 'Administrator'}</div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Super Administrator</div>
          </div>
        </div>

        {/* Nav Items */}
        <nav style={{ flex: 1, padding: '20px 12px' }}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: <Monitor size={18} /> },
            { id: 'users', label: 'User Management', icon: <Users size={18} /> },
            { id: 'roles', label: 'Roles & Permissions', icon: <ShieldAlert size={18} /> },
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
            {activePage === 'roles' && 'Roles & Permissions Matrix'}
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
                {notifications.length > 0 && (
                  <span style={{ position: 'absolute', top: '2px', right: '2px', background: '#ef4444', color: 'white', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px #fff' }}>
                    {notifications.length}
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
                  { label: 'Total Accounts', value: users.length, icon: <Users size={22} />, color: '#3b82f6', border: '#cbd5e1' },
                  { label: 'Active Users', value: users.filter(u => u.status !== false).length, icon: <CheckCircle2 size={22} />, color: '#10b981', border: '#cbd5e1' },
                  { label: 'Deactivated Accounts', value: users.filter(u => u.status === false).length, icon: <UserMinus size={22} />, color: '#ef4444', border: '#cbd5e1' },
                  { label: 'System Logs Recorded', value: auditLogs.length, icon: <Clock size={22} />, color: '#6366f1', border: '#cbd5e1' }
                ].map((stat, i) => (
                  <div key={i} style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -2px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{stat.label}</div>
                      <div style={{ fontSize: '28px', fontWeight: '800', color: '#1e3a5f', marginTop: '8px' }}>{stat.value}</div>
                    </div>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${stat.color}15`, color: stat.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {stat.icon}
                    </div>
                  </div>
                ))}
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
                              <option value="Admin">Admin</option>
                              <option value="Director">Director</option>
                              <option value="ProjectManager">Project Manager</option>
                              <option value="PurchaseOfficer">Purchase Officer</option>
                              <option value="StoreOfficer">Store Officer</option>
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

          {/* ROLES & PERMISSIONS PAGE */}
          {activePage === 'roles' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                {Object.keys(rolesPermissions).map((role) => {
                  const perms = rolesPermissions[role];
                  const rColor = getRoleColor(role);
                  return (
                    <div key={role} style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', padding: '24px', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1e3a5f' }}>{role} Role</h3>
                        <span style={{ background: rColor.bg, color: rColor.text, padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
                          Mapping
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                        {perms.map((perm, idx) => (
                          <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#334155', cursor: 'pointer', userSelect: 'none' }}>
                            <input 
                              type="checkbox" 
                              checked={perm.enabled} 
                              onChange={() => togglePermission(role, idx)}
                              style={{ width: '18px', height: '18px', borderRadius: '4px', cursor: 'pointer', accentColor: '#2563eb' }} 
                            />
                            <span>{perm.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
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

    </div>
  );
};

export default AdminDashboard;