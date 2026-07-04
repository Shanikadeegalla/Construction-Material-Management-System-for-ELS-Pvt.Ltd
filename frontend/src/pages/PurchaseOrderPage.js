import React, { useState, useEffect } from 'react';
import SettingsPage from './SettingsPage';

const PurchaseOrderPage = ({ user, onLogout }) => {
  const [activePage, setActivePage] = useState('dashboard'); // 'dashboard', 'orders', 'suppliers'
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [approvedPRs, setApprovedPRs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // PO Form State
  const [form, setForm] = useState({
    prId: '',
    supplier: '',
    notes: '',
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

  // Search Filter for Suppliers
  const [supplierSearch, setSupplierSearch] = useState('');

  const getHeaders = () => {
    const token = JSON.parse(localStorage.getItem('user'))?.token;
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };
  };

  const fetchData = async () => {
    setError('');
    try {
      const headers = getHeaders();

      // Fetch POs
      const poRes = await fetch('http://localhost:5000/api/purchase-orders', { headers });
      const poData = await poRes.json();
      if (poData.success) setOrders(poData.data);

      // Fetch Suppliers
      const supRes = await fetch('http://localhost:5000/api/suppliers', { headers });
      const supData = await supRes.json();
      const rawSuppliers = supData.success ? supData.data : (Array.isArray(supData) ? supData : []);
      setSuppliers(rawSuppliers);

      // Fetch Approved PRs
      const prRes = await fetch('http://localhost:5000/api/purchase-requests?status=Approved', { headers });
      const prData = await prRes.json();
      if (prData.success) setApprovedPRs(prData.data);

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

  useEffect(() => {
    fetchData();
    fetchNotifications();

    const interval = setInterval(() => {
      fetchData();
      fetchNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handlePrSelectChange = (prId) => {
    const selected = approvedPRs.find(pr => pr._id === prId);
    if (selected && selected.materials) {
      const items = selected.materials.map(m => ({
        materialName: m.materialName || m.name,
        quantity: m.quantity,
        unit: m.unit || 'bag',
        unitPrice: ''
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
        setForm({ prId: '', supplier: '', notes: '', items: [{ materialName: '', quantity: '', unit: 'bag', unitPrice: '' }] });
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

  const handleSupplierSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
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
    { label: 'Total POs', value: orders.length, color: '#1565c0' },
    { label: 'Pending POs', value: orders.filter(o => o.status === 'Pending').length, color: '#e65100' },
    { label: 'Sent POs', value: orders.filter(o => o.status === 'Sent').length, color: '#1565c0' },
    { label: 'Delivered POs', value: orders.filter(o => o.status === 'Delivered').length, color: '#2e7d32' },
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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Segoe UI, Arial, sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width: '240px', background: '#0d1b4b', color: 'white', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh', zIndex: 100 }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px', color: 'white' }}>E</div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: 'white' }}>ELS CMMS</div>
            <div style={{ fontSize: '11px', color: '#ff9800' }}>Procurement</div>
          </div>
        </div>
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#ff9800', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px' }}>
            {user?.name?.charAt(0).toUpperCase() || 'P'}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600' }}>{user?.name || 'Purchase Officer'}</div>
            <div style={{ fontSize: '11px', color: '#cbd5e1' }}>Purchase Officer</div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {[
            { id: 'dashboard', label: 'PO Dashboard', icon: '⊞' },
            { id: 'orders', label: 'Purchase Orders', icon: '📦' },
            { id: 'suppliers', label: 'Suppliers Registry', icon: '🏭' },
            { id: 'settings', label: 'Settings', icon: '⚙️' },
          ].map(item => (
            <div key={item.id} onClick={() => { setActivePage(item.id); setError(''); setMessage(''); }}
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
          <h2 style={{ margin: 0, fontSize: '20px', color: '#0d1b4b' }}>
            {activePage === 'dashboard' && 'PO Dashboard'}
            {activePage === 'orders' && 'Purchase Orders Catalog'}
            {activePage === 'suppliers' && 'Supplier Registry'}
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

            <div style={{ display: 'flex', gap: '10px' }}>
              {activePage === 'orders' && (
                <button onClick={() => setShowForm(!showForm)}
                  style={{ background: '#ff9800', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
                  {showForm ? 'Hide Form' : '+ Create PO'}
                </button>
              )}
              {activePage === 'suppliers' && (
                <button onClick={() => setShowSupplierForm(!showSupplierForm)}
                  style={{ background: '#ff9800', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
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
          {activePage !== 'suppliers' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
              {stats.map((s, i) => (
                <div key={i} style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', borderTop: `4px solid ${s.color}` }}>
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
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500' }}>{po.supplier}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600' }}>{po.totalAmount?.toLocaleString()}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>{new Date(po.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          background: po.status === 'Delivered' ? '#e8f5e9' : po.status === 'Sent' ? '#e3f2fd' : '#fff3e0',
                          color: po.status === 'Delivered' ? '#2e7d32' : po.status === 'Sent' ? '#1565c0' : '#e65100',
                          padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold'
                        }}>{po.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activePage === 'orders' && (
            <div>
              {/* Create PO Form */}
              {showForm && (
                <div style={{ background: 'white', borderRadius: '8px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', border: '1px solid #ff9800' }}>
                  <h3 style={{ margin: '0 0 20px', color: '#0d1b4b' }}>Create New Purchase Order</h3>
                  <form onSubmit={handlePOSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: '600' }}>SELECT APPROVED PURCHASE REQUEST (PR)</label>
                        <select value={form.prId} onChange={e => handlePrSelectChange(e.target.value)}
                          style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' }}>
                          <option value="">-- Create PO without PR (Manual) --</option>
                          {approvedPRs.map(pr => (
                            <option key={pr._id} value={pr._id}>{pr.projectName || pr.project} (PR-Approved)</option>
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

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: '600' }}>NOTES</label>
                      <input placeholder="Enter terms, remarks or delivery location..." value={form.notes}
                        onChange={e => setForm({ ...form, notes: e.target.value })}
                        style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' }} />
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button type="submit" style={{ background: '#ff9800', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
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
                      {['PO No.', 'Supplier', 'Order Items Description', 'Total (LKR)', 'Created Date', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((po, i) => (
                      <tr key={po._id} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
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
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>{new Date(po.createdAt).toLocaleDateString()}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            background: po.status === 'Delivered' ? '#e8f5e9' : po.status === 'Sent' ? '#e3f2fd' : '#fff3e0',
                            color: po.status === 'Delivered' ? '#2e7d32' : po.status === 'Sent' ? '#1565c0' : '#e65100',
                            padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600'
                          }}>{po.status}</span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {po.status === 'Pending' && (
                              <button onClick={() => handleUpdateStatus(po._id, 'Sent')}
                                style={{ background: '#1565c0', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                                Mark as Sent
                              </button>
                            )}
                            {po.status === 'Sent' && (
                              <button onClick={() => handleUpdateStatus(po._id, 'Delivered')}
                                style={{ background: '#2e7d32', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                                Mark as Delivered
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activePage === 'suppliers' && (
            <div>
              {/* Add Supplier Form */}
              {showSupplierForm && (
                <div style={{ background: 'white', borderRadius: '8px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', border: '1px solid #ff9800' }}>
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
                        <input value={supForm.phone} onChange={e => setSupForm({ ...supForm, phone: e.target.value })} required
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
                      <button type="submit" style={{ background: '#ff9800', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Save Supplier</button>
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
                      {['Company Name', 'Contact Person', 'Phone', 'Email', 'Category', 'Status', 'Actions'].map(h => (
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
                              <input value={editSupForm.phone} onChange={e => setEditSupForm({ ...editSupForm, phone: e.target.value })} style={{ padding: '6px', width: '90%', borderRadius: '4px', border: '1px solid #ccc' }} required />
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
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activePage === 'settings' && <SettingsPage user={user} onLogout={onLogout} />}
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderPage;