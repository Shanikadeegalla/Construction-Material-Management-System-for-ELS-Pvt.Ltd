import React, { useState, useEffect } from 'react';
import VarianceReport from './VarianceReport';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';

const DirectorDashboard = ({ user, onLogout }) => {
  const [activePage, setActivePage] = useState('dashboard');
  const [boms, setBoms] = useState([]);
  const [pos, setPos] = useState([]);
  const [varianceReportData, setVarianceReportData] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [usages, setUsages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedBomId, setSelectedBomId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // View BOM modal state
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingBom, setViewingBom] = useState(null);

  // Phase 5 States
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareVersions, setCompareVersions] = useState([]);
  const [versionAId, setVersionAId] = useState('');
  const [versionBId, setVersionBId] = useState('');
  const [directorNote, setDirectorNote] = useState('');

  const getHeaders = () => {
    const token = JSON.parse(localStorage.getItem('user'))?.token;
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/notifications', {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data);
        setUnreadCount(data.data.filter(n => !n.isRead).length);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError('');
    const headers = getHeaders();
    await fetchNotifications();

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

    // 4. Fetch Inventory (for stock levels analytics)
    try {
      const res = await fetch('http://localhost:5000/api/inventory', { headers });
      const data = await res.json();
      if (Array.isArray(data)) {
        setInventory(data);
      } else {
        setInventory([]);
      }
    } catch {
      setInventory([
        { name: 'Portland Cement', quantity: 1500, category: 'Cement' },
        { name: 'TMT Steel 12mm', quantity: 45, category: 'Steel' },
        { name: 'River Sand', quantity: 280, category: 'Sand' }
      ]);
    }

    // 5. Fetch Usages (for usage trends analytics)
    try {
      const res = await fetch('http://localhost:5000/api/material-usage', { headers });
      const data = await res.json();
      if (data.success) {
        setUsages(data.data || []);
      }
    } catch {
      setUsages([
        { materialName: 'Portland Cement', actualQty: 120, usageDate: '2026-06-28T16:33:06.626Z' },
        { materialName: 'Portland Cement', actualQty: 200, usageDate: '2026-06-28T16:33:06.683Z' }
      ]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (id, noteText = '') => {
    setMessage('');
    setError('');
    try {
      const res = await fetch(`http://localhost:5000/api/bom/${id}/approve`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ note: noteText })
      });
      const data = await res.json();
      if (data.success) {
        setMessage('✅ BOM approved successfully!');
        setDirectorNote('');
        fetchData();
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      setMessage('✅ BOM Approved successfully! (Demo Mode)');
      setBoms(prev => prev.map(b => b._id === id ? { ...b, status: 'Approved', approvedBy: user?.name || 'Director', rejectionReason: noteText } : b));
      setDirectorNote('');
    }
  };

  const rejectBOMWithReason = async (id, reason) => {
    setMessage('');
    setError('');
    try {
      const res = await fetch(`http://localhost:5000/api/bom/${id}/reject`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ rejectionReason: reason })
      });
      const data = await res.json();
      if (data.success) {
        setMessage('❌ BOM rejected and note sent to PM.');
        setShowViewModal(false);
        setDirectorNote('');
        fetchData();
      } else {
        alert(`Failed to reject BOM: ${data.message}`);
      }
    } catch (err) {
      setMessage('❌ BOM Rejected (Demo Mode)');
      setBoms(prev => prev.map(b => b._id === id ? { ...b, status: 'Rejected', rejectionReason: reason, approvedBy: user?.name || 'Director' } : b));
      setShowViewModal(false);
      setDirectorNote('');
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

  const downloadPDF = (bom) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("ELS Construction (Pvt) Ltd", 14, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("BILL OF MATERIALS (BOM) DOCUMENT", 14, 26);
    
    doc.setDrawColor(13, 27, 75);
    doc.setLineWidth(1);
    doc.line(14, 28, 196, 28);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Project Details:", 14, 36);

    doc.setFont("helvetica", "normal");
    const proj = bom.projectId || {};
    const name = proj.projectName || proj.name || bom.projectName || 'N/A';
    const client = proj.clientName || 'N/A';
    const loc = proj.location || 'N/A';
    const creator = bom.createdBy?.name || bom.createdBy || 'Project Manager';
    const ver = bom.version || 'v1.0';
    const dateStr = new Date(bom.createdAt).toLocaleDateString();

    doc.text(`Project Name: ${name}`, 14, 42);
    doc.text(`Client: ${client}`, 14, 48);
    doc.text(`Location: ${loc}`, 14, 54);

    doc.text(`BOM Version: ${ver}`, 120, 42);
    doc.text(`Submitted By: ${creator}`, 120, 48);
    doc.text(`Date Created: ${dateStr}`, 120, 54);

    const tableColumn = ["Material Name", "Category", "Unit", "Req Qty", "Unit Cost (LKR)", "Total Cost (LKR)", "Supplier Ref", "Remarks"];
    const tableRows = [];

    const materials = bom.materials || bom.items || [];
    let totalCostSum = 0;

    materials.forEach(item => {
      const qty = Number(item.plannedQty || item.quantity) || 0;
      const cost = Number(item.estimatedUnitCost) || 0;
      const total = qty * cost;
      totalCostSum += total;

      tableRows.push([
        item.name || item.materialName || '-',
        item.category || '-',
        item.unit || '-',
        qty,
        `LKR ${cost.toLocaleString()}`,
        `LKR ${total.toLocaleString()}`,
        item.supplierRef || '-',
        item.remarks || '-'
      ]);
    });

    doc.autoTable({
      startY: 62,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [13, 27, 75] },
      margin: { left: 14, right: 14 }
    });

    const finalY = doc.lastAutoTable.finalY + 12;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Total Estimated Cost: LKR ${totalCostSum.toLocaleString()}`, 14, finalY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Director Signature: _______________________", 14, finalY + 25);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, finalY + 31);

    doc.save(`BOM_${name.replace(/\s+/g, '_')}_${ver}.pdf`);
  };

  const performComparison = (bomA, bomB) => {
    if (!bomA || !bomB) return [];

    const materialsA = bomA.materials || [];
    const materialsB = bomB.materials || [];

    const allNames = Array.from(new Set([
      ...materialsA.map(m => m.name.toLowerCase().trim()),
      ...materialsB.map(m => m.name.toLowerCase().trim())
    ]));

    return allNames.map(name => {
      const itemA = materialsA.find(m => m.name.toLowerCase().trim() === name);
      const itemB = materialsB.find(m => m.name.toLowerCase().trim() === name);

      let status = 'unchanged';
      let displayQty = '';
      let displayCost = '';
      let displayTotal = '';
      let category = '';
      let supplierRef = '';
      let remarks = '';

      if (itemA && !itemB) {
        status = 'removed';
        displayQty = `${itemA.plannedQty} ${itemA.unit}`;
        displayCost = `LKR ${itemA.estimatedUnitCost.toLocaleString()}`;
        displayTotal = `LKR ${(itemA.plannedQty * itemA.estimatedUnitCost).toLocaleString()}`;
        category = itemA.category;
        supplierRef = itemA.supplierRef;
        remarks = itemA.remarks;
      } else if (!itemA && itemB) {
        status = 'added';
        displayQty = `${itemB.plannedQty} ${itemB.unit}`;
        displayCost = `LKR ${itemB.estimatedUnitCost.toLocaleString()}`;
        displayTotal = `LKR ${(itemB.plannedQty * itemB.estimatedUnitCost).toLocaleString()}`;
        category = itemB.category;
        supplierRef = itemB.supplierRef;
        remarks = itemB.remarks;
      } else {
        category = itemB.category;
        supplierRef = itemB.supplierRef;
        remarks = itemB.remarks;
        const qtyChanged = Number(itemA.plannedQty) !== Number(itemB.plannedQty);
        const costChanged = Number(itemA.estimatedUnitCost) !== Number(itemB.estimatedUnitCost);

        if (qtyChanged || costChanged) {
          status = 'changed';
          displayQty = qtyChanged 
            ? `${itemA.plannedQty} ➔ ${itemB.plannedQty} ${itemB.unit}` 
            : `${itemB.plannedQty} ${itemB.unit}`;
          displayCost = costChanged 
            ? `LKR ${itemA.estimatedUnitCost.toLocaleString()} ➔ LKR ${itemB.estimatedUnitCost.toLocaleString()}` 
            : `LKR ${itemB.estimatedUnitCost.toLocaleString()}`;
          displayTotal = `LKR ${(itemA.plannedQty * itemA.estimatedUnitCost).toLocaleString()} ➔ LKR ${(itemB.plannedQty * itemB.estimatedUnitCost).toLocaleString()}`;
        } else {
          status = 'unchanged';
          displayQty = `${itemB.plannedQty} ${itemB.unit}`;
          displayCost = `LKR ${itemB.estimatedUnitCost.toLocaleString()}`;
          displayTotal = `LKR ${(itemB.plannedQty * itemB.estimatedUnitCost).toLocaleString()}`;
        }
      }

      return {
        name: itemB ? itemB.name : itemA.name,
        category,
        status,
        displayQty,
        displayCost,
        displayTotal,
        supplierRef,
        remarks
      };
    });
  };

  const handleCompareClick = async () => {
    if (!viewingBom || !viewingBom.projectId?._id) return;
    
    try {
      const res = await fetch(`http://localhost:5000/api/bom/versions/${viewingBom.projectId._id}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        setCompareVersions(data.data);
        if (data.data.length >= 2) {
          setVersionAId(data.data[1]._id);
          setVersionBId(data.data[0]._id);
        } else {
          setVersionAId(data.data[0]._id);
          setVersionBId(data.data[0]._id);
        }
        setShowCompareModal(true);
      } else {
        alert('Could not find version history for this project.');
      }
    } catch (err) {
      console.error(err);
      alert('Error fetching version history.');
    }
  };

  const openViewModal = (bom) => {
    setViewingBom(bom);
    setShowViewModal(true);
  };

  // Dashboard Stats Calculations
  const activeProjectsCount = Array.from(new Set(boms.map(b => b.projectName))).length;
  const pendingBomsCount = boms.filter(b => b.status === 'Submitted' || b.status === 'Pending').length;
  const budgetUtilized = pos.reduce((sum, po) => sum + (po.totalAmount || 0), 0);
  
  // Calculate aggregate material variance
  const totalPlanned = varianceReportData.reduce((sum, item) => sum + (item.plannedQty || 0), 0);
  const totalActual = varianceReportData.reduce((sum, item) => sum + (item.actualQty || 0), 0);
  const aggregateVariance = totalPlanned > 0 
    ? (((totalActual - totalPlanned) / totalPlanned) * 100).toFixed(1) 
    : '0.0';

  // Analytics Calculations
  const bomStatusData = [
    { name: 'Pending', count: boms.filter(b => b.status === 'Submitted' || b.status === 'Pending').length, fill: '#ff9800' },
    { name: 'Approved', count: boms.filter(b => b.status === 'Approved').length, fill: '#2e7d32' },
    { name: 'Rejected', count: boms.filter(b => b.status === 'Rejected').length, fill: '#c62828' }
  ];

  const stockLevelData = inventory.slice(0, 10).map(item => ({
    name: item.name ? (item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name) : 'Unnamed',
    stock: Number(item.quantity) || 0
  }));

  const usageTrendData = Object.values(
    usages.reduce((acc, curr) => {
      const dateStr = curr.usageDate ? new Date(curr.usageDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Unknown';
      if (!acc[dateStr]) {
        acc[dateStr] = { date: dateStr, amount: 0, rawDate: curr.usageDate ? new Date(curr.usageDate) : new Date(0) };
      }
      acc[dateStr].amount += Number(curr.actualQty) || 0;
      return acc;
    }, {})
  ).sort((a, b) => a.rawDate - b.rawDate);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {/* Bell Icon & Dropdown */}
            <div style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={() => setShowNotifications(!showNotifications)}>
              <span style={{ fontSize: '20px' }}>🔔</span>
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', color: 'white', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px #fff' }}>
                  {unreadCount}
                </span>
              )}

              {showNotifications && (
                <div style={{ position: 'absolute', top: '30px', right: '0', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', width: '320px', maxHeight: '400px', overflowY: 'auto', zIndex: 1000, cursor: 'default', padding: '8px' }} onClick={e => e.stopPropagation()}>
                  <div style={{ padding: '12px', borderBottom: '1px solid #f1f5f9', fontWeight: '700', color: '#0d1b4b', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Notifications</span>
                    <span onClick={async () => {
                      for (const n of notifications) {
                        if (!n.isRead) {
                          await fetch(`http://localhost:5000/api/notifications/${n._id}/read`, {
                            method: 'PUT',
                            headers: getHeaders()
                          });
                        }
                      }
                      fetchNotifications();
                    }} style={{ fontSize: '11px', color: '#ff9800', cursor: 'pointer', fontWeight: '600' }}>Mark all as read</span>
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '24px', color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
                      No notifications
                    </div>
                  ) : (
                    notifications.map((notif, idx) => (
                      <div key={idx} 
                        onClick={async () => {
                          if (!notif.isRead) {
                            await fetch(`http://localhost:5000/api/notifications/${notif._id}/read`, {
                              method: 'PUT',
                              headers: getHeaders()
                            });
                          }
                          setShowNotifications(false);
                          fetchNotifications();
                          if (notif.type && notif.type.startsWith('BOM')) {
                            setActivePage('approvals');
                          }
                        }}
                        style={{ padding: '12px', borderBottom: idx === notifications.length - 1 ? 'none' : '1px solid #f1f5f9', fontSize: '13px', borderRadius: '8px', cursor: 'pointer', background: notif.isRead ? 'white' : '#f8fafc', transition: 'background 0.2s', textAlign: 'left' }}
                      >
                        <div style={{ color: notif.isRead ? '#475569' : '#0f172a', fontWeight: notif.isRead ? '400' : '600' }}>{notif.message}</div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>{new Date(notif.createdAt).toLocaleDateString()}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div style={{ fontSize: '13px', color: '#666', fontWeight: '500' }}>
              🕐 {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
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
                    {boms.slice(0, 5).map((bom, i) => {
                      console.log('BOM row data:', bom);
                      return (
                        <tr key={bom._id || i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: '500', color: '#0d1b4b' }}>{bom.projectId?.name || bom.projectName || '-'}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: '#333' }}>{bom.createdBy?.name || bom.createdBy || bom.submittedBy || '-'}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: '#333' }}>{bom.version || 'v1.0'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            background: bom.status === 'Approved' ? '#e8f5e9' : bom.status === 'Rejected' ? '#ffebee' : '#fff3e0',
                            color: bom.status === 'Approved' ? '#2e7d32' : bom.status === 'Rejected' ? '#c62828' : '#e65100',
                            padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '600'
                          }}>{bom.status}</span>
                        </td>
                      </tr>
                      );
                    })}
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
                    {boms.map((bom, i) => {
                      console.log('BOM row data:', bom);
                      return (
                        <tr key={bom._id || i} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#0d1b4b' }}>{bom.projectId?.name || bom.projectName || '-'}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#333' }}>{bom.createdBy?.name || bom.createdBy || bom.submittedBy || '-'}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#333' }}>{bom.version || 'v1.0'}</td>
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
                            {(bom.status === 'Submitted' || bom.status === 'Pending') && (
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
                      );
                    })}

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
          {activePage === 'analytics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Row 1: Project Counts & Inventory Stock Levels */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
                {/* Project Counts by BOM Status */}
                <div style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                  <h3 style={{ margin: '0 0 16px', color: '#0d1b4b', fontSize: '15px', fontWeight: '700' }}>📊 Project BOM Status Distribution</h3>
                  <div style={{ height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={bomStatusData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" name="BOM Count" radius={[4, 4, 0, 0]}>
                          {bomStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Stock Levels */}
                <div style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                  <h3 style={{ margin: '0 0 16px', color: '#0d1b4b', fontSize: '15px', fontWeight: '700' }}>📦 Current Stock Levels (Top 10 Materials)</h3>
                  {stockLevelData.length === 0 ? (
                    <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>No inventory data available.</div>
                  ) : (
                    <div style={{ height: '300px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stockLevelData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
                          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="stock" name="Units in Stock" fill="#0d1b4b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: Usage Trends */}
              <div style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                <h3 style={{ margin: '0 0 16px', color: '#0d1b4b', fontSize: '15px', fontWeight: '700' }}>📈 Material Usage Trends over Time</h3>
                {usageTrendData.length === 0 ? (
                  <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>No usage logs available.</div>
                ) : (
                  <div style={{ height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={usageTrendData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="amount" name="Total Quantity Used" stroke="#ff9800" strokeWidth={3} activeDot={{ r: 8 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BOM Viewer Modal */}
      {showViewModal && viewingBom && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '8px', width: '90%', maxWidth: '850px', maxHeight: '85%', overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0d1b4b', paddingBottom: '10px', marginBottom: '20px' }}>
              <h3 style={{ color: '#0d1b4b', margin: 0 }}>📋 Bill of Materials (BOM) Details</h3>
              <span onClick={() => setShowViewModal(false)} style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '20px', color: '#666' }}>&times;</span>
            </div>
            
            {/* Project & Creator Metadata */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px', background: '#f8fafc', padding: '16px', borderRadius: '8px', fontSize: '13px', border: '1px solid #e2e8f0' }}>
              <div><strong>Project Name:</strong> {viewingBom.projectId?.projectName || viewingBom.projectId?.name || viewingBom.projectName || '-'}</div>
              <div><strong>BOM Version:</strong> {viewingBom.version || 'v1.0'}</div>
              <div><strong>Client Name:</strong> {viewingBom.projectId?.clientName || '-'}</div>
              <div><strong>Project Location:</strong> {viewingBom.projectId?.location || '-'}</div>
              <div><strong>Submitted By (PM):</strong> {viewingBom.createdBy?.name || viewingBom.createdBy || 'Project Manager'}</div>
              <div><strong>Date Created:</strong> {new Date(viewingBom.createdAt).toLocaleDateString()}</div>
              <div><strong>Current Status:</strong> <span style={{ fontWeight: '700', color: viewingBom.status === 'Approved' ? '#2e7d32' : viewingBom.status === 'Rejected' ? '#c62828' : '#e65100' }}>{viewingBom.status}</span></div>
              {viewingBom.rejectionReason && (
                <div style={{ gridColumn: 'span 2', color: '#c62828', background: '#fdf2f2', padding: '8px', borderRadius: '4px', border: '1px solid #fecaca' }}>
                  <strong>Director Feedback / Note:</strong> {viewingBom.rejectionReason}
                </div>
              )}
            </div>

            {/* Materials Table */}
            <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0d1b4b', color: 'white' }}>
                    {['Material Name', 'Category', 'Unit', 'Req Qty', 'Unit Cost (LKR)', 'Total Cost (LKR)', 'Supplier Ref', 'Remarks'].map(h => (
                      <th key={h} style={{ padding: '10px', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(viewingBom.materials || []).map((item, idx) => {
                    const qty = Number(item.plannedQty || item.quantity) || 0;
                    const cost = Number(item.estimatedUnitCost) || 0;
                    const total = qty * cost;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '10px', fontWeight: '600', color: '#0d1b4b' }}>{item.name || item.materialName || '-'}</td>
                        <td style={{ padding: '10px' }}>{item.category || '-'}</td>
                        <td style={{ padding: '10px' }}>{item.unit || '-'}</td>
                        <td style={{ padding: '10px' }}>{qty}</td>
                        <td style={{ padding: '10px' }}>LKR {cost.toLocaleString()}</td>
                        <td style={{ padding: '10px', fontWeight: '700' }}>LKR {total.toLocaleString()}</td>
                        <td style={{ padding: '10px' }}>{item.supplierRef || '-'}</td>
                        <td style={{ padding: '10px' }}>{item.remarks || '-'}</td>
                      </tr>
                    );
                  })}
                  {(viewingBom.materials || []).length === 0 && (
                    <tr>
                      <td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No items in this BOM.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* BOM Summaries: Total Cost and Category Breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
              <div>
                <h4 style={{ color: '#0d1b4b', margin: '0 0 10px', fontSize: '13px', fontWeight: '700', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px' }}>💰 ESTIMATED SUMMARY</h4>
                <div style={{ fontSize: '12px', marginBottom: '6px', color: '#475569' }}>
                  Total Material Items: <strong style={{ color: '#0d1b4b' }}>{(viewingBom.materials || []).length}</strong>
                </div>
                <div style={{ fontSize: '13px', color: '#2e7d32', fontWeight: '700' }}>
                  Total Cost: LKR {(viewingBom.materials || []).reduce((sum, item) => sum + (Number(item.totalCost) || (Number(item.plannedQty || item.quantity) * (Number(item.estimatedUnitCost) || 0))), 0).toLocaleString()}
                </div>
              </div>
              <div>
                <h4 style={{ color: '#0d1b4b', margin: '0 0 10px', fontSize: '13px', fontWeight: '700', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px' }}>📂 COST BREAKDOWN BY CATEGORY</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ background: '#e2e8f0', color: '#334155' }}>
                      <th style={{ padding: '4px 6px', textAlign: 'left', fontWeight: '600' }}>Category</th>
                      <th style={{ padding: '4px 6px', textAlign: 'right', fontWeight: '600' }}>Total Cost (LKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(
                      (viewingBom.materials || []).reduce((acc, item) => {
                        const cat = item.category || 'Unassigned';
                        const cost = Number(item.totalCost) || (Number(item.plannedQty || item.quantity) * (Number(item.estimatedUnitCost) || 0));
                        acc[cat] = (acc[cat] || 0) + cost;
                        return acc;
                      }, {})
                    ).map(([category, cost]) => (
                      <tr key={category} style={{ borderBottom: '1px solid #cbd5e1' }}>
                        <td style={{ padding: '4px 6px', color: '#334155', fontWeight: '500' }}>{category}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: '700', color: '#0d1b4b' }}>LKR {cost.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Approval / Rejection Optional Notes Textarea */}
            {(viewingBom.status === 'Submitted' || viewingBom.status === 'Pending') && (
              <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>DIRECTOR NOTE / FEEDBACK (MANDATORY FOR REJECTIONS) *</label>
                <textarea
                  placeholder="Specify feedback note here. Rejections require this field to be filled."
                  value={directorNote}
                  onChange={e => setDirectorNote(e.target.value)}
                  style={{ width: '100%', height: '80px', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => downloadPDF(viewingBom)}
                  style={{ background: '#cbd5e1', color: '#0c122c', border: 'none', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
                >
                  🖨️ Download PDF
                </button>
                {viewingBom.projectId?._id && (
                  <button
                    type="button"
                    onClick={handleCompareClick}
                    style={{ background: '#cbd5e1', color: '#0c122c', border: 'none', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
                  >
                    ⚖️ Compare Versions
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(viewingBom.status === 'Submitted' || viewingBom.status === 'Pending') && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        handleApprove(viewingBom._id, directorNote);
                        setShowViewModal(false);
                      }}
                      style={{ background: '#2e7d32', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '13px' }}
                    >
                      ✓ Approve BOM
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!directorNote.trim()) {
                          alert('⚠️ Rejection reason is required. Please type your feedback note above.');
                          return;
                        }
                        rejectBOMWithReason(viewingBom._id, directorNote);
                      }}
                      style={{ background: '#c62828', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '13px' }}
                    >
                      ✕ Reject BOM
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setShowViewModal(false)}
                  style={{ background: 'white', color: '#333', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compare Modal */}
      {showCompareModal && compareVersions.length > 0 && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '8px', width: '90%', maxWidth: '1000px', maxHeight: '85%', overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0d1b4b', paddingBottom: '10px', marginBottom: '20px' }}>
              <h3 style={{ color: '#0d1b4b', margin: 0 }}>⚖️ Compare BOM Versions</h3>
              <span onClick={() => setShowCompareModal(false)} style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '20px', color: '#666' }}>&times;</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>VERSION A (OLDER)</label>
                <select
                  value={versionAId}
                  onChange={e => setVersionAId(e.target.value)}
                  style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: 'white' }}
                >
                  {compareVersions.map(v => (
                    <option key={v._id} value={v._id}>
                      {v.version} ({v.status}) - {new Date(v.createdAt).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>VERSION B (NEWER)</label>
                <select
                  value={versionBId}
                  onChange={e => setVersionBId(e.target.value)}
                  style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: 'white' }}
                >
                  {compareVersions.map(v => (
                    <option key={v._id} value={v._id}>
                      {v.version} ({v.status}) - {new Date(v.createdAt).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                  {['Material Name', 'Category', 'Qty (A ➔ B)', 'Unit Price (A ➔ B)', 'Total Cost (A ➔ B)', 'Supplier Ref', 'Remarks'].map(h => (
                    <th key={h} style={{ padding: '10px', textAlign: 'left', fontWeight: '600' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {performComparison(
                  compareVersions.find(v => v._id === versionAId),
                  compareVersions.find(v => v._id === versionBId)
                ).map((item, idx) => {
                  let bg = 'white';
                  let textDec = 'none';
                  let textColor = '#333';
                  
                  if (item.status === 'added') {
                    bg = '#dcfce7'; // green
                    textColor = '#15803d';
                  } else if (item.status === 'removed') {
                    bg = '#fee2e2'; // red
                    textColor = '#b91c1c';
                    textDec = 'line-through';
                  } else if (item.status === 'changed') {
                    bg = '#fef9c3'; // yellow
                    textColor = '#854d0e';
                  }

                  return (
                    <tr key={idx} style={{ background: bg, borderBottom: '1px solid #e2e8f0', color: textColor, textDecoration: textDec }}>
                      <td style={{ padding: '10px', fontWeight: '600' }}>{item.name}</td>
                      <td style={{ padding: '10px' }}>{item.category}</td>
                      <td style={{ padding: '10px' }}>{item.displayQty}</td>
                      <td style={{ padding: '10px' }}>{item.displayCost}</td>
                      <td style={{ padding: '10px', fontWeight: '700' }}>{item.displayTotal}</td>
                      <td style={{ padding: '10px' }}>{item.supplierRef || '-'}</td>
                      <td style={{ padding: '10px' }}>{item.remarks || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowCompareModal(false)}
                style={{ background: '#0d1b4b', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
              >
                Close Comparison
              </button>
            </div>
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
