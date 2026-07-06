import React, { useState, useEffect } from 'react';
import SettingsPage from './SettingsPage';

function MainStoreDashboard({ user, onLogout }) {
  const [view, setView] = useState('dashboard'); // 'dashboard', 'add-stock', 'grn', 'issue', 'transfer-log', 'purchase-request'
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

  // Add Stock form
  const [addForm, setAddForm] = useState({
    name: '',
    category: 'Cement',
    unit: 'bag',
    quantity: 0,
    minimumStock: 10,
    unitPrice: 0,
    description: ''
  });

  // Issue Stock form
  const [issueForm, setIssueForm] = useState({
    materialId: '',
    quantity: '',
    projectName: '',
    projectId: ''
  });

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

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      const res = await fetch('http://localhost:5000/api/inventory/add', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ ...addForm, location: 'MainStore' })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('✅ Material added successfully to Main Store!');
        setAddForm({ name: '', category: 'Cement', unit: 'bag', quantity: 0, minimumStock: 10, unitPrice: 0, description: '' });
        setView('dashboard');
        fetchData();
      } else {
        setError(data.message || 'Failed to add material.');
      }
    } catch (err) {
      setError('Connection error occurred.');
    }
  };

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!issueForm.materialId || !issueForm.quantity || Number(issueForm.quantity) <= 0) {
      setError('Please select a material and enter a valid quantity.');
      return;
    }

    const selectedMat = materials.find(m => m._id === issueForm.materialId);
    if (selectedMat && Number(issueForm.quantity) > selectedMat.quantity) {
      setError('Transfer quantity exceeds available stock.');
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/inventory/issue', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(issueForm)
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message || '✅ Stock issued successfully!');
        setIssueForm({ materialId: '', quantity: '', projectName: '', projectId: '' });
        setView('dashboard');
        fetchData();
      } else {
        setError(data.message || 'Failed to issue material.');
      }
    } catch (err) {
      setError('Connection error occurred.');
    }
  };

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
  const lastGRNDate = grns.length > 0 ? new Date(grns[0].receivedDate || grns[0].createdAt).toLocaleDateString() : 'N/A';

  const filteredMaterials = mainMaterials.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || m.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div style={styles.dashboardLayout}>
      {/* Navigation Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.logoIcon}>E</div>
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
            { id: 'add-stock', label: 'Add Stock', icon: '➕' },
            { id: 'grn', label: 'GRN Incoming', icon: '📥' },
            { id: 'issue-site', label: 'Issue to Site', icon: '⇄' },
            { id: 'transfer-log', label: 'Transfer Log', icon: '📋' },
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
              🕐 {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
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
                <div style={styles.statLabel}>Total Stock Value</div>
                <div style={styles.statValue}>LKR {stockValue.toLocaleString()}</div>
              </div>
              <div style={{ ...styles.statCard, borderLeft: lowStockItems > 0 ? '4px solid #ef4444' : '4px solid #0d1b4b' }}>
                <div style={styles.statLabel}>Low Stock Alerts</div>
                <div style={{ ...styles.statValue, color: lowStockItems > 0 ? '#ef4444' : '#0d1b4b' }}>{lowStockItems}</div>
              </div>
              <div style={styles.statCard}>
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
          </div>
        )}

        {view === 'add-stock' && (
          <div style={styles.container}>
            <h1 style={styles.pageTitle}>Add Material to Inventory</h1>
            <div style={styles.formCard}>
              <form onSubmit={handleAddSubmit} style={{ display: 'grid', gap: '16px', maxWidth: '500px' }}>
                <div>
                  <label style={styles.fieldLabel}>Material Name</label>
                  <input
                    type="text"
                    value={addForm.name}
                    onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                    style={styles.formInput}
                    required
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={styles.fieldLabel}>Category</label>
                    <select
                      value={addForm.category}
                      onChange={e => setAddForm({ ...addForm, category: e.target.value })}
                      style={styles.formSelect}
                    >
                      {['Cement', 'Steel', 'Bricks', 'Sand', 'Gravel', 'Wood', 'Paint', 'Other'].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Unit</label>
                    <select
                      value={addForm.unit}
                      onChange={e => setAddForm({ ...addForm, unit: e.target.value })}
                      style={styles.formSelect}
                    >
                      {['kg', 'ton', 'litre', 'piece', 'bag', 'm3'].map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={styles.fieldLabel}>Quantity</label>
                    <input
                      type="number"
                      value={addForm.quantity}
                      onChange={e => setAddForm({ ...addForm, quantity: Number(e.target.value) })}
                      style={styles.formInput}
                      min="0"
                      required
                    />
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Min Stock</label>
                    <input
                      type="number"
                      value={addForm.minimumStock}
                      onChange={e => setAddForm({ ...addForm, minimumStock: Number(e.target.value) })}
                      style={styles.formInput}
                      min="0"
                      required
                    />
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Unit Price (LKR)</label>
                    <input
                      type="number"
                      value={addForm.unitPrice}
                      onChange={e => setAddForm({ ...addForm, unitPrice: Number(e.target.value) })}
                      style={styles.formInput}
                      min="0"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label style={styles.fieldLabel}>Description</label>
                  <textarea
                    value={addForm.description}
                    onChange={e => setAddForm({ ...addForm, description: e.target.value })}
                    style={{ ...styles.formInput, height: '80px' }}
                  />
                </div>
                <button type="submit" style={styles.orangeBtn}>Add to Inventory</button>
              </form>
            </div>
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
                    <input
                      type="date"
                      value={grnForm.receivedDate}
                      onChange={e => setGrnForm({ ...grnForm, receivedDate: e.target.value })}
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
                      <td style={styles.td}>{new Date(g.receivedDate || g.createdAt).toLocaleDateString()}</td>
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

        {view === 'issue-site' && (
          <div style={styles.container}>
            <h1 style={styles.pageTitle}>Issue Material to Site Store</h1>
            <div style={styles.formCard}>
              <form onSubmit={handleIssueSubmit} style={{ display: 'grid', gap: '16px', maxWidth: '500px' }}>
                <div>
                  <label style={styles.fieldLabel}>Select Material from Main Store *</label>
                  <select
                    value={issueForm.materialId}
                    onChange={e => setIssueForm({ ...issueForm, materialId: e.target.value })}
                    style={styles.formSelect}
                    required
                  >
                    <option value="">-- Select Material --</option>
                    {materials.filter(m => m.location === 'MainStore' && m.quantity > 0).map(m => (
                      <option key={m._id} value={m._id}>{m.name} (Available: {m.quantity} {m.unit})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={styles.fieldLabel}>Quantity to Transfer *</label>
                  <input
                    type="number"
                    value={issueForm.quantity}
                    onChange={e => setIssueForm({ ...issueForm, quantity: e.target.value })}
                    style={styles.formInput}
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label style={styles.fieldLabel}>Project Name *</label>
                  <select
                    value={issueForm.projectId}
                    onChange={e => {
                      const selectedProj = projects.find(p => p._id === e.target.value);
                      setIssueForm({
                        ...issueForm,
                        projectId: e.target.value,
                        projectName: selectedProj ? (selectedProj.projectName || selectedProj.name) : ''
                      });
                    }}
                    style={styles.formSelect}
                    required
                  >
                    <option value="">-- Select Project --</option>
                    {projects.map(p => (
                      <option key={p._id} value={p._id}>
                        {p.projectName || p.name}
                      </option>
                    ))}
                  </select>
                </div>
                 <button type="submit" style={styles.orangeBtn}>Process Stock Transfer</button>
              </form>
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
                        <td style={styles.td}>{new Date(t.date).toLocaleString()}</td>
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
                            background: '#ff9800',
                            color: 'white',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 4px rgba(255,152,0,0.2)'
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
                          background: pr.urgency === 'Critical' ? '#ffebee' : pr.urgency === 'Urgent' ? '#fff3e0' : '#e3f2fd',
                          color: pr.urgency === 'Critical' ? '#c62828' : pr.urgency === 'Urgent' ? '#e65100' : '#1565c0',
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
                      <td style={styles.td}>{new Date(pr.createdAt).toLocaleDateString()}</td>
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

        {view === 'settings' && <SettingsPage user={user} onLogout={onLogout} />}
      </main>
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
  logoIcon: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '18px',
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
    background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
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
    color: '#ff9800',
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
    backgroundColor: '#ff9800',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    boxShadow: '0 4px 12px rgba(255,152,0,0.2)',
  },
  sidebarSwitchBtn: {
    width: '100%',
    padding: '12px',
    backgroundColor: 'rgba(255,152,0,0.1)',
    color: '#ff9800',
    border: '1px solid rgba(255,152,0,0.2)',
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
    background: '#ff9800',
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
