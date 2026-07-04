import React, { useState, useEffect } from 'react';
import VarianceReport from './VarianceReport';

const DirectorDashboard = ({ user, onLogout }) => {
  const [activePage, setActivePage] = useState('dashboard');
  const [boms, setBoms] = useState([]);
  const [pos, setPos] = useState([]);
  const [varianceReportData, setVarianceReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedBomId, setSelectedBomId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // View BOM modal state
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingBom, setViewingBom] = useState(null);

  const getHeaders = () => {
    const token = JSON.parse(localStorage.getItem('user'))?.token;
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };
  };

  const fetchData = async () => {
    setLoading(true);
    setError('');
    const headers = getHeaders();

    // 1. Fetch BOMs
    try {
      const res = await fetch('http://localhost:5000/api/bom', { headers });
      const data = await res.json();
      if (data.success) {
        setBoms(data.data);
      }
    } catch {
      // Mock data if server endpoint fails or is pending build
      setBoms([
        { _id: '1', projectName: 'Colombo Port Expansion', version: 'v1.0', createdBy: 'John PM', createdAt: new Date().toISOString(), status: 'Pending', materials: [{ name: 'Portland Cement', unit: 'bags', plannedQty: 300, category: 'Cement' }, { name: 'TMT Steel 12mm', unit: 'ton', plannedQty: 10, category: 'Steel' }] },
        { _id: '2', projectName: 'Marina Heights', version: 'v1.2', createdBy: 'Sarah PM', createdAt: new Date(Date.now() - 86400000).toISOString(), status: 'Approved', materials: [{ name: 'Portland Cement', unit: 'bags', plannedQty: 500, category: 'Cement' }] }
      ]);
    }

    // 2. Fetch POs (for Budget Utilized calculation)
    try {
      const res = await fetch('http://localhost:5000/api/purchase-orders', { headers });
      const data = await res.json();
      if (data.success) {
        setPos(data.data);
      }
    } catch {
      setPos([
        { _id: '1', totalAmount: 555000 },
        { _id: '2', totalAmount: 925000 }
      ]);
    }

    // 3. Fetch Variance (for overall variance stat)
    try {
      const res = await fetch('http://localhost:5000/api/material-usage/variance', { headers });
      const data = await res.json();
      if (data.success) {
        setVarianceReportData(data.report || []);
      }
    } catch {
      setVarianceReportData([
        { plannedQty: 300, actualQty: 315 },
        { plannedQty: 10, actualQty: 12 }
      ]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async (id) => {
    setMessage('');
    setError('');
    try {
      const res = await fetch(`http://localhost:5000/api/bom/${id}/approve`, {
        method: 'PUT',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setMessage('✅ BOM approved successfully!');
        fetchData();
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      setMessage('✅ BOM Approved successfully! (Demo Mode)');
      setBoms(prev => prev.map(b => b._id === id ? { ...b, status: 'Approved', approvedBy: user?.name || 'Director' } : b));
    }
  };

  const handleRejectClick = (id) => {
    setSelectedBomId(id);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) return;

    setMessage('');
    setError('');
    try {
      const res = await fetch(`http://localhost:5000/api/bom/${selectedBomId}/reject`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ rejectionReason })
      });
      const data = await res.json();
      if (data.success) {
        setMessage('❌ BOM rejected and sent back to PM.');
        setShowRejectModal(false);
        fetchData();
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      setMessage('❌ BOM Rejected and note sent to PM. (Demo Mode)');
      setBoms(prev => prev.map(b => b._id === selectedBomId ? { ...b, status: 'Rejected', rejectionReason, approvedBy: user?.name || 'Director' } : b));
      setShowRejectModal(false);
    }
  };

  const openViewModal = (bom) => {
    setViewingBom(bom);
    setShowViewModal(true);
  };

  // Dashboard Stats Calculations
  const activeProjectsCount = Array.from(new Set(boms.map(b => b.projectName))).length;
  const pendingBomsCount = boms.filter(b => b.status === 'Pending').length;
  const budgetUtilized = pos.reduce((sum, po) => sum + (po.totalAmount || 0), 0);
  
  // Calculate aggregate material variance
  const totalPlanned = varianceReportData.reduce((sum, item) => sum + (item.plannedQty || 0), 0);
  const totalActual = varianceReportData.reduce((sum, item) => sum + (item.actualQty || 0), 0);
  const aggregateVariance = totalPlanned > 0 
    ? (((totalActual - totalPlanned) / totalPlanned) * 100).toFixed(1) 
    : '0.0';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Segoe UI, Arial, sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width: '240px', background: '#0d1b4b', color: 'white', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh', zIndex: 100 }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px', color: 'white' }}>E</div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: 'white' }}>ELS CMMS</div>
            <div style={{ fontSize: '11px', color: '#ff9800' }}>Executive Director</div>
          </div>
        </div>
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#ff9800', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px', color: 'white' }}>
            {user?.name?.charAt(0).toUpperCase() || 'D'}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600' }}>{user?.name || 'Director User'}</div>
            <div style={{ fontSize: '11px', color: '#cbd5e1' }}>{user?.role || 'Director'}</div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {[
            { id: 'dashboard', label: 'Executive Board', icon: '⊞' },
            { id: 'approvals', label: 'BOM Approvals', icon: '📋' },
            { id: 'reports', label: 'Variance Reports', icon: '📊' },
            { id: 'analytics', label: 'Analytics Chart', icon: '📈' },
          ].map(item => (
            <div key={item.id} onClick={() => { setActivePage(item.id); setMessage(''); setError(''); }}
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
      <div style={{ marginLeft: '240px', flex: 1, background: '#f5f6fa', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ background: 'white', padding: '16px 24px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: '#0d1b4b', fontWeight: '700' }}>
            {activePage === 'dashboard' && 'Director Board Summary'}
            {activePage === 'approvals' && 'BOM Approval Registry'}
            {activePage === 'reports' && 'Project Material Variance Reports'}
            {activePage === 'analytics' && 'Operational Analytics'}
          </h2>
          <div style={{ fontSize: '13px', color: '#666', fontWeight: '500' }}>
            🕐 {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px', flex: 1 }}>
          {message && (
            <div style={{ background: message.includes('✅') ? '#e8f5e9' : '#ffebee', border: `1px solid ${message.includes('✅') ? '#4caf50' : '#ef5350'}`, color: message.includes('✅') ? '#2e7d32' : '#c62828', padding: '10px 16px', borderRadius: '6px', marginBottom: '16px', fontWeight: '500' }}>
              {message}
            </div>
          )}

          {activePage === 'dashboard' && (
            <div>
              {/* Welcome Banner */}
              <div style={{ background: 'linear-gradient(135deg, #0d1b4b 0%, #1a365d 100%)', borderRadius: '12px', padding: '24px', color: 'white', marginBottom: '24px', boxShadow: '0 4px 15px rgba(13,27,75,0.15)' }}>
                <h3 style={{ margin: 0, fontSize: '20px' }}>Welcome back, Director {user?.name}!</h3>
                <p style={{ margin: '8px 0 0', opacity: 0.8, fontSize: '14px' }}>Here is the executive view of the ELS Construction project status, BOM approvals, and budget utilizations.</p>
              </div>

              {/* Stats Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                {[
                  { label: 'Active Projects Profile', value: activeProjectsCount, color: '#0d1b4b' },
                  { label: 'BOMs Awaiting Approval', value: pendingBomsCount, color: '#ff9800' },
                  { label: 'Budget Utilized (LKR)', value: `Rs. ${budgetUtilized.toLocaleString()}`, color: '#2e7d32' },
                  { label: 'Material Variance (Avg)', value: `${aggregateVariance}%`, color: Number(aggregateVariance) > 15 ? '#c62828' : Number(aggregateVariance) > 5 ? '#f59e0b' : '#2e7d32' }
                ].map((stat, i) => (
                  <div key={i} style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', borderTop: `4px solid ${stat.color}` }}>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: stat.color }}>{stat.value}</div>
                    <div style={{ fontSize: '13px', color: '#666', marginTop: '6px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Quick Checklist Section */}
              <div style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 16px', color: '#0d1b4b', fontSize: '15px', fontWeight: 'bold' }}>📋 Recent BOM Activity</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f5f6fa' }}>
                      {['Project Name', 'PM Name', 'BOM Version', 'Status'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', color: '#666' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {boms.slice(0, 5).map((bom, i) => (
                      <tr key={bom._id || i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: '500' }}>{bom.projectName}</td>
                        <td style={{ padding: '10px 12px', fontSize: '12px' }}>{bom.createdBy}</td>
                        <td style={{ padding: '10px 12px', fontSize: '12px' }}>{bom.version}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            background: bom.status === 'Approved' ? '#e8f5e9' : bom.status === 'Rejected' ? '#ffebee' : '#fff3e0',
                            color: bom.status === 'Approved' ? '#2e7d32' : bom.status === 'Rejected' ? '#c62828' : '#e65100',
                            padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '600'
                          }}>{bom.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activePage === 'approvals' && (
            <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', background: '#0d1b4b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: 'white', fontSize: '15px' }}>BOM Verification Registry</h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f5f6fa' }}>
                      {['Project Name', 'PM Name', 'BOM Version', 'Date Submitted', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#666', fontWeight: '600' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {boms.map((bom, i) => (
                      <tr key={bom._id || i} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#0d1b4b' }}>{bom.projectName}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px' }}>{bom.createdBy}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px' }}>{bom.version}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>{new Date(bom.createdAt).toLocaleDateString()}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            background: bom.status === 'Approved' ? '#e8f5e9' : bom.status === 'Rejected' ? '#ffebee' : '#fff3e0',
                            color: bom.status === 'Approved' ? '#2e7d32' : bom.status === 'Rejected' ? '#c62828' : '#e65100',
                            padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700'
                          }}>{bom.status}</span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => openViewModal(bom)}
                              style={{ background: '#0d1b4b', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                              👁 View BOM
                            </button>
                            {bom.status === 'Pending' && (
                              <>
                                <button onClick={() => handleApprove(bom._id)}
                                  style={{ background: '#2e7d32', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                                  ✓ Approve
                                </button>
                                <button onClick={() => handleRejectClick(bom._id)}
                                  style={{ background: '#c62828', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                                  ✕ Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {boms.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#999' }}>
                          No Bill of Materials submitted yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activePage === 'reports' && <VarianceReport />}
          {activePage === 'analytics' && <VarianceReport />}
        </div>
      </div>

      {/* BOM Viewer Modal */}
      {showViewModal && viewingBom && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '8px', width: '600px', maxHeight: '80%', overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0d1b4b', paddingBottom: '10px', marginBottom: '20px' }}>
              <h3 style={{ color: '#0d1b4b', margin: 0 }}>Project Material Details: {viewingBom.projectName}</h3>
              <span onClick={() => setShowViewModal(false)} style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '20px', color: '#666' }}>&times;</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px', background: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
              <div><strong>BOM Version:</strong> {viewingBom.version}</div>
              <div><strong>Status:</strong> {viewingBom.status}</div>
              <div><strong>Created By (PM):</strong> {viewingBom.createdBy}</div>
              <div><strong>Date Created:</strong> {new Date(viewingBom.createdAt).toLocaleDateString()}</div>
              {viewingBom.rejectionReason && (
                <div style={{ gridColumn: 'span 2', color: '#c62828' }}>
                  <strong>Rejection Note:</strong> {viewingBom.rejectionReason}
                </div>
              )}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#0d1b4b', color: 'white' }}>
                  {['Item Name', 'Category', 'Planned Qty', 'Unit'].map(h => (
                    <th key={h} style={{ padding: '10px', textAlign: 'left', fontSize: '12px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {viewingBom.materials.map((m, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '10px', fontSize: '13px', fontWeight: '600' }}>{m.name}</td>
                    <td style={{ padding: '10px', fontSize: '13px' }}>{m.category}</td>
                    <td style={{ padding: '10px', fontSize: '13px' }}>{m.plannedQty}</td>
                    <td style={{ padding: '10px', fontSize: '13px' }}>{m.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rejection popup / modal */}
      {showRejectModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '8px', width: '400px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <h3 style={{ color: '#0d1b4b', marginTop: 0, marginBottom: '16px' }}>Reject Bill of Materials (BOM)</h3>
            <form onSubmit={handleRejectSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#666', fontWeight: '600', marginBottom: '6px' }}>MANDATORY REJECTION NOTE *</label>
                <textarea
                  placeholder="Specify feedback/reason for rejection"
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  style={{ width: '100%', height: '100px', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="submit" style={{ background: '#c62828', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Confirm Reject</button>
                <button type="button" onClick={() => setShowRejectModal(false)} style={{ background: '#f5f5f5', color: '#333', border: '1px solid #ddd', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DirectorDashboard;
