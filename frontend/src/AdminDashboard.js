import React, { useState, useEffect } from 'react';
import { formatShortDate } from './utils/dateUtils';

const AdminDashboard = ({ user, onLogout }) => {
  const [activePage, setActivePage] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'MainStoreOfficer' });
  const [message, setMessage] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [recentActivity, setRecentActivity] = useState([
    { name: 'Admin User', action: 'Created new user account', time: new Date(Date.now() - 2*60*60*1000), type: 'success' },
    { name: 'Director User', action: 'Updated system settings', time: new Date(Date.now() - 4*60*60*1000), type: 'info' },
    { name: 'Admin User', action: 'Deactivated user account', time: new Date(Date.now() - 6*60*60*1000), type: 'warning' },
  ]);
  const [auditLogs, setAuditLogs] = useState([
    { name: 'Admin User', action: 'User Login', module: 'Authentication', time: new Date(Date.now() - 30*60*1000), status: 'Success' },
    { name: 'Admin User', action: 'Created User', module: 'User Management', time: new Date(Date.now() - 2*60*60*1000), status: 'Success' },
    { name: 'Director User', action: 'BOM Approved', module: 'BOM Approvals', time: new Date(Date.now() - 4*60*60*1000), status: 'Success' },
    { name: 'Unknown', action: 'Failed Login', module: 'Authentication', time: new Date(Date.now() - 6*60*60*1000), status: 'Failed' },
    { name: 'Purchase Manager', action: 'Created PO', module: 'Purchase Orders', time: new Date(Date.now() - 8*60*60*1000), status: 'Success' },
  ]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { fetchUsers(); }, []);

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  const fetchUsers = async () => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setUsers(data.data);
    } catch (err) {
      setUsers([
        { _id: '1', name: 'John Smith', email: 'john@els.com', role: 'ProjectManager', status: true, createdAt: new Date().toISOString() },
        { _id: '2', name: 'Sarah Johnson', email: 'sarah@els.com', role: 'Director', status: true, createdAt: new Date().toISOString() },
        { _id: '3', name: 'Mike Davis', email: 'mike@els.com', role: 'MainStoreOfficer', status: false, createdAt: new Date().toISOString() },
        { _id: '4', name: 'Emily Brown', email: 'emily@els.com', role: 'PurchaseManager', status: true, createdAt: new Date().toISOString() },
      ]);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`✅ User "${newUser.name}" added successfully!`);
        setShowAddUser(false);
        const newLog = { name: user?.name || 'Admin', action: `Created user: ${newUser.name}`, module: 'User Management', time: new Date(), status: 'Success' };
        setAuditLogs(prev => [newLog, ...prev]);
        const newAct = { name: user?.name || 'Admin', action: `Created new user: ${newUser.name} (${newUser.role})`, time: new Date(), type: 'success' };
        setRecentActivity(prev => [newAct, ...prev.slice(0, 4)]);
        setNewUser({ name: '', email: '', password: '', role: 'MainStoreOfficer' });
        fetchUsers();
      } else {
        setMessage(`❌ ${data.message || 'Failed to add user'}`);
      }
    } catch (err) {
      setMessage('❌ Error connecting to server');
    }
  };

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = [
    { label: 'Total Users', value: users.length || 5, color: '#1565c0' },
    { label: 'Active Users', value: users.filter(u => u.status !== false).length || 4, color: '#2e7d32' },
    { label: 'Inactive Users', value: users.filter(u => u.status === false).length || 1, color: '#c62828' },
    { label: 'User Roles', value: 5, color: '#e65100' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Segoe UI, Arial, sans-serif' }}>
      <div style={{ width: '240px', background: '#0d1b4b', color: 'white', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh' }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#ff9800' }}>ELS Constructions</div>
          <div style={{ fontSize: '12px', color: '#90caf9', marginTop: '4px' }}>Material Management</div>
        </div>
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#ff9800', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px' }}>
            {user?.name?.charAt(0) || 'A'}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600' }}>{user?.name || 'Admin User'}</div>
            <div style={{ fontSize: '11px', color: '#90caf9' }}>{user?.role || 'Administrator'}</div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: '⊞' },
            { id: 'users', label: 'User Management', icon: '👥' },
            { id: 'audit', label: 'Audit Logs', icon: '📋' },
            { id: 'settings', label: 'System Settings', icon: '⚙️' },
          ].map(item => (
            <div key={item.id} onClick={() => setActivePage(item.id)}
              style={{ padding: '12px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', background: activePage === item.id ? 'rgba(255,152,0,0.2)' : 'transparent', borderLeft: activePage === item.id ? '3px solid #ff9800' : '3px solid transparent', color: activePage === item.id ? '#ff9800' : '#ccc', transition: 'all 0.2s' }}>
              <span>{item.icon}</span>{item.label}
            </div>
          ))}
        </nav>
        <div onClick={onLogout} style={{ padding: '16px 20px', cursor: 'pointer', borderTop: '1px solid rgba(255,255,255,0.1)', color: '#ef5350', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          🚪 Logout
        </div>
      </div>

      <div style={{ marginLeft: '240px', flex: 1, background: '#f5f6fa' }}>
        <div style={{ background: 'white', padding: '16px 24px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: '#0d1b4b' }}>
            {activePage === 'dashboard' && 'Admin Dashboard'}
            {activePage === 'users' && 'User Management'}
            {activePage === 'audit' && 'System Audit Logs'}
            {activePage === 'settings' && 'System Settings'}
          </h2>
        </div>

        <div style={{ padding: '24px' }}>
          {message && (
            <div style={{ background: message.includes('✅') ? '#e8f5e9' : '#ffebee', border: `1px solid ${message.includes('✅') ? '#4caf50' : '#ef5350'}`, color: message.includes('✅') ? '#2e7d32' : '#c62828', padding: '10px 16px', borderRadius: '6px', marginBottom: '16px' }}>
              {message}
            </div>
          )}

          {activePage === 'dashboard' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                {stats.map((stat, i) => (
                  <div key={i} style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', borderTop: `4px solid ${stat.color}` }}>
                    <div style={{ fontSize: '28px', fontWeight: '700', color: stat.color }}>{stat.value}</div>
                    <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 16px', color: '#0d1b4b', fontSize: '16px' }}>Recent Activity</h3>
                {recentActivity.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: item.type === 'success' ? '#4caf50' : item.type === 'warning' ? '#ff9800' : '#2196f3' }} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: '600', fontSize: '14px' }}>{item.name}</span>
                      <span style={{ fontSize: '13px', color: '#666' }}> — {item.action}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#999', whiteSpace: 'nowrap' }}>{getTimeAgo(item.time)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activePage === 'users' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <input placeholder="Search Users..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  style={{ padding: '10px 16px', border: '1px solid #ddd', borderRadius: '6px', width: '280px', fontSize: '14px' }} />
                <button onClick={() => setShowAddUser(true)}
                  style={{ background: '#ff9800', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>
                  + Add New User
                </button>
              </div>

              {showAddUser && (
                <div style={{ background: 'white', borderRadius: '8px', padding: '24px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', border: '1px solid #ff9800' }}>
                  <h3 style={{ margin: '0 0 16px', color: '#0d1b4b' }}>Add New User</h3>
                  <form onSubmit={handleAddUser}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>FULL NAME</label>
                        <input placeholder="Enter Full name" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>EMAIL</label>
                        <input type="email" placeholder="john@els.com" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>PASSWORD</label>
                        <input type="password" placeholder="Enter password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>ROLE</label>
                        <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' }}>
                          <option value="Director">Director</option>
                          <option value="ProjectManager">Project Manager</option>
                          <option value="PurchaseManager">Purchase Manager</option>
                          <option value="MainStoreOfficer">Main Store Officer</option>
                          <option value="SiteStoreOfficer">Site Store Officer</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button type="submit" style={{ background: '#ff9800', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Add User</button>
                      <button type="button" onClick={() => setShowAddUser(false)} style={{ background: '#f5f5f5', color: '#333', border: '1px solid #ddd', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </form>
                </div>
              )}

              <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#0d1b4b', color: 'white' }}>
                      {['Name', 'Email', 'Role', 'Status', 'Created At', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u, i) => (
                      <tr key={u._id || i} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '500' }}>{u.name}</td>
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#666' }}>{u.email}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ background: '#e3f2fd', color: '#1565c0', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>{u.role}</span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ background: u.status !== false ? '#e8f5e9' : '#ffebee', color: u.status !== false ? '#2e7d32' : '#c62828', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>
                            {u.status !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#666' }}>
                          {formatShortDate(u.createdAt)}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <button style={{ background: '#1565c0', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '6px' }}>Edit</button>
                          <button style={{ background: u.status !== false ? '#c62828' : '#2e7d32', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                            {u.status !== false ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activePage === 'audit' && (
            <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#0d1b4b' }}>System Audit Logs</h3>
                <input placeholder="Search logs..." style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px' }} />
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#0d1b4b', color: 'white' }}>
                    {['User Name', 'Action', 'Module', 'Timestamp', 'Status'].map(h => (
                      <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500' }}>{log.name}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}>{log.action}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#666' }}>{log.module}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#666' }}>
                        {log.time.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: log.status === 'Success' ? '#e8f5e9' : '#ffebee', color: log.status === 'Success' ? '#2e7d32' : '#c62828', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activePage === 'settings' && (
            <div style={{ background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
              <h3 style={{ margin: '0 0 20px', color: '#0d1b4b' }}>General Settings</h3>
              <div style={{ display: 'grid', gap: '16px', maxWidth: '500px' }}>
                {[
                  { label: 'System Timezone', value: 'Asia/Colombo (GMT+5:30)' },
                  { label: 'Currency', value: 'LKR' },
                  { label: 'Support Email', value: 'support@els.com' },
                ].map((s, i) => (
                  <div key={i}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>{s.label.toUpperCase()}</label>
                    <input defaultValue={s.value} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' }} />
                  </div>
                ))}
                <div>
                  <h4 style={{ color: '#0d1b4b', marginBottom: '12px' }}>Notification Settings</h4>
                  {[
                    { label: 'Email Notifications', desc: 'Send email alerts for important updates' },
                    { label: 'BOM Approval Alerts', desc: 'Notify directors when BOMs need approval' },
                    { label: 'Low Stock Alerts', desc: 'Alert when inventory falls below reorder level' },
                  ].map((n, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '500' }}>{n.label}</div>
                        <div style={{ fontSize: '12px', color: '#999' }}>{n.desc}</div>
                      </div>
                      <input type="checkbox" defaultChecked style={{ width: '16px', height: '16px' }} />
                    </div>
                  ))}
                </div>
                <button style={{ background: '#ff9800', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;