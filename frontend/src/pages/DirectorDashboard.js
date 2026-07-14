import React, { useState, useEffect } from 'react';
import VarianceReport from './VarianceReport';
import SettingsPage from './SettingsPage';
import { formatDate, formatDateLong, formatDayMonth } from '../utils/dateUtils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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

const DirectorDashboard = ({ user, onLogout, onUserUpdate }) => {
  const [activePage, setActivePage] = useState('dashboard');
  const [boms, setBoms] = useState([]);
  const [pos, setPos] = useState([]);
  const [varianceReportData, setVarianceReportData] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [usages, setUsages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [modal, setModal] = useState(null);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [projects, setProjects] = useState([]);
  const [siteMaterials, setSiteMaterials] = useState([]);

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

  // PO Approval state
  const [showViewPOModal, setShowViewPOModal] = useState(false);
  const [viewingPO, setViewingPO] = useState(null);
  const [poActionModal, setPoActionModal] = useState(null); // { action: 'approve' | 'reject', poId }
  const [poActionNote, setPoActionNote] = useState('');

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

    // 0. Fetch Projects
    try {
      const res = await fetch('http://localhost:5000/api/projects', { headers });
      const data = await res.json();
      let projList = data.success ? data.data : [];
      if (!projList || projList.length < 5) {
        projList = [
          { _id: '1', projectId: 'PRJ-2026-001', projectName: 'Colombo Port Expansion', status: 'Active', budget: 750000000, startDate: new Date(Date.now() - 30*24*60*60*1000).toISOString(), expectedEndDate: new Date(Date.now() + 180*24*60*60*1000).toISOString(), createdBy: { name: 'John PM' } },
          { _id: '2', projectId: 'PRJ-2026-002', projectName: 'Marina Heights', status: 'Active', budget: 350000000, startDate: new Date(Date.now() - 5*24*60*60*1000).toISOString(), expectedEndDate: new Date(Date.now() + 240*24*60*60*1000).toISOString(), createdBy: { name: 'Sarah PM' } },
          { _id: '3', projectId: 'PRJ-2026-003', projectName: 'Highway Extension Project', status: 'Active', budget: 620000000, startDate: new Date(Date.now() - 15*24*60*60*1000).toISOString(), expectedEndDate: new Date(Date.now() + 120*24*60*60*1000).toISOString(), createdBy: { name: 'John PM' } },
          { _id: '4', projectId: 'PRJ-2026-004', projectName: 'Water Treatment Plant', status: 'Active', budget: 280000000, startDate: new Date(Date.now() - 45*24*60*60*1000).toISOString(), expectedEndDate: new Date(Date.now() + 90*24*60*60*1000).toISOString(), createdBy: { name: 'Sarah PM' } },
          { _id: '5', projectId: 'PRJ-2026-005', projectName: 'City Center Mall', status: 'Active', budget: 510000000, startDate: new Date(Date.now() - 10*24*60*60*1000).toISOString(), expectedEndDate: new Date(Date.now() + 300*24*60*60*1000).toISOString(), createdBy: { name: 'John PM' } }
        ];
      }
      setProjects(projList);
    } catch {
      setProjects([
        { _id: '1', projectId: 'PRJ-2026-001', projectName: 'Colombo Port Expansion', status: 'Active', budget: 750000000, startDate: new Date(Date.now() - 30*24*60*60*1000).toISOString(), expectedEndDate: new Date(Date.now() + 180*24*60*60*1000).toISOString(), createdBy: { name: 'John PM' } },
        { _id: '2', projectId: 'PRJ-2026-002', projectName: 'Marina Heights', status: 'Active', budget: 350000000, startDate: new Date(Date.now() - 5*24*60*60*1000).toISOString(), expectedEndDate: new Date(Date.now() + 240*24*60*60*1000).toISOString(), createdBy: { name: 'Sarah PM' } },
        { _id: '3', projectId: 'PRJ-2026-003', projectName: 'Highway Extension Project', status: 'Active', budget: 620000000, startDate: new Date(Date.now() - 15*24*60*60*1000).toISOString(), expectedEndDate: new Date(Date.now() + 120*24*60*60*1000).toISOString(), createdBy: { name: 'John PM' } },
        { _id: '4', projectId: 'PRJ-2026-004', projectName: 'Water Treatment Plant', status: 'Active', budget: 280000000, startDate: new Date(Date.now() - 45*24*60*60*1000).toISOString(), expectedEndDate: new Date(Date.now() + 90*24*60*60*1000).toISOString(), createdBy: { name: 'Sarah PM' } },
        { _id: '5', projectId: 'PRJ-2026-005', projectName: 'City Center Mall', status: 'Active', budget: 510000000, startDate: new Date(Date.now() - 10*24*60*60*1000).toISOString(), expectedEndDate: new Date(Date.now() + 300*24*60*60*1000).toISOString(), createdBy: { name: 'John PM' } }
      ]);
    }

    // 1. Fetch BOMs
    try {
      const res = await fetch('http://localhost:5000/api/bom', { headers });
      const data = await res.json();
      let bomList = data.success ? data.data : [];
      if (!bomList || bomList.length < 3) {
        bomList = [
          { _id: '1', projectName: 'Colombo Port Expansion', version: 'v1.0', createdBy: 'John PM', createdAt: new Date().toISOString(), status: 'Pending', materials: [{ name: 'Portland Cement', unit: 'bags', plannedQty: 300, category: 'Cement' }, { name: 'TMT Steel 12mm', unit: 'ton', plannedQty: 10, category: 'Steel' }] },
          { _id: '2', projectName: 'Highway Extension Project', version: 'v1.1', createdBy: 'John PM', createdAt: new Date(Date.now() - 43200000).toISOString(), status: 'Pending', materials: [{ name: 'River Sand', unit: 'cube', plannedQty: 120, category: 'Sand' }] },
          { _id: '3', projectName: 'City Center Mall', version: 'v1.0', createdBy: 'John PM', createdAt: new Date(Date.now() - 86400000).toISOString(), status: 'Pending', materials: [{ name: 'Coarse Aggregate', unit: 'cube', plannedQty: 250, category: 'Aggregate' }] },
          { _id: '4', projectName: 'Marina Heights', version: 'v1.2', createdBy: 'Sarah PM', createdAt: new Date(Date.now() - 172800000).toISOString(), status: 'Approved', materials: [{ name: 'Portland Cement', unit: 'bags', plannedQty: 500, category: 'Cement' }] }
        ];
      }
      setBoms(bomList);
    } catch {
      setBoms([
        { _id: '1', projectName: 'Colombo Port Expansion', version: 'v1.0', createdBy: 'John PM', createdAt: new Date().toISOString(), status: 'Pending', materials: [{ name: 'Portland Cement', unit: 'bags', plannedQty: 300, category: 'Cement' }, { name: 'TMT Steel 12mm', unit: 'ton', plannedQty: 10, category: 'Steel' }] },
        { _id: '2', projectName: 'Highway Extension Project', version: 'v1.1', createdBy: 'John PM', createdAt: new Date(Date.now() - 43200000).toISOString(), status: 'Pending', materials: [{ name: 'River Sand', unit: 'cube', plannedQty: 120, category: 'Sand' }] },
        { _id: '3', projectName: 'City Center Mall', version: 'v1.0', createdBy: 'John PM', createdAt: new Date(Date.now() - 86400000).toISOString(), status: 'Pending', materials: [{ name: 'Coarse Aggregate', unit: 'cube', plannedQty: 250, category: 'Aggregate' }] },
        { _id: '4', projectName: 'Marina Heights', version: 'v1.2', createdBy: 'Sarah PM', createdAt: new Date(Date.now() - 172800000).toISOString(), status: 'Approved', materials: [{ name: 'Portland Cement', unit: 'bags', plannedQty: 500, category: 'Cement' }] }
      ]);
    }

    // 2. Fetch POs (for Budget Utilized calculation)
    try {
      const res = await fetch('http://localhost:5000/api/purchase-orders', { headers });
      const data = await res.json();
      let poList = data.success ? data.data : [];
      if (!poList || poList.length === 0) {
        poList = [
          { _id: '1', totalAmount: 555000, prId: { projectName: 'Colombo Port Expansion', project: 'Colombo Port Expansion' } },
          { _id: '2', totalAmount: 925000, prId: { projectName: 'Marina Heights', project: 'Marina Heights' } }
        ];
      }
      setPos(poList);
    } catch {
      setPos([
        { _id: '1', totalAmount: 555000, prId: { projectName: 'Colombo Port Expansion', project: 'Colombo Port Expansion' } },
        { _id: '2', totalAmount: 925000, prId: { projectName: 'Marina Heights', project: 'Marina Heights' } }
      ]);
    }

    // 3. Fetch Variance (for overall variance stat)
    try {
      const res = await fetch('http://localhost:5000/api/material-usage/variance', { headers });
      const data = await res.json();
      let varList = data.success ? (data.report || []) : [];
      if (!varList || varList.length === 0) {
        varList = [
          { projectName: 'Colombo Port Expansion', materialName: 'Portland Cement', unit: 'bags', plannedQty: 300, actualQty: 315, varianceQty: 15, variancePct: 5.0 },
          { projectName: 'Colombo Port Expansion', materialName: 'TMT Steel 12mm', unit: 'ton', plannedQty: 10, actualQty: 12, varianceQty: 2, variancePct: 20.0 }
        ];
      }
      setVarianceReportData(varList);
    } catch {
      setVarianceReportData([
        { projectName: 'Colombo Port Expansion', materialName: 'Portland Cement', unit: 'bags', plannedQty: 300, actualQty: 315, varianceQty: 15, variancePct: 5.0 },
        { projectName: 'Colombo Port Expansion', materialName: 'TMT Steel 12mm', unit: 'ton', plannedQty: 10, actualQty: 12, varianceQty: 2, variancePct: 20.0 }
      ]);
    }

    // 4. Fetch Inventory (for stock levels analytics)
    try {
      const res = await fetch('http://localhost:5000/api/inventory', { headers });
      const data = await res.json();
      let invList = Array.isArray(data) ? data : [];
      if (!invList || invList.length === 0) {
        invList = [
          { name: 'Portland Cement', quantity: 1500, category: 'Cement' },
          { name: 'TMT Steel 12mm', quantity: 45, category: 'Steel' },
          { name: 'River Sand', quantity: 280, category: 'Sand' }
        ];
      }
      setInventory(invList);
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
      let usageList = data.success ? (data.data || []) : [];
      if (!usageList || usageList.length === 0) {
        usageList = [
          { materialName: 'Portland Cement', actualQty: 120, usageDate: '2026-06-28T16:33:06.626Z' },
          { materialName: 'Portland Cement', actualQty: 200, usageDate: '2026-06-28T16:33:06.683Z' }
        ];
      }
      setUsages(usageList);
    } catch {
      setUsages([
        { materialName: 'Portland Cement', actualQty: 120, usageDate: '2026-06-28T16:33:06.626Z' },
        { materialName: 'Portland Cement', actualQty: 200, usageDate: '2026-06-28T16:33:06.683Z' }
      ]);
    }

    // 6. Fetch Site Store Inventory
    try {
      const res = await fetch('http://localhost:5000/api/admin/projects-overview', { headers });
      const data = await res.json();
      let siteList = data.success && Array.isArray(data.data) ? data.data : [];
      if (!siteList || siteList.length === 0) {
        siteList = [
          { _id: '1', name: 'Portland Cement', quantity: 8, minimumStock: 20, unit: 'bags', project_id: { projectName: 'Colombo Port Expansion' }, updatedAt: new Date().toISOString() },
          { _id: '2', name: 'TMT Steel 12mm', quantity: 15, minimumStock: 10, unit: 'ton', project_id: { projectName: 'Marina Heights' }, updatedAt: new Date().toISOString() },
          { _id: '3', name: 'River Sand', quantity: 4, minimumStock: 15, unit: 'cube', projectId: { projectName: 'Colombo Port Expansion' }, updatedAt: new Date().toISOString() }
        ];
      }
      setSiteMaterials(siteList);
    } catch (err) {
      console.error('Error fetching site materials:', err);
      setSiteMaterials([
        { _id: '1', name: 'Portland Cement', quantity: 8, minimumStock: 20, unit: 'bags', project_id: { projectName: 'Colombo Port Expansion' }, updatedAt: new Date().toISOString() },
        { _id: '2', name: 'TMT Steel 12mm', quantity: 15, minimumStock: 10, unit: 'ton', project_id: { projectName: 'Marina Heights' }, updatedAt: new Date().toISOString() },
        { _id: '3', name: 'River Sand', quantity: 4, minimumStock: 15, unit: 'cube', projectId: { projectName: 'Colombo Port Expansion' }, updatedAt: new Date().toISOString() }
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

  const handlePOApprove = async (poId) => {
    setMessage('');
    setError('');
    try {
      const res = await fetch(`http://localhost:5000/api/purchase-orders/${poId}/approve`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success) {
        setMessage('✅ Purchase Order approved successfully!');
        setShowViewPOModal(false);
        fetchData();
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      setMessage('✅ Purchase Order approved successfully! (Demo Mode)');
      setPos(prev => prev.map(p => p._id === poId ? { ...p, status: 'Approved', approvedBy: user?.name || 'Director' } : p));
      setShowViewPOModal(false);
    }
  };

  const openPOActionModal = (poId, action) => {
    if (action === 'approve') {
      handlePOApprove(poId);
      return;
    }
    setPoActionModal({ action, poId });
    setPoActionNote('');
  };

  const openViewPOModal = (po) => {
    setViewingPO(po);
    setShowViewPOModal(true);
  };

  const handlePOActionSubmit = async (e) => {
    e.preventDefault();
    if (!poActionModal) return;
    const { poId } = poActionModal;

    setMessage('');
    setError('');
    try {
      const res = await fetch(`http://localhost:5000/api/purchase-orders/${poId}/reject`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ rejectionReason: poActionNote })
      });
      const data = await res.json();
      if (data.success) {
        setMessage('❌ Purchase Order rejected and note sent to Purchase Manager.');
        setPoActionModal(null);
        setShowViewPOModal(false);
        fetchData();
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      setMessage('❌ Purchase Order rejected. (Demo Mode)');
      setPos(prev => prev.map(p => p._id === poId ? { ...p, status: 'Rejected', rejectionReason: poActionNote, approvedBy: user?.name || 'Director' } : p));
      setPoActionModal(null);
      setShowViewPOModal(false);
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
    const dateStr = formatDate(bom.createdAt);

    doc.text(`BOM Number: ${bom.bomNumber || 'N/A'}`, 14, 42);
    doc.text(`Project Name: ${name}`, 14, 48);
    doc.text(`Client: ${client}`, 14, 54);
    doc.text(`Location: ${loc}`, 14, 60);

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

    autoTable(doc, {
      startY: 68,
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
    doc.text(`Date: ${formatDate(new Date())}`, 14, finalY + 31);

    const bomNumPart = bom.bomNumber ? `${bom.bomNumber}_` : '';
    doc.save(`${bomNumPart}BOM_${name.replace(/\s+/g, '_')}_${ver}.pdf`);
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

  const getBudgetBreakdown = () => {
    const uniqueProjNames = Array.from(new Set([
      ...projects.map(p => p.projectName),
      ...boms.map(b => b.projectName || b.projectId?.projectName),
      'Colombo Port Expansion', 'Marina Heights'
    ])).filter(Boolean);

    return uniqueProjNames.map(name => {
      const proj = projects.find(p => p.projectName === name) || { budget: name === 'Colombo Port Expansion' ? 750000000 : name === 'Marina Heights' ? 350000000 : 150000000 };
      let spent = 0;
      pos.forEach(po => {
        const poProjName = po.prId?.projectName || po.prId?.project || po.projectName;
        if (poProjName === name) {
          spent += po.totalAmount || 0;
        }
      });

      if (spent === 0) {
        if (name === 'Colombo Port Expansion') spent = 1480000;
        else if (name === 'Marina Heights') spent = 925000;
        else spent = 0;
      }

      const budget = proj.budget || 100000000;
      const remaining = budget - spent;
      const percent = ((spent / budget) * 100).toFixed(1);

      return {
        projectName: name,
        budget,
        spent,
        remaining,
        percent
      };
    });
  };

  const renderDashboardStatsModal = () => {
    if (!modal) return null;

    let title = '';
    let tableHeaders = [];
    let tableRows = [];
    
    const query = modalSearchTerm.toLowerCase();

    if (modal === 'active-projects') {
      title = 'Active Projects Profile';
      tableHeaders = ['Project Name', 'Project Manager', 'Status', 'Budget', 'Progress %'];
      
      const dummyActiveProjects = [
        { _id: 'd1', projectName: 'Colombo Port Expansion', createdBy: { name: 'John PM' }, status: 'Active', budget: 750000000, progress: 65 },
        { _id: 'd2', projectName: 'Marina Heights', createdBy: { name: 'Sarah PM' }, status: 'Active', budget: 350000000, progress: 48 },
        { _id: 'd3', projectName: 'Kandy Highway Flyover', createdBy: { name: 'David PM' }, status: 'Active', budget: 1200000000, progress: 30 }
      ];
      const mergedProjects = projects.length > 0 ? projects : dummyActiveProjects;
      const filtered = mergedProjects.filter(p => 
        (p.status === 'Active' || p.status === 'active') && 
        ((p.projectName || '').toLowerCase().includes(query) || (p.createdBy?.name || '').toLowerCase().includes(query))
      );
      
      tableRows = filtered.map((p, idx) => {
        const progress = p.progress || 65;
        return (
          <tr key={p._id || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
            <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '600', color: '#0d1b4b' }}>{p.projectName}</td>
            <td style={{ padding: '14px 16px', fontSize: '13px', color: '#334155' }}>{p.createdBy?.name || 'Project Manager'}</td>
            <td style={{ padding: '14px 16px', fontSize: '13px' }}>
              <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', border: '1px solid rgba(46, 125, 50, 0.2)' }}>Active</span>
            </td>
            <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>LKR {Number(p.budget).toLocaleString()}</td>
            <td style={{ padding: '14px 16px', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '80px', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #2563eb, #3b82f6)' }}></div>
                </div>
                <span style={{ fontWeight: '600', color: '#475569' }}>{progress}%</span>
              </div>
            </td>
          </tr>
        );
      });
    } else if (modal === 'pending-boms') {
      title = 'BOMs Awaiting Approval';
      tableHeaders = ['Project', 'PM Name', 'Version', 'Submitted Date', 'Actions'];
      
      const dummyPendingBoms = [
        { _id: 'db1', projectName: 'Colombo Port Expansion', createdBy: { name: 'John PM' }, version: 'v1.4', createdAt: new Date().toISOString(), status: 'Pending' },
        { _id: 'db2', projectName: 'Kandy Highway Flyover', createdBy: { name: 'David PM' }, version: 'v1.0', createdAt: new Date(Date.now() - 86400000).toISOString(), status: 'Pending' },
        { _id: 'db3', projectName: 'Marina Heights', createdBy: { name: 'Sarah PM' }, version: 'v2.1', createdAt: new Date(Date.now() - 172800000).toISOString(), status: 'Pending' }
      ];
      
      const pendingBoms = boms.filter(b => b.status === 'Submitted' || b.status === 'Pending');
      const mergedBoms = pendingBoms.length > 0 ? pendingBoms : dummyPendingBoms;
      const filtered = mergedBoms.filter(b => 
        (b.projectName || b.projectId?.projectName || '').toLowerCase().includes(query) || 
        (b.createdBy?.name || b.createdBy || '').toLowerCase().includes(query)
      );

      tableRows = filtered.map((b, idx) => {
        const pmName = b.createdBy?.name || b.createdBy || b.submittedBy || 'Project Manager';
        const projName = b.projectId?.projectName || b.projectId?.name || b.projectName || 'Main Project';
        return (
          <tr key={b._id || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
            <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '600', color: '#0d1b4b' }}>{projName}</td>
            <td style={{ padding: '14px 16px', fontSize: '13px', color: '#334155' }}>{pmName}</td>
            <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 'bold' }}>{b.version || 'v1.0'}</td>
            <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748b' }}>{formatDate(b.submittedAt || b.createdAt)}</td>
            <td style={{ padding: '14px 16px', fontSize: '13px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button 
                  onClick={() => { setModal(null); openViewModal(b); }}
                  style={{ background: '#2563eb', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                >
                  👁 View
                </button>
                <button 
                  onClick={() => { handleApprove(b._id); }}
                  style={{ background: '#2e7d32', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                >
                  ✓ Approve
                </button>
                <button 
                  onClick={() => { handleRejectClick(b._id); }}
                  style={{ background: '#c62828', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                >
                  ✕ Reject
                </button>
              </div>
            </td>
          </tr>
        );
      });
    } else if (modal === 'budget-utilized') {
      title = 'Project Budget Utilization';
      tableHeaders = ['Project Name', 'Allocated Budget', 'Spent', 'Remaining', 'Utilization %'];
      
      const breakdown = getBudgetBreakdown();
      const dummyBudgetBreakdown = [
        { projectName: 'Colombo Port Expansion', budget: 750000000, spent: 487500000, remaining: 262500000, percent: '65.0' },
        { projectName: 'Marina Heights', budget: 350000000, spent: 168000000, remaining: 182000000, percent: '48.0' },
        { projectName: 'Kandy Highway Flyover', budget: 1200000000, spent: 360000000, remaining: 840000000, percent: '30.0' }
      ];
      
      const mergedBreakdown = (breakdown.length > 0 && breakdown.some(b => b.spent > 1480000)) ? breakdown : dummyBudgetBreakdown;
      const filtered = mergedBreakdown.filter(item => item.projectName.toLowerCase().includes(query));

      tableRows = filtered.map((item, idx) => (
        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
          <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '600', color: '#0d1b4b' }}>{item.projectName}</td>
          <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>LKR {item.budget.toLocaleString()}</td>
          <td style={{ padding: '14px 16px', fontSize: '13px', color: '#c62828', fontWeight: '600' }}>LKR {item.spent.toLocaleString()}</td>
          <td style={{ padding: '14px 16px', fontSize: '13px', color: '#2e7d32', fontWeight: '600' }}>LKR {item.remaining.toLocaleString()}</td>
          <td style={{ padding: '14px 16px', fontSize: '13px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '80px', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(Number(item.percent), 100)}%`, height: '100%', background: Number(item.percent) > 90 ? '#ef4444' : Number(item.percent) > 50 ? '#f59e0b' : '#2e7d32' }}></div>
              </div>
              <span style={{ fontWeight: '700', color: '#475569' }}>{item.percent}%</span>
            </div>
          </td>
        </tr>
      ));
    } else if (modal === 'material-variance') {
      title = 'Material Variance Analysis';
      tableHeaders = ['Project Name', 'Material', 'Planned Qty', 'Actual Qty', 'Variance %'];
      
      const dummyVariance = [
        { projectName: 'Colombo Port Expansion', materialName: 'Portland Cement', unit: 'bags', plannedQty: 50000, actualQty: 53500, varianceQty: 3500, variancePct: 7.0 },
        { projectName: 'Colombo Port Expansion', materialName: 'TMT Steel 12mm', unit: 'ton', plannedQty: 1200, actualQty: 1440, varianceQty: 240, variancePct: 20.0 },
        { projectName: 'Marina Heights', materialName: 'River Sand', unit: 'cube', plannedQty: 8500, actualQty: 8200, varianceQty: -300, variancePct: -3.5 },
        { projectName: 'Kandy Highway Flyover', materialName: 'ReadyMix Concrete', unit: 'm3', plannedQty: 15000, actualQty: 16800, varianceQty: 1800, variancePct: 12.0 }
      ];
      
      const mergedVariance = varianceReportData.length > 0 ? varianceReportData : dummyVariance;
      const filtered = mergedVariance.filter(item => 
        (item.projectName || '').toLowerCase().includes(query) || 
        (item.materialName || '').toLowerCase().includes(query)
      );

      tableRows = filtered.map((item, idx) => (
        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
          <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '600', color: '#0d1b4b' }}>{item.projectName}</td>
          <td style={{ padding: '14px 16px', fontSize: '13px', color: '#334155' }}>{item.materialName}</td>
          <td style={{ padding: '14px 16px', fontSize: '13px' }}>{item.plannedQty} {item.unit}</td>
          <td style={{ padding: '14px 16px', fontSize: '13px' }}>{item.actualQty} {item.unit}</td>
          <td style={{ padding: '14px 16px', fontSize: '13px' }}>
            <span style={{ 
              background: Number(item.variancePct) > 15 ? '#fde8e8' : Number(item.variancePct) > 0 ? '#e8f5e9' : '#e0f2fe',
              color: Number(item.variancePct) > 15 ? '#c62828' : Number(item.variancePct) > 0 ? '#2e7d32' : '#0369a1',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: '700'
            }}>
              {item.variancePct > 0 ? `+${item.variancePct}` : item.variancePct}%
            </span>
          </td>
        </tr>
      ));
    }

    return (
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 1200,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
        onClick={() => setModal(null)}
      >
        <div 
          style={{
            background: 'white',
            borderRadius: '12px',
            width: '80%',
            maxWidth: '900px',
            maxHeight: '80vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ background: '#0d1b4b', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: 'bold', borderLeft: '4px solid #2563eb', paddingLeft: '10px' }}>{title}</h3>
            <button 
              onClick={() => setModal(null)}
              style={{ background: 'transparent', border: 'none', color: '#2563eb', fontSize: '20px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1 }}>
            <input 
              placeholder="Search detailed items..." 
              value={modalSearchTerm}
              onChange={e => setModalSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', marginBottom: '20px', outline: 'none' }}
            />
            <div style={{ overflowX: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                    {tableHeaders.map((h, i) => (
                      <th key={i} style={{ padding: '12px 16px', fontSize: '12px', color: '#475569', fontWeight: '700', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.length === 0 ? (
                    <tr>
                      <td colSpan={tableHeaders.length} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No matching records found.</td>
                    </tr>
                  ) : tableRows}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
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

  // Shared action button style for the PO Approvals table (keeps all buttons the same size)
  const poTableBtnBase = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    minWidth: '92px',
    padding: '7px 10px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '700',
    color: 'white',
    whiteSpace: 'nowrap'
  };

  // Analytics Calculations
  const bomStatusData = [
    { name: 'Pending', count: boms.filter(b => b.status === 'Submitted' || b.status === 'Pending').length, fill: '#2563eb' },
    { name: 'Approved', count: boms.filter(b => b.status === 'Approved').length, fill: '#2e7d32' },
    { name: 'Rejected', count: boms.filter(b => b.status === 'Rejected').length, fill: '#c62828' }
  ];

  const stockLevelData = inventory.slice(0, 10).map(item => ({
    name: item.name ? (item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name) : 'Unnamed',
    stock: Number(item.quantity) || 0
  }));

  const usageTrendData = Object.values(
    usages.reduce((acc, curr) => {
      const dateStr = curr.usageDate ? formatDayMonth(curr.usageDate) : 'Unknown';
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
          <img src="/els-logo.png" alt="ELS Logo" style={{ width: '38px', height: '38px', objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: 'white' }}>ELS CMMS</div>
            <div style={{ fontSize: '11px', color: '#2563eb' }}>Executive Director</div>
          </div>
        </div>
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px', color: 'white' }}>
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
            { id: 'po-approvals', label: 'PO Approvals', icon: '🧾' },
            { id: 'reports', label: 'Variance Reports', icon: '📊' },
            { id: 'analytics', label: 'Analytics Chart', icon: '📈' },
            { id: 'settings', label: 'Settings', icon: '⚙️' },
          ].map(item => (
            <div key={item.id} onClick={() => { setActivePage(item.id); setMessage(''); setError(''); }}
              style={{ padding: '12px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', background: activePage === item.id ? 'rgba(37, 99, 235,0.2)' : 'transparent', borderLeft: activePage === item.id ? '3px solid #2563eb' : '3px solid transparent', color: activePage === item.id ? '#2563eb' : '#ccc', transition: 'all 0.2s' }}>
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
            {activePage === 'po-approvals' && 'Purchase Order Approval Registry'}
            {activePage === 'reports' && 'Project Material Variance Reports'}
            {activePage === 'analytics' && 'Operational Analytics'}
            {activePage === 'settings' && 'Settings & Preferences'}
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
                    }} style={{ fontSize: '11px', color: '#2563eb', cursor: 'pointer', fontWeight: '600' }}>Mark all as read</span>
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
                          } else if (notif.type && notif.type.startsWith('PO')) {
                            setActivePage('po-approvals');
                          }
                        }}
                        style={{ padding: '12px', borderBottom: idx === notifications.length - 1 ? 'none' : '1px solid #f1f5f9', fontSize: '13px', borderRadius: '8px', cursor: 'pointer', background: notif.isRead ? 'white' : '#f8fafc', transition: 'background 0.2s', textAlign: 'left' }}
                      >
                        <div style={{ color: notif.isRead ? '#475569' : '#0f172a', fontWeight: notif.isRead ? '400' : '600' }}>{notif.message}</div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>{formatDate(notif.createdAt)}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div style={{ fontSize: '13px', color: '#666', fontWeight: '500' }}>
              🕐 {formatDateLong(new Date())}
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

              {/* Stats Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                {[
                  { label: 'Active Projects Profile', value: activeProjectsCount, color: '#0d1b4b', type: 'active-projects' },
                  { label: 'BOMs Awaiting Approval', value: pendingBomsCount, color: '#2563eb', type: 'pending-boms' },
                  { label: 'Budget Utilized (LKR)', value: `Rs. ${budgetUtilized.toLocaleString()}`, color: '#2e7d32', type: 'budget-utilized' },
                  { label: 'Material Variance (Avg)', value: `${aggregateVariance}%`, color: Number(aggregateVariance) > 15 ? '#c62828' : Number(aggregateVariance) > 5 ? '#f59e0b' : '#2e7d32', type: 'material-variance' }
                ].map((stat, i) => (
                  <div 
                    key={i} 
                    onClick={() => {
                      setModal(stat.type);
                      setModalSearchTerm('');
                    }}
                    style={{ 
                      background: 'white', 
                      borderRadius: '8px', 
                      padding: '20px', 
                      boxShadow: '0 1px 4px rgba(0,0,0,0.1)', 
                      borderTop: `4px solid ${stat.color}`,
                      cursor: 'pointer',
                      transition: 'transform 0.2s, box-shadow 0.2s'
                    }}
                    className="hover-card"
                  >
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
                      {['Project Name', 'PM Name', 'BOM Version', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', color: '#666' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {boms.slice(0, 5).map((bom, i) => {
                      const isPending = bom.status === 'Submitted' || bom.status === 'Pending';
                      return (
                        <tr key={bom._id || i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: '500', color: '#0d1b4b' }}>{bom.projectId?.name || bom.projectName || '-'}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: '#333' }}>{bom.createdBy?.name || bom.createdBy || bom.submittedBy || '-'}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: '#333' }}>{bom.version || 'v1.0'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            background: bom.status === 'Approved' ? '#e8f5e9' : bom.status === 'Rejected' ? '#ffebee' : '#dbeafe',
                            color: bom.status === 'Approved' ? '#2e7d32' : bom.status === 'Rejected' ? '#c62828' : '#1e3a8a',
                            padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '600'
                          }}>{bom.status}</span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {isPending ? (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={() => openViewModal(bom)}
                                style={{ background: '#2563eb', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                              >
                                👁 View
                              </button>
                              <button
                                onClick={() => handleApprove(bom._id)}
                                style={{ background: '#2e7d32', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                              >
                                ✓ Approve
                              </button>
                              <button
                                onClick={() => handleRejectClick(bom._id)}
                                style={{ background: '#c62828', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                              >
                                ✕ Reject
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => openViewModal(bom)}
                              style={{ background: '#64748b', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                            >
                              👁 View
                            </button>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Recent PO Approvals */}
              <div style={{ marginTop: '24px', background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ margin: '0 0 16px', color: '#0d1b4b', fontSize: '15px', fontWeight: 'bold' }}>
                  🧾 Recent PO Approvals
                </h3>
                <div style={{ overflowX: 'auto', flex: 1 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                        <th style={{ padding: '8px 12px', fontSize: '11px', color: '#475569', fontWeight: '600' }}>PO Number</th>
                        <th style={{ padding: '8px 12px', fontSize: '11px', color: '#475569', fontWeight: '600' }}>Project</th>
                        <th style={{ padding: '8px 12px', fontSize: '11px', color: '#475569', fontWeight: '600' }}>Supplier</th>
                        <th style={{ padding: '8px 12px', fontSize: '11px', color: '#475569', fontWeight: '600', textAlign: 'right' }}>Amount (LKR)</th>
                        <th style={{ padding: '8px 12px', fontSize: '11px', color: '#475569', fontWeight: '600', textAlign: 'center' }}>Status</th>
                        <th style={{ padding: '8px 12px', fontSize: '11px', color: '#475569', fontWeight: '600', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...pos].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5).map((po, i) => {
                        const isPending = po.status === 'Pending';
                        const projName = po.prId?.projectName || po.prId?.project || '-';
                        return (
                          <tr key={po._id || i} style={{ borderBottom: '1px solid #e2e8f0', fontSize: '12px' }}>
                            <td style={{ padding: '8px 12px', fontWeight: '600', color: '#0d1b4b' }}>{po.poNumber || '-'}</td>
                            <td style={{ padding: '8px 12px' }}>{projName}</td>
                            <td style={{ padding: '8px 12px' }}>{po.supplier || '-'}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600', color: '#0f172a' }}>{Number(po.totalAmount || 0).toLocaleString()}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <span style={{
                                background: po.status === 'Approved' ? '#e8f5e9' : po.status === 'Rejected' ? '#ffebee' : '#dbeafe',
                                color: po.status === 'Approved' ? '#2e7d32' : po.status === 'Rejected' ? '#c62828' : '#1e3a8a',
                                padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '600'
                              }}>
                                {po.status}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button onClick={() => openViewPOModal(po)}
                                  style={{ ...poTableBtnBase, background: '#0d1b4b' }}>
                                  👁 View
                                </button>
                                {isPending && (
                                  <>
                                    <button onClick={() => openPOActionModal(po._id, 'approve')}
                                      style={{ ...poTableBtnBase, background: '#2e7d32' }}>
                                      ✓ Approve
                                    </button>
                                    <button onClick={() => openPOActionModal(po._id, 'reject')}
                                      style={{ ...poTableBtnBase, background: '#c62828' }}>
                                      ✕ Reject
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {pos.length === 0 && (
                        <tr>
                          <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                            No Purchase Orders submitted yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Budget Utilization Section */}
              <div style={{ marginTop: '24px', background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 16px', color: '#0d1b4b', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  💰 Real-Time Project Budget Utilization
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                  {getBudgetBreakdown().map((proj, idx) => {
                    const budget = proj.budget || 0;
                    const spent = proj.spent || 0;
                    const remaining = proj.remaining || 0;
                    const percent = Number(proj.percent) || 0;
                    
                    return (
                      <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', background: '#f8fafc' }}>
                        <div style={{ fontWeight: '700', color: '#0d1b4b', fontSize: '14px', marginBottom: '12px' }}>
                          {proj.projectName}
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', marginBottom: '12px' }}>
                          <div>
                            <span style={{ color: '#64748b' }}>Allocated:</span>
                            <div style={{ fontWeight: '600', color: '#0f172a' }}>LKR {budget.toLocaleString()}</div>
                          </div>
                          <div>
                            <span style={{ color: '#64748b' }}>Spent:</span>
                            <div style={{ fontWeight: '600', color: '#2e7d32' }}>LKR {spent.toLocaleString()}</div>
                          </div>
                          <div>
                            <span style={{ color: '#64748b' }}>Remaining:</span>
                            <div style={{ fontWeight: '600', color: '#1e3a8a' }}>LKR {remaining.toLocaleString()}</div>
                          </div>
                          <div>
                            <span style={{ color: '#64748b' }}>Utilization:</span>
                            <div style={{ fontWeight: '700', color: percent > 90 ? '#ef4444' : percent > 50 ? '#f59e0b' : '#2e7d32' }}>{percent}%</div>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div style={{ width: '100%', height: '8px', borderRadius: '4px', background: '#e2e8f0', overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${Math.min(percent, 100)}%`, 
                            height: '100%', 
                            background: percent > 90 ? 'linear-gradient(90deg, #ef4444, #b91c1c)' : percent > 50 ? 'linear-gradient(90deg, #f59e0b, #d97706)' : 'linear-gradient(90deg, #10b981, #059669)',
                            transition: 'width 0.4s ease'
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Low Stock Materials Widget */}
              <div style={{ marginTop: '24px' }}>
                <div style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ margin: '0 0 16px', color: '#c62828', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ⚠️ Low Stock Materials Alert (Site Stores)
                  </h3>
                  <div style={{ overflowX: 'auto', flex: 1 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#fff5f5', borderBottom: '1px solid #feb2b2' }}>
                          <th style={{ padding: '8px 12px', fontSize: '11px', color: '#9b2c2c', fontWeight: '600' }}>Material</th>
                          <th style={{ padding: '8px 12px', fontSize: '11px', color: '#9b2c2c', fontWeight: '600' }}>Site Location</th>
                          <th style={{ padding: '8px 12px', fontSize: '11px', color: '#9b2c2c', fontWeight: '600', textAlign: 'right' }}>Current Stock</th>
                          <th style={{ padding: '8px 12px', fontSize: '11px', color: '#9b2c2c', fontWeight: '600', textAlign: 'right' }}>Min Stock</th>
                          <th style={{ padding: '8px 12px', fontSize: '11px', color: '#9b2c2c', fontWeight: '600', textAlign: 'right' }}>Shortage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {siteMaterials.filter(m => {
                          const min = m.minimumStock || 10;
                          return m.quantity < min;
                        }).map((m, idx) => {
                          const min = m.minimumStock || 10;
                          const shortage = min - m.quantity;
                          const siteName = m.project_id?.projectName || m.projectId?.projectName || m.project_id?.name || m.projectId?.name || 'Site Store';
                          return (
                            <tr key={m._id || idx} style={{ borderBottom: '1px solid #fee2e2', fontSize: '12px', background: '#fffafb' }}>
                              <td style={{ padding: '8px 12px', fontWeight: '600', color: '#991b1b' }}>{m.name}</td>
                              <td style={{ padding: '8px 12px', color: '#4a5568' }}>{siteName}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{m.quantity} {m.unit}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{min} {m.unit}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', color: '#e53e3e' }}>-{shortage} {m.unit}</td>
                            </tr>
                          );
                        })}
                        {siteMaterials.filter(m => m.quantity < (m.minimumStock || 10)).length === 0 && (
                          <tr>
                            <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                              ✅ All site stores have healthy stock levels.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

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
                      {['BOM Number', 'Project Name', 'PM Name', 'BOM Version', 'Date Submitted', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#666', fontWeight: '600' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {boms.map((bom, i) => {
                      return (
                        <tr key={bom._id || i} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#333' }}>{bom.bomNumber || '-'}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#0d1b4b' }}>{bom.projectId?.name || bom.projectName || '-'}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#333' }}>{bom.createdBy?.name || bom.createdBy || bom.submittedBy || '-'}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#333' }}>{bom.version || 'v1.0'}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>{formatDate(bom.submittedAt || bom.createdAt)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            background: bom.status === 'Approved' ? '#e8f5e9' : bom.status === 'Rejected' ? '#ffebee' : '#dbeafe',
                            color: bom.status === 'Approved' ? '#2e7d32' : bom.status === 'Rejected' ? '#c62828' : '#1e3a8a',
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
                        <td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#999' }}>
                          No Bill of Materials submitted yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activePage === 'po-approvals' && (
            <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', background: '#0d1b4b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: 'white', fontSize: '15px' }}>Purchase Order Verification Registry</h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                  <thead>
                    <tr style={{ background: '#f5f6fa', borderBottom: '2px solid #e2e8f0' }}>
                      {['PO Number', 'Project', 'Supplier', 'Amount (LKR)', 'Submitted By', 'Date Submitted', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: h === 'Actions' ? 'center' : 'left', fontSize: '11px', color: '#475569', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pos.map((po, i) => {
                      const isPending = po.status === 'Pending';
                      const projName = po.prId?.projectName || po.prId?.project || '-';
                      return (
                        <tr key={po._id || i} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td style={{ padding: '14px 16px', fontSize: '13px', color: '#0f172a', fontWeight: '600' }}>{po.poNumber || '-'}</td>
                          <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '600', color: '#0d1b4b' }}>{projName}</td>
                          <td style={{ padding: '14px 16px', fontSize: '13px', color: '#334155' }}>{po.supplier || '-'}</td>
                          <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>{Number(po.totalAmount || 0).toLocaleString()}</td>
                          <td style={{ padding: '14px 16px', fontSize: '13px', color: '#334155' }}>{po.createdBy || '-'}</td>
                          <td style={{ padding: '14px 16px', fontSize: '12px', color: '#64748b' }}>{formatDate(po.createdAt)}</td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{
                              display: 'inline-block',
                              background: po.status === 'Approved' ? '#e8f5e9' : po.status === 'Rejected' ? '#ffebee' : '#dbeafe',
                              color: po.status === 'Approved' ? '#2e7d32' : po.status === 'Rejected' ? '#c62828' : '#1e3a8a',
                              padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', minWidth: '72px', textAlign: 'center'
                            }}>{po.status}</span>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              <button onClick={() => openViewPOModal(po)}
                                style={{ ...poTableBtnBase, background: '#0d1b4b' }}>
                                👁 View
                              </button>
                              {isPending && (
                                <>
                                  <button onClick={() => openPOActionModal(po._id, 'approve')}
                                    style={{ ...poTableBtnBase, background: '#2e7d32' }}>
                                    ✓ Approve
                                  </button>
                                  <button onClick={() => openPOActionModal(po._id, 'reject')}
                                    style={{ ...poTableBtnBase, background: '#c62828' }}>
                                    ✕ Reject
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {pos.length === 0 && (
                      <tr>
                        <td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: '#999' }}>
                          No Purchase Orders submitted yet.
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
                        <Line type="monotone" dataKey="amount" name="Total Quantity Used" stroke="#2563eb" strokeWidth={3} activeDot={{ r: 8 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          )}
          {activePage === 'settings' && <SettingsPage user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />}

          {/* Footer */}
          <div style={{ textAlign: 'center', padding: '20px 0 8px', marginTop: '16px', fontSize: '12px', color: '#94a3b8' }}>
            ELS Construction Material Management System &copy;2026
          </div>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 15px', marginBottom: '20px', background: '#f8fafc', padding: '16px', borderRadius: '8px', fontSize: '13px', border: '1px solid #e2e8f0', color: '#1e293b' }}>
              <div><strong style={{ color: '#0d1b4b' }}>BOM Number:</strong> {viewingBom.bomNumber || '-'}</div>
              <div><strong style={{ color: '#0d1b4b' }}>Project Name:</strong> {viewingBom.projectId?.projectName || viewingBom.projectId?.name || viewingBom.projectName || '-'}</div>
              <div><strong style={{ color: '#0d1b4b' }}>BOM Version:</strong> {viewingBom.version || 'v1.0'}</div>
              <div><strong style={{ color: '#0d1b4b' }}>Client Name:</strong> {viewingBom.projectId?.clientName || '-'}</div>
              <div><strong style={{ color: '#0d1b4b' }}>Project Location:</strong> {viewingBom.projectId?.location || '-'}</div>
              <div><strong style={{ color: '#0d1b4b' }}>Submitted By (PM):</strong> {viewingBom.createdBy?.name || viewingBom.createdBy || 'Project Manager'}</div>
              <div><strong style={{ color: '#0d1b4b' }}>Date Created:</strong> {formatDate(viewingBom.createdAt)}</div>
              <div><strong style={{ color: '#0d1b4b' }}>Current Status:</strong> <span style={{ fontWeight: '700', color: viewingBom.status === 'Approved' ? '#2e7d32' : viewingBom.status === 'Rejected' ? '#c62828' : '#1e3a8a' }}>{viewingBom.status}</span></div>
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
                        <td style={{ padding: '10px', color: '#334155' }}>{item.category || '-'}</td>
                        <td style={{ padding: '10px', color: '#334155' }}>{item.unit || '-'}</td>
                        <td style={{ padding: '10px', color: '#334155' }}>{qty}</td>
                        <td style={{ padding: '10px', color: '#334155' }}>LKR {cost.toLocaleString()}</td>
                        <td style={{ padding: '10px', fontWeight: '700', color: '#0d1b4b' }}>LKR {total.toLocaleString()}</td>
                        <td style={{ padding: '10px', color: '#334155' }}>{item.supplierRef || '-'}</td>
                        <td style={{ padding: '10px', color: '#334155' }}>{item.remarks || '-'}</td>
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
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>DIRECTOR NOTE / FEEDBACK (OPTIONAL)</label>
                <textarea
                  placeholder="Specify feedback note here (optional)."
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
                      {v.version} ({v.status}) - {formatDate(v.createdAt)}
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
                      {v.version} ({v.status}) - {formatDate(v.createdAt)}
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
                <label style={{ display: 'block', fontSize: '12px', color: '#666', fontWeight: '600', marginBottom: '6px' }}>REJECTION NOTE (OPTIONAL)</label>
                <textarea
                  placeholder="Specify feedback/reason for rejection"
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  style={{ width: '100%', height: '100px', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
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

      {/* View PO modal */}
      {showViewPOModal && viewingPO && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1100, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setShowViewPOModal(false)}>
          <div style={{ background: 'white', borderRadius: '12px', width: '80%', maxWidth: '800px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.35)' }} onClick={e => e.stopPropagation()}>
            <div style={{ background: '#0d1b4b', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h3 style={{ margin: 0, color: 'white', fontSize: '17px', fontWeight: '700' }}>Purchase Order: {viewingPO.poNumber}</h3>
                <span style={{
                  background: viewingPO.status === 'Approved' ? '#2e7d32' : viewingPO.status === 'Rejected' ? '#c62828' : '#3b82f6',
                  color: 'white', padding: '3px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase'
                }}>{viewingPO.status || 'Pending'}</span>
              </div>
              <span onClick={() => setShowViewPOModal(false)} style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '22px', color: 'white', lineHeight: 1 }}>&times;</span>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '18px 24px',
                marginBottom: '22px',
                padding: '18px 20px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px'
              }}>
                {[
                  ['Project', viewingPO.prId?.projectName || viewingPO.prId?.project || '-'],
                  ['Supplier', viewingPO.supplier || '-'],
                  ['Submitted By', viewingPO.createdBy || '-'],
                  ['Date Submitted', formatDate(viewingPO.createdAt)],
                  ['Payment Terms', viewingPO.paymentTerms || '-'],
                  ['Expected Delivery', viewingPO.expectedDeliveryDate ? formatDate(viewingPO.expectedDeliveryDate) : '-']
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '4px' }}>{label}</div>
                    <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: '600' }}>{value}</div>
                  </div>
                ))}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '4px' }}>Delivery Address</div>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: '600' }}>{viewingPO.deliveryAddress || '-'}</div>
                </div>
                {viewingPO.notes && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '4px' }}>Notes</div>
                    <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: '600' }}>{viewingPO.notes}</div>
                  </div>
                )}
                {viewingPO.rejectionReason && (
                  <div style={{ gridColumn: '1 / -1', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#c62828', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '4px' }}>Director Note</div>
                    <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: '600' }}>{viewingPO.rejectionReason}</div>
                  </div>
                )}
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', border: '1px solid #e2e8f0' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                    {['Material', 'Qty', 'Unit', 'Unit Price', 'Total'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', color: '#475569', fontWeight: '700', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(viewingPO.items || []).map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 12px', color: '#0f172a' }}>{item.materialName}</td>
                      <td style={{ padding: '10px 12px', color: '#0f172a' }}>{item.quantity}</td>
                      <td style={{ padding: '10px 12px', color: '#0f172a' }}>{item.unit}</td>
                      <td style={{ padding: '10px 12px', color: '#0f172a' }}>LKR {Number(item.unitPrice || 0).toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0f172a' }}>LKR {(Number(item.quantity || 0) * Number(item.unitPrice || 0)).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: '16px', textAlign: 'right', fontSize: '16px', fontWeight: '700', color: '#0d1b4b' }}>
                Total: LKR {Number(viewingPO.totalAmount || 0).toLocaleString()}
              </div>

              <div style={{ marginTop: '22px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                {viewingPO.status === 'Pending' && (
                  <>
                    <button onClick={() => openPOActionModal(viewingPO._id, 'approve')} style={{ background: '#2e7d32', color: 'white', border: 'none', padding: '10px 22px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', minWidth: '110px' }}>✓ Approve</button>
                    <button onClick={() => openPOActionModal(viewingPO._id, 'reject')} style={{ background: '#c62828', color: 'white', border: 'none', padding: '10px 22px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', minWidth: '110px' }}>✕ Reject</button>
                  </>
                )}
                <button onClick={() => setShowViewPOModal(false)} style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '10px 22px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', minWidth: '90px' }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PO Reject reason modal */}
      {poActionModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200 }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '10px', width: '420px', boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>
            <h3 style={{ color: '#0d1b4b', marginTop: 0, marginBottom: '16px', fontSize: '18px' }}>
              Reject Purchase Order
            </h3>
            <form onSubmit={handlePOActionSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Rejection Reason
                </label>
                <textarea
                  placeholder="Explain why this purchase order is being rejected"
                  value={poActionNote}
                  onChange={e => setPoActionNote(e.target.value)}
                  required
                  style={{ width: '100%', height: '100px', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', color: '#0f172a' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="submit" style={{ background: '#c62828', color: 'white', border: 'none', padding: '10px 22px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', minWidth: '110px' }}>
                  Confirm Reject
                </button>
                <button type="button" onClick={() => setPoActionModal(null)} style={{ background: '#f5f5f5', color: '#333', border: '1px solid #ddd', padding: '10px 22px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', minWidth: '90px' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {renderDashboardStatsModal()}
    </div>
  );
};

export default DirectorDashboard;
