import React, { useState, useEffect } from 'react';
import SettingsPage from './SettingsPage';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { encryptTransit, decryptTransit } from '../utils/cryptoUtils';
import { formatDate, formatDateTime, formatDateLong } from '../utils/dateUtils';
import DateInput from '../components/DateInput';

function MainStoreDashboard({ user, onLogout, onUserUpdate }) {
  const [view, setView] = useState('dashboard'); // 'dashboard', 'grn', 'transfer-log', 'purchase-request', 'item-master', 'min', 'approved-boms'
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

  // Item Master state
  const [itemMasterList, setItemMasterList] = useState([]);
  const [showItemMasterForm, setShowItemMasterForm] = useState(false);
  const [editingItemMasterId, setEditingItemMasterId] = useState(null);
  const emptyItemMasterForm = {
    materialCode: '',
    materialName: '',
    category: 'Cement & Concrete',
    unit: 'Bag',
    estimatedUnitCost: 0,
    description: '',
    minimumStock: 10,
    maximumStock: 100,
    reorderLevel: 50,
    status: 'Active'
  };
  const [itemMasterForm, setItemMasterForm] = useState(emptyItemMasterForm);

  // Material Issuance Notes and Usage charts state
  const [minList, setMinList] = useState([]);
  const [usageLogs, setUsageLogs] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('2026-07');
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState({});

  // Director-Approved BOMs, and the BOM-vs-stock shortage comparison state used
  // to auto-generate (and let the officer manually adjust) a Purchase Request.
  const [approvedBoms, setApprovedBoms] = useState([]);
  const [selectedBom, setSelectedBom] = useState(null);
  const [shortageItems, setShortageItems] = useState([]);

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

  // Inline edit state
  const [editingMaterialId, setEditingMaterialId] = useState(null);
  const [editQty, setEditQty] = useState('');

  // GRN form
  const [grnForm, setGrnForm] = useState({
    supplier: '',
    poReference: '',
    receivedDate: new Date().toISOString().substring(0, 10),
    notes: '',
    items: [{ material: '', expectedQty: '', receivedQty: '', condition: 'Good' }]
  });

  const getHeaders = () => {
    const token = JSON.parse(localStorage.getItem('user'))?.token;
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };
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

  const fetchItemMasters = async () => {
    try {
      const headers = getHeaders();
      const res = await fetch('http://localhost:5000/api/item-master', { headers });
      const data = await res.json();
      let finalData = data;
      if (data && data.ciphertext) {
        finalData = JSON.parse(decryptTransit(data.ciphertext));
      }
      if (finalData.success && Array.isArray(finalData.data)) {
        setItemMasterList(finalData.data);
      }
    } catch (err) {
      console.error('Error fetching item master records:', err);
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

  const fetchData = async () => {
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

      // Fetch Item Masters, Material Issuance Notes, and Usage Logs
      await fetchItemMasters();
      await fetchMINs();
      await fetchUsageLogs();

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

  const handleGrnSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');

    const invalid = grnForm.items.some(item => !item.material || !item.expectedQty || !item.receivedQty);
    if (invalid) {
      setError('Please fill in material, expected and received quantities for all rows.');
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
          poReference: '',
          receivedDate: new Date().toISOString().substring(0, 10),
          notes: '',
          items: [{ material: '', expectedQty: '', receivedQty: '', condition: 'Good' }]
        });
        setView('dashboard');
        fetchData();
      } else {
        setError(data.message || 'Failed to submit GRN.');
      }
    } catch (err) {
      setError('Connection error occurred.');
    }
  };

  const handleEditQtySave = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/api/inventory/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ quantity: Number(editQty) })
      });
      if (res.ok) {
        setSuccess('✅ Quantity updated successfully!');
        setEditingMaterialId(null);
        fetchData();
      } else {
        setError('Failed to update quantity.');
      }
    } catch (err) {
      setError('Connection error.');
    }
  };

  const handleDeleteMaterial = async (id) => {
    if (!window.confirm('Are you sure you want to delete this material?')) return;
    setError(''); setSuccess('');
    try {
      const res = await fetch(`http://localhost:5000/api/inventory/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        setSuccess('✅ Material deleted successfully!');
        fetchData();
      } else {
        setError('Failed to delete material.');
      }
    } catch (err) {
      setError('Connection error.');
    }
  };

  // Item Master Handlers
  const handleItemMasterSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      const payload = {
        ...itemMasterForm,
        estimatedUnitCost: Number(itemMasterForm.estimatedUnitCost) || 0,
        reorderLevel: Number(itemMasterForm.reorderLevel)
      };

      const ciphertext = encryptTransit(JSON.stringify(payload));
      
      const url = editingItemMasterId 
        ? `http://localhost:5000/api/item-master/${editingItemMasterId}`
        : 'http://localhost:5000/api/item-master';
      const method = editingItemMasterId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({ ciphertext })
      });
      const data = await res.json();
      let finalData = data;
      if (data && data.ciphertext) {
        finalData = JSON.parse(decryptTransit(data.ciphertext));
      }

      if (res.ok && finalData.success) {
        setSuccess(`Item Master threshold ${editingItemMasterId ? 'updated' : 'created'} successfully!`);
        setShowItemMasterForm(false);
        setEditingItemMasterId(null);
        setItemMasterForm(emptyItemMasterForm);
        fetchData();
      } else {
        setError(finalData.message || 'Failed to save item master threshold.');
      }
    } catch (err) {
      setError('Connection error occurred.');
    }
  };

  const handleItemMasterDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this master item threshold?')) return;
    setError(''); setSuccess('');
    try {
      const res = await fetch(`http://localhost:5000/api/item-master/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      let finalData = data;
      if (data && data.ciphertext) {
        finalData = JSON.parse(decryptTransit(data.ciphertext));
      }
      if (res.ok && finalData.success) {
        setSuccess('Master item threshold deleted successfully!');
        fetchData();
      } else {
        setError(finalData.message || 'Failed to delete record.');
      }
    } catch (err) {
      setError('Connection error.');
    }
  };

  const handleItemMasterEditClick = (item) => {
    setEditingItemMasterId(item._id);
    setItemMasterForm({
      materialCode: item.materialCode,
      materialName: item.materialName,
      category: item.category || 'Cement & Concrete',
      unit: item.unit,
      estimatedUnitCost: item.estimatedUnitCost || 0,
      description: item.description || '',
      minimumStock: item.minimumStock,
      maximumStock: item.maximumStock,
      reorderLevel: item.reorderLevel,
      status: item.status || 'Active'
    });
    setShowItemMasterForm(true);
  };

  const handleItemMasterToggleStatus = async (item) => {
    setError(''); setSuccess('');
    const newStatus = item.status === 'Active' ? 'Inactive' : 'Active';
    try {
      const payload = { status: newStatus };
      const ciphertext = encryptTransit(JSON.stringify(payload));
      const res = await fetch(`http://localhost:5000/api/item-master/${item._id}`, {
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
        setSuccess(`Material ${newStatus === 'Active' ? 'activated' : 'deactivated'} successfully!`);
        fetchData();
      } else {
        setError(finalData.message || 'Failed to update status.');
      }
    } catch (err) {
      setError('Connection error.');
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
          <h2 style={styles.sidebarTitle}>ELS CMMS</h2>
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
            { id: 'grn', label: 'GRN Incoming', icon: '📥' },
            { id: 'transfer-log', label: 'Transfer Log', icon: '📋' },
            { id: 'min', label: 'Material Issuance Notes', icon: '📥' },
            { id: 'approved-boms', label: 'Approved BOMs', icon: '✅' },
            { id: 'item-master', label: 'Item Master', icon: '🗂️' },
            { id: 'purchase-request', label: 'Purchase Request', icon: '📝' },
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
      <main style={styles.contentArea}>
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
              <div 
                style={{ ...styles.statCard, cursor: 'pointer', transition: 'transform 0.2s' }}
                onClick={() => { setModal('total-materials'); setModalSearchTerm(''); }}
                className="hover-card"
              >
                <div style={styles.statLabel}>Total Materials</div>
                <div style={styles.statValue}>{totalSKUs}</div>
              </div>
              <div 
                style={{ ...styles.statCard, cursor: 'pointer', transition: 'transform 0.2s' }}
                onClick={() => { setModal('stock-value'); setModalSearchTerm(''); }}
                className="hover-card"
              >
                <div style={styles.statLabel}>Total Stock Value</div>
                <div style={styles.statValue}>LKR {stockValue.toLocaleString()}</div>
              </div>
              <div 
                style={{ 
                  ...styles.statCard, 
                  borderLeft: lowStockItems > 0 ? '4px solid #ef4444' : '4px solid #0d1b4b',
                  cursor: 'pointer',
                  transition: 'transform 0.2s'
                }}
                onClick={() => { setModal('low-stock'); setModalSearchTerm(''); }}
                className="hover-card"
              >
                <div style={styles.statLabel}>Low Stock Alerts</div>
                <div style={{ ...styles.statValue, color: lowStockItems > 0 ? '#ef4444' : '#0d1b4b' }}>{lowStockItems}</div>
              </div>
              <div 
                style={{ ...styles.statCard, cursor: 'pointer', transition: 'transform 0.2s' }}
                onClick={() => { setModal('frequently-used'); }}
                className="hover-card"
              >
                <div style={styles.statLabel}>Frequently Used</div>
                <div style={styles.statValue}>View Catalog 📊</div>
              </div>
              <div 
                style={{ ...styles.statCard, cursor: 'pointer', transition: 'transform 0.2s' }}
                onClick={() => { setModal('last-grn'); setModalSearchTerm(''); }}
                className="hover-card"
              >
                <div style={styles.statLabel}>Last GRN Date</div>
                <div style={styles.statValue}>{lastGRNDate}</div>
              </div>
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
                <button onClick={fetchData} style={styles.refreshBtn}>Refresh</button>
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
                      <th style={styles.th}>Unit Price (LKR)</th>
                      <th style={styles.th}>Location</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMaterials.map(m => {
                      const isLow = m.quantity <= m.minimumStock;
                      return (
                        <tr key={m._id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: isLow ? 'rgba(239,68,68,0.08)' : 'white' }}>
                          <td style={{ ...styles.tdBold, color: isLow ? '#c62828' : '#0d1b4b' }}>{m.name}</td>
                          <td style={styles.td}>{m.category}</td>
                          <td style={styles.td}>{m.unit}</td>
                          <td style={styles.td}>
                            {editingMaterialId === m._id ? (
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <input
                                  type="number"
                                  value={editQty}
                                  onChange={e => setEditQty(e.target.value)}
                                  style={{ width: '70px', padding: '4px' }}
                                />
                                <button onClick={() => handleEditQtySave(m._id)} style={{ background: '#2e7d32', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Save</button>
                                <button onClick={() => setEditingMaterialId(null)} style={{ background: '#ccc', color: '#333', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>X</button>
                              </div>
                            ) : (
                              <span>{m.quantity}</span>
                            )}
                          </td>
                          <td style={styles.td}>{m.minimumStock}</td>
                          <td style={styles.td}>{m.unitPrice?.toLocaleString()}</td>
                          <td style={styles.td}>{m.location}</td>
                          <td style={styles.td}>
                            {isLow ? (
                              <span style={{ background: '#ffebee', color: '#c62828', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>Low</span>
                            ) : (
                              <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>OK</span>
                            )}
                          </td>
                          <td style={styles.td}>
                            <button
                              onClick={() => { setEditingMaterialId(m._id); setEditQty(m.quantity); }}
                              style={{ background: '#1565c0', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '6px' }}
                            >
                              Edit Qty
                            </button>
                            <button
                              onClick={() => handleDeleteMaterial(m._id)}
                              style={{ background: '#c62828', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            {/* Monthly Usage Pie Chart */}
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
                <div style={{ ...styles.tableContainer, marginTop: '24px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
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

        {view === 'grn' && (
          <div style={styles.container}>
            <h1 style={styles.pageTitle}>Goods Received Note (GRN) Operations</h1>

            {/* GRN form */}
            <div style={styles.formCard}>
              <h3 style={{ color: '#0d1b4b', marginBottom: '16px' }}>Record New Incoming Goods</h3>
              <form onSubmit={handleGrnSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={styles.fieldLabel}>Supplier *</label>
                    <select
                      value={grnForm.supplier}
                      onChange={e => setGrnForm({ ...grnForm, supplier: e.target.value })}
                      style={styles.formSelect}
                      required
                    >
                      <option value="">-- Select Supplier --</option>
                      {suppliers.map(s => (
                        <option key={s._id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>PO Reference (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. PO-2026-001"
                      value={grnForm.poReference}
                      onChange={e => setGrnForm({ ...grnForm, poReference: e.target.value })}
                      style={styles.formInput}
                    />
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Received Date</label>
                    <DateInput
                      value={grnForm.receivedDate}
                      onChange={iso => setGrnForm({ ...grnForm, receivedDate: iso })}
                      style={styles.formInput}
                      required
                    />
                  </div>
                </div>

                <h4 style={{ color: '#0d1b4b', marginBottom: '12px' }}>GRN Materials List</h4>
                {grnForm.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <select
                      value={item.material}
                      onChange={e => {
                        const updated = [...grnForm.items];
                        updated[idx].material = e.target.value;
                        const matched = materials.find(m => m._id === e.target.value);
                        updated[idx].materialName = matched ? matched.name : '';
                        setGrnForm({ ...grnForm, items: updated });
                      }}
                      style={styles.formSelect}
                      required
                    >
                      <option value="">-- Select Material --</option>
                      {materials.filter(m => m.location === 'MainStore').map(m => (
                        <option key={m._id} value={m._id}>{m.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Expected"
                      value={item.expectedQty}
                      onChange={e => {
                        const updated = [...grnForm.items];
                        updated[idx].expectedQty = e.target.value;
                        setGrnForm({ ...grnForm, items: updated });
                      }}
                      style={styles.formInput}
                      required
                    />
                    <input
                      type="number"
                      placeholder="Received"
                      value={item.receivedQty}
                      onChange={e => {
                        const updated = [...grnForm.items];
                        updated[idx].receivedQty = e.target.value;
                        setGrnForm({ ...grnForm, items: updated });
                      }}
                      style={styles.formInput}
                      required
                    />
                    <select
                      value={item.condition}
                      onChange={e => {
                        const updated = [...grnForm.items];
                        updated[idx].condition = e.target.value;
                        setGrnForm({ ...grnForm, items: updated });
                      }}
                      style={styles.formSelect}
                    >
                      <option value="Good">Good</option>
                      <option value="Damaged">Damaged</option>
                      <option value="Partial">Partial</option>
                      <option value="Shortage">Shortage</option>
                      <option value="Other">Other</option>
                    </select>
                    {grnForm.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setGrnForm({ ...grnForm, items: grnForm.items.filter((_, i) => i !== idx) })}
                        style={{ background: '#ffebee', color: '#c62828', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setGrnForm({ ...grnForm, items: [...grnForm.items, { material: '', expectedQty: '', receivedQty: '', condition: 'Good' }] })}
                  style={{ background: '#e3f2fd', color: '#1565c0', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', marginBottom: '16px', fontSize: '13px' }}
                >
                  + Add Row
                </button>

                <div style={{ marginBottom: '16px' }}>
                  <label style={styles.fieldLabel}>Notes</label>
                  <input
                    type="text"
                    value={grnForm.notes}
                    onChange={e => setGrnForm({ ...grnForm, notes: e.target.value })}
                    style={styles.formInput}
                  />
                </div>

                <button type="submit" style={styles.orangeBtn}>Record GRN & Update Inventory</button>
              </form>
            </div>

            {/* GRN History */}
            <div style={styles.tableContainer}>
              <h3 style={{ padding: '16px 20px', color: '#0d1b4b', margin: 0, borderBottom: '1px solid #eee' }}>GRN Processing History</h3>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeaderRow}>
                    <th style={styles.th}>GRN No.</th>
                    <th style={styles.th}>Supplier</th>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>PO Reference</th>
                    <th style={styles.th}>Items Count</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {grns.map((g, i) => (
                    <tr key={g._id || i} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={styles.tdBold}>{g.grnNumber}</td>
                      <td style={styles.td}>{g.supplier}</td>
                      <td style={styles.td}>{formatDate(g.receivedDate || g.createdAt)}</td>
                      <td style={styles.td}>{g.poReference}</td>
                      <td style={styles.td}>{g.items?.length || 0}</td>
                      <td style={styles.td}>
                        <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>Processed</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'transfer-log' && (
          <div style={styles.container}>
            <h1 style={styles.pageTitle}>Stock Transfer Ledger Log</h1>
            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeaderRow}>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Material Name</th>
                    <th style={styles.th}>Quantity Issued</th>
                    <th style={styles.th}>From</th>
                    <th style={styles.th}>To</th>
                    <th style={styles.th}>Issued By</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: '#999' }}>No transfers recorded.</td>
                    </tr>
                  ) : (
                    transfers.map((t, i) => (
                      <tr key={t._id || i} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={styles.td}>{formatDateTime(t.date)}</td>
                        <td style={styles.tdBold}>{t.materialName}</td>
                        <td style={styles.td}>{t.quantity}</td>
                        <td style={styles.td}>{t.from}</td>
                        <td style={styles.td}>{t.to}</td>
                        <td style={styles.td}>{t.issuedBy}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', background: '#0d1b4b' }}>
                <h3 style={{ margin: 0, color: 'white', fontSize: '15px' }}>📋 Submitted PR Registry Archive</h3>
              </div>
              <table style={styles.table}>
                <thead>
                  <tr style={{ background: '#f5f6fa' }}>
                    <th style={{ ...styles.th, color: '#333' }}>PR Number</th>
                    <th style={{ ...styles.th, color: '#333' }}>Project Name</th>
                    <th style={{ ...styles.th, color: '#333' }}>Material Specifications</th>
                    <th style={{ ...styles.th, color: '#333' }}>Urgency</th>
                    <th style={{ ...styles.th, color: '#333' }}>Status</th>
                    <th style={{ ...styles.th, color: '#333' }}>Submitted Date</th>
                  </tr>
                </thead>
                <tbody>
                  {prs.map((pr, idx) => (
                    <tr key={pr._id || idx} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={styles.tdBold}>PR-{String(idx + 1).padStart(3, '0')}</td>
                      <td style={styles.td}>{pr.projectName || pr.project}</td>
                      <td style={styles.td}>
                        {pr.materials?.map((m, i) => (
                          <div key={i}>{m.materialName} ×{m.quantity} {m.unit}</div>
                        ))}
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
                  ))}
                  {prs.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#999' }}>
                        No purchase requests submitted yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'settings' && <SettingsPage user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />}

        {view === 'item-master' && (
          <div style={styles.container}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h1 style={styles.pageTitle}>Item Master Threshold Settings</h1>
              <button 
                onClick={() => {
                  setEditingItemMasterId(null);
                  setItemMasterForm(emptyItemMasterForm);
                  setShowItemMasterForm(!showItemMasterForm);
                }}
                style={{ ...styles.orangeBtn, background: '#2563eb' }}
              >
                {showItemMasterForm ? 'View Master Catalog' : '＋ Add Master Item'}
              </button>
            </div>

            {showItemMasterForm ? (
              <div style={styles.formCard}>
                <h3 style={{ color: '#0d1b4b', marginBottom: '16px' }}>{editingItemMasterId ? 'Edit Threshold Settings' : 'Create Master Catalog Record'}</h3>
                <form onSubmit={handleItemMasterSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={styles.fieldLabel}>Material Code *</label>
                    <input 
                      type="text" 
                      placeholder="e.g. MAT-CEM-001" 
                      value={itemMasterForm.materialCode}
                      onChange={e => setItemMasterForm({ ...itemMasterForm, materialCode: e.target.value })}
                      style={styles.formInput}
                      required
                    />
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Material Name *</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Portland Cement OPC" 
                      value={itemMasterForm.materialName}
                      onChange={e => setItemMasterForm({ ...itemMasterForm, materialName: e.target.value })}
                      style={styles.formInput}
                      required
                    />
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Material Category *</label>
                    <select
                      value={itemMasterForm.category}
                      onChange={e => setItemMasterForm({ ...itemMasterForm, category: e.target.value })}
                      style={styles.formSelect}
                      required
                    >
                      {[
                        'Cement & Concrete',
                        'Aggregates',
                        'Road Construction',
                        'Bridge Construction',
                        'Reinforcement Steel',
                        'Structural Steel',
                        'Railway Materials',
                        'Drainage & Culvert',
                        'Geotechnical',
                        'Formwork & Scaffolding',
                        'Fasteners & Hardware',
                        'Waterproofing & Joints',
                        'Safety Materials',
                        'Survey & Site',
                        'Miscellaneous',
                        'Other'
                      ].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Unit *</label>
                    <select
                      value={itemMasterForm.unit}
                      onChange={e => setItemMasterForm({ ...itemMasterForm, unit: e.target.value })}
                      style={styles.formSelect}
                      required
                    >
                      {['bag', 'kg', 'ton', 'piece', 'litre', 'm3'].map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Estimated Unit Cost (LKR) *</label>
                    <input
                      type="number"
                      min="0"
                      value={itemMasterForm.estimatedUnitCost}
                      onChange={e => setItemMasterForm({ ...itemMasterForm, estimatedUnitCost: e.target.value })}
                      style={styles.formInput}
                      required
                    />
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Status</label>
                    <select
                      value={itemMasterForm.status}
                      onChange={e => setItemMasterForm({ ...itemMasterForm, status: e.target.value })}
                      style={styles.formSelect}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={styles.fieldLabel}>Description (optional)</label>
                    <input
                      type="text"
                      value={itemMasterForm.description}
                      onChange={e => setItemMasterForm({ ...itemMasterForm, description: e.target.value })}
                      style={styles.formInput}
                      placeholder="e.g. 50kg Ordinary Portland Cement bags"
                    />
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Minimum Stock Level *</label>
                    <input 
                      type="number" 
                      value={itemMasterForm.minimumStock}
                      onChange={e => setItemMasterForm({ ...itemMasterForm, minimumStock: e.target.value })}
                      style={styles.formInput}
                      required
                    />
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Maximum Stock Level *</label>
                    <input 
                      type="number" 
                      value={itemMasterForm.maximumStock}
                      onChange={e => {
                        const max = Number(e.target.value);
                        setItemMasterForm({ 
                          ...itemMasterForm, 
                          maximumStock: max,
                          reorderLevel: Math.round(max * 0.5) 
                        });
                      }}
                      style={styles.formInput}
                      required
                    />
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Reorder Level * (Auto-set to 50% of Max, editable)</label>
                    <input 
                      type="number" 
                      value={itemMasterForm.reorderLevel}
                      onChange={e => setItemMasterForm({ ...itemMasterForm, reorderLevel: e.target.value })}
                      style={styles.formInput}
                      required
                    />
                  </div>
                  <div style={{ gridColumn: 'span 2', display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button type="submit" style={styles.orangeBtn}>Save Threshold Settings</button>
                    <button type="button" onClick={() => setShowItemMasterForm(false)} style={{ ...styles.orangeBtn, background: '#cbd5e1', color: '#1e293b' }}>Cancel</button>
                  </div>
                </form>
              </div>
            ) : (
              <div style={styles.tableContainer}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeaderRow}>
                      <th style={styles.th}>Material Code</th>
                      <th style={styles.th}>Material Name</th>
                      <th style={styles.th}>Category</th>
                      <th style={styles.th}>Unit</th>
                      <th style={styles.th}>Est. Unit Cost</th>
                      <th style={styles.th}>Min Level</th>
                      <th style={styles.th}>Reorder Level</th>
                      <th style={styles.th}>Max Level</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemMasterList.length === 0 ? (
                      <tr>
                        <td colSpan="10" style={styles.emptyState}>No Item Master records found. Click Add to get started.</td>
                      </tr>
                    ) : (
                      itemMasterList.map(item => (
                        <tr key={item._id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={styles.tdBold}>{item.materialCode}</td>
                          <td style={styles.td}>{item.materialName}</td>
                          <td style={styles.td}>{item.category}</td>
                          <td style={styles.td}>{item.unit}</td>
                          <td style={styles.td}>{Number(item.estimatedUnitCost || 0).toLocaleString()}</td>
                          <td style={styles.td}>{item.minimumStock}</td>
                          <td style={styles.td}>{item.reorderLevel}</td>
                          <td style={styles.td}>{item.maximumStock}</td>
                          <td style={styles.td}>
                            <span style={{
                              background: item.status === 'Inactive' ? '#ffebee' : '#e8f5e9',
                              color: item.status === 'Inactive' ? '#c62828' : '#2e7d32',
                              padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600'
                            }}>{item.status || 'Active'}</span>
                          </td>
                          <td style={styles.td}>
                            <button
                              onClick={() => handleItemMasterEditClick(item)}
                              style={{ background: '#1565c0', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '6px', fontWeight: 'bold' }}
                            >
                              ⚙️ Edit
                            </button>
                            <button
                              onClick={() => handleItemMasterToggleStatus(item)}
                              style={{ background: item.status === 'Inactive' ? '#2e7d32' : '#f57f17', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '6px', fontWeight: 'bold' }}
                            >
                              {item.status === 'Inactive' ? 'Activate' : 'Deactivate'}
                            </button>
                            <button
                              onClick={() => handleItemMasterDelete(item._id)}
                              style={{ background: '#c62828', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                            >
                              🗑 Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {view === 'min' && (
          <div style={styles.container}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h1 style={styles.pageTitle}>Material Issuance Notes</h1>
              <button onClick={fetchMINs} style={{ ...styles.orangeBtn, background: '#2563eb' }}>🔄 Refresh Requests</button>
            </div>

            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeaderRow}>
                    <th style={styles.th}>MIN No.</th>
                    <th style={styles.th}>Project / Requestor</th>
                    <th style={styles.th}>Requested Materials</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Notes</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {minList.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={styles.emptyState}>No Material Issuance Notes submitted yet.</td>
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
                            {m.materials.map((mat, i) => {
                              const mainMat = materials.find(x => x.name === mat.materialName && x.location === 'MainStore');
                              const isShort = mainMat ? mainMat.quantity < mat.quantity : true;
                              return (
                                <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
                                  <span>{mat.materialName} ({mat.quantity} {mat.unit})</span>
                                  {isShort && (
                                    <span style={{ background: '#fde8e8', color: '#c62828', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                                      Shortage ({mainMat ? mainMat.quantity : 0} avail)
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </td>
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
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  onClick={() => handleApproveMIN(m._id)}
                                  style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                                >
                                  Approve
                                </button>
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
              <button onClick={fetchData} style={{ ...styles.orangeBtn, background: '#2563eb' }}>🔄 Refresh</button>
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
                        <td style={styles.td}>
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
                          <td style={{ ...styles.tdBold }}>{it.name}</td>
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
    fontSize: '18px',
    fontWeight: '700',
    color: 'white',
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
