import React, { useState, useEffect } from 'react';
import SettingsPage from './SettingsPage';

const PMDashboard = ({ user, onLogout }) => {
  const [activePage, setActivePage] = useState('dashboard'); // 'dashboard', 'approvals', 'all-prs', 'bom', 'settings'
  const [requests, setRequests] = useState([]);
  const [boms, setBoms] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // New BOM Form State
  const [bomProjectName, setBomProjectName] = useState('');
  const [bomVersion, setBomVersion] = useState('v1.0');
  const [bomMaterials, setBomMaterials] = useState([
    { name: '', unit: 'bag', plannedQty: 1, category: 'Cement' }
  ]);

  // Rejection modal/popup state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingPrId, setRejectingPrId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const getHeaders = () => {
    const token = JSON.parse(localStorage.getItem('user'))?.token;
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };
  };

  const fetchRequests = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/purchase-requests', {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setRequests(data.data);
      }
    } catch {
      setRequests([
        { _id: '1', projectName: 'Colombo Port Expansion', materials: [{ materialName: 'Portland Cement', quantity: 300, unit: 'bags', reason: 'Foundation concrete' }], status: 'Pending', requestedBy: 'Mike Storekeeper', createdAt: new Date().toISOString(), notes: 'Urgent request' },
        { _id: '2', projectName: 'Marina Heights', materials: [{ materialName: 'TMT Steel 12mm', quantity: 5, unit: 'ton', reason: 'Column reinforcement' }], status: 'Pending', requestedBy: 'Mike Storekeeper', createdAt: new Date(Date.now() - 86400000).toISOString(), notes: '' },
        { _id: '3', projectName: 'Business Bay Office', materials: [{ materialName: 'River Sand', quantity: 20, unit: 'm3', reason: 'Plastering work' }], status: 'Approved', requestedBy: 'Mike Storekeeper', approvedBy: 'John PM', createdAt: new Date(Date.now() - 172800000).toISOString(), notes: '' },
      ]);
    }
  };

  const fetchBoms = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/bom', {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setBoms(data.data);
      }
    } catch {
      setBoms([
        { _id: '1', projectName: 'Colombo Port Expansion', version: 'v1.0', createdBy: 'John PM', createdAt: new Date().toISOString(), status: 'Pending', materials: [{ name: 'Portland Cement', unit: 'bags', plannedQty: 300, category: 'Cement' }] }
      ]);
    }
  };

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

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([fetchRequests(), fetchBoms(), fetchNotifications()]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/api/purchase-requests/${id}/approve`, {
        method: 'PUT',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setMessage('✅ PR Approved successfully!');
        fetchRequests();
      }
    } catch {
      setMessage('✅ PR Approved! (Demo mode)');
      setRequests(prev => prev.map(r => r._id === id ? { ...r, status: 'Approved', approvedBy: user?.name || 'Project Manager' } : r));
    }
  };

  const handleRejectClick = (id) => {
    setRejectingPrId(id);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) return;

    try {
      const res = await fetch(`http://localhost:5000/api/purchase-requests/${rejectingPrId}/reject`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ rejectionReason })
      });
      const data = await res.json();
      if (data.success) {
        setMessage('❌ PR Rejected successfully!');
        setShowRejectModal(false);
        fetchRequests();
      }
    } catch {
      setMessage('❌ PR Rejected! (Demo mode)');
      setRequests(prev => prev.map(r => r._id === rejectingPrId ? { ...r, status: 'Rejected', rejectionReason } : r));
      setShowRejectModal(false);
    }
  };

  // Add / Remove material rows in Create BOM Form
  const handleAddMaterialRow = () => {
    setBomMaterials([...bomMaterials, { name: '', unit: 'bag', plannedQty: 1, category: 'Cement' }]);
  };

  const handleRemoveMaterialRow = (idx) => {
    if (bomMaterials.length === 1) return;
    setBomMaterials(bomMaterials.filter((_, i) => i !== idx));
  };

  const handleMaterialChange = (idx, field, val) => {
    const updated = [...bomMaterials];
    updated[idx][field] = val;
    setBomMaterials(updated);
  };

  // Create new BOM submit handler
  const handleSubmitBOM = async (e) => {
    e.preventDefault();
    setMessage('');
    
    if (!bomProjectName.trim() || !bomVersion.trim()) {
      setMessage('⚠️ Please provide project name and version.');
      return;
    }

    const invalid = bomMaterials.some(m => !m.name.trim() || m.plannedQty <= 0);
    if (invalid) {
      setMessage('⚠️ Please provide valid names and positive quantities for all materials.');
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/bom', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          projectName: bomProjectName,
          version: bomVersion,
          materials: bomMaterials.map(m => ({
            name: m.name,
            unit: m.unit,
            plannedQty: Number(m.plannedQty),
            category: m.category
          }))
        })
      });
      const data = await res.json();
      if (data.success) {
        setMessage('✅ BOM submitted to Director successfully!');
        setBomProjectName('');
        setBomVersion('v1.0');
        setBomMaterials([{ name: '', unit: 'bag', plannedQty: 1, category: 'Cement' }]);
        fetchBoms();
      } else {
        setMessage(`❌ Failed: ${data.message}`);
      }
    } catch {
      setMessage('✅ BOM submitted successfully! (Demo mode)');
      const newMockBom = {
        _id: String(Date.now()),
        projectName: bomProjectName,
        version: bomVersion,
        createdBy: user?.name || 'Project Manager',
        status: 'Pending',
        materials: bomMaterials,
        createdAt: new Date().toISOString()
      };
      setBoms(prev => [newMockBom, ...prev]);
      setBomProjectName('');
      setBomVersion('v1.0');
      setBomMaterials([{ name: '', unit: 'bag', plannedQty: 1, category: 'Cement' }]);
    }
  };

  const stats = [
    { label: 'Total PRs', value: requests.length, color: '#1565c0' },
    { label: 'Pending PR Approval', value: requests.filter(r => r.status === 'Pending').length, color: '#e65100' },
    { label: 'Total BOMs Tracked', value: boms.length, color: '#0d1b4b' },
    { label: 'Pending BOM Approvals', value: boms.filter(b => b.status === 'Pending').length, color: '#ff9800' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Segoe UI, Arial, sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width: '240px', background: '#0d1b4b', color: 'white', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh', zIndex: 100 }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px', color: 'white' }}>E</div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: 'white' }}>ELS CMMS</div>
            <div style={{ fontSize: '11px', color: '#ff9800' }}>PM Workspace</div>
          </div>
        </div>
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#ff9800', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px' }}>
            {user?.name?.charAt(0).toUpperCase() || 'P'}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600' }}>{user?.name || 'Project Manager'}</div>
            <div style={{ fontSize: '11px', color: '#90caf9' }}>Project Manager</div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: '⊞' },
            { id: 'approvals', label: 'PR Approvals', icon: '📋' },
            { id: 'all-prs', label: 'All PRs', icon: '📁' },
            { id: 'bom', label: 'BOM Management', icon: '🏗️' },
            { id: 'settings', label: 'Settings', icon: '⚙️' },
          ].map(item => (
            <div key={item.id} onClick={() => { setActivePage(item.id); setMessage(''); }}
              style={{ padding: '12px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', background: activePage === item.id ? 'rgba(255,152,0,0.2)' : 'transparent', borderLeft: activePage === item.id ? '3px solid #ff9800' : '3px solid transparent', color: activePage === item.id ? '#ff9800' : '#ccc', transition: 'all 0.2s' }}>
              <span>{item.icon}</span>{item.label}
            </div>
          ))}
        </nav>
        <div onClick={onLogout} style={{ padding: '16px 20px', cursor: 'pointer', borderTop: '1px solid rgba(255,255,255,0.1)', color: '#ef5350', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          🚪 Logout Session
        </div>
      </div>

      {/* Main Content */}
      <div style={{ marginLeft: '240px', flex: 1, background: '#f5f6fa', minHeight: '100vh' }}>
        <div style={{ background: 'white', padding: '16px 24px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: '#0d1b4b', fontWeight: '700' }}>
            {activePage === 'dashboard' && 'PM Executive Overview'}
            {activePage === 'approvals' && 'Purchase Request Approvals'}
            {activePage === 'all-prs' && 'Purchase Request Archive'}
            {activePage === 'bom' && 'Bill of Materials (BOM) Management'}
            {activePage === 'settings' && 'User Settings & Preferences'}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {/* Notification Bell */}
            <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setShowNotifications(!showNotifications)}>
              <span style={{ fontSize: '20px' }}>🔔</span>
              {notifications.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  background: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {notifications.length}
                </span>
              )}
              {showNotifications && (
                <div style={{
                  position: 'absolute',
                  top: '30px',
                  right: '0',
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  width: '300px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  zIndex: 1000,
                  cursor: 'default',
                  textAlign: 'left'
                }} onClick={e => e.stopPropagation()}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold', color: '#0d1b4b', fontSize: '14px' }}>
                    Low Stock Alerts
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '16px', color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
                      All stock levels are normal.
                    </div>
                  ) : (
                    notifications.map((notif, idx) => (
                      <div key={idx} style={{
                        padding: '12px 16px',
                        borderBottom: idx === notifications.length - 1 ? 'none' : '1px solid #f1f5f9',
                        fontSize: '13px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600', marginBottom: '4px' }}>
                          <span style={{ color: '#0d1b4b' }}>{notif.materialName}</span>
                          <span style={{
                            color: notif.alertLevel === 'Critical' ? '#ef4444' : '#f59e0b',
                            background: notif.alertLevel === 'Critical' ? '#fef2f2' : '#fef3c7',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px'
                          }}>
                            {notif.alertLevel}
                          </span>
                        </div>
                        <div style={{ color: '#475569', fontSize: '12px' }}>
                          Qty: <strong>{notif.currentQty}</strong> / Min: {notif.minimumStock}
                        </div>
                        <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>
                          📍 {notif.location}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div style={{ fontSize: '13px', color: '#666', fontWeight: '500' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          {message && (
            <div style={{ background: message.includes('✅') ? '#e8f5e9' : message.includes('⚠️') ? '#fff3e0' : '#ffebee', border: `1px solid ${message.includes('✅') ? '#4caf50' : message.includes('⚠️') ? '#f59e0b' : '#ef5350'}`, color: message.includes('✅') ? '#2e7d32' : message.includes('⚠️') ? '#b7791f' : '#c62828', padding: '10px 16px', borderRadius: '6px', marginBottom: '16px', fontWeight: '500' }}>
              {message}
            </div>
          )}

          {/* Stats Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            {stats.map((s, i) => (
              <div key={i} style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', borderTop: `4px solid ${s.color}` }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '13px', color: '#666', marginTop: '6px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {activePage === 'dashboard' && (
            <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', background: '#0d1b4b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: 'white', fontSize: '15px' }}>⏳ Pending PR Material Requests checklist</h3>
                <button onClick={fetchRequests} style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid white', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}>Refresh</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f5f6fa' }}>
                    {['PR No.', 'Project', 'Materials requested', 'Date', 'Requested By', 'Notes', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#666', fontWeight: '600', borderBottom: '1px solid #e0e0e0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requests.filter(r => r.status === 'Pending').map((req, i) => (
                    <tr key={req._id} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1565c0', fontWeight: '600' }}>PR-{String(i + 1).padStart(3, '0')}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500' }}>{req.projectName || req.project}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>
                        {req.materials?.map((m, idx) => (
                          <div key={idx}>{m.materialName} ({m.quantity} {m.unit}) {m.reason && ` - [Reason: ${m.reason}]`}</div>
                        ))}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px' }}>{req.requestedBy}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>{req.notes || '-'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => handleApprove(req._id)}
                            style={{ background: '#2e7d32', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                            ✓ Approve
                          </button>
                          <button onClick={() => handleRejectClick(req._id)}
                            style={{ background: '#c62828', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                            ✕ Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {requests.filter(r => r.status === 'Pending').length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#999', fontSize: '14px' }}>
                        🎉 No pending purchase requests requiring approval!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activePage === 'approvals' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Pending Section */}
              <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', background: '#e65100' }}>
                  <h3 style={{ margin: 0, color: 'white', fontSize: '15px' }}>⏳ Pending Section</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f5f6fa' }}>
                      {['PR No.', 'Project', 'Materials list', 'Date', 'Requested By', 'Notes', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#666', fontWeight: '600' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {requests.filter(r => r.status === 'Pending').map((req, i) => (
                      <tr key={req._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1565c0', fontWeight: '600' }}>PR-{String(i + 1).padStart(3, '0')}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500' }}>{req.projectName || req.project}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>
                          {req.materials?.map((m, idx) => (
                            <div key={idx}>{m.materialName} ({m.quantity} {m.unit})</div>
                          ))}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>{new Date(req.createdAt).toLocaleDateString()}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px' }}>{req.requestedBy}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>{req.notes || '-'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => handleApprove(req._id)}
                              style={{ background: '#2e7d32', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✓ Approve</button>
                            <button onClick={() => handleRejectClick(req._id)}
                              style={{ background: '#c62828', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✕ Reject</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {requests.filter(r => r.status === 'Pending').length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>No pending PRs.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Approved Section */}
              <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', background: '#2e7d32' }}>
                  <h3 style={{ margin: 0, color: 'white', fontSize: '15px' }}>✓ Approved Section</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f5f6fa' }}>
                      {['PR No.', 'Project', 'Materials list', 'Date', 'Requested By', 'Approved By'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#666', fontWeight: '600' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {requests.filter(r => r.status === 'Approved').map((req, i) => (
                      <tr key={req._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1565c0', fontWeight: '600' }}>PR-{String(i + 1).padStart(3, '0')}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500' }}>{req.projectName || req.project}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>
                          {req.materials?.map((m, idx) => (
                            <div key={idx}>{m.materialName} ({m.quantity} {m.unit})</div>
                          ))}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>{new Date(req.createdAt).toLocaleDateString()}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px' }}>{req.requestedBy}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#2e7d32' }}>{req.approvedBy || 'Project Manager'}</td>
                      </tr>
                    ))}
                    {requests.filter(r => r.status === 'Approved').length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>No approved PRs yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activePage === 'all-prs' && (
            <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
                <h3 style={{ margin: 0, color: '#0d1b4b' }}>PR History Archive</h3>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#0d1b4b', color: 'white' }}>
                    {['PR No.', 'Project Name', 'Materials list', 'Requested By', 'Notes', 'Date', 'Status', 'Status Info'].map(h => (
                      <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req, i) => (
                    <tr key={req._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1565c0', fontWeight: '600' }}>PR-{String(i + 1).padStart(3, '0')}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500' }}>{req.projectName || req.project}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>
                        {req.materials?.map((m, idx) => (
                          <div key={idx}>{m.materialName} ({m.quantity} {m.unit})</div>
                        ))}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px' }}>{req.requestedBy}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>{req.notes || '-'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>{new Date(req.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          background: req.status === 'Approved' ? '#e8f5e9' : req.status === 'Rejected' ? '#ffebee' : '#fff3e0',
                          color: req.status === 'Approved' ? '#2e7d32' : req.status === 'Rejected' ? '#c62828' : '#e65100',
                          padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600'
                        }}>
                          {req.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>
                        {req.status === 'Approved' && `Approved by ${req.approvedBy || 'PM'}`}
                        {req.status === 'Rejected' && `Reason: ${req.rejectionReason || 'No reason'}`}
                        {req.status === 'Pending' && 'Awaiting PM action'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activePage === 'bom' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}>
              {/* Create BOM Form */}
              <div style={{ background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 20px', color: '#0d1b4b', borderBottom: '2px solid #0d1b4b', paddingBottom: '10px', fontWeight: '700' }}>🏗️ Create New Bill of Materials (BOM)</h3>
                <form onSubmit={handleSubmitBOM}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#475569', fontWeight: '700', marginBottom: '6px' }}>PROJECT NAME *</label>
                      <input
                        type="text"
                        placeholder="e.g. Colombo Port Expansion"
                        value={bomProjectName}
                        onChange={e => setBomProjectName(e.target.value)}
                        style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#475569', fontWeight: '700', marginBottom: '6px' }}>BOM VERSION *</label>
                      <input
                        type="text"
                        placeholder="e.g. v1.0"
                        value={bomVersion}
                        onChange={e => setBomVersion(e.target.value)}
                        style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                        required
                      />
                    </div>
                  </div>

                  <h4 style={{ color: '#0d1b4b', margin: '20px 0 10px', fontSize: '14px', fontWeight: '700' }}>Material Allocation Table</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                        {['Item Name *', 'Unit *', 'Planned/Req Qty *', 'Category *', 'Action'].map(h => (
                          <th key={h} style={{ padding: '10px', textAlign: 'left', fontSize: '12px', color: '#475569', fontWeight: '600' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bomMaterials.map((m, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 4px' }}>
                            <input
                              type="text"
                              placeholder="Material name"
                              value={m.name}
                              onChange={e => handleMaterialChange(idx, 'name', e.target.value)}
                              style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }}
                              required
                            />
                          </td>
                          <td style={{ padding: '8px 4px', width: '100px' }}>
                            <input
                              type="text"
                              placeholder="e.g. bag, ton"
                              value={m.unit}
                              onChange={e => handleMaterialChange(idx, 'unit', e.target.value)}
                              style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }}
                              required
                            />
                          </td>
                          <td style={{ padding: '8px 4px', width: '120px' }}>
                            <input
                              type="number"
                              min="1"
                              value={m.plannedQty}
                              onChange={e => handleMaterialChange(idx, 'plannedQty', e.target.value)}
                              style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }}
                              required
                            />
                          </td>
                          <td style={{ padding: '8px 4px', width: '150px' }}>
                            <select
                              value={m.category}
                              onChange={e => handleMaterialChange(idx, 'category', e.target.value)}
                              style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', background: 'white' }}
                            >
                              <option value="Cement">Cement</option>
                              <option value="Steel">Steel</option>
                              <option value="Sand">Sand</option>
                              <option value="Gravel">Gravel</option>
                              <option value="Brick">Bricks / Blocks</option>
                              <option value="Other">Other Category</option>
                            </select>
                          </td>
                          <td style={{ padding: '8px 4px', width: '80px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveMaterialRow(idx)}
                              disabled={bomMaterials.length === 1}
                              style={{ background: '#ef4444', color: 'white', border: 'none', width: '32px', height: '32px', borderRadius: '4px', cursor: bomMaterials.length === 1 ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={handleAddMaterialRow}
                      style={{ background: '#f1f5f9', color: '#0d1b4b', border: '1px solid #cbd5e1', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
                    >
                      ➕ Add Material Row
                    </button>
                    <button
                      type="submit"
                      style={{ background: '#ff9800', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', boxShadow: '0 4px 10px rgba(255,152,0,0.15)' }}
                    >
                      🚀 Submit BOM to Director
                    </button>
                  </div>
                </form>
              </div>

              {/* View BOM Status List */}
              <div style={{ background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 20px', color: '#0d1b4b', borderBottom: '2px solid #0d1b4b', paddingBottom: '10px', fontWeight: '700' }}>📋 Bill of Materials (BOM) Status Registry</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                        {['Project Name', 'Version', 'Date Submitted', 'Status', 'Feedback / Director Note'].map(h => (
                          <th key={h} style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: '#475569', fontWeight: '600' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {boms.map((b, idx) => (
                        <tr key={b._id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px', fontSize: '13px', fontWeight: '600', color: '#0d1b4b' }}>{b.projectName}</td>
                          <td style={{ padding: '12px', fontSize: '13px' }}>{b.version}</td>
                          <td style={{ padding: '12px', fontSize: '12px', color: '#64748b' }}>{new Date(b.createdAt).toLocaleDateString()}</td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              background: b.status === 'Approved' ? '#e8f5e9' : b.status === 'Rejected' ? '#ffebee' : '#fff3e0',
                              color: b.status === 'Approved' ? '#2e7d32' : b.status === 'Rejected' ? '#c62828' : '#e65100',
                              padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700'
                            }}>{b.status}</span>
                          </td>
                          <td style={{ padding: '12px', fontSize: '13px', color: '#c62828', fontWeight: '500' }}>
                            {b.status === 'Rejected' ? `❌ Reason: ${b.rejectionReason || 'No feedback details'}` : b.status === 'Approved' ? '✅ Ready for material logging' : '⏳ Awaiting director validation'}
                          </td>
                        </tr>
                      ))}
                      {boms.length === 0 && (
                        <tr>
                          <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                            No BOM logs found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activePage === 'settings' && <SettingsPage user={user} onLogout={onLogout} />}
        </div>
      </div>

      {/* Rejection reason popup / modal */}
      {showRejectModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '8px', width: '400px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <h3 style={{ color: '#0d1b4b', marginTop: 0, marginBottom: '16px' }}>Reject Purchase Request</h3>
            <form onSubmit={handleRejectSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#666', fontWeight: '600', marginBottom: '6px' }}>REJECTION REASON *</label>
                <input
                  type="text"
                  placeholder="Specify why this PR is rejected"
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="submit" style={{ background: '#c62828', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Reject PR</button>
                <button type="button" onClick={() => setShowRejectModal(false)} style={{ background: '#f5f5f5', color: '#333', border: '1px solid #ddd', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PMDashboard;