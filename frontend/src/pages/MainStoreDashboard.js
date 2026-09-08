import React, { useState, useEffect } from 'react';
import SettingsPage from './SettingsPage';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { encryptTransit, decryptTransit } from '../utils/cryptoUtils';
import { formatDate, formatDateTime, formatDateLong } from '../utils/dateUtils';
import DateInput from '../components/DateInput';

function MainStoreDashboard({ user, onLogout, onUserUpdate }) {
  const [view, setView] = useState('dashboard'); // 'dashboard', 'inventory', 'grn', 'purchase-request', 'min', 'approved-boms', 'stock-adjustments', 'stock-ledger', 'reports', 'notifications', 'settings'
  const [materials, setMaterials] = useState([]);
  const [projects, setProjects] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [grns, setGrns] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [prs, setPrs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modal, setModal] = useState(null);
  const [modalSearchTerm, setModalSearchTerm] = useState('');

  // Material Issuance Notes and Usage charts state
  const [minList, setMinList] = useState([]);
  const [usageLogs, setUsageLogs] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('2026-07');
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState({});

  // Create Material Transfer Note form (Main Store -> Site Store). Used both
  // to push a brand new transfer, and - when opened from a Pending FreeForm
  // Site Store request - to fulfil that request in one step (sourceRequestId
  // is set in that case).
  const emptyTransferItemRow = { materialName: '', unit: '', quantity: '' };
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [transferForm, setTransferForm] = useState({
    sourceRequestId: '',
    projectId: '',
    projectName: '',
    transferDate: new Date().toISOString().substring(0, 10),
    reference: '',
    notes: '',
    items: [{ ...emptyTransferItemRow }]
  });
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  // Director-Approved BOMs, and the BOM-vs-stock shortage comparison state used
  // to auto-generate (and let the officer manually adjust) a Purchase Request.
  const [approvedBoms, setApprovedBoms] = useState([]);
  const [selectedBom, setSelectedBom] = useState(null);
  const [shortageItems, setShortageItems] = useState([]);
  const [viewBom, setViewBom] = useState(null);

  // PR Form State
  const [prForm, setPrForm] = useState({
    projectName: '',
    materialName: '',
    unit: 'bag',
    quantity: '',
    urgency: 'Normal',
    notes: ''
  });
  const [showPrForm, setShowPrForm] = useState(false);

  // Search & Filters for Stock Table
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Stock Adjustment form state
  const [adjustmentForm, setAdjustmentForm] = useState({ materialId: '', physicalCount: '', reason: 'Count Correction', notes: '' });
  const [adjustmentSubmitting, setAdjustmentSubmitting] = useState(false);

  // GRN form
  const [grnForm, setGrnForm] = useState({
    supplier: '',
    supplierId: '',
    poReference: '',
    receivedDate: new Date().toISOString().substring(0, 10),
    notes: '',
    items: []
  });

  // Post-GRN "Attach Invoice" step state
  const [lastCreatedGrn, setLastCreatedGrn] = useState(null);
  const [supplierPOs, setSupplierPOs] = useState([]);
  const [invoiceForm, setInvoiceForm] = useState({ po: '', amount: '', invoiceDate: new Date().toISOString().substring(0, 10) });
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [invoiceMessage, setInvoiceMessage] = useState('');
  const [invoiceError, setInvoiceError] = useState('');
  const [grnInvoices, setGrnInvoices] = useState([]);

  // Purchase Orders (used to prefill GRN creation from a Sent/Delivered PO)
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [selectedGrnPO, setSelectedGrnPO] = useState('');

  // Purchase Requests screen filters
  const [prSearch, setPrSearch] = useState('');
  const [prStatusFilter, setPrStatusFilter] = useState('All');

  // Stock Ledger screen
  const [stockLedger, setStockLedger] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('All');

  // Notifications screen (persisted Notification records, distinct from the
  // low-stock alert list used by the header bell)
  const [persistedNotifications, setPersistedNotifications] = useState([]);
  const [notifFilter, setNotifFilter] = useState('All');

  const getHeaders = () => {
    const token = JSON.parse(localStorage.getItem('user'))?.token;
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };
  };

  const fetchNotifications = async () => {
    if (!hasSession()) return;
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

  const fetchMINs = async () => {
    try {
      const headers = getHeaders();
      const res = await fetch('http://localhost:5000/api/min', { headers });
      const data = await res.json();
      let finalData = data;
      if (data && data.ciphertext) {
        finalData = JSON.parse(decryptTransit(data.ciphertext));
      }
      if (finalData.success && Array.isArray(finalData.data)) {
        setMinList(finalData.data);
      }
    } catch (err) {
      console.error('Error fetching Material Issuance Notes:', err);
    }
  };

  const fetchPurchaseOrders = async () => {
    try {
      const headers = getHeaders();
      const res = await fetch('http://localhost:5000/api/purchase-orders', { headers });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setPurchaseOrders(data.data);
      }
    } catch (err) {
      console.error('Error fetching purchase orders:', err);
    }
  };

  const fetchStockLedger = async () => {
    setLedgerLoading(true);
    try {
      const headers = getHeaders();
      const res = await fetch('http://localhost:5000/api/inventory/stock-ledger', { headers });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setStockLedger(data.data);
      }
    } catch (err) {
      console.error('Error fetching stock ledger:', err);
    } finally {
      setLedgerLoading(false);
    }
  };

  const fetchPersistedNotifications = async () => {
    try {
      const headers = getHeaders();
      const res = await fetch('http://localhost:5000/api/notifications', { headers });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setPersistedNotifications(data.data);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const fetchUsageLogs = async () => {
    try {
      const headers = getHeaders();
      const res = await fetch('http://localhost:5000/api/material-usage', { headers });
      const data = await res.json();
      let finalData = data;
      if (data && data.ciphertext) {
        finalData = JSON.parse(decryptTransit(data.ciphertext));
      }
      if (finalData.success && Array.isArray(finalData.data)) {
        setUsageLogs(finalData.data);
      }
    } catch (err) {
      console.error('Error fetching usage records:', err);
    }
  };

  const hasSession = () => {
    try {
      return !!JSON.parse(localStorage.getItem('user'))?.token;
    } catch {
      return false;
    }
  };

  const fetchData = async () => {
    if (!hasSession()) return;
    setLoading(true);
    setError('');
    try {
      const headers = getHeaders();

      // Fetch materials
      const matRes = await fetch('http://localhost:5000/api/inventory', { headers });
      const matData = await matRes.json();
      if (Array.isArray(matData)) setMaterials(matData);

      // Fetch GRNs
      const grnRes = await fetch('http://localhost:5000/api/inventory/grn-list', { headers });
      const grnData = await grnRes.json();
      if (Array.isArray(grnData)) setGrns(grnData);

      // Fetch invoices (to flag which GRNs already have a supplier invoice attached)
      const invRes = await fetch('http://localhost:5000/api/invoices', { headers });
      const invData = await invRes.json();
      if (invData.success) setGrnInvoices(invData.data);

      // Fetch Transfers
      const transferRes = await fetch('http://localhost:5000/api/inventory/transfers', { headers });
      const transferData = await transferRes.json();
      if (Array.isArray(transferData)) setTransfers(transferData);

      // Fetch Suppliers
      const supRes = await fetch('http://localhost:5000/api/suppliers', { headers });
      const supData = await supRes.json();
      const rawSuppliers = supData.success ? supData.data : (Array.isArray(supData) ? supData : []);
      setSuppliers(rawSuppliers);

      // Fetch notifications
      await fetchNotifications();

      // Fetch PRs
      const prRes = await fetch('http://localhost:5000/api/purchase-requests', { headers });
      const prData = await prRes.json();
      if (prData.success) {
        setPrs(prData.data);
      }

      // Fetch projects
      const projRes = await fetch('http://localhost:5000/api/projects', { headers });
      const projData = await projRes.json();
      if (projData.success) {
        setProjects(projData.data);
      }

      // Fetch Material Issuance Notes and Usage Logs
      await fetchMINs();
      await fetchUsageLogs();
      await fetchPurchaseOrders();
      await fetchPersistedNotifications();

      // Fetch Director-Approved BOMs so Main Store can compare planned quantities
      // against current stock and raise a shortage Purchase Request.
      const bomRes = await fetch('http://localhost:5000/api/bom', { headers });
      const bomData = await bomRes.json();
      if (bomData.success) {
        setApprovedBoms((bomData.data || []).filter(b => b.status === 'Approved'));
      }

    } catch (err) {
      setError('Could not connect to the backend server. Using fallback demo data.');
      // Fallback
      setMaterials([
        { _id: '1', name: 'Portland Cement OPC', category: 'Cement', unit: 'bag', quantity: 150, minimumStock: 20, unitPrice: 1850, location: 'MainStore' },
        { _id: '2', name: 'Deformed Steel Bars 12mm', category: 'Steel', unit: 'ton', quantity: 5, minimumStock: 10, unitPrice: 185000, location: 'MainStore' },
        { _id: '3', name: 'Fine River Sand', category: 'Sand', unit: 'm3', quantity: 8, minimumStock: 15, unitPrice: 8500, location: 'MainStore' },
      ]);
      setGrns([
        { grnNumber: 'GRN-2026-001', supplier: 'Lanka Cement', receivedDate: new Date().toISOString(), items: [{}, {}], status: 'Completed' }
      ]);
      setTransfers([
        { materialName: 'Portland Cement OPC', quantity: 50, from: 'MainStore', to: 'SiteStore', issuedBy: 'Store Officer', date: new Date().toISOString() }
      ]);
      setNotifications([
        { materialName: 'Deformed Steel Bars 12mm', currentQty: 5, minimumStock: 10, location: 'MainStore', alertLevel: 'Low' }
      ]);
      setPrs([
        { _id: '1', projectName: 'Colombo Port Expansion', materials: [{ materialName: 'Portland Cement OPC', quantity: 300, unit: 'bag' }], urgency: 'Normal', status: 'Pending', createdAt: new Date().toISOString() }
      ]);
      setProjects([
        { _id: '1', projectName: 'Colombo Port Expansion' },
        { _id: '2', projectName: 'Marina Heights Development' }
      ]);
      setApprovedBoms([
        { _id: '1', bomNumber: 'BOM-DEMO-001', version: 'v1.0', status: 'Approved', projectName: 'Colombo Port Expansion', approvedBy: 'Director', materials: [{ name: 'Portland Cement OPC', unit: 'bag', plannedQty: 300, category: 'Cement' }] }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (view === 'stock-ledger' || view === 'stock-adjustments') {
      fetchStockLedger();
    }
  }, [view]);

  const handleGrnSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');

    if (!selectedGrnPO || grnForm.items.length === 0) {
      setError('Please select a Purchase Order to load its items before recording a GRN.');
      return;
    }

    const invalid = grnForm.items.some(item => !item.material || item.receivedQty === '' || item.receivedQty === null || Number(item.receivedQty) < 0);
    if (invalid) {
      setError('Please enter a valid received quantity for all items.');
      return;
    }

    const invalidDamaged = grnForm.items.some(item =>
      item.condition === 'Damaged' &&
      (item.damagedQty === '' || item.damagedQty === null || Number(item.damagedQty) < 0 || Number(item.damagedQty) > Number(item.receivedQty))
    );
    if (invalidDamaged) {
      setError('Please enter a valid damaged quantity (not exceeding received quantity) for items marked Damaged.');
      return;
    }

    try {
      const payload = {
        ...grnForm,
        receivedBy: user ? user.name : 'Store Officer'
      };
      const res = await fetch('http://localhost:5000/api/inventory/grn', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message || '✅ GRN processed successfully!');
        setGrnForm({
          supplier: '',
          supplierId: '',
          poReference: '',
          receivedDate: new Date().toISOString().substring(0, 10),
          notes: '',
          items: []
        });
        setSelectedGrnPO('');
        setLastCreatedGrn(data.grn);
        fetchData();
      } else {
        setError(data.message || 'Failed to submit GRN.');
      }
    } catch (err) {
      setError('Connection error occurred.');
    }
  };

  // Once a GRN is recorded, load that supplier's Sent/Delivered POs so the
  // officer can optionally attach the paper invoice the supplier handed over.
  useEffect(() => {
    if (!lastCreatedGrn) {
      setSupplierPOs([]);
      return;
    }
    (async () => {
      try {
        const res = await fetch('http://localhost:5000/api/purchase-orders', { headers: getHeaders() });
        const data = await res.json();
        const allPOs = data.success ? data.data : [];
        setSupplierPOs(allPOs.filter(po => po.supplier === lastCreatedGrn.supplier && ['Sent', 'Delivered'].includes(po.status)));
      } catch (err) {
        setSupplierPOs([]);
      }
    })();
  }, [lastCreatedGrn]);

  const handleInvoiceSubmit = async (e) => {
    e.preventDefault();
    setInvoiceError(''); setInvoiceMessage('');
    if (!invoiceForm.po || !invoiceForm.amount) {
      setInvoiceError('Please select the related PO and enter the invoice amount.');
      return;
    }
    try {
      const fd = new FormData();
      fd.append('supplier', lastCreatedGrn.supplierId || '');
      fd.append('po', invoiceForm.po);
      fd.append('grn', lastCreatedGrn._id);
      fd.append('amount', invoiceForm.amount);
      fd.append('invoiceDate', invoiceForm.invoiceDate);
      if (invoiceFile) fd.append('file', invoiceFile);

      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/invoices', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      });
      const data = await res.json();
      if (res.ok) {
        setInvoiceMessage('✅ Invoice recorded and sent for Director approval!');
        setInvoiceForm({ po: '', amount: '', invoiceDate: new Date().toISOString().substring(0, 10) });
        setInvoiceFile(null);
        setTimeout(() => {
          setLastCreatedGrn(null);
          setInvoiceMessage('');
          setView('dashboard');
        }, 1500);
      } else {
        setInvoiceError(data.message || 'Failed to record invoice.');
      }
    } catch (err) {
      setInvoiceError('Connection error occurred.');
    }
  };

  // Stock Adjustment: the only sanctioned way to correct current stock
  // outside of GRN/MIN/Usage transactions (e.g. after a physical count).
  const handleStockAdjustmentSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');

    if (!adjustmentForm.materialId || adjustmentForm.physicalCount === '' || !adjustmentForm.reason.trim()) {
      setError('Please select a material, enter the physical count, and provide a reason.');
      return;
    }

    setAdjustmentSubmitting(true);
    try {
      const res = await fetch('http://localhost:5000/api/inventory/adjustments', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          materialId: adjustmentForm.materialId,
          physicalCount: Number(adjustmentForm.physicalCount),
          reason: adjustmentForm.reason,
          notes: adjustmentForm.notes
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess('✅ Stock adjustment recorded successfully!');
        setAdjustmentForm({ materialId: '', physicalCount: '', reason: 'Count Correction', notes: '' });
        fetchData();
        fetchStockLedger();
      } else {
        setError(data.message || 'Failed to record stock adjustment.');
      }
    } catch (err) {
      setError('Connection error occurred.');
    } finally {
      setAdjustmentSubmitting(false);
    }
  };

  // Material Issuance Note Handlers
  const handleApproveMIN = async (id) => {
    setError(''); setSuccess('');
    try {
      const payload = { status: 'Approved' };
      const ciphertext = encryptTransit(JSON.stringify(payload));
      const res = await fetch(`http://localhost:5000/api/min/${id}/status`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ ciphertext })
      });
      const data = await res.json();
      let finalData = data;
      if (data && data.ciphertext) {
        finalData = JSON.parse(decryptTransit(data.ciphertext));
      }
      if (res.ok && finalData.success) {
        setSuccess('Material Issuance Note approved successfully!');
        fetchData();
      } else {
        setError(finalData.message || 'Failed to approve Material Issuance Note.');
      }
    } catch (err) {
      setError('Error approving Material Issuance Note.');
    }
  };

  const handleRejectMIN = async (id) => {
    const reason = window.prompt('Please enter the reason for rejection:');
    if (reason === null) return; // cancel
    setError(''); setSuccess('');
    try {
      const payload = { status: 'Rejected', rejectionReason: reason || 'Rejected by Main Store' };
      const ciphertext = encryptTransit(JSON.stringify(payload));
      const res = await fetch(`http://localhost:5000/api/min/${id}/status`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ ciphertext })
      });
      const data = await res.json();
      let finalData = data;
      if (data && data.ciphertext) {
        finalData = JSON.parse(decryptTransit(data.ciphertext));
      }
      if (res.ok && finalData.success) {
        setSuccess('Material Issuance Note rejected.');
        fetchData();
      } else {
        setError(finalData.message || 'Failed to reject Material Issuance Note.');
      }
    } catch (err) {
      setError('Error rejecting Material Issuance Note.');
    }
  };

  const handleIssueMIN = async (id) => {
    setError(''); setSuccess('');
    try {
      const res = await fetch(`http://localhost:5000/api/min/${id}/issue`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      let finalData = data;
      if (data && data.ciphertext) {
        finalData = JSON.parse(decryptTransit(data.ciphertext));
      }
      if (res.ok && finalData.success) {
        setSuccess('✅ Materials issued to Site Store! Awaiting delivery confirmation.');
        fetchData();
      } else {
        setError(finalData.message || 'Failed to issue materials.');
      }
    } catch (err) {
      setError('Error issuing materials.');
    }
  };

  const handleMINShortagePR = async (min) => {
    setError(''); setSuccess('');
    try {
      // Find shortages
      const prItems = [];
      for (const item of min.materials) {
        const mainMat = materials.find(m => m.name === item.materialName && m.location === 'MainStore');
        const available = mainMat ? mainMat.quantity : 0;
        if (available < item.quantity) {
          prItems.push({
            materialName: item.materialName,
            quantity: item.quantity - available,
            unit: item.unit
          });
        }
      }

      if (prItems.length === 0) {
        setError('No shortage detected for this requisition. Main Store has sufficient stock.');
        return;
      }

      const payload = {
        projectName: min.projectName,
        urgency: 'High',
        notes: `Auto-generated shortage PR from Main Store for Material Issuance Note ${min.minNumber}`,
        materials: prItems,
        requestedBy: user ? user.name : 'Main Store Officer'
      };

      const ciphertext = encryptTransit(JSON.stringify(payload));
      const res = await fetch('http://localhost:5000/api/purchase-requests', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ ciphertext })
      });
      const data = await res.json();
      let finalData = data;
      if (data && data.ciphertext) {
        finalData = JSON.parse(decryptTransit(data.ciphertext));
      }

      if (res.ok && finalData.success) {
        setSuccess(`✅ PR successfully generated for shortages: ${prItems.map(p => `${p.materialName} (${p.quantity})`).join(', ')}`);
        fetchData();
      } else {
        setError(finalData.message || 'Failed to generate Purchase Request.');
      }
    } catch (err) {
      setError('Error generating PR.');
    }
  };

  // Opens the Create Material Transfer Note form. With no argument it opens
  // blank for a brand new Main Store-initiated transfer. Passed a Pending
  // FreeForm Material Transfer Note (a Site Store request), it pre-fills the
  // project, materials and reference from that request so Main Store can
  // review/adjust the transfer quantities before sending.
  const openTransferForm = (sourceRequest) => {
    setError(''); setSuccess('');
    if (sourceRequest) {
      setTransferForm({
        sourceRequestId: sourceRequest._id,
        projectId: sourceRequest.projectId,
        projectName: sourceRequest.projectName,
        transferDate: new Date().toISOString().substring(0, 10),
        reference: sourceRequest.minNumber,
        notes: sourceRequest.notes || '',
        items: sourceRequest.materials.map(m => ({ materialName: m.materialName, unit: m.unit, quantity: m.quantity }))
      });
    } else {
      setTransferForm({
        sourceRequestId: '',
        projectId: '',
        projectName: '',
        transferDate: new Date().toISOString().substring(0, 10),
        reference: '',
        notes: '',
        items: [{ ...emptyTransferItemRow }]
      });
    }
    setShowTransferForm(true);
  };

  const handleTransferProjectChange = (projectId) => {
    const proj = projects.find(p => p._id === projectId);
    setTransferForm({ ...transferForm, projectId, projectName: proj ? proj.projectName : '' });
  };

  const handleTransferItemChange = (idx, field, value) => {
    const items = transferForm.items.map((item, i) => {
      if (i !== idx) return item;
      if (field === 'materialName') {
        const mat = mainMaterials.find(m => m.name === value);
        return { ...item, materialName: value, unit: mat ? mat.unit : item.unit };
      }
      return { ...item, [field]: value };
    });
    setTransferForm({ ...transferForm, items });
  };

  const addTransferItemRow = () => {
    setTransferForm({ ...transferForm, items: [...transferForm.items, { ...emptyTransferItemRow }] });
  };

  const removeTransferItemRow = (idx) => {
    setTransferForm({ ...transferForm, items: transferForm.items.filter((_, i) => i !== idx) });
  };

  const handleCreateTransferSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');

    if (!transferForm.projectId || !transferForm.transferDate) {
      setError('Please select a project and transfer date.');
      return;
    }
    const invalid = transferForm.items.some(item => !item.materialName || !item.quantity || Number(item.quantity) <= 0);
    if (invalid) {
      setError('Please select a material and enter a valid transfer quantity for every row.');
      return;
    }

    setTransferSubmitting(true);
    try {
      const payload = {
        projectId: transferForm.projectId,
        projectName: transferForm.projectName,
        transferDate: transferForm.transferDate,
        reference: transferForm.reference,
        notes: transferForm.notes,
        sourceRequestId: transferForm.sourceRequestId || undefined,
        materials: transferForm.items.map(item => ({ materialName: item.materialName, quantity: item.quantity, unit: item.unit }))
      };
      const ciphertext = encryptTransit(JSON.stringify(payload));
      const res = await fetch('http://localhost:5000/api/min/transfer', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ ciphertext })
      });
      const data = await res.json();
      let finalData = data;
      if (data && data.ciphertext) {
        finalData = JSON.parse(decryptTransit(data.ciphertext));
      }
      if (res.ok && finalData.success) {
        setSuccess('✅ Material Transfer Note created and materials issued to Site Store!');
        setShowTransferForm(false);
        fetchData();
      } else {
        setError(finalData.message || 'Failed to create Material Transfer Note.');
      }
    } catch (err) {
      setError('Could not connect to the backend server to create the Material Transfer Note.');
    } finally {
      setTransferSubmitting(false);
    }
  };

  // Opens the shortage comparison panel for one Director-approved BOM: every
  // planned material is checked against current Main Store stock, and any
  // shortfall is pre-selected as an editable PR quantity. The officer can then
  // adjust quantities or include/exclude rows before submitting.
  const handleCompareBom = (bom) => {
    setError(''); setSuccess('');
    const items = (bom.materials || []).map(item => {
      const mainMat = materials.find(m => m.name === item.name && m.location === 'MainStore');
      const available = mainMat ? mainMat.quantity : 0;
      const shortage = Math.max((Number(item.plannedQty) || 0) - available, 0);
      return {
        name: item.name,
        category: item.category,
        unit: item.unit,
        plannedQty: item.plannedQty,
        available,
        quantity: shortage,
        include: shortage > 0
      };
    });
    setSelectedBom(bom);
    setShortageItems(items);
  };

  const handleShortageQtyChange = (idx, val) => {
    setShortageItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: val } : it));
  };

  const handleShortageIncludeToggle = (idx) => {
    setShortageItems(prev => prev.map((it, i) => i === idx ? { ...it, include: !it.include } : it));
  };

  const handleCancelBomCompare = () => {
    setSelectedBom(null);
    setShortageItems([]);
  };

  // Submits the (possibly manually adjusted) shortage list as a Purchase Request
  // against the same approved BOM used for the comparison. This reuses the exact
  // Create-PR endpoint/permission Main Store already has, so it lands directly in
  // the Purchase Manager's Purchase Request queue with no further wiring needed.
  const handleSubmitBomShortagePR = async () => {
    setError(''); setSuccess('');
    if (!selectedBom) return;

    const prItems = shortageItems
      .filter(it => it.include && Number(it.quantity) > 0)
      .map(it => ({
        materialName: it.name,
        quantity: Number(it.quantity),
        unit: it.unit,
        reason: `Shortage vs approved BOM ${selectedBom.bomNumber || ''} (${selectedBom.version || 'v1.0'})`
      }));

    if (prItems.length === 0) {
      setError('Select at least one material with a quantity greater than zero to raise a Purchase Request.');
      return;
    }

    const projectName = selectedBom.projectId?.projectName || selectedBom.projectId?.name || selectedBom.projectName;

    const payload = {
      projectName,
      urgency: 'Critical',
      notes: `Auto-generated shortage PR from Main Store, comparing approved BOM ${selectedBom.bomNumber || ''} (${selectedBom.version || 'v1.0'}) against current Main Store stock.`,
      materials: prItems,
      requestedBy: user ? user.name : 'Main Store Officer'
    };

    try {
      const res = await fetch('http://localhost:5000/api/purchase-requests', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(`✅ Purchase Request submitted to Purchase Manager for: ${prItems.map(p => `${p.materialName} (${p.quantity})`).join(', ')}`);
        handleCancelBomCompare();
        fetchData();
      } else {
        setError(data.message || 'Failed to generate Purchase Request.');
      }
    } catch (err) {
      setError('Error generating Purchase Request from BOM comparison.');
    }
  };

  const handleStoreSwitch = () => {
    localStorage.setItem('storeType', 'SiteStore');
    window.location.reload();
  };

  // Resolve a PO's supplier to the matching Supplier Registry record, preferring
  // the reliable ObjectId reference over fuzzy name matching.
  const resolveSupplierForPO = (po) => {
    if (!po) return null;
    const supName = po.supplier?.name || po.supplier;
    return (
      suppliers.find(s => s._id === po.supplierRefId) ||
      suppliers.find(s => s._id === (po.supplier?._id || '')) ||
      suppliers.find(s => s.name === supName || s.supplierId === supName) ||
      null
    );
  };

  const formatSupplierLabel = (po) => {
    const matched = resolveSupplierForPO(po);
    if (!matched) return po?.supplier?.name || po?.supplier || '';
    const displayName = (matched.name && matched.name !== matched.supplierId) ? matched.name : (matched.contactPerson || matched.name);
    return `${matched.supplierId} – ${displayName}`;
  };

  // Next GRN Number preview: highest existing serial for the current year + 1,
  // so it stays correct even if some GRNs were removed (avoids collisions).
  const nextGrnNumber = () => {
    const year = new Date().getFullYear();
    const prefix = `GRN-${year}-`;
    const maxSerial = grns.reduce((max, g) => {
      if (typeof g.grnNumber === 'string' && g.grnNumber.startsWith(prefix)) {
        const n = parseInt(g.grnNumber.slice(prefix.length), 10);
        if (!isNaN(n) && n > max) return n;
      }
      return max;
    }, 0);
    return `${prefix}${String(maxSerial + 1).padStart(3, '0')}`;
  };

  // GRN: prefill the form (supplier + item rows) from a selected Sent/Delivered PO
  const handleGrnPOSelect = (poId) => {
    setSelectedGrnPO(poId);
    if (!poId) {
      setGrnForm({ ...grnForm, supplier: '', supplierId: '', poReference: '', items: [] });
      return;
    }
    const po = purchaseOrders.find(p => p._id === poId);
    if (!po) return;

    const matchedSupplier = resolveSupplierForPO(po);
    const items = (po.items || []).map(item => {
      const matchedMaterial = materials.find(m => m.name === item.materialName && m.location === 'MainStore');
      return {
        material: matchedMaterial ? matchedMaterial._id : '',
        materialName: item.materialName,
        unit: item.unit || '',
        expectedQty: item.quantity,
        receivedQty: '',
        condition: 'Good',
        damagedQty: ''
      };
    });

    setGrnForm({
      ...grnForm,
      supplier: matchedSupplier ? matchedSupplier.name : (po.supplier?.name || grnForm.supplier),
      supplierId: matchedSupplier ? matchedSupplier._id : (po.supplier?._id || ''),
      poReference: po.poNumber,
      items
    });
  };

  // Notifications
  const handleMarkNotifRead = async (id) => {
    try {
      await fetch(`http://localhost:5000/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: getHeaders()
      });
      setPersistedNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllNotifsRead = async () => {
    try {
      await fetch('http://localhost:5000/api/notifications/mark-all-read', {
        method: 'PUT',
        headers: getHeaders()
      });
      setPersistedNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  // Generic CSV export used by Stock Ledger / Reports screens
  const exportToCSV = (filename, headers, rows) => {
    const escapeCell = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const csvContent = [headers.map(escapeCell).join(','), ...rows.map(row => row.map(escapeCell).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!prForm.projectName || !prForm.materialName || !prForm.quantity || Number(prForm.quantity) <= 0) {
      setError('Please fill in all required PR fields.');
      return;
    }

    const payload = {
      projectName: prForm.projectName,
      materials: [{
        materialName: prForm.materialName,
        quantity: Number(prForm.quantity),
        unit: prForm.unit,
        reason: prForm.notes
      }],
      urgency: prForm.urgency,
      notes: prForm.notes,
      requestedBy: user ? user.name : 'Store Officer'
    };

    try {
      const res = await fetch('http://localhost:5000/api/purchase-requests', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess('✅ PR submitted to Project Manager');
        setShowPrForm(false);
        setPrForm({
          projectName: '',
          materialName: '',
          unit: 'bag',
          quantity: '',
          urgency: 'Normal',
          notes: ''
        });
        fetchData();
      } else {
        setError(data.message || 'Failed to submit Purchase Request.');
      }
    } catch (err) {
      setSuccess('✅ PR submitted to Project Manager (Demo Mode)');
      const mockPr = {
        _id: String(Date.now()),
        projectName: prForm.projectName,
        materials: [{
          materialName: prForm.materialName,
          quantity: Number(prForm.quantity),
          unit: prForm.unit,
          reason: prForm.notes
        }],
        urgency: prForm.urgency,
        status: 'Pending',
        requestedBy: user ? user.name : 'Store Officer',
        createdAt: new Date().toISOString()
      };
      setPrs(prev => [mockPr, ...prev]);
      setShowPrForm(false);
      setPrForm({
        projectName: '',
        materialName: '',
        unit: 'bag',
        quantity: '',
        urgency: 'Normal',
        notes: ''
      });
    }
  };

  // Calculations for stats
  const mainMaterials = materials.filter(m => m.location === 'MainStore');
  const totalSKUs = mainMaterials.length;
  const stockValue = mainMaterials.reduce((sum, m) => sum + (m.quantity * m.unitPrice), 0);
  const lowStockItems = mainMaterials.filter(m => m.quantity <= m.minimumStock).length;
  const lastGRNDate = grns.length > 0 ? formatDate(grns[0].receivedDate || grns[0].createdAt) : 'N/A';

  const filteredMaterials = mainMaterials.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || m.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Additional dashboard/report stats
  const outOfStockItems = mainMaterials.filter(m => m.quantity === 0).length;
  const reorderRequiredItems = mainMaterials.filter(m => m.quantity > m.minimumStock && m.quantity <= (m.reorderLevel || m.minimumStock)).length;
  const pendingGRNs = grns.filter(g => g.status === 'Pending' || g.status === 'Partial').length;
  const pendingPRs = prs.filter(p => p.status === 'Pending').length;
  const pendingMINs = minList.filter(m => m.status === 'Pending').length;
  const todayStr = new Date().toISOString().substring(0, 10);
  const todaysTransfers = transfers.filter(t => String(t.date || '').substring(0, 10) === todayStr).length;

  const materialStatus = (m) => {
    if (m.quantity === 0) return { label: 'Out of Stock', bg: '#ffebee', color: '#c62828' };
    if (m.quantity <= m.minimumStock) return { label: 'Low', bg: '#ffebee', color: '#c62828' };
    if (m.quantity <= (m.reorderLevel || m.minimumStock)) return { label: 'Reorder', bg: '#fff3e0', color: '#b7791f' };
    return { label: 'Healthy', bg: '#e8f5e9', color: '#2e7d32' };
  };

  // Category breakdown (by stock value) for the dashboard donut chart
  const categoryChartData = Object.entries(
    mainMaterials.reduce((acc, m) => {
      const cat = m.category || 'Other';
      acc[cat] = (acc[cat] || 0) + ((m.quantity * m.unitPrice) || 0);
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value })).filter(c => c.value > 0);

  // Recent activity feed combining GRNs, MIN status changes, and PR submissions
  const recentActivities = [
    ...grns.map(g => ({
      date: g.createdAt || g.receivedDate,
      icon: '📥',
      text: `${g.grnNumber} created for ${g.supplier}`
    })),
    ...minList.filter(m => ['Issued', 'Approved', 'Received', 'Rejected'].includes(m.status)).map(m => ({
      date: m.updatedAt || m.issuedAt || m.createdAt,
      icon: m.status === 'Rejected' ? '⛔' : '🚚',
      text: `${m.minNumber} ${m.status.toLowerCase()}${m.status === 'Issued' ? ` to ${m.projectName || 'site'}` : ''}`
    })),
    ...prs.map(pr => ({
      date: pr.createdAt,
      icon: '📝',
      text: `Purchase Request submitted for ${pr.projectName || pr.project} (${pr.materials?.length || 0} item${pr.materials?.length === 1 ? '' : 's'})`
    }))
  ].filter(a => a.date).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);

  const renderStoreStatsModal = () => {
    if (!modal) return null;

    let title = '';
    let tableHeaders = [];
    let tableRows = [];
    
    const query = modalSearchTerm.toLowerCase();

    if (modal === 'total-materials') {
      title = 'Total Materials Inventory';
      tableHeaders = ['Material Name', 'Category', 'Quantity Available', 'Min Stock Level', 'Unit Price', 'Stock Status'];
      
      const filtered = mainMaterials.filter(m => 
        (m.name || '').toLowerCase().includes(query) ||
        (m.category || '').toLowerCase().includes(query)
      );

      tableRows = filtered.map((m, idx) => {
        const isLow = m.quantity <= m.minimumStock;
        return (
          <tr key={m._id || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
            <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600' }}>{m.name}</td>
            <td style={{ padding: '12px 16px', fontSize: '13px' }}>{m.category}</td>
            <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '700' }}>{m.quantity} {m.unit}</td>
            <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>{m.minimumStock} {m.unit}</td>
            <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600' }}>LKR {m.unitPrice?.toLocaleString()}</td>
            <td style={{ padding: '12px 16px' }}>
              <span style={{
                background: isLow ? '#ffebee' : '#e8f5e9',
                color: isLow ? '#c62828' : '#2e7d32',
                padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold'
              }}>{isLow ? 'Low Stock' : 'In Stock'}</span>
            </td>
          </tr>
        );
      });
    } else if (modal === 'stock-value') {
      title = 'Stock Value Breakdown by Category';
      tableHeaders = ['Category', 'Items Count', 'Total Value (LKR)', '% of Total Value'];

      const categoriesBreakdown = Object.entries(
        mainMaterials.reduce((acc, m) => {
          const cat = m.category || 'Other';
          if (!acc[cat]) acc[cat] = { count: 0, value: 0 };
          acc[cat].count += 1;
          acc[cat].value += (m.quantity * m.unitPrice) || 0;
          return acc;
        }, {})
      );

      const filtered = categoriesBreakdown.filter(([cat]) => cat.toLowerCase().includes(query));

      tableRows = filtered.map(([category, info], idx) => {
        const percent = stockValue > 0 ? ((info.value / stockValue) * 100).toFixed(1) : '0.0';
        return (
          <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
            <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600' }}>{category}</td>
            <td style={{ padding: '12px 16px', fontSize: '13px' }}>{info.count} items</td>
            <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#0d1b4b' }}>LKR {info.value.toLocaleString()}</td>
            <td style={{ padding: '12px 16px', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '60px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(Number(percent), 100)}%`, height: '100%', background: '#2563eb' }}></div>
                </div>
                <span>{percent}%</span>
              </div>
            </td>
          </tr>
        );
      });
    } else if (modal === 'low-stock') {
      title = 'Low Stock Items Alert Directory';
      tableHeaders = ['Material Name', 'Current Qty', 'Min Required', 'Shortage', 'Actions'];

      const lowItems = mainMaterials.filter(m => m.quantity <= m.minimumStock);
      const filtered = lowItems.filter(m => (m.name || '').toLowerCase().includes(query));

      tableRows = filtered.map((m, idx) => {
        const shortage = m.minimumStock - m.quantity;
        return (
          <tr key={m._id || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
            <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#c62828' }}>{m.name}</td>
            <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '700' }}>{m.quantity} {m.unit}</td>
            <td style={{ padding: '12px 16px', fontSize: '13px' }}>{m.minimumStock} {m.unit}</td>
            <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '700', color: '#c62828' }}>{shortage} {m.unit}</td>
            <td style={{ padding: '12px 16px' }}>
              <button 
                onClick={() => {
                  setPrForm({
                    projectName: '',
                    materialName: m.name,
                    unit: m.unit,
                    quantity: shortage || 10,
                    urgency: 'Urgent',
                    notes: `Requested shortage of ${shortage} units to restore minimum stock level.`
                  });
                  setShowPrForm(true);
                  setView('purchase-request');
                  setModal(null);
                }}
                style={{ background: '#2563eb', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
              >
                Create PR
              </button>
            </td>
          </tr>
        );
      });
    } else if (modal === 'reorder-level') {
      title = 'Reorder Level Report';
      tableHeaders = ['Material Name', 'Current Qty', 'Reorder Level', 'Min Stock', 'Actions'];

      const reorderItems = mainMaterials.filter(m => m.quantity > m.minimumStock && m.quantity <= (m.reorderLevel || m.minimumStock));
      const filtered = reorderItems.filter(m => (m.name || '').toLowerCase().includes(query));

      tableRows = filtered.map((m, idx) => (
        <tr key={m._id || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#b7791f' }}>{m.name}</td>
          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '700' }}>{m.quantity} {m.unit}</td>
          <td style={{ padding: '12px 16px', fontSize: '13px' }}>{m.reorderLevel} {m.unit}</td>
          <td style={{ padding: '12px 16px', fontSize: '13px' }}>{m.minimumStock} {m.unit}</td>
          <td style={{ padding: '12px 16px' }}>
            <button
              onClick={() => {
                setPrForm({ projectName: '', materialName: m.name, unit: m.unit, quantity: (m.maximumStock || m.reorderLevel) - m.quantity, urgency: 'Normal', notes: 'Restock ahead of reorder threshold.' });
                setShowPrForm(true);
                setView('purchase-request');
                setModal(null);
              }}
              style={{ background: '#2563eb', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
            >
              Create PR
            </button>
          </td>
        </tr>
      ));
    } else if (modal === 'last-grn') {
      title = 'Goods Received Note (GRN) History';
      tableHeaders = ['GRN Number', 'Supplier', 'Received Date', 'Items', 'Status'];

      const filtered = grns.filter(g => 
        (g.grnNumber || '').toLowerCase().includes(query) ||
        (g.supplier || '').toLowerCase().includes(query)
      );

      tableRows = filtered.map((g, idx) => (
        <tr key={g._id || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '700', color: '#1565c0' }}>{g.grnNumber}</td>
          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500' }}>{g.supplier}</td>
          <td style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b' }}>{formatDateTime(g.receivedDate || g.createdAt)}</td>
          <td style={{ padding: '12px 16px', fontSize: '12px', color: '#555' }}>
            {g.items?.map((item, itemIdx) => (
              <div key={itemIdx}>{item.materialName || item.material || 'Material'} (Received: {item.receivedQty} {item.unit || 'bag'})</div>
            ))}
          </td>
          <td style={{ padding: '12px 16px' }}>
            <span style={{
              background: '#e8f5e9',
              color: '#2e7d32',
              padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold'
            }}>{g.status || 'Completed'}</span>
          </td>
        </tr>
      ));
    } else if (modal === 'frequently-used') {
      title = 'Frequently Used Materials Catalog';
      tableHeaders = ['Rank', 'Material Name', 'Total Quantity Issued', 'Issues Count'];

      // Decrypt and group transfers in memory
      const groupMap = {};
      (transfers || []).forEach(t => {
        if (t.from !== 'MainStore') return;
        const name = t.materialName;
        const qty = Number(t.quantity) || 0;
        if (!groupMap[name]) {
          groupMap[name] = { totalQty: 0, count: 0 };
        }
        groupMap[name].totalQty += qty;
        groupMap[name].count += 1;
      });

      const sorted = Object.entries(groupMap)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      tableRows = sorted.map((m, idx) => (
        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 'bold', color: '#1a365d' }}>#{idx + 1}</td>
          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600' }}>{m.name}</td>
          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 'bold' }}>{m.totalQty} units</td>
          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#4a5568' }}>{m.count} issues</td>
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

  return (
    <div style={styles.dashboardLayout}>
      {/* Navigation Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <img src="/els-logo.png" alt="ELS Logo" style={{ width: '38px', height: '38px', objectFit: 'contain' }} />
          <div>
            <div style={styles.sidebarTitle}>ELS Construction</div>
            <div style={styles.sidebarSubtitle}>Main Store Panel</div>
          </div>
        </div>

        {user && (
          <div style={styles.sidebarUserSection}>
            <div style={styles.dbAvatar}>{user.name ? user.name.charAt(0).toUpperCase() : 'S'}</div>
            <div style={styles.sidebarUserInfo}>
              <div style={styles.sidebarUserName}>{user.name}</div>
              <div style={styles.sidebarUserRole}>{user.role} — Main Store</div>
            </div>
          </div>
        )}

        <nav style={styles.sidebarNav}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: '📊' },
            { id: 'inventory', label: 'Inventory', icon: '📦' },
            { id: 'approved-boms', label: 'Approved BOMs', icon: '✅' },
            { id: 'grn', label: 'Goods Received Note', icon: '📥' },
            { id: 'min', label: 'Material Transfer Note', icon: '🚚' },
            { id: 'reports', label: 'Reports & Analytics', icon: '📈' },
            { id: 'settings', label: 'Settings', icon: '⚙️' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => { setView(item.id); setError(''); setSuccess(''); }}
              style={view === item.id ? styles.sidebarBtnActive : styles.sidebarBtn}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>

        <button onClick={onLogout} style={styles.sidebarLogoutBtn}>
          Logout Session
        </button>
      </aside>

      {/* Content Area */}
      <main className="dashboard-content" style={styles.contentArea}>
        {/* Header bar with low stock notification bell */}
        <div style={{ background: 'white', padding: '16px 24px', borderRadius: '8px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#0d1b4b' }}>
            Main Store Operations Centre
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {/* Notification Bell */}
            <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setShowNotifications(!showNotifications)}>
              <span style={{ fontSize: '20px' }}>🔔</span>
              {unreadCount > 0 && (
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
                  {unreadCount}
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
              🕐 {formatDateLong(new Date())}
            </div>
          </div>
        </div>

        {error && <div style={styles.errorAlert}>{error}</div>}
        {success && <div style={styles.successAlert}>{success}</div>}

        {view === 'dashboard' && (
          <div style={styles.container}>
            <h1 style={styles.pageTitle}>Main Store Dashboard Overview</h1>

            {/* Stats row */}
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Total Materials</div>
                <div style={styles.statValue}>{totalSKUs}</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Inventory Value</div>
                <div style={styles.statValue}>LKR {stockValue.toLocaleString()}</div>
              </div>
              <div style={{ ...styles.statCard, borderLeft: pendingGRNs > 0 ? '4px solid #f59e0b' : '4px solid #0d1b4b' }}>
                <div style={styles.statLabel}>Pending GRNs</div>
                <div style={styles.statValue}>{pendingGRNs}</div>
              </div>
              <div style={{ ...styles.statCard, borderLeft: (pendingPRs + pendingMINs) > 0 ? '4px solid #f59e0b' : '4px solid #0d1b4b' }}>
                <div style={styles.statLabel}>Pending Requests</div>
                <div style={styles.statValue}>{pendingPRs + pendingMINs}</div>
              </div>
              <div style={{ ...styles.statCard, borderLeft: lowStockItems > 0 ? '4px solid #ef4444' : '4px solid #0d1b4b' }}>
                <div style={styles.statLabel}>Low Stock Items</div>
                <div style={{ ...styles.statValue, color: lowStockItems > 0 ? '#ef4444' : '#0d1b4b' }}>{lowStockItems}</div>
              </div>
              <div style={{ ...styles.statCard, borderLeft: outOfStockItems > 0 ? '4px solid #ef4444' : '4px solid #0d1b4b' }}>
                <div style={styles.statLabel}>Out of Stock</div>
                <div style={{ ...styles.statValue, color: outOfStockItems > 0 ? '#ef4444' : '#0d1b4b' }}>{outOfStockItems}</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Today's Transfers</div>
                <div style={styles.statValue}>{todaysTransfers}</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Last GRN Date</div>
                <div style={styles.statValue}>{lastGRNDate}</div>
              </div>
            </div>

            {/* Recent Activity + Category Breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '24px' }}>
              <div style={{ ...styles.tableContainer, padding: '20px' }}>
                <h3 style={{ margin: '0 0 16px', color: '#0d1b4b' }}>🕘 Recent Activity</h3>
                {recentActivities.length === 0 ? (
                  <div style={{ color: '#64748b', fontSize: '13px' }}>No recent activity recorded.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {recentActivities.map((a, i) => (
                      <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', paddingBottom: '10px', borderBottom: i === recentActivities.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: '16px' }}>{a.icon}</span>
                        <div>
                          <div style={{ fontSize: '13px', color: '#0d1b4b', fontWeight: '500' }}>{a.text}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{formatDateTime(a.date)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ ...styles.tableContainer, padding: '20px' }}>
                <h3 style={{ margin: '0 0 16px', color: '#0d1b4b' }}>📊 Inventory Value by Category</h3>
                {categoryChartData.length === 0 ? (
                  <div style={{ color: '#64748b', fontSize: '13px' }}>No stock value recorded yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '100%', height: '180px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={categoryChartData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                            {categoryChartData.map((entry, index) => {
                              const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#3b82f6', '#14b8a6'];
                              return <Cell key={`cat-cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                            })}
                          </Pie>
                          <Tooltip formatter={(value) => `LKR ${Number(value).toLocaleString()}`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {categoryChartData.map((c, index) => {
                        const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#3b82f6', '#14b8a6'];
                        const pct = stockValue > 0 ? ((c.value / stockValue) * 100).toFixed(1) : '0.0';
                        return (
                          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: COLORS[index % COLORS.length] }}></div>
                            <span style={{ fontWeight: '600', flex: 1 }}>{c.name}</span>
                            <span style={{ color: '#64748b' }}>{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {view === 'inventory' && (
          <div style={styles.container}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <h1 style={{ ...styles.pageTitle, marginBottom: 0 }}>Inventory — Main Store Material List</h1>
            </div>
            <div style={{ color: '#64748b', fontSize: '13px', marginBottom: '16px' }}>
              Generated from the Material Master. Quantities update automatically from GRN receipts, Material Issuance, Usage and Stock Adjustments — they cannot be edited directly here.
            </div>

            {/* Filters */}
            <div style={styles.filtersContainer}>
              <input
                type="text"
                placeholder="Search inventory by name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={styles.searchInput}
              />
              <div style={styles.filterGroup}>
                <span style={styles.filterLabel}>Category:</span>
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  style={styles.filterSelect}
                >
                  <option value="All">All Categories</option>
                  {['Cement', 'Steel', 'Bricks', 'Sand', 'Gravel', 'Wood', 'Paint', 'Other'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Stock Table */}
            <div style={styles.tableContainer}>
              {loading ? (
                <div style={styles.loadingText}>Fetching inventory logs...</div>
              ) : filteredMaterials.length === 0 ? (
                <div style={styles.emptyState}>No materials found in the Main Store.</div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeaderRow}>
                      <th style={styles.th}>Name</th>
                      <th style={styles.th}>Category</th>
                      <th style={styles.th}>Unit</th>
                      <th style={styles.th}>Qty</th>
                      <th style={styles.th}>Min Stock</th>
                      <th style={styles.th}>Reorder Level</th>
                      <th style={styles.th}>Unit Price (LKR)</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMaterials.map(m => {
                      const status = materialStatus(m);
                      return (
                        <tr key={m._id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: status.label !== 'Healthy' ? 'rgba(239,68,68,0.05)' : 'white' }}>
                          <td style={{ ...styles.tdBold, color: status.label !== 'Healthy' ? '#c62828' : '#0d1b4b' }}>{m.name}</td>
                          <td style={styles.td}>{m.category}</td>
                          <td style={styles.td}>{m.unit}</td>
                          <td style={styles.td}>{m.quantity}</td>
                          <td style={styles.td}>{m.minimumStock}</td>
                          <td style={styles.td}>{m.reorderLevel}</td>
                          <td style={styles.td}>{m.unitPrice?.toLocaleString()}</td>
                          <td style={styles.td}>
                            <span style={{ background: status.bg, color: status.color, padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>{status.label}</span>
                          </td>
                          <td style={styles.td}>
                            <button
                              onClick={() => { setLedgerSearch(m.name); setView('stock-ledger'); }}
                              style={{ background: '#1565c0', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                            >
                              View History
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {view === 'grn' && (
          <div style={styles.container}>
            <h1 style={styles.pageTitle}>Goods Received Note (GRN) Operations</h1>

            {/* GRN form */}
            <div style={styles.formCard}>
              <h3 style={{ color: '#0d1b4b', marginBottom: '16px' }}>Record New Incoming Goods</h3>

              <div style={{ marginBottom: '16px', maxWidth: '400px' }}>
                <label style={styles.fieldLabel}>Select Purchase Order *</label>
                <select
                  value={selectedGrnPO}
                  onChange={e => handleGrnPOSelect(e.target.value)}
                  style={styles.formSelect}
                  required
                >
                  <option value="">-- Select Purchase Order --</option>
                  {purchaseOrders.filter(po => ['Sent', 'Delivered'].includes(po.status)).map(po => (
                    <option key={po._id} value={po._id}>{po.poNumber} — {formatSupplierLabel(po)} (LKR {Number(po.totalAmount || 0).toLocaleString()})</option>
                  ))}
                </select>
              </div>

              {(() => {
                const po = selectedGrnPO ? purchaseOrders.find(p => p._id === selectedGrnPO) : null;
                return (
                  <div style={{
                    marginBottom: '16px',
                    padding: '16px',
                    background: '#f4f6fb',
                    border: '1px solid #d7deed',
                    borderRadius: '8px'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                      <div>
                        <div style={styles.fieldLabel}>GRN Number</div>
                        <div style={{ fontWeight: 600, color: '#0d1b4b' }}>
                          {nextGrnNumber()}
                        </div>
                      </div>
                      <div>
                        <div style={styles.fieldLabel}>Supplier *</div>
                        {po ? (
                          <div style={{ fontWeight: 600, color: '#0d1b4b' }}>
                            {formatSupplierLabel(po)}
                          </div>
                        ) : (
                          <select
                            value={grnForm.supplier}
                            onChange={e => {
                              const matched = suppliers.find(s => s.name === e.target.value);
                              setGrnForm({ ...grnForm, supplier: e.target.value, supplierId: matched ? matched._id : '' });
                            }}
                            style={styles.formSelect}
                            required
                          >
                            <option value="">-- Select Supplier --</option>
                            {suppliers.map(s => (
                              <option key={s._id} value={s.name}>{s.supplierId} – {s.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                      <div>
                        <div style={styles.fieldLabel}>Received Date</div>
                        <DateInput
                          value={grnForm.receivedDate}
                          onChange={iso => setGrnForm({ ...grnForm, receivedDate: iso })}
                          style={styles.formInput}
                          required
                        />
                      </div>
                      {po && (
                        <>
                          <div>
                            <div style={styles.fieldLabel}>PO Number</div>
                            <div style={{ fontWeight: 600, color: '#0d1b4b' }}>{po.poNumber}</div>
                          </div>
                          <div>
                            <div style={styles.fieldLabel}>PO Date</div>
                            <div style={{ fontWeight: 600, color: '#0d1b4b' }}>
                              {po.sentAt ? new Date(po.sentAt).toLocaleDateString() : (po.createdAt ? new Date(po.createdAt).toLocaleDateString() : 'N/A')}
                            </div>
                          </div>
                          <div>
                            <div style={styles.fieldLabel}>Project</div>
                            <div style={{ fontWeight: 600, color: '#0d1b4b' }}>{po.prId?.project || po.prId?.projectName || 'N/A'}</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}

              <form onSubmit={handleGrnSubmit}>
                <h4 style={{ color: '#0d1b4b', marginBottom: '12px' }}>GRN Materials List</h4>
                {!selectedGrnPO || grnForm.items.length === 0 ? (
                  <div style={{ padding: '16px', background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '8px', color: '#8a6d00', fontSize: '13px', marginBottom: '16px' }}>
                    Select a Purchase Order above to load its items. Materials cannot be added manually — GRNs must match an ordered PO.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                    <table style={styles.table}>
                      <thead>
                        <tr style={styles.tableHeaderRow}>
                          <th style={styles.th}>Material</th>
                          <th style={{ ...styles.th, textAlign: 'right' }}>Ordered Qty</th>
                          <th style={{ ...styles.th, textAlign: 'right' }}>Received Qty</th>
                          <th style={styles.th}>Condition</th>
                          <th style={styles.th}>Discrepancy</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grnForm.items.map((item, idx) => {
                          const ordered = Number(item.expectedQty) || 0;
                          const received = item.receivedQty === '' ? null : Number(item.receivedQty);
                          const shortage = received !== null && ordered - received > 0 ? ordered - received : 0;
                          const damagedQty = Number(item.damagedQty) || 0;
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={{ ...styles.tdBold, color: '#0d1b4b' }}>{item.materialName}{item.unit ? ` (${item.unit})` : ''}</td>
                              <td style={{ ...styles.td, textAlign: 'right' }}>{ordered}</td>
                              <td style={{ ...styles.td, textAlign: 'right' }}>
                                <input
                                  type="number"
                                  min="0"
                                  value={item.receivedQty}
                                  onChange={e => {
                                    const updated = [...grnForm.items];
                                    updated[idx].receivedQty = e.target.value;
                                    setGrnForm({ ...grnForm, items: updated });
                                  }}
                                  style={{ ...styles.formInput, width: '90px', textAlign: 'right' }}
                                  required
                                />
                              </td>
                              <td style={styles.td}>
                                <select
                                  value={item.condition}
                                  onChange={e => {
                                    const updated = [...grnForm.items];
                                    updated[idx].condition = e.target.value;
                                    if (e.target.value !== 'Damaged') updated[idx].damagedQty = '';
                                    setGrnForm({ ...grnForm, items: updated });
                                  }}
                                  style={styles.formSelect}
                                >
                                  <option value="Good">Good</option>
                                  <option value="Damaged">Damaged</option>
                                </select>
                                {item.condition === 'Damaged' && (
                                  <input
                                    type="number"
                                    min="0"
                                    max={received !== null ? received : undefined}
                                    placeholder="Damaged qty"
                                    value={item.damagedQty}
                                    onChange={e => {
                                      const updated = [...grnForm.items];
                                      updated[idx].damagedQty = e.target.value;
                                      setGrnForm({ ...grnForm, items: updated });
                                    }}
                                    style={{ ...styles.formInput, width: '110px', marginTop: '6px' }}
                                    required
                                  />
                                )}
                              </td>
                              <td style={styles.td}>
                                {shortage > 0 && (
                                  <div style={{ color: '#b45309', fontSize: '12px', fontWeight: 600 }}>
                                    ⚠️ Shortage: {shortage} units
                                  </div>
                                )}
                                {item.condition === 'Damaged' && damagedQty > 0 && (
                                  <div style={{ color: '#b91c1c', fontSize: '12px', fontWeight: 600, marginTop: shortage > 0 ? '4px' : 0 }}>
                                    ⚠️ Damaged quantity: {damagedQty}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                  <label style={styles.fieldLabel}>Notes</label>
                  <input
                    type="text"
                    value={grnForm.notes}
                    onChange={e => setGrnForm({ ...grnForm, notes: e.target.value })}
                    style={styles.formInput}
                  />
                </div>

                <button
                  type="submit"
                  style={{ ...styles.orangeBtn, opacity: (!selectedGrnPO || grnForm.items.length === 0) ? 0.5 : 1, cursor: (!selectedGrnPO || grnForm.items.length === 0) ? 'not-allowed' : 'pointer' }}
                  disabled={!selectedGrnPO || grnForm.items.length === 0}
                >
                  Record GRN & Update Inventory
                </button>
              </form>
            </div>

            {/* Attach Invoice */}
            <div style={styles.formCard}>
              <h3 style={{ color: '#0d1b4b', marginBottom: '4px' }}>Attach Supplier Invoice</h3>
              <p style={{ color: '#666', fontSize: '13px', marginTop: 0, marginBottom: '16px' }}>
                {lastCreatedGrn
                  ? `GRN ${lastCreatedGrn.grnNumber} recorded. If the supplier handed over an invoice with this delivery, record it here for Director payment approval.`
                  : 'Select the GRN the supplier invoice belongs to, then record it here for Director payment approval.'}
              </p>
              {invoiceMessage && <div style={{ ...styles.errorAlert, backgroundColor: '#e8f5e9', border: '1px solid #66bb6a', color: '#2e7d32' }}>{invoiceMessage}</div>}
              {invoiceError && <div style={styles.errorAlert}>{invoiceError}</div>}
              <form onSubmit={handleInvoiceSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={styles.fieldLabel}>Related GRN *</label>
                    <select
                      value={lastCreatedGrn?._id || ''}
                      onChange={e => {
                        const selected = grns.find(g => g._id === e.target.value) || null;
                        setLastCreatedGrn(selected);
                        setInvoiceForm({ po: '', amount: '', invoiceDate: new Date().toISOString().substring(0, 10) });
                      }}
                      style={styles.formSelect}
                      required
                    >
                      <option value="">-- Select GRN --</option>
                      {grns.map(g => (
                        <option key={g._id} value={g._id}>{g.grnNumber} — {g.supplier}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Related PO *</label>
                    <select
                      value={invoiceForm.po}
                      onChange={e => setInvoiceForm({ ...invoiceForm, po: e.target.value })}
                      style={styles.formSelect}
                      required
                      disabled={!lastCreatedGrn}
                    >
                      <option value="">-- Select Purchase Order --</option>
                      {supplierPOs.map(po => (
                        <option key={po._id} value={po._id}>{po.poNumber}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Invoice Amount (LKR) *</label>
                    <input
                      type="number"
                      value={invoiceForm.amount}
                      onChange={e => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                      style={styles.formInput}
                      required
                      disabled={!lastCreatedGrn}
                    />
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Invoice Date</label>
                    <DateInput
                      value={invoiceForm.invoiceDate}
                      onChange={iso => setInvoiceForm({ ...invoiceForm, invoiceDate: iso })}
                      style={styles.formInput}
                    />
                  </div>
                  <div style={{ gridColumn: 'span 4' }}>
                    <label style={styles.fieldLabel}>Attach Invoice PDF/JPG</label>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      border: '1px solid #ddd', borderRadius: '6px', padding: '8px 10px',
                      backgroundColor: lastCreatedGrn ? 'white' : '#f5f5f5'
                    }}>
                      <label style={{
                        padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: '600',
                        whiteSpace: 'nowrap', flexShrink: 0,
                        backgroundColor: lastCreatedGrn ? '#0d1b4b' : '#ccc', color: 'white',
                        cursor: lastCreatedGrn ? 'pointer' : 'not-allowed'
                      }}>
                        Choose File
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg"
                          onChange={e => setInvoiceFile(e.target.files[0] || null)}
                          disabled={!lastCreatedGrn}
                          style={{ display: 'none' }}
                        />
                      </label>
                      <span style={{
                        color: '#334155', fontSize: '13px', overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                      }}>
                        {invoiceFile ? invoiceFile.name : 'No file chosen'}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" style={{ ...styles.orangeBtn, opacity: lastCreatedGrn ? 1 : 0.5, cursor: lastCreatedGrn ? 'pointer' : 'not-allowed' }} disabled={!lastCreatedGrn}>Record Invoice</button>
                  <button type="button" onClick={() => { setLastCreatedGrn(null); setInvoiceForm({ po: '', amount: '', invoiceDate: new Date().toISOString().substring(0, 10) }); setInvoiceFile(null); setInvoiceMessage(''); setInvoiceError(''); }}
                    style={{ background: '#f5f5f5', color: '#333', border: '1px solid #ddd', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
                    Clear
                  </button>
                </div>
              </form>
            </div>

            {/* GRN History */}
            <div style={styles.tableContainer}>
              <h3 style={{ padding: '16px 20px', color: '#0d1b4b', margin: 0, borderBottom: '1px solid #eee' }}>Recent GRNs</h3>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeaderRow}>
                    <th style={styles.th}>GRN No.</th>
                    <th style={styles.th}>PO No.</th>
                    <th style={styles.th}>Supplier</th>
                    <th style={styles.th}>Received Date</th>
                    <th style={styles.th}>Invoice</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {grns.map((g, i) => {
                    const matchedSupplier = suppliers.find(s =>
                      s.name === g.supplier || s.supplierId === g.supplier || s._id === g.supplierId
                    );
                    const supplierLabel = matchedSupplier ? `${matchedSupplier.supplierId} – ${matchedSupplier.name}` : g.supplier;
                    const invoice = grnInvoices.find(inv => (inv.grn?._id || inv.grn) === g._id);
                    return (
                      <tr key={g._id || i} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ ...styles.tdBold, color: '#0d1b4b' }}>{g.grnNumber}</td>
                        <td style={styles.td}>{g.poReference || 'N/A'}</td>
                        <td style={styles.td}>{supplierLabel}</td>
                        <td style={styles.td}>{formatDate(g.receivedDate || g.createdAt)}</td>
                        <td style={styles.td}>
                          {invoice ? (
                            invoice.file?.url ? (
                              <a href={`http://localhost:5000${invoice.file.url}`} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: '600', fontSize: '12px' }}>
                                View Invoice
                              </a>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '12px' }}>Recorded (no file)</span>
                            )
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '12px' }}>Not attached</span>
                          )}
                        </td>
                        <td style={styles.td}>
                          <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>Processed</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'stock-ledger' && (
          <div style={styles.container}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <h1 style={{ ...styles.pageTitle, marginBottom: 0 }}>Stock Ledger — All Inventory Movements</h1>
            </div>

            {(() => {
              const q = ledgerSearch.toLowerCase();
              const filteredLedger = stockLedger.filter(e => {
                const matchesSearch = !q || e.materialName.toLowerCase().includes(q);
                const matchesType = ledgerTypeFilter === 'All' || e.type === ledgerTypeFilter;
                return matchesSearch && matchesType;
              });
              const totalIn = filteredLedger.reduce((sum, e) => sum + (e.inQty || 0), 0);
              const totalOut = filteredLedger.reduce((sum, e) => sum + (e.outQty || 0), 0);

              return (
                <>
                  <div style={styles.filtersContainer}>
                    <input
                      type="text"
                      placeholder="Search material..."
                      value={ledgerSearch}
                      onChange={e => setLedgerSearch(e.target.value)}
                      style={styles.searchInput}
                    />
                    <div style={styles.filterGroup}>
                      <span style={styles.filterLabel}>Transaction Type:</span>
                      <select value={ledgerTypeFilter} onChange={e => setLedgerTypeFilter(e.target.value)} style={styles.filterSelect}>
                        <option value="All">All Types</option>
                        <option value="GRN Receipt">GRN Receipt</option>
                        <option value="MIN Issue">MIN Issue</option>
                        <option value="MIN Receipt">MIN Receipt</option>
                        <option value="Usage">Usage</option>
                        <option value="Adjustment">Adjustment</option>
                      </select>
                      <button
                        onClick={() => exportToCSV('stock-ledger.csv',
                          ['Date', 'Material', 'Type', 'Reference', 'IN Qty', 'OUT Qty', 'Balance', 'Performed By', 'Remarks'],
                          filteredLedger.map(e => [formatDateTime(e.date), e.materialName, e.type, e.reference, e.inQty, e.outQty, e.balance, e.performedBy, e.remarks])
                        )}
                        style={styles.refreshBtn}
                      >
                        ⬇ Export CSV
                      </button>
                    </div>
                  </div>

                  <div style={styles.tableContainer}>
                    {ledgerLoading ? (
                      <div style={styles.loadingText}>Loading stock ledger...</div>
                    ) : filteredLedger.length === 0 ? (
                      <div style={styles.emptyState}>No stock movements recorded yet.</div>
                    ) : (
                      <table style={styles.table}>
                        <thead>
                          <tr style={styles.tableHeaderRow}>
                            <th style={styles.th}>Date</th>
                            <th style={styles.th}>Material</th>
                            <th style={styles.th}>Transaction Type</th>
                            <th style={styles.th}>Reference</th>
                            <th style={styles.th}>IN Qty</th>
                            <th style={styles.th}>OUT Qty</th>
                            <th style={styles.th}>Balance</th>
                            <th style={styles.th}>Performed By</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLedger.map((e, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={styles.td}>{formatDateTime(e.date)}</td>
                              <td style={styles.tdBold}>{e.materialName} <span style={{ color: '#94a3b8', fontWeight: 'normal' }}>{e.unit}</span></td>
                              <td style={styles.td}>
                                {(() => {
                                  const TYPE_COLORS = {
                                    'GRN Receipt': { bg: '#e8f5e9', color: '#2e7d32' },
                                    'MIN Issue': { bg: '#e3f2fd', color: '#1565c0' },
                                    'MIN Receipt': { bg: '#e0f2fe', color: '#0369a1' },
                                    'Usage': { bg: '#fff3e0', color: '#b7791f' },
                                    'Adjustment': { bg: '#f3e8ff', color: '#7e22ce' }
                                  };
                                  const c = TYPE_COLORS[e.type] || { bg: '#f1f5f9', color: '#334155' };
                                  return (
                                    <span style={{
                                      background: c.bg,
                                      color: c.color,
                                      padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold'
                                    }}>{e.type}</span>
                                  );
                                })()}
                              </td>
                              <td style={styles.td}>{e.reference}</td>
                              <td style={{ ...styles.td, color: e.inQty ? '#2e7d32' : '#cbd5e1', fontWeight: e.inQty ? 'bold' : 'normal' }}>{e.inQty ? `+${e.inQty}` : '—'}</td>
                              <td style={{ ...styles.td, color: e.outQty ? '#c62828' : '#cbd5e1', fontWeight: e.outQty ? 'bold' : 'normal' }}>{e.outQty ? `-${e.outQty}` : '—'}</td>
                              <td style={styles.tdBold}>{e.balance}</td>
                              <td style={styles.td}>{e.performedBy}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#f5f6fa', borderTop: '2px solid #cbd5e1' }}>
                            <td colSpan="4" style={{ ...styles.tdBold, textAlign: 'right' }}>Totals (filtered):</td>
                            <td style={{ ...styles.tdBold, color: '#2e7d32' }}>+{totalIn}</td>
                            <td style={{ ...styles.tdBold, color: '#c62828' }}>-{totalOut}</td>
                            <td colSpan="2" style={styles.td}></td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {view === 'purchase-request' && (
          <div style={styles.container}>
            <h1 style={styles.pageTitle}>Purchase Requests (PR) Workspace</h1>
            
            {/* Low Stock Items Section */}
            <div style={{ ...styles.tableContainer, marginBottom: '30px' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', background: '#c62828' }}>
                <h3 style={{ margin: 0, color: 'white', fontSize: '15px' }}>⚠️ Low Stock Items Registry</h3>
              </div>
              <table style={styles.table}>
                <thead>
                  <tr style={{ background: '#f5f6fa' }}>
                    <th style={{ ...styles.th, color: '#333' }}>Material Name</th>
                    <th style={{ ...styles.th, color: '#333' }}>Current Qty</th>
                    <th style={{ ...styles.th, color: '#333' }}>Min Stock</th>
                    <th style={{ ...styles.th, color: '#333' }}>Unit</th>
                    <th style={{ ...styles.th, color: '#333' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.filter(m => m.location === 'MainStore' && m.quantity <= m.minimumStock).map((m, i) => (
                    <tr key={m._id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: 'rgba(239,68,68,0.08)' }}>
                      <td style={{ ...styles.tdBold, color: '#c62828' }}>{m.name}</td>
                      <td style={styles.td}>{m.quantity}</td>
                      <td style={styles.td}>{m.minimumStock}</td>
                      <td style={styles.td}>{m.unit}</td>
                      <td style={styles.td}>
                        <button
                          onClick={() => {
                            setPrForm({
                              projectName: '',
                              materialName: m.name,
                              unit: m.unit,
                              quantity: '',
                              urgency: 'Normal',
                              notes: ''
                            });
                            setShowPrForm(true);
                          }}
                          style={{
                            background: '#2563eb',
                            color: 'white',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 4px rgba(37, 99, 235,0.2)'
                          }}
                        >
                          Create PR
                        </button>
                      </td>
                    </tr>
                  ))}
                  {materials.filter(m => m.location === 'MainStore' && m.quantity <= m.minimumStock).length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                        All Main Store material stock levels are normal!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* PR Form Card */}
            {showPrForm && (
              <div style={styles.formCard}>
                <h3 style={{ color: '#0d1b4b', marginBottom: '20px', fontWeight: 'bold' }}>Create New Purchase Request</h3>
                <form onSubmit={handlePrSubmit} style={{ display: 'grid', gap: '16px', maxWidth: '600px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={styles.fieldLabel}>Project Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Colombo Port Expansion"
                        value={prForm.projectName}
                        onChange={e => setPrForm({ ...prForm, projectName: e.target.value })}
                        style={styles.formInput}
                        required
                      />
                    </div>
                    <div>
                      <label style={styles.fieldLabel}>Material (Pre-filled)</label>
                      <input
                        type="text"
                        value={prForm.materialName}
                        style={{ ...styles.formInput, background: '#f1f5f9', cursor: 'not-allowed' }}
                        disabled
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={styles.fieldLabel}>Quantity Needed *</label>
                      <input
                        type="number"
                        placeholder="Quantity"
                        value={prForm.quantity}
                        onChange={e => setPrForm({ ...prForm, quantity: e.target.value })}
                        style={styles.formInput}
                        min="1"
                        required
                      />
                    </div>
                    <div>
                      <label style={styles.fieldLabel}>Urgency *</label>
                      <select
                        value={prForm.urgency}
                        onChange={e => setPrForm({ ...prForm, urgency: e.target.value })}
                        style={styles.formSelect}
                        required
                      >
                        <option value="Normal">Normal</option>
                        <option value="Urgent">Urgent</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={styles.fieldLabel}>Notes to PM (Reason)</label>
                    <textarea
                      placeholder="Explain notes, requirements, or reason..."
                      value={prForm.notes}
                      onChange={e => setPrForm({ ...prForm, notes: e.target.value })}
                      style={{ ...styles.formInput, height: '80px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="submit" style={styles.orangeBtn}>
                      Submit Purchase Request
                    </button>
                    <button type="button" onClick={() => setShowPrForm(false)} style={{ background: '#cbd5e1', color: '#333', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Submitted PRs Registry */}
            <div style={styles.tableContainer}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', background: '#0d1b4b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ margin: 0, color: 'white', fontSize: '15px' }}>📋 Submitted PR Registry Archive</h3>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Search project or material..."
                    value={prSearch}
                    onChange={e => setPrSearch(e.target.value)}
                    style={{ padding: '7px 12px', borderRadius: '6px', border: 'none', fontSize: '13px', width: '220px' }}
                  />
                  <select
                    value={prStatusFilter}
                    onChange={e => setPrStatusFilter(e.target.value)}
                    style={{ padding: '7px 12px', borderRadius: '6px', border: 'none', fontSize: '13px' }}
                  >
                    <option value="All">All Status</option>
                    <option value="Pending">Pending</option>
                    <option value="PO Created">PO Created</option>
                  </select>
                </div>
              </div>
              <table style={styles.table}>
                <thead>
                  <tr style={{ background: '#f5f6fa' }}>
                    <th style={{ ...styles.th, color: '#333' }}>PR Number</th>
                    <th style={{ ...styles.th, color: '#333' }}>Project</th>
                    <th style={{ ...styles.th, color: '#333' }}>Material</th>
                    <th style={{ ...styles.th, color: '#333' }}>Required Qty</th>
                    <th style={{ ...styles.th, color: '#333' }}>Available Qty</th>
                    <th style={{ ...styles.th, color: '#333' }}>Shortage Qty</th>
                    <th style={{ ...styles.th, color: '#333' }}>Priority</th>
                    <th style={{ ...styles.th, color: '#333' }}>Status</th>
                    <th style={{ ...styles.th, color: '#333' }}>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const rows = [];
                    prs.forEach((pr, idx) => {
                      (pr.materials || []).forEach((m, mi) => {
                        rows.push({ pr, idx, m, mi });
                      });
                    });
                    const filtered = rows.filter(({ pr, m }) => {
                      const matchesStatus = prStatusFilter === 'All' || pr.status === prStatusFilter;
                      const q = prSearch.toLowerCase();
                      const matchesSearch = !q || (pr.projectName || pr.project || '').toLowerCase().includes(q) || (m.materialName || '').toLowerCase().includes(q);
                      return matchesStatus && matchesSearch;
                    });

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan="9" style={{ padding: '30px', textAlign: 'center', color: '#999' }}>
                            No purchase requests match the current filters.
                          </td>
                        </tr>
                      );
                    }

                    return filtered.map(({ pr, idx, m, mi }) => {
                      const mainMat = mainMaterials.find(x => x.name === m.materialName);
                      const available = mainMat ? mainMat.quantity : 0;
                      const shortage = Math.max((Number(m.quantity) || 0) - available, 0);
                      return (
                        <tr key={`${pr._id || idx}-${mi}`} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={styles.tdBold}>PR-{String(idx + 1).padStart(3, '0')}</td>
                          <td style={styles.td}>{pr.projectName || pr.project}</td>
                          <td style={styles.td}>{m.materialName}</td>
                          <td style={styles.td}>{m.quantity} {m.unit}</td>
                          <td style={styles.td}>{available} {m.unit}</td>
                          <td style={styles.td}>
                            {shortage > 0 ? (
                              <span style={{ color: '#c62828', fontWeight: 'bold' }}>{shortage} {m.unit}</span>
                            ) : (
                              <span style={{ color: '#2e7d32' }}>0</span>
                            )}
                          </td>
                          <td style={styles.td}>
                            <span style={{
                              background: pr.urgency === 'Critical' ? '#ffebee' : pr.urgency === 'Urgent' ? '#dbeafe' : '#e3f2fd',
                              color: pr.urgency === 'Critical' ? '#c62828' : pr.urgency === 'Urgent' ? '#1e3a8a' : '#1565c0',
                              padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold'
                            }}>{pr.urgency || 'Normal'}</span>
                          </td>
                          <td style={styles.td}>
                            <span style={{
                              background: pr.status === 'Approved' ? '#e8f5e9' : pr.status === 'Rejected' ? '#ffebee' : pr.status === 'PO Created' ? '#e0f2f1' : '#f5f5f5',
                              color: pr.status === 'Approved' ? '#2e7d32' : pr.status === 'Rejected' ? '#c62828' : pr.status === 'PO Created' ? '#004d40' : '#666',
                              padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold'
                            }}>{pr.status}</span>
                          </td>
                          <td style={styles.td}>{formatDate(pr.createdAt)}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'settings' && <SettingsPage user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />}

        {view === 'stock-adjustments' && (
          <div style={styles.container}>
            <h1 style={styles.pageTitle}>Stock Adjustments</h1>
            <div style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
              The only authorized way to correct current stock outside of a GRN, Material Issuance or Usage transaction — e.g. after a physical stock count. Every adjustment requires a reason and is permanently logged.
            </div>

            <div style={styles.formCard}>
              <h3 style={{ color: '#0d1b4b', marginBottom: '16px' }}>Record a Physical Count Adjustment</h3>
              <form onSubmit={handleStockAdjustmentSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={styles.fieldLabel}>Material *</label>
                  <select
                    value={adjustmentForm.materialId}
                    onChange={e => setAdjustmentForm({ ...adjustmentForm, materialId: e.target.value })}
                    style={styles.formSelect}
                    required
                  >
                    <option value="">-- Select material --</option>
                    {mainMaterials.map(m => (
                      <option key={m._id} value={m._id}>{m.name} ({m.unit})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={styles.fieldLabel}>Current System Quantity</label>
                  <input
                    type="text"
                    value={adjustmentForm.materialId ? (mainMaterials.find(m => m._id === adjustmentForm.materialId)?.quantity ?? '-') : '-'}
                    style={{ ...styles.formInput, background: '#f1f5f9' }}
                    disabled
                  />
                </div>
                <div>
                  <label style={styles.fieldLabel}>Physical Count *</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Quantity actually counted"
                    value={adjustmentForm.physicalCount}
                    onChange={e => setAdjustmentForm({ ...adjustmentForm, physicalCount: e.target.value })}
                    style={styles.formInput}
                    required
                  />
                </div>
                <div>
                  <label style={styles.fieldLabel}>Reason *</label>
                  <select
                    value={adjustmentForm.reason}
                    onChange={e => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                    style={styles.formSelect}
                    required
                  >
                    {['Count Correction', 'Damage', 'Loss/Theft', 'Expiry', 'Other'].map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={styles.fieldLabel}>Notes (optional)</label>
                  <input
                    type="text"
                    value={adjustmentForm.notes}
                    onChange={e => setAdjustmentForm({ ...adjustmentForm, notes: e.target.value })}
                    style={styles.formInput}
                    placeholder="Additional detail supporting this adjustment"
                  />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <button type="submit" style={styles.orangeBtn} disabled={adjustmentSubmitting}>
                    {adjustmentSubmitting ? 'Recording...' : 'Record Adjustment'}
                  </button>
                </div>
              </form>
            </div>

            <div style={{ ...styles.tableContainer, marginTop: '24px' }}>
              <h3 style={{ color: '#0d1b4b', margin: '16px 0 0 16px' }}>Recent Adjustments</h3>
              {ledgerLoading ? (
                <div style={styles.loadingText}>Loading adjustment history...</div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeaderRow}>
                      <th style={styles.th}>Date</th>
                      <th style={styles.th}>Material</th>
                      <th style={styles.th}>Change</th>
                      <th style={styles.th}>New Balance</th>
                      <th style={styles.th}>Reason</th>
                      <th style={styles.th}>Performed By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockLedger.filter(e => e.type === 'Adjustment').length === 0 ? (
                      <tr><td colSpan="6" style={styles.emptyState}>No stock adjustments recorded yet.</td></tr>
                    ) : (
                      stockLedger.filter(e => e.type === 'Adjustment').map((e, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={styles.td}>{formatDateTime(e.date)}</td>
                          <td style={styles.tdBold}>{e.materialName} <span style={{ color: '#94a3b8', fontWeight: 'normal' }}>{e.unit}</span></td>
                          <td style={{ ...styles.td, color: e.inQty ? '#2e7d32' : (e.outQty ? '#c62828' : '#64748b'), fontWeight: 'bold' }}>
                            {e.inQty ? `+${e.inQty}` : (e.outQty ? `-${e.outQty}` : 'No change')}
                          </td>
                          <td style={styles.tdBold}>{e.balance}</td>
                          <td style={styles.td}>{e.remarks}</td>
                          <td style={styles.td}>{e.performedBy}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {view === 'min' && (
          <div style={styles.container}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h1 style={styles.pageTitle}>Material Transfer Notes</h1>
              <button
                onClick={() => (showTransferForm ? setShowTransferForm(false) : openTransferForm())}
                style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
              >
                {showTransferForm ? 'Cancel' : '+ Create Material Transfer Note'}
              </button>
            </div>

            {showTransferForm && (
              <div style={styles.formCard}>
                <h3 style={{ color: '#0d1b4b', marginBottom: '16px', fontWeight: 'bold' }}>
                  {transferForm.sourceRequestId ? `Transfer Materials for Request ${transferForm.reference}` : 'Create Material Transfer Note'}
                </h3>
                <form onSubmit={handleCreateTransferSubmit} style={{ display: 'grid', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={styles.fieldLabel}>Project *</label>
                      <select
                        value={transferForm.projectId}
                        onChange={e => handleTransferProjectChange(e.target.value)}
                        style={styles.formSelect}
                        disabled={!!transferForm.sourceRequestId}
                        required
                      >
                        <option value="">-- Select project --</option>
                        {projects.map(p => (
                          <option key={p._id} value={p._id}>{p.projectName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={styles.fieldLabel}>Site Store *</label>
                      <input
                        type="text"
                        value={transferForm.projectName ? `${transferForm.projectName} Site Store` : ''}
                        placeholder="Select a project first"
                        style={{ ...styles.formInput, background: '#f1f5f9', cursor: 'not-allowed' }}
                        disabled
                      />
                    </div>
                    <div>
                      <label style={styles.fieldLabel}>Transfer Date *</label>
                      <DateInput
                        value={transferForm.transferDate}
                        onChange={val => setTransferForm({ ...transferForm, transferDate: val })}
                        style={styles.formInput}
                        required
                      />
                    </div>
                    <div>
                      <label style={styles.fieldLabel}>Reference</label>
                      <input
                        type="text"
                        placeholder="e.g. BOM-PRJ-2026-013"
                        value={transferForm.reference}
                        onChange={e => setTransferForm({ ...transferForm, reference: e.target.value })}
                        style={styles.formInput}
                      />
                    </div>
                  </div>

                  <div>
                    <table style={styles.table}>
                      <thead>
                        <tr style={styles.tableHeaderRow}>
                          <th style={styles.th}>Material</th>
                          <th style={styles.th}>Available (Main Store)</th>
                          <th style={styles.th}>Transfer Qty</th>
                          <th style={styles.th}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {transferForm.items.map((item, idx) => {
                          const mainMat = mainMaterials.find(m => m.name === item.materialName);
                          const available = mainMat ? mainMat.quantity : 0;
                          const over = item.quantity && Number(item.quantity) > available;
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={styles.td}>
                                <select
                                  value={item.materialName}
                                  onChange={e => handleTransferItemChange(idx, 'materialName', e.target.value)}
                                  style={styles.formSelect}
                                  required
                                >
                                  <option value="">-- Select material --</option>
                                  {mainMaterials.map(m => (
                                    <option key={m._id} value={m.name}>{m.name} ({m.unit})</option>
                                  ))}
                                </select>
                              </td>
                              <td style={styles.td}>{available} {item.unit}</td>
                              <td style={styles.td}>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={e => handleTransferItemChange(idx, 'quantity', e.target.value)}
                                  style={{ ...styles.formInput, borderColor: over ? '#ef4444' : undefined }}
                                  required
                                />
                                {over && <div style={{ color: '#c62828', fontSize: '11px', marginTop: '2px' }}>Exceeds available stock</div>}
                              </td>
                              <td style={styles.td}>
                                {transferForm.items.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeTransferItemRow(idx)}
                                    style={{ background: '#fde8e8', color: '#c62828', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                                  >
                                    Remove
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <button
                      type="button"
                      onClick={addTransferItemRow}
                      style={{ marginTop: '10px', background: '#e2e8f0', color: '#1a365d', border: 'none', padding: '8px 14px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                    >
                      + Add Material
                    </button>
                  </div>

                  <div>
                    <label style={styles.fieldLabel}>Notes</label>
                    <textarea
                      placeholder="Optional notes for this transfer..."
                      value={transferForm.notes}
                      onChange={e => setTransferForm({ ...transferForm, notes: e.target.value })}
                      style={{ ...styles.formInput, height: '70px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="submit" disabled={transferSubmitting} style={styles.orangeBtn}>
                      {transferSubmitting ? 'Creating...' : 'Create Transfer'}
                    </button>
                    <button type="button" onClick={() => setShowTransferForm(false)} style={{ background: '#cbd5e1', color: '#333', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeaderRow}>
                    <th style={styles.th}>MIN No.</th>
                    <th style={styles.th}>Project / Requestor</th>
                    <th style={styles.th}>Requested Materials</th>
                    <th style={styles.th}>Required Date</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Notes</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {minList.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={styles.emptyState}>No Material Transfer Notes submitted yet.</td>
                    </tr>
                  ) : (
                    minList.map(m => {
                      const shortages = [];
                      m.materials.forEach(item => {
                        const mainMat = materials.find(x => x.name === item.materialName && x.location === 'MainStore');
                        const available = mainMat ? mainMat.quantity : 0;
                        if (available < item.quantity) {
                          shortages.push({ name: item.materialName, needed: item.quantity - available });
                        }
                      });

                      return (
                        <tr key={m._id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ ...styles.tdBold, color: '#1a365d' }}>{m.minNumber}</td>
                          <td style={styles.td}>
                            <div style={{ fontWeight: 'bold' }}>{m.projectName}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>By: {m.requestedBy}</div>
                          </td>
                          <td style={styles.td}>
                            {m.requestType === 'FreeForm' && (
                              <span style={{ background: '#ede9fe', color: '#6d28d9', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', display: 'inline-block', marginBottom: '4px' }}>
                                Site Request
                              </span>
                            )}
                            {m.materials.map((mat, i) => {
                              const mainMat = materials.find(x => x.name === mat.materialName && x.location === 'MainStore');
                              const isShort = mainMat ? mainMat.quantity < mat.quantity : true;
                              return (
                                <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
                                  <span>{mat.materialName} ({mat.quantity} {mat.unit})</span>
                                  {mat.availableAtSite !== undefined && (
                                    <span style={{ fontSize: '10px', color: '#64748b' }}>
                                      Site had: {mat.availableAtSite}
                                    </span>
                                  )}
                                  {isShort && (
                                    <span style={{ background: '#fde8e8', color: '#c62828', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                                      Shortage ({mainMat ? mainMat.quantity : 0} avail)
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </td>
                          <td style={styles.td}>{m.requiredDate ? formatDate(m.requiredDate) : '-'}</td>
                          <td style={styles.td}>
                            <span style={{
                              background: m.status === 'Received' ? '#e8f5e9' : m.status === 'Issued' ? '#e0f2f1' : m.status === 'Approved' ? '#e3f2fd' : m.status === 'Rejected' ? '#ffebee' : '#fff3e0',
                              color: m.status === 'Received' ? '#2e7d32' : m.status === 'Issued' ? '#00695c' : m.status === 'Approved' ? '#1565c0' : m.status === 'Rejected' ? '#c62828' : '#b7791f',
                              padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold'
                            }}>
                              {m.status}
                            </span>
                          </td>
                          <td style={styles.td}>{m.notes || '-'}</td>
                          <td style={styles.td}>
                            {m.status === 'Pending' && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {m.requestType === 'FreeForm' ? (
                                  <button
                                    onClick={() => openTransferForm(m)}
                                    disabled={shortages.length > 0}
                                    title={shortages.length > 0 ? 'Insufficient Main Store stock for one or more materials' : ''}
                                    style={{ background: shortages.length > 0 ? '#94a3b8' : '#2563eb', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: shortages.length > 0 ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                                  >
                                    Transfer to Site
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleApproveMIN(m._id)}
                                    style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                                  >
                                    Approve
                                  </button>
                                )}
                                <button
                                  onClick={() => handleRejectMIN(m._id)}
                                  style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                            {m.status === 'Approved' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {shortages.length > 0 ? (
                                  <>
                                    <div style={{ fontSize: '11px', color: '#c62828', fontWeight: 'bold' }}>⚠️ Insufficient Stock to Issue</div>
                                    <button
                                      onClick={() => handleMINShortagePR(m)}
                                      style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                                    >
                                      Generate Shortage PR
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => handleIssueMIN(m._id)}
                                    style={{ background: '#2563eb', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                                  >
                                    Issue Materials
                                  </button>
                                )}
                              </div>
                            )}
                            {m.status === 'Issued' && <span style={{ fontSize: '12px', color: '#00695c', fontWeight: '600' }}>🚚 Shipped, awaiting site confirmation</span>}
                            {m.status === 'Received' && <span style={{ fontSize: '12px', color: '#2e7d32', fontWeight: '600' }}>✓ Delivered & confirmed at site</span>}
                            {m.status === 'Rejected' && <div style={{ fontSize: '12px', color: '#c62828' }}>Rejected: {m.rejectionReason}</div>}
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

        {view === 'approved-boms' && (
          <div style={styles.container}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h1 style={styles.pageTitle}>Director-Approved BOMs</h1>
            </div>

            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeaderRow}>
                    <th style={styles.th}>BOM Number</th>
                    <th style={styles.th}>Project</th>
                    <th style={styles.th}>Version</th>
                    <th style={styles.th}>Approved By</th>
                    <th style={styles.th}>Materials</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedBoms.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={styles.emptyState}>No Director-approved BOMs yet.</td>
                    </tr>
                  ) : (
                    approvedBoms.map(bom => (
                      <tr key={bom._id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ ...styles.tdBold, color: '#1a365d' }}>{bom.bomNumber || '-'}</td>
                        <td style={styles.td}>{bom.projectId?.projectName || bom.projectId?.name || bom.projectName || '-'}</td>
                        <td style={styles.td}>{bom.version || 'v1.0'}</td>
                        <td style={styles.td}>{bom.approvedBy || '-'}</td>
                        <td style={styles.td}>{(bom.materials || []).length} item(s)</td>
                        <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => setViewBom(bom)}
                            style={{ background: '#f1f5f9', color: '#0d1b4b', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', marginRight: '8px' }}
                          >
                            👁 View
                          </button>
                          <button
                            onClick={() => handleCompareBom(bom)}
                            style={{ background: '#2563eb', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                          >
                            Compare Stock & Create PR
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {selectedBom && (
              <div style={{ ...styles.tableContainer, marginTop: '24px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, color: '#0d1b4b', fontWeight: '700' }}>
                    Stock Comparison — {selectedBom.bomNumber || selectedBom.version} ({selectedBom.projectId?.projectName || selectedBom.projectId?.name || selectedBom.projectName})
                  </h3>
                  <button onClick={handleCancelBomCompare} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                    ✕ Cancel
                  </button>
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: 0, marginBottom: '16px' }}>
                  Quantities below default to the shortfall (Planned Qty − Available in Main Store). Untick a row to exclude it, or edit the quantity before submitting — it cannot exceed the BOM's planned quantity.
                </p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.tableHeaderRow}>
                        <th style={styles.th}>Include</th>
                        <th style={styles.th}>Material</th>
                        <th style={styles.th}>Category</th>
                        <th style={styles.th}>Planned Qty</th>
                        <th style={styles.th}>Available (Main Store)</th>
                        <th style={styles.th}>PR Quantity</th>
                        <th style={styles.th}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shortageItems.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={styles.td}>
                            <input type="checkbox" checked={it.include} onChange={() => handleShortageIncludeToggle(idx)} />
                          </td>
                          <td style={{ ...styles.tdBold, color: '#0d1b4b' }}>{it.name}</td>
                          <td style={styles.td}>{it.category}</td>
                          <td style={styles.td}>{it.plannedQty} {it.unit}</td>
                          <td style={styles.td}>{it.available} {it.unit}</td>
                          <td style={styles.td}>
                            <input
                              type="number"
                              min="0"
                              max={it.plannedQty}
                              value={it.quantity}
                              onChange={e => handleShortageQtyChange(idx, e.target.value)}
                              disabled={!it.include}
                              style={{ width: '90px', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }}
                            />
                          </td>
                          <td style={styles.td}>
                            {it.plannedQty - it.available > 0 ? (
                              <span style={{ background: '#fde8e8', color: '#c62828', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>Shortage</span>
                            ) : (
                              <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>Sufficient</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button
                    onClick={handleSubmitBomShortagePR}
                    style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
                  >
                    🚀 Submit Purchase Request to Purchase Manager
                  </button>
                </div>
              </div>
            )}

            {viewBom && (
              <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }} onClick={() => setViewBom(null)}>
                <div style={{ background: 'white', borderRadius: '10px', width: '700px', maxWidth: '90%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
                    <div>
                      <h3 style={{ margin: 0, color: '#0d1b4b', fontWeight: '700' }}>{viewBom.bomNumber || '-'}</h3>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                        {viewBom.projectId?.projectName || viewBom.projectId?.name || viewBom.projectName || '-'} &middot; {viewBom.version || 'v1.0'} &middot; Approved by {viewBom.approvedBy || '-'}
                      </p>
                    </div>
                    <button onClick={() => setViewBom(null)} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                      ✕ Close
                    </button>
                  </div>
                  <div style={{ padding: '20px 24px' }}>
                    <table style={styles.table}>
                      <thead>
                        <tr style={styles.tableHeaderRow}>
                          <th style={styles.th}>Material</th>
                          <th style={styles.th}>Category</th>
                          <th style={styles.th}>Planned Qty</th>
                          <th style={styles.th}>Unit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(viewBom.materials || []).length === 0 ? (
                          <tr>
                            <td colSpan="4" style={styles.emptyState}>No materials listed on this BOM.</td>
                          </tr>
                        ) : (
                          viewBom.materials.map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={{ ...styles.tdBold, color: '#0d1b4b' }}>{item.name}</td>
                              <td style={styles.td}>{item.category || '-'}</td>
                              <td style={styles.td}>{item.plannedQty}</td>
                              <td style={styles.td}>{item.unit || '-'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px', borderTop: '1px solid #e2e8f0' }}>
                    <button
                      onClick={() => { const b = viewBom; setViewBom(null); handleCompareBom(b); }}
                      style={{ background: '#2563eb', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                    >
                      Compare Stock & Create PR
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'reports' && (
          <div style={styles.container}>
            <h1 style={styles.pageTitle}>Reports &amp; Analytics</h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '30px' }}>
              {[
                { icon: '💰', title: 'Inventory Valuation Report', desc: 'View current stock value and valuation', action: () => { setModal('total-materials'); setModalSearchTerm(''); } },
                { icon: '📊', title: 'Stock Summary Report', desc: 'Detailed stock breakdown by category', action: () => { setModal('stock-value'); setModalSearchTerm(''); } },
                { icon: '⚠️', title: 'Low Stock Report', desc: 'Materials below minimum stock level', action: () => { setModal('low-stock'); setModalSearchTerm(''); } },
                { icon: '🔔', title: 'Reorder Level Report', desc: 'Materials that have reached reorder level', action: () => { setModal('reorder-level'); setModalSearchTerm(''); } },
                { icon: '📥', title: 'GRN Report', desc: 'Goods received notes summary', action: () => { setModal('last-grn'); setModalSearchTerm(''); } },
                { icon: '🚚', title: 'Material Transfer Report', desc: 'All MIN transfers to sites (Stock Ledger)', action: () => setView('stock-ledger') },
                { icon: '📝', title: 'Purchase Request Report', desc: 'PRs generated summary', action: () => setView('purchase-request') },
                { icon: '📈', title: 'Frequently Issued Materials', desc: 'Fast-moving materials, ranked by issue count', action: () => setModal('frequently-used') },
              ].map((r, i) => (
                <div key={i} onClick={r.action} className="hover-card" style={{ ...styles.tableContainer, padding: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '24px' }}>{r.icon}</div>
                  <div style={{ fontWeight: '700', color: '#0d1b4b', fontSize: '14px' }}>{r.title}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{r.desc}</div>
                </div>
              ))}
            </div>

            {/* Monthly Usage Report */}
            {(() => {
              const filteredUsage = usageLogs.filter(u => {
                if (!u.usageDate) return false;
                const dateStr = u.usageDate.substring(0, 7); // 'YYYY-MM'
                return dateStr === selectedMonth;
              });

              const usageDataGrouped = [];
              const usageMap = {};
              filteredUsage.forEach(u => {
                const name = u.materialName;
                const qty = Number(u.actualQty) || 0;
                usageMap[name] = (usageMap[name] || 0) + qty;
              });
              Object.keys(usageMap).forEach(key => {
                usageDataGrouped.push({ name: key, value: usageMap[key] });
              });

              return (
                <div style={{ ...styles.tableContainer, padding: '24px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, color: '#0d1b4b' }}>📊 Monthly Material Usage Consumption</h3>
                    <div>
                      <label style={{ marginRight: '10px', fontSize: '13px', fontWeight: 'bold' }}>Select Month:</label>
                      <select
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                        style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
                      >
                        <option value="2026-07">July 2026</option>
                        <option value="2026-06">June 2026</option>
                        <option value="2026-05">May 2026</option>
                        <option value="2026-04">April 2026</option>
                      </select>
                    </div>
                  </div>
                  {usageDataGrouped.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No material consumption recorded for this month.</div>
                  ) : (
                    <div style={{ display: 'flex', gap: '40px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ width: '320px', height: '240px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={usageDataGrouped}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={90}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {usageDataGrouped.map((entry, index) => {
                                const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#3b82f6'];
                                return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                              })}
                            </Pie>
                            <Tooltip formatter={(value, name) => [`${value} units`, name]} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {usageDataGrouped.map((item, index) => {
                          const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#3b82f6'];
                          return (
                            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: COLORS[index % COLORS.length] }}></div>
                              <span style={{ fontWeight: '600' }}>{item.name}:</span>
                              <span>{item.value}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {view === 'notifications' && (
          <div style={styles.container}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <h1 style={{ ...styles.pageTitle, marginBottom: 0 }}>Notifications</h1>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={styles.filterGroup}>
                  <select value={notifFilter} onChange={e => setNotifFilter(e.target.value)} style={styles.filterSelect}>
                    <option value="All">All ({persistedNotifications.length})</option>
                    <option value="Unread">Unread ({persistedNotifications.filter(n => !n.isRead).length})</option>
                  </select>
                </div>
                <button onClick={handleMarkAllNotifsRead} style={{ ...styles.orangeBtn, background: '#2563eb' }}>Mark all as read</button>
              </div>
            </div>

            <div style={styles.tableContainer}>
              {(() => {
                const filtered = notifFilter === 'Unread' ? persistedNotifications.filter(n => !n.isRead) : persistedNotifications;
                if (filtered.length === 0) {
                  return <div style={styles.emptyState}>No notifications to show.</div>;
                }
                return (
                  <div>
                    {filtered.map((n, i) => (
                      <div
                        key={n._id || i}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px',
                          padding: '16px 20px', borderBottom: i === filtered.length - 1 ? 'none' : '1px solid #f1f5f9',
                          backgroundColor: n.isRead ? 'white' : 'rgba(37, 99, 235, 0.05)'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            {!n.isRead && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb', display: 'inline-block' }}></span>}
                            <span style={{
                              background: '#e3f2fd', color: '#1565c0', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase'
                            }}>{n.type || 'info'}</span>
                          </div>
                          <div style={{ fontSize: '13px', color: '#0d1b4b', fontWeight: n.isRead ? '400' : '600' }}>{n.message}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{formatDateTime(n.createdAt)}</div>
                        </div>
                        {!n.isRead && (
                          <button onClick={() => handleMarkNotifRead(n._id)} style={{ background: '#f1f5f9', color: '#0d1b4b', border: '1px solid #cbd5e1', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                            Mark read
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '20px 0 8px', marginTop: '16px', fontSize: '12px', color: '#94a3b8' }}>
          ELS Construction Material Management System &copy;2026
        </div>
      </main>

      {/* Low Stock Popup Alerts (Mandatory overlay) */}
      {(() => {
        const alertsToTrigger = materials.filter(m => {
          const reorder = m.reorderLevel !== undefined ? m.reorderLevel : 50;
          return m.quantity < reorder && m.location === 'MainStore';
        });
        const unacknowledged = alertsToTrigger.filter(m => !acknowledgedAlerts[m._id]);
        if (unacknowledged.length === 0) return null;
        
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
            <div style={{ background: 'white', padding: '30px', borderRadius: '12px', width: '500px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', borderTop: '6px solid #ef4444', textAlign: 'left' }}>
              <h3 style={{ color: '#ef4444', margin: '0 0 16px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🚨 Low Stock Alert Notification (Main Store)
              </h3>
              <p style={{ color: '#475569', fontSize: '14px', marginBottom: '20px' }}>
                The following materials have fallen below their reorder levels. Please review and restock:
              </p>
              <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '24px' }}>
                {unacknowledged.map(m => {
                  const reorder = m.reorderLevel !== undefined ? m.reorderLevel : 50;
                  const isCritical = m.quantity <= (m.minimumStock || 10);
                  return (
                    <div key={m._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                      <div>
                        <strong style={{ color: '#0f172a' }}>{m.name}</strong>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Stock: {m.quantity} {m.unit} / Reorder: {reorder} {m.unit}</div>
                      </div>
                      <span style={{ 
                        background: isCritical ? '#fee2e2' : '#ffedd5', 
                        color: isCritical ? '#991b1b' : '#c2410c',
                        padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' 
                      }}>
                        {isCritical ? 'Critical' : 'Low Stock'}
                      </span>
                    </div>
                  );
                })}
              </div>
              <button 
                onClick={() => {
                  const updated = { ...acknowledgedAlerts };
                  alertsToTrigger.forEach(m => {
                    updated[m._id] = true;
                  });
                  setAcknowledgedAlerts(updated);
                }}
                style={{ width: '100%', padding: '12px', background: '#0d1b4b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
              >
                Acknowledge & Dismiss Alerts
              </button>
            </div>
          </div>
        );
      })()}
      {renderStoreStatsModal()}
    </div>
  );
}

const styles = {
  dashboardLayout: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#f5f6fa',
  },
  sidebar: {
    width: '260px',
    backgroundColor: '#0d1b4b',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    borderRight: '1px solid #1f2937',
    position: 'fixed',
    height: '100vh',
    zIndex: 100
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '30px',
  },
  sidebarTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#2563eb',
  },
  sidebarSubtitle: {
    fontSize: '11px',
    color: '#cbd5e1',
    fontWeight: '500',
  },
  sidebarUserSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 0',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    marginBottom: '24px',
  },
  dbAvatar: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '16px',
    color: 'white',
  },
  sidebarUserInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarUserName: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'white',
  },
  sidebarUserRole: {
    fontSize: '12px',
    color: '#2563eb',
    fontWeight: '600',
  },
  sidebarNav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: '1',
  },
  sidebarBtn: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '12px 16px',
    backgroundColor: 'transparent',
    color: '#cbd5e1',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s',
  },
  sidebarBtnActive: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '12px 16px',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    boxShadow: '0 4px 12px rgba(37, 99, 235,0.2)',
  },
  sidebarSwitchBtn: {
    width: '100%',
    padding: '12px',
    backgroundColor: 'rgba(37, 99, 235,0.1)',
    color: '#2563eb',
    border: '1px solid rgba(37, 99, 235,0.2)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    marginBottom: '10px'
  },
  sidebarLogoutBtn: {
    width: '100%',
    padding: '12px',
    backgroundColor: 'rgba(239,68,68,0.1)',
    color: '#fca5a5',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    marginTop: 'auto',
  },
  contentArea: {
    flex: '1',
    backgroundColor: '#f5f6fa',
    padding: '30px',
    overflowY: 'auto',
    maxHeight: '100vh',
    marginLeft: '260px',
  },
  container: {
    backgroundColor: '#f5f6fa',
    padding: '24px',
    borderRadius: '12px',
    minHeight: '80vh',
  },
  pageTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#0d1b4b',
    marginBottom: '24px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '20px',
    marginBottom: '30px',
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    borderLeft: '4px solid #0d1b4b',
  },
  statLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '6px',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#0d1b4b',
  },
  filtersContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px',
    marginBottom: '20px',
  },
  searchInput: {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    width: '280px',
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  filterLabel: {
    fontSize: '13px',
    color: '#64748b',
    fontWeight: '600',
  },
  filterSelect: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    backgroundColor: 'white',
    fontSize: '14px',
  },
  refreshBtn: {
    backgroundColor: '#0d1b4b',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  tableContainer: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: 'white',
  },
  tableHeaderRow: {
    backgroundColor: '#0d1b4b',
  },
  th: {
    color: 'white',
    padding: '14px 18px',
    textAlign: 'left',
    fontSize: '13px',
    fontWeight: '600',
  },
  td: {
    padding: '14px 18px',
    fontSize: '14px',
    color: '#334155',
  },
  tdBold: {
    padding: '14px 18px',
    fontSize: '14px',
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  fieldLabel: {
    display: 'block',
    fontSize: '12px',
    color: '#666',
    fontWeight: '600',
    marginBottom: '4px',
    textTransform: 'uppercase',
  },
  formInput: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    boxSizing: 'border-box',
  },
  formSelect: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    boxSizing: 'border-box',
    backgroundColor: 'white',
  },
  orangeBtn: {
    background: '#2563eb',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
  },
  errorAlert: {
    backgroundColor: '#ffebee',
    border: '1px solid #ef5350',
    color: '#c62828',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '20px',
  },
  successAlert: {
    backgroundColor: '#e8f5e9',
    border: '1px solid #4caf50',
    color: '#2e7d32',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '20px',
  },
  loadingText: {
    padding: '40px',
    textAlign: 'center',
    color: '#64748b',
    fontSize: '14px',
  },
  emptyState: {
    padding: '40px',
    textAlign: 'center',
    color: '#64748b',
    fontSize: '14px',
  },
};

export default MainStoreDashboard;
