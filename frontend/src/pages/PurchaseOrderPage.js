import React, { useState, useEffect } from 'react';
import SettingsPage from './SettingsPage';
import { formatPhoneInput, isValidPhone, PHONE_PLACEHOLDER } from '../utils/phoneUtils';
import { formatDate } from '../utils/dateUtils';
import DateInput from '../components/DateInput';

const PurchaseOrderPage = ({ user, onLogout, onUserUpdate }) => {
  const [activePage, setActivePage] = useState('dashboard'); // 'dashboard', 'orders', 'suppliers'
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [prNotifications, setPrNotifications] = useState([]);
  const [prUnreadCount, setPrUnreadCount] = useState(0);
  const [pendingPRs, setPendingPRs] = useState([]);
  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [performanceData, setPerformanceData] = useState([]);
  const [modal, setModal] = useState(null);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [poSearchTerm, setPoSearchTerm] = useState('');

  // PO Form State
  const [form, setForm] = useState({
    prId: '',
    supplier: '',
    notes: '',
    expectedDeliveryDate: '',
    paymentTerms: '30 Days Credit',
    deliveryAddress: '',
    items: [{ materialName: '', quantity: '', unit: 'bag', unitPrice: '' }]
  });

  // Supplier Form State
  const [supForm, setSupForm] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    category: 'Cement',
    status: 'Active'
  });

  // Editing Supplier State
  const [editingSupplierId, setEditingSupplierId] = useState(null);
  const [editSupForm, setEditSupForm] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    category: 'Cement',
    status: 'Active'
  });

  // Rate Delivery popup state
  const [showRateModal, setShowRateModal] = useState(false);
  const [selectedPo, setSelectedPo] = useState(null);
  const [rateForm, setRateForm] = useState({
    actualDeliveryDate: new Date().toISOString().substring(0, 10),
    receivedQty: '',
    deliveryCondition: 'Good'
  });

  // Search Filter for Suppliers
  const [supplierSearch, setSupplierSearch] = useState('');

  const getHeaders = () => {
    const token = JSON.parse(localStorage.getItem('user'))?.token;
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };
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
    setError('');
    try {
      const headers = getHeaders();

      // Fetch POs
      const poRes = await fetch('http://localhost:5000/api/purchase-orders', { headers });
      const poData = await poRes.json();
      let orderList = poData.success ? poData.data : [];
      if (!orderList || orderList.length === 0) {
        orderList = [
          { _id: '1', poNumber: 'PO-2026-001', supplier: 'Lanka Cement Ltd', items: [{ materialName: 'Portland Cement OPC', quantity: 300, unit: 'bags', unitPrice: 1850 }], totalAmount: 555000, status: 'Sent', createdAt: new Date().toISOString() },
          { _id: '2', poNumber: 'PO-2026-002', supplier: 'Melwa Steel', items: [{ materialName: 'TMT Steel 12mm', quantity: 5, unit: 'ton', unitPrice: 185000 }], totalAmount: 925000, status: 'Delivered', createdAt: new Date(Date.now() - 86400000).toISOString() },
          { _id: '3', poNumber: 'PO-2026-003', supplier: 'Mahaweli Sand Co.', items: [{ materialName: 'River Sand', quantity: 20, unit: 'm3', unitPrice: 8500 }], totalAmount: 170000, status: 'Pending', createdAt: new Date(Date.now() - 172800000).toISOString() },
        ];
      }
      setOrders(orderList);

      // Fetch Suppliers
      const supRes = await fetch('http://localhost:5000/api/suppliers', { headers });
      const supData = await supRes.json();
      let rawSuppliers = supData.success ? supData.data : (Array.isArray(supData) ? supData : []);
      if (!rawSuppliers || rawSuppliers.length === 0) {
        rawSuppliers = [
          { _id: '1', name: 'Lanka Cement Ltd', contactPerson: 'Nimal Perera', phone: '0711122334', email: 'nimal@lankacement.lk', category: 'Cement', status: 'Active' },
          { _id: '2', name: 'Melwa Steel', contactPerson: 'Kamal Silva', phone: '0722233445', email: 'kamal@melwa.lk', category: 'Steel', status: 'Active' },
          { _id: '3', name: 'Mahaweli Sand Co.', contactPerson: 'Sunil Silva', phone: '0777345678', email: 'sunil@mahawelisand.lk', category: 'Sand', status: 'Active' }
        ];
      }
      setSuppliers(rawSuppliers);

      // Fetch Pending PRs (not yet converted into a PO)
      const prRes = await fetch('http://localhost:5000/api/purchase-requests?status=Pending', { headers });
      const prData = await prRes.json();
      if (prData.success) setPendingPRs(prData.data);

      // Fetch ALL PRs
      const allPrRes = await fetch('http://localhost:5000/api/purchase-requests', { headers });
      const allPrData = await allPrRes.json();
      let prList = allPrData.success ? allPrData.data : [];
      if (!prList || prList.length === 0) {
        prList = [
          { _id: '1', prNumber: 'PR-2026-001', projectName: 'Colombo Port Expansion', materials: [{ materialName: 'Portland Cement OPC', quantity: 150, unit: 'bags' }], urgency: 'Normal', status: 'Pending', notes: 'Need for foundation casting.', createdAt: new Date().toISOString() },
          { _id: '2', prNumber: 'PR-2026-002', projectName: 'Marina Heights', materials: [{ materialName: 'TMT Steel 12mm', quantity: 8, unit: 'ton' }], urgency: 'Urgent', status: 'Approved', notes: 'Urgent column structure reinforcement.', createdAt: new Date(Date.now() - 86400000).toISOString() },
          { _id: '3', prNumber: 'PR-2026-003', projectName: 'Highway Extension Project', materials: [{ materialName: 'River Sand', quantity: 30, unit: 'cube' }], urgency: 'Critical', status: 'Pending', notes: 'Urgent supply for concrete mixing.', createdAt: new Date(Date.now() - 172800000).toISOString() },
          { _id: '4', prNumber: 'PR-2026-004', projectName: 'City Center Mall', materials: [{ materialName: 'Coarse Aggregate', quantity: 45, unit: 'cube' }], urgency: 'Normal', status: 'Rejected', notes: 'Excess materials on site.', createdAt: new Date(Date.now() - 259200000).toISOString() }
        ];
      }
      setPurchaseRequests(prList);

      // Fetch Supplier Performance
      const perfRes = await fetch('http://localhost:5000/api/purchase-orders/supplier-performance', { headers });
      const perfData = await perfRes.json();
      let rawPerf = perfData.success ? perfData.data : [];
      if (!rawPerf || rawPerf.length === 0) {
        rawPerf = [
          { supplierName: 'Lanka Cement Ltd', totalOrders: 5, onTimeDeliveries: 4, onTimePercent: 80, deliveryAccuracy: 96.5, performanceRating: 'Excellent' },
          { supplierName: 'Melwa Steel', totalOrders: 3, onTimeDeliveries: 3, onTimePercent: 100, deliveryAccuracy: 100, performanceRating: 'Excellent' },
          { supplierName: 'Mahaweli Sand Co.', totalOrders: 2, onTimeDeliveries: 2, onTimePercent: 100, deliveryAccuracy: 98.0, performanceRating: 'Excellent' }
        ];
      }
      setPerformanceData(rawPerf);

    } catch (err) {
      setError('Could not connect to the backend server. Loading fallback demo data.');
      setOrders([
        { _id: '1', poNumber: 'PO-2026-001', supplier: 'Lanka Cement Ltd', items: [{ materialName: 'Portland Cement OPC', quantity: 300, unit: 'bags', unitPrice: 1850 }], totalAmount: 555000, status: 'Sent', createdAt: new Date().toISOString() },
        { _id: '2', poNumber: 'PO-2026-002', supplier: 'Melwa Steel', items: [{ materialName: 'TMT Steel 12mm', quantity: 5, unit: 'ton', unitPrice: 185000 }], totalAmount: 925000, status: 'Delivered', createdAt: new Date(Date.now() - 86400000).toISOString() },
        { _id: '3', poNumber: 'PO-2026-003', supplier: 'Mahaweli Sand Co.', items: [{ materialName: 'River Sand', quantity: 20, unit: 'm3', unitPrice: 8500 }], totalAmount: 170000, status: 'Pending', createdAt: new Date(Date.now() - 172800000).toISOString() },
      ]);
      setSuppliers([
        { _id: '1', name: 'Lanka Cement Ltd', contactPerson: 'Nimal Perera', phone: '0711122334', email: 'nimal@lankacement.lk', category: 'Cement', status: 'Active' },
        { _id: '2', name: 'Melwa Steel', contactPerson: 'Kamal Silva', phone: '0722233445', email: 'kamal@melwa.lk', category: 'Steel', status: 'Active' },
      ]);
      setPerformanceData([
        { supplierName: 'Lanka Cement Ltd', totalOrders: 5, onTimeDeliveries: 4, onTimePercent: 80, deliveryAccuracy: 96.5, performanceRating: 'Excellent' },
        { supplierName: 'Melwa Steel', totalOrders: 3, onTimeDeliveries: 3, onTimePercent: 100, deliveryAccuracy: 100, performanceRating: 'Excellent' },
      ]);
      setPurchaseRequests([
        { _id: '1', prNumber: 'PR-2026-001', projectName: 'Colombo Port Expansion', materials: [{ materialName: 'Portland Cement OPC', quantity: 150, unit: 'bags' }], urgency: 'Normal', status: 'Pending', notes: 'Need for foundation casting.', createdAt: new Date().toISOString() },
        { _id: '2', prNumber: 'PR-2026-002', projectName: 'Marina Heights', materials: [{ materialName: 'TMT Steel 12mm', quantity: 8, unit: 'ton' }], urgency: 'Urgent', status: 'Approved', notes: 'Urgent column structure reinforcement.', createdAt: new Date(Date.now() - 86400000).toISOString() },
        { _id: '3', prNumber: 'PR-2026-003', projectName: 'Highway Extension Project', materials: [{ materialName: 'River Sand', quantity: 30, unit: 'cube' }], urgency: 'Critical', status: 'Pending', notes: 'Urgent supply for concrete mixing.', createdAt: new Date(Date.now() - 172800000).toISOString() },
        { _id: '4', prNumber: 'PR-2026-004', projectName: 'City Center Mall', materials: [{ materialName: 'Coarse Aggregate', quantity: 45, unit: 'cube' }], urgency: 'Normal', status: 'Rejected', notes: 'Excess materials on site.', createdAt: new Date(Date.now() - 259200000).toISOString() }
      ]);
    }
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

  // Fetches PR-submitted / PO-approved / PO-rejected notifications addressed to
  // this Purchase Manager, separate from the low-stock inventory alerts above.
  const fetchPrNotifications = async () => {
    if (!hasSession()) return;
    try {
      const res = await fetch('http://localhost:5000/api/notifications', { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        setPrNotifications(data.data || []);
        setPrUnreadCount((data.data || []).filter(n => !n.isRead).length);
      }
    } catch (err) {
      console.error('Error fetching PR/PO notifications:', err);
    }
  };

  const handleMarkNotificationRead = async (notif) => {
    try {
      await fetch(`http://localhost:5000/api/notifications/${notif._id}/read`, {
        method: 'PUT',
        headers: getHeaders()
      });
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
    setPrNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, isRead: true } : n));
    setPrUnreadCount(prev => Math.max(0, prev - 1));
    if (notif.link) setActivePage('prs');
  };

  useEffect(() => {
    fetchData();
    fetchNotifications();
    fetchPrNotifications();

    const interval = setInterval(() => {
      fetchData();
      fetchNotifications();
      fetchPrNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handlePrSelectChange = (prId) => {
    const selected = pendingPRs.find(pr => pr._id === prId);
    if (selected && selected.materials) {
      const items = selected.materials.map(m => ({
        materialName: m.materialName || m.name,
        quantity: m.quantity,
        unit: m.unit || 'bag',
        unitPrice: m.estimatedUnitCost ?? ''
      }));
      setForm({ ...form, prId, items });
    } else {
      setForm({ ...form, prId, items: [{ materialName: '', quantity: '', unit: 'bag', unitPrice: '' }] });
    }
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { materialName: '', quantity: '', unit: 'bag', unitPrice: '' }] });
  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  const updateItem = (index, field, value) => {
    const updated = [...form.items];
    updated[index][field] = value;
    setForm({ ...form, items: updated });
  };

  const calcTotal = () => form.items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0), 0);

  const handlePOSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    try {
      const res = await fetch('http://localhost:5000/api/purchase-orders', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ ...form, totalAmount: calcTotal() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage('✅ Purchase Order created successfully!');
        setShowForm(false);
        setForm({
          prId: '',
          supplier: '',
          notes: '',
          expectedDeliveryDate: '',
          paymentTerms: '30 Days Credit',
          deliveryAddress: '',
          items: [{ materialName: '', quantity: '', unit: 'bag', unitPrice: '' }]
        });
        fetchData();
      } else {
        setError(data.message || 'Failed to create PO.');
      }
    } catch {
      setError('Connection failed. Mock PO saved.');
    }
  };

  const handleUpdateStatus = async (id, status) => {
    setError(''); setMessage('');
    try {
      const res = await fetch(`http://localhost:5000/api/purchase-orders/${id}/status`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage(`✅ PO status updated to ${status}!`);
        fetchData();
      } else {
        setError('Failed to update status.');
      }
    } catch {
      setMessage(`✅ PO status updated to ${status}! (Demo Mode)`);
      setOrders(prev => prev.map(o => o._id === id ? { ...o, status } : o));
    }
  };

  const handleConvertToPO = (pr) => {
    setForm({
      prId: pr._id,
      supplier: '',
      notes: pr.notes || `Derived from PR for project ${pr.projectName}`,
      expectedDeliveryDate: '',
      paymentTerms: '30 Days Credit',
      deliveryAddress: '',
      items: pr.materials.map(m => ({
        materialName: m.materialName,
        quantity: m.quantity,
        unit: m.unit || 'bags',
        unitPrice: m.estimatedUnitCost ?? '' // prefilled from the approved BOM's cost estimate
      }))
    });
    setShowForm(true);
    setActivePage('orders');
  };

  const handleSendToSupplier = async (id, poNumber, supplierName) => {
    setError(''); setMessage('');
    try {
      const res = await fetch(`http://localhost:5000/api/purchase-orders/${id}/send`, {
        method: 'PUT',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage(`✅ ${poNumber} sent to ${supplierName} successfully!`);
        fetchData();
      } else {
        setError(data.message || 'Failed to send PO.');
      }
    } catch {
      setMessage(`✅ ${poNumber} sent to ${supplierName} successfully! (Demo Mode)`);
      setOrders(prev => prev.map(o => o._id === id ? { ...o, status: 'Sent', sentAt: new Date().toISOString() } : o));
    }
  };

  const handleRateClick = (po) => {
    setSelectedPo(po);
    const totalQty = po.items ? po.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
    setRateForm({
      actualDeliveryDate: new Date().toISOString().substring(0, 10),
      receivedQty: po.receivedQty || totalQty,
      deliveryCondition: po.deliveryCondition || 'Good'
    });
    setShowRateModal(true);
  };

  const handleRateSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    try {
      const res = await fetch(`http://localhost:5000/api/purchase-orders/${selectedPo._id}/rate-delivery`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(rateForm)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage('✅ PO delivery rated successfully!');
        setShowRateModal(false);
        fetchData();
      } else {
        setError(data.message || 'Failed to rate delivery.');
      }
    } catch {
      setMessage('✅ PO delivery rated successfully! (Demo Mode)');
      setOrders(prev => prev.map(o => o._id === selectedPo._id ? { ...o, status: 'Delivered', actualDeliveryDate: rateForm.actualDeliveryDate, receivedQty: Number(rateForm.receivedQty), deliveryCondition: rateForm.deliveryCondition } : o));
      setShowRateModal(false);
    }
  };

  const handleSupplierSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    if (!isValidPhone(supForm.phone)) {
      setError(`Phone number must be a 10-digit number, e.g. ${PHONE_PLACEHOLDER}.`);
      return;
    }
    try {
      const res = await fetch('http://localhost:5000/api/suppliers/add', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(supForm)
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('✅ Supplier added successfully!');
        setShowSupplierForm(false);
        setSupForm({ name: '', contactPerson: '', phone: '', email: '', address: '', category: 'Cement', status: 'Active' });
        fetchData();
      } else {
        setError(data.message || 'Failed to add supplier.');
      }
    } catch {
      setError('Connection failed.');
    }
  };

  const handleSupplierDeactivate = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this supplier?')) return;
    setError(''); setMessage('');
    try {
      const res = await fetch(`http://localhost:5000/api/suppliers/${id}/deactivate`, {
        method: 'PUT',
        headers: getHeaders()
      });
      if (res.ok) {
        setMessage('✅ Supplier deactivated successfully!');
        fetchData();
      } else {
        setError('Failed to deactivate supplier.');
      }
    } catch {
      setMessage('✅ Supplier deactivated! (Demo Mode)');
      setSuppliers(prev => prev.map(s => s._id === id ? { ...s, status: 'Inactive' } : s));
    }
  };

  const handleSupplierEditClick = (s) => {
    setEditingSupplierId(s._id);
    setEditSupForm({
      name: s.name,
      contactPerson: s.contactPerson || '',
      phone: s.phone,
      email: s.email || '',
      address: s.address || '',
      category: s.category,
      status: s.status
    });
  };

  const handleSupplierEditSave = async (e, id) => {
    e.preventDefault();
    setError(''); setMessage('');
    if (!isValidPhone(editSupForm.phone)) {
      setError(`Phone number must be a 10-digit number, e.g. ${PHONE_PLACEHOLDER}.`);
      return;
    }
    try {
      const res = await fetch(`http://localhost:5000/api/suppliers/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(editSupForm)
      });
      if (res.ok) {
        setMessage('✅ Supplier updated successfully!');
        setEditingSupplierId(null);
        fetchData();
      } else {
        setError('Failed to update supplier.');
      }
    } catch {
      setError('Connection failed.');
    }
  };

  // Stats Calculations
  const stats = [
    { label: 'Total POs', value: orders.length, color: '#1565c0', type: 'total-pos' },
    { label: 'Pending POs', value: orders.filter(o => o.status === 'Pending').length, color: '#1e3a8a', type: 'pending-pos' },
    { label: 'Sent POs', value: orders.filter(o => o.status === 'Sent').length, color: '#1565c0', type: 'sent-pos' },
    { label: 'Delivered POs', value: orders.filter(o => o.status === 'Delivered').length, color: '#2e7d32', type: 'delivered-pos' },
  ];

  const supplierStats = [
    { label: 'Total Suppliers', value: suppliers.length, color: '#1565c0' },
    { label: 'Active Suppliers', value: suppliers.filter(s => s.status === 'Active').length, color: '#2e7d32' },
    { label: 'Inactive Suppliers', value: suppliers.filter(s => s.status === 'Inactive').length, color: '#c62828' },
  ];

  const filteredSuppliers = suppliers.filter(s =>
    s.name?.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    s.category?.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  const renderPOStatsModal = () => {
    if (!modal) return null;

    let title = '';
    let tableHeaders = [];
    let tableRows = [];
    
    const query = modalSearchTerm.toLowerCase();

    if (modal === 'total-pos') {
      title = 'Total Purchase Orders';
      tableHeaders = ['PO Number', 'Supplier', 'Items Description', 'Total (LKR)', 'Status', 'Date'];
      
      const filtered = orders.filter(o => 
        (o.poNumber || '').toLowerCase().includes(query) ||
        (o.supplier || '').toLowerCase().includes(query)
      );

      tableRows = filtered.map((po, idx) => (
        <tr key={po._id || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1565c0', fontWeight: '600' }}>{po.poNumber}</td>
          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500' }}>{po.supplier}</td>
          <td style={{ padding: '12px 16px', fontSize: '12px', color: '#555' }}>
            {po.items?.map((item, idx) => (
              <div key={idx}>{item.materialName} ×{item.quantity} {item.unit} (LKR {item.unitPrice})</div>
            ))}
          </td>
          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#0d1b4b' }}>
            {po.totalAmount?.toLocaleString()}
          </td>
          <td style={{ padding: '12px 16px' }}>
            <span style={{
              background: po.status === 'Delivered' ? '#e8f5e9' : po.status === 'Sent' ? '#e3f2fd' : '#dbeafe',
              color: po.status === 'Delivered' ? '#2e7d32' : po.status === 'Sent' ? '#1565c0' : '#1e3a8a',
              padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold'
            }}>{po.status}</span>
          </td>
          <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>{formatDate(po.createdAt)}</td>
        </tr>
      ));
    } else if (modal === 'pending-pos') {
      title = 'Pending Purchase Orders';
      tableHeaders = ['PO Number', 'Supplier', 'Items Description', 'Total (LKR)', 'Date', 'Actions'];
      
      const pendingPOs = orders.filter(o => o.status === 'Pending');
      const filtered = pendingPOs.filter(o => 
        (o.poNumber || '').toLowerCase().includes(query) ||
        (o.supplier || '').toLowerCase().includes(query)
      );

      tableRows = filtered.map((po, idx) => (
        <tr key={po._id || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1565c0', fontWeight: '600' }}>{po.poNumber}</td>
          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500' }}>{po.supplier}</td>
          <td style={{ padding: '12px 16px', fontSize: '12px', color: '#555' }}>
            {po.items?.map((item, idx) => (
              <div key={idx}>{item.materialName} ×{item.quantity} {item.unit}</div>
            ))}
          </td>
          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#0d1b4b' }}>
            {po.totalAmount?.toLocaleString()}
          </td>
          <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>{formatDate(po.createdAt)}</td>
          <td style={{ padding: '12px 16px' }}>
            <button 
              onClick={() => { setModal(null); handleSendToSupplier(po._id, po.poNumber, po.supplier); }}
              style={{ background: '#2563eb', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
            >
              🚀 Send to Supplier
            </button>
          </td>
        </tr>
      ));
    } else if (modal === 'sent-pos') {
      title = 'Sent Purchase Orders';
      tableHeaders = ['PO Number', 'Supplier', 'Items Description', 'Total (LKR)', 'Sent Date', 'Expected Delivery Date'];
      
      const sentPOs = orders.filter(o => o.status === 'Sent');
      const filtered = sentPOs.filter(o => 
        (o.poNumber || '').toLowerCase().includes(query) ||
        (o.supplier || '').toLowerCase().includes(query)
      );

      tableRows = filtered.map((po, idx) => (
        <tr key={po._id || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1565c0', fontWeight: '600' }}>{po.poNumber}</td>
          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500' }}>{po.supplier}</td>
          <td style={{ padding: '12px 16px', fontSize: '12px', color: '#555' }}>
            {po.items?.map((item, idx) => (
              <div key={idx}>{item.materialName} ×{item.quantity} {item.unit}</div>
            ))}
          </td>
          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#0d1b4b' }}>
            {po.totalAmount?.toLocaleString()}
          </td>
          <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>{po.sentAt ? formatDate(po.sentAt) : formatDate(po.createdAt)}</td>
          <td style={{ padding: '12px 16px', fontSize: '12px', color: '#2563eb', fontWeight: 'bold' }}>{po.expectedDeliveryDate ? formatDate(po.expectedDeliveryDate) : 'N/A'}</td>
        </tr>
      ));
    } else if (modal === 'delivered-pos') {
      title = 'Delivered Purchase Orders';
      tableHeaders = ['PO Number', 'Supplier', 'Items Description', 'Total (LKR)', 'Delivery Date', 'GRN Status / Details'];
      
      const deliveredPOs = orders.filter(o => o.status === 'Delivered');
      const filtered = deliveredPOs.filter(o => 
        (o.poNumber || '').toLowerCase().includes(query) ||
        (o.supplier || '').toLowerCase().includes(query)
      );

      tableRows = filtered.map((po, idx) => (
        <tr key={po._id || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1565c0', fontWeight: '600' }}>{po.poNumber}</td>
          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500' }}>{po.supplier}</td>
          <td style={{ padding: '12px 16px', fontSize: '12px', color: '#555' }}>
            {po.items?.map((item, idx) => (
              <div key={idx}>{item.materialName} ×{item.quantity} {item.unit}</div>
            ))}
          </td>
          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600' }}>{po.totalAmount?.toLocaleString()}</td>
          <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>{po.actualDeliveryDate ? formatDate(po.actualDeliveryDate) : 'N/A'}</td>
          <td style={{ padding: '12px 16px', fontSize: '12px' }}>
            <div>Received Qty: <strong>{po.receivedQty || 'Full'}</strong></div>
            <div style={{ color: po.deliveryCondition === 'Good' ? '#2e7d32' : '#c62828', fontWeight: 'bold' }}>
              Condition: {po.deliveryCondition || 'Good'}
            </div>
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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Segoe UI, Arial, sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width: '240px', background: '#0d1b4b', color: 'white', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh', zIndex: 100 }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/els-logo.png" alt="ELS Logo" style={{ width: '38px', height: '38px', objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: 'white' }}>ELS CMMS</div>
            <div style={{ fontSize: '11px', color: '#2563eb' }}>Procurement</div>
          </div>
        </div>
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px' }}>
            {user?.name?.charAt(0).toUpperCase() || 'P'}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600' }}>{user?.name || 'Purchase Manager'}</div>
            <div style={{ fontSize: '11px', color: '#cbd5e1' }}>Purchase Manager</div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: '⊞' },
            { id: 'prs', label: 'Purchase Request', icon: '📋' },
            { id: 'orders', label: 'Purchase Orders', icon: '📦' },
            { id: 'suppliers', label: 'Suppliers Registry', icon: '🏭' },
            { id: 'performance', label: 'Supplier Performance', icon: '📈' },
            { id: 'settings', label: 'Settings', icon: '⚙️' },
          ].map(item => (
            <div key={item.id} onClick={() => { setActivePage(item.id); setError(''); setMessage(''); }}
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
      <div style={{ marginLeft: '240px', flex: 1, background: '#f5f6fa', minHeight: '100vh' }}>
        <div style={{ background: 'white', padding: '16px 24px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: '#0d1b4b' }}>
            {activePage === 'dashboard' && 'Dashboard'}
            {activePage === 'prs' && 'Purchase Request'}
            {activePage === 'orders' && 'Purchase Orders Catalog'}
            {activePage === 'suppliers' && 'Supplier Registry'}
            {activePage === 'performance' && 'Supplier Performance Evaluation'}
            {activePage === 'settings' && 'User Settings & Preferences'}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {/* Notification Bell */}
            <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setShowNotifications(!showNotifications)}>
              <span style={{ fontSize: '20px' }}>🔔</span>
              {(unreadCount + prUnreadCount) > 0 && (
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
                  {unreadCount + prUnreadCount}
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
                    Purchase Request & Order Updates
                  </div>
                  {prNotifications.length === 0 ? (
                    <div style={{ padding: '16px', color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
                      No PR/PO updates yet.
                    </div>
                  ) : (
                    prNotifications.map((notif) => {
                      const type = (notif.type || '').toLowerCase();
                      const isApproved = type === 'po_approved';
                      const isRejected = type === 'po_rejected';
                      const label = isApproved ? 'PO Approved' : isRejected ? 'PO Rejected' : 'New PR';
                      const color = isApproved ? '#2e7d32' : isRejected ? '#c62828' : '#1e3a8a';
                      const bg = isApproved ? '#e8f5e9' : isRejected ? '#ffebee' : '#dbeafe';
                      return (
                        <div
                          key={notif._id}
                          onClick={() => handleMarkNotificationRead(notif)}
                          style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid #f1f5f9',
                            fontSize: '13px',
                            cursor: 'pointer',
                            background: notif.isRead ? 'white' : '#f8fafc'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ color: '#0d1b4b', fontWeight: notif.isRead ? '500' : '700' }}>{notif.message}</span>
                            <span style={{ color, background: bg, padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                              {label}
                            </span>
                          </div>
                          <div style={{ color: '#64748b', fontSize: '11px' }}>
                            {formatDate(notif.createdAt)}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', borderTop: '1px solid #e2e8f0', fontWeight: 'bold', color: '#0d1b4b', fontSize: '14px' }}>
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

            <div style={{ display: 'flex', gap: '10px' }}>
              {activePage === 'suppliers' && user?.role === 'Admin' && (
                <button onClick={() => setShowSupplierForm(!showSupplierForm)}
                  style={{ background: '#2563eb', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
                  {showSupplierForm ? 'Hide Form' : '+ Add Supplier'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          {error && <div style={{ background: '#ffebee', border: '1px solid #ef5350', color: '#c62828', padding: '10px 16px', borderRadius: '6px', marginBottom: '16px' }}>{error}</div>}
          {message && <div style={{ background: '#e8f5e9', border: '1px solid #4caf50', color: '#2e7d32', padding: '10px 16px', borderRadius: '6px', marginBottom: '16px' }}>{message}</div>}

          {/* Stats Bar */}
          {activePage === 'settings' ? null : activePage !== 'suppliers' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
              {stats.map((s, i) => (
                <div 
                  key={i} 
                  onClick={() => {
                    setModal(s.type);
                    setModalSearchTerm('');
                  }}
                  style={{ 
                    background: 'white', 
                    borderRadius: '8px', 
                    padding: '20px', 
                    boxShadow: '0 1px 4px rgba(0,0,0,0.1)', 
                    borderTop: `4px solid ${s.color}`,
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                  className="hover-card"
                >
                  <div style={{ fontSize: '28px', fontWeight: '700', color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>{s.label}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
              {supplierStats.map((s, i) => (
                <div key={i} style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', borderTop: `4px solid ${s.color}` }}>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {activePage === 'dashboard' && (
            <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', background: '#0d1b4b' }}>
                <h3 style={{ margin: 0, color: 'white', fontSize: '15px' }}>📦 Recent Purchase Orders</h3>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f5f6fa' }}>
                    {['PO No.', 'Supplier', 'Total (LKR)', 'Date', 'Status'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#666', fontWeight: '600' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 5).map((po, i) => (
                    <tr key={po._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1565c0', fontWeight: '600' }}>{po.poNumber}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500', color: '#1e293b' }}>{po.supplier}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{po.totalAmount?.toLocaleString()}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>{formatDate(po.createdAt)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          background: po.status === 'Delivered' ? '#e8f5e9' : po.status === 'Sent' ? '#e3f2fd' : '#dbeafe',
                          color: po.status === 'Delivered' ? '#2e7d32' : po.status === 'Sent' ? '#1565c0' : '#1e3a8a',
                          padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold'
                        }}>{po.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activePage === 'dashboard' && (
            <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', overflow: 'hidden', marginTop: '24px' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', background: '#0d1b4b' }}>
                <h3 style={{ margin: 0, color: 'white', fontSize: '15px' }}>📋 Recent Purchase Requests</h3>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f5f6fa' }}>
                    {['PR No.', 'Project Name', 'Material Details', 'Urgency', 'Date', 'Status'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#666', fontWeight: '600' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {purchaseRequests.slice(0, 5).map((pr, i) => (
                    <tr key={pr._id || i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1565c0', fontWeight: '600' }}>{pr.prNumber || `PR-2026-${String(i+1).padStart(3,'0')}`}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500', color: '#1e293b' }}>{pr.projectName || pr.project}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#555' }}>
                        {pr.materials?.map((m, idx) => (
                          <div key={idx}>{m.materialName} ×{m.quantity} {m.unit || 'bags'}</div>
                        ))}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px' }}>
                        <span style={{
                          background: pr.urgency === 'Critical' ? '#fee2e2' : pr.urgency === 'Urgent' ? '#fff7ed' : '#e0f2fe',
                          color: pr.urgency === 'Critical' ? '#991b1b' : pr.urgency === 'Urgent' ? '#c2410c' : '#0369a1',
                          padding: '2px 8px', borderRadius: '4px', fontWeight: '600'
                        }}>{pr.urgency}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>{formatDate(pr.createdAt)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          background: pr.status === 'PO Created' ? '#e0f2f1' : '#f1f5f9',
                          color: pr.status === 'PO Created' ? '#004d40' : '#475569',
                          padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold'
                        }}>{pr.status}</span>
                      </td>
                    </tr>
                  ))}
                  {purchaseRequests.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No Purchase Requests available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activePage === 'prs' && (
            <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', background: '#0d1b4b' }}>
                <h3 style={{ margin: 0, color: 'white', fontSize: '15px' }}>📋 Main Store Purchase Requests</h3>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f5f6fa' }}>
                    {['PR Number', 'Project Name', 'Material Details', 'Urgency', 'Notes', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#666', fontWeight: '600' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {purchaseRequests.map((pr, i) => (
                    <tr key={pr._id || i} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1565c0', fontWeight: '600' }}>{pr.prNumber || `PR-2026-${String(i+1).padStart(3,'0')}`}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500', color: '#1e293b' }}>{pr.projectName || pr.project || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#555' }}>
                        {pr.materials?.map((m, idx) => (
                          <div key={idx}><strong>{m.materialName}</strong>: {m.quantity} {m.unit || 'bags'}</div>
                        ))}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px' }}>
                        <span style={{
                          background: pr.urgency === 'Critical' ? '#fee2e2' : pr.urgency === 'Urgent' ? '#fff7ed' : '#e0f2fe',
                          color: pr.urgency === 'Critical' ? '#991b1b' : pr.urgency === 'Urgent' ? '#c2410c' : '#0369a1',
                          padding: '2px 8px', borderRadius: '4px', fontWeight: '600'
                        }}>{pr.urgency}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b' }}>{pr.notes || '-'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          background: pr.status === 'PO Created' ? '#e0f2f1' : '#f1f5f9',
                          color: pr.status === 'PO Created' ? '#004d40' : '#475569',
                          padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold'
                        }}>{pr.status}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {pr.status === 'Pending' && (
                            <button onClick={() => handleConvertToPO(pr)}
                              style={{ background: '#2563eb', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                              Convert to PO
                            </button>
                          )}
                          {pr.status === 'PO Created' && (
                            <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>PO already created</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {purchaseRequests.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No Purchase Requests available from the Main Store.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activePage === 'orders' && (
            <div>
              <div style={{ background: 'white', borderRadius: '8px', padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                <div style={{ position: 'relative', width: '320px' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '14px' }}>🔍</span>
                  <input
                    type="text"
                    placeholder="Search purchase orders..."
                    value={poSearchTerm}
                    onChange={(e) => setPoSearchTerm(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <button onClick={() => setShowForm(!showForm)}
                  style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', boxShadow: '0 2px 6px rgba(37,99,235,0.3)', whiteSpace: 'nowrap' }}>
                  {showForm ? 'Hide Form' : '+ Create PO'}
                </button>
              </div>

              {/* Create PO Form */}
              {showForm && (
                <div style={{ background: 'white', borderRadius: '8px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', border: '1px solid #2563eb' }}>
                  <h3 style={{ margin: '0 0 20px', color: '#0d1b4b' }}>Create New Purchase Order</h3>
                  <form onSubmit={handlePOSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: '600' }}>SELECT PURCHASE REQUEST (PR)</label>
                        <select value={form.prId} onChange={e => handlePrSelectChange(e.target.value)}
                          style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' }}>
                          <option value="">-- Create PO without PR (Manual) --</option>
                          {pendingPRs.map(pr => (
                            <option key={pr._id} value={pr._id}>{pr.projectName || pr.project} (Pending PR)</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: '600' }}>SELECT SUPPLIER *</label>
                        <select value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} required
                          style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' }}>
                          <option value="">-- Select Supplier --</option>
                          {suppliers.filter(s => s.status === 'Active').map(s => (
                            <option key={s._id} value={s.name}>{s.name} ({s.category})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <h4 style={{ color: '#0d1b4b', marginBottom: '12px' }}>Order Items Specification</h4>
                    {form.items.map((item, index) => (
                      <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                        <input placeholder="Material Name" value={item.materialName}
                          onChange={e => updateItem(index, 'materialName', e.target.value)} required
                          style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }} />
                        <input type="number" placeholder="Qty" value={item.quantity}
                          onChange={e => updateItem(index, 'quantity', e.target.value)} required
                          style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }} />
                        <select value={item.unit} onChange={e => updateItem(index, 'unit', e.target.value)}
                          style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}>
                          {!['kg', 'ton', 'bag', 'bags', 'm3', 'litre', 'piece'].includes(item.unit) && item.unit && (
                            <option value={item.unit}>{item.unit}</option>
                          )}
                          {['kg', 'ton', 'bag', 'bags', 'm3', 'litre', 'piece'].map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        <input type="number" placeholder="Unit Price (LKR)" value={item.unitPrice}
                          onChange={e => updateItem(index, 'unitPrice', e.target.value)} required
                          style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }} />
                        {form.items.length > 1 && (
                          <button type="button" onClick={() => removeItem(index)}
                            style={{ background: '#ffebee', color: '#c62828', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}>✕</button>
                        )}
                      </div>
                    ))}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <button type="button" onClick={addItem}
                        style={{ background: '#e3f2fd', color: '#1565c0', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                        + Add Custom Item
                      </button>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: '#0d1b4b' }}>
                        Total PO Amount: LKR {calcTotal().toLocaleString()}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: '600' }}>EXPECTED DELIVERY DATE *</label>
                        <DateInput value={form.expectedDeliveryDate || ''} onChange={iso => setForm({ ...form, expectedDeliveryDate: iso })} required
                          style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: '600' }}>PAYMENT TERMS *</label>
                        <select value={form.paymentTerms || ''} onChange={e => setForm({ ...form, paymentTerms: e.target.value })} required
                          style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' }}>
                          <option value="30 Days Credit">30 Days Credit</option>
                          <option value="Cash on Delivery">Cash on Delivery</option>
                          <option value="50% Advance">50% Advance</option>
                          <option value="Full Payment">Full Payment</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: '600' }}>DELIVERY ADDRESS *</label>
                        <input placeholder="Enter delivery address..." value={form.deliveryAddress || ''} onChange={e => setForm({ ...form, deliveryAddress: e.target.value })} required
                          style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' }} />
                      </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: '600' }}>NOTES</label>
                      <input placeholder="Enter terms, remarks or delivery location..." value={form.notes}
                        onChange={e => setForm({ ...form, notes: e.target.value })}
                        style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' }} />
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button type="submit" style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
                        Submit Purchase Order
                      </button>
                      <button type="button" onClick={() => setShowForm(false)}
                        style={{ background: '#f5f5f5', color: '#333', border: '1px solid #ddd', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Purchase Orders Table */}
              <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#0d1b4b', color: 'white' }}>
                      {['PO No.', 'Supplier', 'Order Items Description', 'Total (LKR)', 'Expected Delivery', 'Payment Terms', 'Created Date', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const query = poSearchTerm.trim().toLowerCase();
                      const filteredOrders = !query ? orders : orders.filter(po =>
                        (po.poNumber || '').toLowerCase().includes(query) ||
                        (po.supplier || '').toLowerCase().includes(query) ||
                        (po.status || '').toLowerCase().includes(query) ||
                        (po.items || []).some(item => (item.materialName || '').toLowerCase().includes(query))
                      );
                      if (filteredOrders.length === 0) {
                        return (
                          <tr>
                            <td colSpan="9" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>No purchase orders match your search criteria.</td>
                          </tr>
                        );
                      }
                      return filteredOrders.map((po, i) => (
                      <tr key={po._id} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1565c0', fontWeight: '600' }}>{po.poNumber}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                          {['Pending', 'Approved'].includes(po.status) ? (
                            <select 
                              value={po.supplierId || suppliers.find(s => s.name === po.supplier)?._id || ''}
                              onChange={async (e) => {
                                const supplierId = e.target.value;
                                if (!supplierId) return;
                                try {
                                  const token = JSON.parse(localStorage.getItem('user'))?.token;
                                  const res = await fetch(`http://localhost:5000/api/purchase-orders/${po._id}/supplier`, {
                                    method: 'PUT',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      Authorization: `Bearer ${token}`
                                    },
                                    body: JSON.stringify({ supplier: supplierId })
                                  });
                                  if (res.ok) {
                                    setMessage('✅ Supplier assigned successfully!');
                                    fetchData();
                                  } else {
                                    // Fallback for Demo Mode
                                    const supName = suppliers.find(s => s._id === supplierId)?.name || 'Supplier';
                                    setOrders(prev => prev.map(o => o._id === po._id ? { ...o, supplier: supName } : o));
                                    setMessage('✅ Supplier assigned successfully! (Demo Mode)');
                                  }
                                } catch {
                                  const supName = suppliers.find(s => s._id === supplierId)?.name || 'Supplier';
                                  setOrders(prev => prev.map(o => o._id === po._id ? { ...o, supplier: supName } : o));
                                  setMessage('✅ Supplier assigned successfully! (Demo Mode)');
                                }
                              }}
                              style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', maxWidth: '160px', outline: 'none' }}
                            >
                              <option value="">-- Assign Supplier --</option>
                              {suppliers.filter(s => s.status === 'Active').map(s => (
                                <option key={s._id} value={s._id}>{s.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span style={{ fontWeight: '500' }}>{po.supplier}</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#555' }}>
                          {po.items?.map((item, idx) => (
                            <div key={idx}>{item.materialName} ×{item.quantity} {item.unit} (LKR {item.unitPrice})</div>
                          ))}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#0d1b4b' }}>
                          {po.totalAmount?.toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>
                          {po.expectedDeliveryDate ? formatDate(po.expectedDeliveryDate) : '-'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#555' }}>
                          {po.paymentTerms || '-'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>{formatDate(po.createdAt)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            background: po.status === 'Delivered' ? '#e8f5e9' : po.status === 'Sent' ? '#e3f2fd' : po.status === 'Approved' ? '#f0fdf4' : po.status === 'Rejected' ? '#fef2f2' : '#f1f5f9',
                            color: po.status === 'Delivered' ? '#2e7d32' : po.status === 'Sent' ? '#1565c0' : po.status === 'Approved' ? '#166534' : po.status === 'Rejected' ? '#991b1b' : '#475569',
                            padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600'
                          }}>{po.status}</span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '6px', flexDirection: 'column', width: '130px' }}>
                            {po.status === 'Pending' && (
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button onClick={() => handleUpdateStatus(po._id, 'Approved')}
                                  style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', flex: 1 }}>
                                  Approve
                                </button>
                                <button onClick={() => handleUpdateStatus(po._id, 'Rejected')}
                                  style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', flex: 1 }}>
                                  Reject
                                </button>
                              </div>
                            )}
                            {po.status === 'Approved' && (
                              <button onClick={() => handleSendToSupplier(po._id, po.poNumber, po.supplier)}
                                style={{ background: '#2563eb', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                                Send to Supplier
                              </button>
                            )}
                            {(po.status === 'Sent' || po.status === 'Delivered') && (
                              <button onClick={() => handleRateClick(po)}
                                style={{ background: '#2563eb', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                                Rate Delivery
                              </button>
                            )}
                            <select 
                              value={po.status} 
                              onChange={e => handleUpdateStatus(po._id, e.target.value)}
                              style={{ padding: '4px', fontSize: '11px', borderRadius: '4px', border: '1px solid #ddd', cursor: 'pointer', outline: 'none', background: 'white' }}
                            >
                              {['Pending', 'Approved', 'Rejected', 'Sent', 'Delivered', 'Closed', 'Cancelled'].map(st => (
                                <option key={st} value={st}>{st}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                      </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activePage === 'suppliers' && (
            <div>
              {/* Add Supplier Form */}
              {showSupplierForm && (
                <div style={{ background: 'white', borderRadius: '8px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', border: '1px solid #2563eb' }}>
                  <h3 style={{ margin: '0 0 16px', color: '#0d1b4b' }}>Add New Supplier</h3>
                  <form onSubmit={handleSupplierSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: '600' }}>COMPANY NAME *</label>
                        <input value={supForm.name} onChange={e => setSupForm({ ...supForm, name: e.target.value })} required
                          style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: '600' }}>CONTACT PERSON</label>
                        <input value={supForm.contactPerson} onChange={e => setSupForm({ ...supForm, contactPerson: e.target.value })}
                          style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: '600' }}>PHONE NUMBER *</label>
                        <input value={supForm.phone} onChange={e => setSupForm({ ...supForm, phone: formatPhoneInput(e.target.value) })} required
                          maxLength={12} placeholder={PHONE_PLACEHOLDER}
                          style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: '600' }}>EMAIL ADDRESS</label>
                        <input type="email" value={supForm.email} onChange={e => setSupForm({ ...supForm, email: e.target.value })}
                          style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: '600' }}>MATERIAL CATEGORY *</label>
                        <select value={supForm.category} onChange={e => setSupForm({ ...supForm, category: e.target.value })}
                          style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' }}>
                          {['Cement', 'Steel', 'Bricks', 'Sand', 'Gravel', 'Wood', 'Paint', 'Other'].map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: '600' }}>ADDRESS</label>
                        <input value={supForm.address} onChange={e => setSupForm({ ...supForm, address: e.target.value })}
                          style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button type="submit" style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Save Supplier</button>
                      <button type="button" onClick={() => setShowSupplierForm(false)} style={{ background: '#f5f5f5', color: '#333', border: '1px solid #ddd', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </form>
                </div>
              )}

              {/* Suppliers Table Section */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <input placeholder="Search suppliers by name or category..." value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)}
                  style={{ padding: '10px 16px', border: '1px solid #ddd', borderRadius: '6px', width: '320px', fontSize: '14px' }} />
              </div>

              <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#0d1b4b', color: 'white' }}>
                      {['Company Name', 'Contact Person', 'Phone', 'Email', 'Category', 'Status', ...(user?.role === 'Admin' ? ['Actions'] : [])].map(h => (
                        <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSuppliers.map((s, i) => (
                      <tr key={s._id || i} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                        {editingSupplierId === s._id ? (
                          // Editing Row
                          <>
                            <td style={{ padding: '10px 16px' }}>
                              <input value={editSupForm.name} onChange={e => setEditSupForm({ ...editSupForm, name: e.target.value })} style={{ padding: '6px', width: '90%', borderRadius: '4px', border: '1px solid #ccc' }} required />
                            </td>
                            <td style={{ padding: '10px 16px' }}>
                              <input value={editSupForm.contactPerson} onChange={e => setEditSupForm({ ...editSupForm, contactPerson: e.target.value })} style={{ padding: '6px', width: '90%', borderRadius: '4px', border: '1px solid #ccc' }} />
                            </td>
                            <td style={{ padding: '10px 16px' }}>
                              <input value={editSupForm.phone} onChange={e => setEditSupForm({ ...editSupForm, phone: formatPhoneInput(e.target.value) })} maxLength={12} style={{ padding: '6px', width: '90%', borderRadius: '4px', border: '1px solid #ccc' }} required />
                            </td>
                            <td style={{ padding: '10px 16px' }}>
                              <input type="email" value={editSupForm.email} onChange={e => setEditSupForm({ ...editSupForm, email: e.target.value })} style={{ padding: '6px', width: '90%', borderRadius: '4px', border: '1px solid #ccc' }} />
                            </td>
                            <td style={{ padding: '10px 16px' }}>
                              <select value={editSupForm.category} onChange={e => setEditSupForm({ ...editSupForm, category: e.target.value })} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}>
                                {['Cement', 'Steel', 'Bricks', 'Sand', 'Gravel', 'Wood', 'Paint', 'Other'].map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: '10px 16px' }}>
                              <select value={editSupForm.status} onChange={e => setEditSupForm({ ...editSupForm, status: e.target.value })} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                              </select>
                            </td>
                            <td style={{ padding: '10px 16px' }}>
                              <button onClick={(e) => handleSupplierEditSave(e, s._id)} style={{ background: '#2e7d32', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '6px' }}>Save</button>
                              <button onClick={() => setEditingSupplierId(null)} style={{ background: '#cbd5e1', color: '#333', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                            </td>
                          </>
                        ) : (
                          // Normal Display Row
                          <>
                            <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '500', color: '#0d1b4b' }}>{s.name}</td>
                            <td style={{ padding: '14px 16px', fontSize: '13px' }}>{s.contactPerson || '-'}</td>
                            <td style={{ padding: '14px 16px', fontSize: '13px' }}>{s.phone}</td>
                            <td style={{ padding: '14px 16px', fontSize: '13px', color: '#666' }}>{s.email || '-'}</td>
                            <td style={{ padding: '14px 16px' }}>
                              <span style={{ background: '#e3f2fd', color: '#1565c0', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>{s.category}</span>
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <span style={{
                                background: s.status === 'Active' ? '#e8f5e9' : '#ffebee',
                                color: s.status === 'Active' ? '#2e7d32' : '#c62828',
                                padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600'
                              }}>{s.status}</span>
                            </td>
                            {user?.role === 'Admin' && (
                              <td style={{ padding: '14px 16px' }}>
                                <button onClick={() => handleSupplierEditClick(s)}
                                  style={{ background: '#1565c0', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '6px' }}>
                                  Edit
                                </button>
                                {s.status === 'Active' && (
                                  <button onClick={() => handleSupplierDeactivate(s._id)}
                                    style={{ background: '#c62828', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                                    Deactivate
                                  </button>
                                )}
                              </td>
                            )}
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activePage === 'performance' && (
            <div>
              <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#0d1b4b', color: 'white' }}>
                      {['Supplier Name', 'Total Orders', 'On-Time Deliveries', 'Delivery Accuracy %', 'Performance Rating'].map(h => (
                        <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {performanceData.map((perf, i) => {
                      const rating = perf.performanceRating;
                      let ratingBg = '#ffebee';
                      let ratingColor = '#c62828';
                      if (rating === 'Excellent') {
                        ratingBg = '#e8f5e9';
                        ratingColor = '#2e7d32';
                      } else if (rating === 'Good') {
                        ratingBg = '#e3f2fd';
                        ratingColor = '#1565c0';
                      } else if (rating === 'Average') {
                        ratingBg = '#dbeafe';
                        ratingColor = '#1e3a8a';
                      } else if (rating === 'N/A') {
                        ratingBg = '#f5f5f5';
                        ratingColor = '#666';
                      }

                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '500', color: '#0d1b4b' }}>{perf.supplierName}</td>
                          <td style={{ padding: '14px 16px', fontSize: '13px' }}>{perf.totalOrders}</td>
                          <td style={{ padding: '14px 16px', fontSize: '13px' }}>
                            {perf.onTimeDeliveries} ({perf.onTimePercent}%)
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '600' }}>
                            {perf.deliveryAccuracy}%
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{
                              background: ratingBg,
                              color: ratingColor,
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}>{rating}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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

      {showRateModal && selectedPo && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '8px', width: '450px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <h3 style={{ color: '#0d1b4b', marginTop: 0, marginBottom: '20px' }}>Rate Delivery: {selectedPo.poNumber}</h3>
            <form onSubmit={handleRateSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#666', fontWeight: '600', marginBottom: '6px' }}>ACTUAL DELIVERY DATE *</label>
                <DateInput
                  value={rateForm.actualDeliveryDate}
                  onChange={iso => setRateForm({ ...rateForm, actualDeliveryDate: iso })}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#666', fontWeight: '600', marginBottom: '6px' }}>RECEIVED QUANTITY *</label>
                <input
                  type="number"
                  placeholder="Total Qty Received"
                  value={rateForm.receivedQty}
                  onChange={e => setRateForm({ ...rateForm, receivedQty: e.target.value })}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' }}
                  min="0"
                  required
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#666', fontWeight: '600', marginBottom: '6px' }}>DELIVERY CONDITION *</label>
                <select
                  value={rateForm.deliveryCondition}
                  onChange={e => setRateForm({ ...rateForm, deliveryCondition: e.target.value })}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box', background: 'white' }}
                  required
                >
                  <option value="Good">Good</option>
                  <option value="Damaged">Damaged</option>
                  <option value="Partial">Partial</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="submit" style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
                  Save Delivery Rating
                </button>
                <button type="button" onClick={() => setShowRateModal(false)} style={{ background: '#f5f5f5', color: '#333', border: '1px solid #ddd', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {renderPOStatsModal()}
    </div>
  );
};

export default PurchaseOrderPage;