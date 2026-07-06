import React, { useState, useEffect } from 'react';
import { encryptTransit, decryptTransit } from '../utils/cryptoUtils';

function SiteStoreDashboard({ user, onLogout }) {
  const [view, setView] = useState('dashboard'); // 'dashboard', 'site-inventory', 'create-pr', 'usage'
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Phase 8 - Approved BOM states
  const [projects, setProjects] = useState([]);
  const [selectedProjId, setSelectedProjId] = useState('');
  const [bomMaterialsList, setBomMaterialsList] = useState([]);
  const [noApprovedBomError, setNoApprovedBomError] = useState(false);
  const [loadingBom, setLoadingBom] = useState(false);

  // Phase 9 - Stock Transfer States
  const [transfers, setTransfers] = useState([]);

  // PR Form State
  const [prForm, setPrForm] = useState({
    projectName: '',
    notes: '',
    items: [{ materialName: '', quantity: '', unit: 'bag', reason: '' }]
  });

  // Usage Form State
  const [usageForm, setUsageForm] = useState({
    materialId: '',
    quantityUsed: '',
    date: new Date().toISOString().substring(0, 10),
    purpose: ''
  });

  // Usage History from LocalStorage
  const [usageHistory, setUsageHistory] = useState([]);

  // Main Store stock lookup for shortages
  const [mainStoreStock, setMainStoreStock] = useState(null);
  const [showMainStoreStock, setShowMainStoreStock] = useState(false);

  const getHeaders = () => {
    const token = JSON.parse(localStorage.getItem('user'))?.token;
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-site-store': 'true'
    };
  };

  const fetchMaterials = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('http://localhost:5000/api/site/inventory', {
        headers: getHeaders()
      });
      const data = await res.json();
      let finalData = data;
      if (data && data.ciphertext) {
        finalData = JSON.parse(decryptTransit(data.ciphertext));
      }
      if (Array.isArray(finalData)) {
        setMaterials(finalData);
      } else {
        setError('Failed to fetch site inventory.');
      }
    } catch (err) {
      setError('Could not connect to the backend server. Loading demo data.');
      setMaterials([
        { _id: 'site1', name: 'Portland Cement OPC', category: 'Cement', unit: 'bag', quantity: 50, minimumStock: 10, unitPrice: 1850, location: 'SiteStore' },
        { _id: 'site2', name: 'Deformed Steel Bars 12mm', category: 'Steel', unit: 'ton', quantity: 2, minimumStock: 2, unitPrice: 185000, location: 'SiteStore' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/projects', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setProjects(data.data);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  const handleProjectChange = async (projectName) => {
    setError(''); setSuccess('');
    const proj = projects.find(p => p.projectName === projectName || p.name === projectName);
    if (!proj) {
      setSelectedProjId('');
      setBomMaterialsList([]);
      setNoApprovedBomError(false);
      setPrForm({ ...prForm, projectName, items: [{ materialName: '', quantity: '', unit: 'bag', reason: '' }] });
      return;
    }

    setSelectedProjId(proj._id);
    setLoadingBom(true);
    setNoApprovedBomError(false);
    setPrForm({ ...prForm, projectName, items: [{ materialName: '', quantity: '', unit: 'bag', reason: '' }] });

    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch(`http://localhost:5000/api/bom/approved/${proj._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        setBomMaterialsList(data.data.materials || []);
        setNoApprovedBomError(false);
      } else {
        setBomMaterialsList([]);
        setNoApprovedBomError(true);
      }
    } catch (err) {
      console.error(err);
      setBomMaterialsList([]);
      setNoApprovedBomError(true);
    } finally {
      setLoadingBom(false);
    }
  };

  const fetchTransfers = async () => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/inventory/transfers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        const userProjId = user?.projectId || user?.project_id;
        const projectTransfers = data.filter(t => String(t.projectId) === String(userProjId) || String(t.project_id) === String(userProjId));
        setTransfers(projectTransfers);
      }
    } catch (err) {
      console.error('Error fetching transfers:', err);
    }
  };

  const handleConfirmReceipt = async (transferLogId) => {
    setError(''); setSuccess('');
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch(`http://localhost:5000/api/site/confirm-transfer/${transferLogId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess('✅ Delivery receipt confirmed successfully! Stock updated.');
        fetchMaterials();
        fetchTransfers();
      } else {
        setError(data.message || 'Failed to confirm receipt.');
      }
    } catch (err) {
      setError('Connection error occurred.');
    }
  };

  useEffect(() => {
    fetchMaterials();
    fetchProjects();
    fetchTransfers();
    // Load usage logs
    const logs = localStorage.getItem('siteUsageLogs');
    if (logs) {
      try {
        setUsageHistory(JSON.parse(logs));
      } catch (e) {
        setUsageHistory([]);
      }
    }
  }, []);

  useEffect(() => {
    if (projects.length > 0 && (user?.projectId || user?.project_id)) {
      const userProjId = user.projectId || user.project_id;
      const userProj = projects.find(p => p._id === userProjId);
      if (userProj && prForm.projectName !== (userProj.projectName || userProj.name)) {
        handleProjectChange(userProj.projectName || userProj.name);
      }
    }
  }, [projects, user]);

  const checkShortage = async (matId, qty) => {
    if (!matId || !qty || Number(qty) <= 0) {
      setMainStoreStock(null);
      setShowMainStoreStock(false);
      return;
    }
    const selectedMaterial = materials.find(m => m._id === matId);
    if (!selectedMaterial) return;

    if (selectedMaterial.quantity < Number(qty)) {
      try {
        const res = await fetch(`http://localhost:5000/api/materials/main-store/${matId}`, {
          headers: getHeaders()
        });
        const data = await res.json();
        if (data.success && data.data) {
          setMainStoreStock(data.data);
          setShowMainStoreStock(true);
        } else {
          setMainStoreStock(null);
          setShowMainStoreStock(false);
        }
      } catch (err) {
        console.error('Error fetching main store stock:', err);
        setMainStoreStock({
          name: selectedMaterial.name,
          quantity: 0,
          updatedAt: new Date().toISOString()
        });
        setShowMainStoreStock(true);
      }
    } else {
      setMainStoreStock(null);
      setShowMainStoreStock(false);
    }
  };

  useEffect(() => {
    checkShortage(usageForm.materialId, usageForm.quantityUsed);
  }, [usageForm.materialId, usageForm.quantityUsed, materials]);

  const handlePrSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');

    const invalid = prForm.items.some(item => !item.materialName || !item.quantity || Number(item.quantity) <= 0);
    if (invalid) {
      setError('Please fill in material name and valid quantity for all request rows.');
      return;
    }

    if (noApprovedBomError) {
      setError('Cannot submit PR without an approved BOM for this project.');
      return;
    }

    // Verify each item against approved BOM qty
    for (const item of prForm.items) {
      const bomMat = bomMaterialsList.find(bm => bm.name === item.materialName);
      if (!bomMat) {
        setError(`Material "${item.materialName}" is not in the approved BOM.`);
        return;
      }
      if (Number(item.quantity) > bomMat.plannedQty) {
        setError(`Requested quantity for "${item.materialName}" (${item.quantity}) exceeds the approved BOM limit (${bomMat.plannedQty}).`);
        return;
      }
    }

    try {
      const payload = {
        projectName: prForm.projectName,
        notes: prForm.notes,
        materials: prForm.items,
        requestedBy: user ? user.name : 'Store Officer'
      };

      // Encrypt payload for transit
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
        setSuccess('✅ Purchase Request submitted successfully to PM for approval!');
        setPrForm({
          projectName: '',
          notes: '',
          items: [{ materialName: '', quantity: '', unit: 'bag', reason: '' }]
        });
        setView('dashboard');
      } else {
        setError(finalData.message || 'Failed to submit Purchase Request.');
      }
    } catch (err) {
      setError('Connection error occurred.');
    }
  };

  const handleUsageSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');

    const { materialId, quantityUsed, date, purpose } = usageForm;
    if (!materialId || !quantityUsed || Number(quantityUsed) <= 0) {
      setError('Please select a material and enter a valid quantity.');
      return;
    }

    const selectedMaterial = materials.find(m => m._id === materialId);
    if (!selectedMaterial) return;

    if (selectedMaterial.quantity < Number(quantityUsed)) {
      try {
        const token = JSON.parse(localStorage.getItem('user'))?.token;
        const lookupRes = await fetch(`http://localhost:5000/api/materials/main-store/${materialId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const lookupData = await lookupRes.json();
        
        if (lookupRes.ok && lookupData.success && lookupData.data) {
          const mainQty = lookupData.data.quantity;
          if (mainQty > 0) {
            setError(`Insufficient stock at the site. However, the Main Store currently has ${mainQty} units.`);
          } else {
            setError('Insufficient stock at both the Site Store and Main Store.');
          }
        } else {
          setError(`Insufficient stock. Only ${selectedMaterial.quantity} units available at site.`);
        }
      } catch (err) {
        setError(`Insufficient stock. Only ${selectedMaterial.quantity} units available at site.`);
      }
      return;
    }

    try {
      // Update inventory on backend via POST /api/site/material-usage
      const res = await fetch('http://localhost:5000/api/site/material-usage', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          materialId,
          quantity_used: Number(quantityUsed),
          date,
          purpose
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Record log locally
        const newLog = {
          id: Date.now(),
          materialName: selectedMaterial.name,
          quantity: quantityUsed,
          unit: selectedMaterial.unit,
          date,
          purpose
        };
        const updatedLogs = [newLog, ...usageHistory];
        setUsageHistory(updatedLogs);
        localStorage.setItem('siteUsageLogs', JSON.stringify(updatedLogs));

        setSuccess(`✅ Successfully logged usage of ${quantityUsed} ${selectedMaterial.unit}(s) of ${selectedMaterial.name}!`);
        setUsageForm({ materialId: '', quantityUsed: '', date: new Date().toISOString().substring(0, 10), purpose: '' });
        fetchMaterials();
      } else {
        if (data.insufficient && data.mainStoreStock) {
          setError(data.message);
          setMainStoreStock(data.mainStoreStock);
          setShowMainStoreStock(true);
        } else {
          setError(data.message || 'Failed to update inventory during usage log.');
        }
      }
    } catch (err) {
      setError('Connection error occurred.');
    }
  };

  const handleStoreSwitch = () => {
    localStorage.setItem('storeType', 'MainStore');
    window.location.reload();
  };

  // Calculations for stats
  const totalSiteSKUs = materials.length;
  const siteStockValue = materials.reduce((sum, m) => sum + (m.quantity * m.unitPrice), 0);
  const siteLowStockItems = materials.filter(m => m.quantity <= m.minimumStock).length;

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
              <div style={styles.sidebarUserRole}>
                {user.role} {(() => {
                  const userProjId = user.projectId || user.project_id;
                  const userProj = projects.find(p => p._id === userProjId);
                  return userProj ? `(${userProj.projectName || userProj.name})` : '— Site Store';
                })()}
              </div>
              <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                <span>🔒</span> Encrypted
              </div>
            </div>
          </div>
        )}

        <nav style={styles.sidebarNav}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: '📊' },
            { id: 'site-inventory', label: 'Site Inventory', icon: '🏗️' },
            { id: 'create-pr', label: 'Create PR', icon: '📋' },
            { id: 'usage', label: 'Material Usage', icon: '🔧' },
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
        {error && <div style={styles.errorAlert}>{error}</div>}
        {success && <div style={styles.successAlert}>{success}</div>}

        {view === 'dashboard' && (
          <div style={styles.container}>
            <h1 style={styles.pageTitle}>
              Site Store Operations Center {(() => {
                const userProjId = user.projectId || user.project_id;
                const userProj = projects.find(p => p._id === userProjId);
                return userProj ? `— ${userProj.projectName || userProj.name}` : '';
              })()}
            </h1>

            {/* Stats row */}
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Site Materials (SKUs)</div>
                <div style={styles.statValue}>{totalSiteSKUs}</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Site Stock Value</div>
                <div style={styles.statValue}>LKR {siteStockValue.toLocaleString()}</div>
              </div>
              <div style={{ ...styles.statCard, borderLeft: siteLowStockItems > 0 ? '4px solid #ef4444' : '4px solid #0d1b4b' }}>
                <div style={styles.statLabel}>Low Stock Warnings</div>
                <div style={{ ...styles.statValue, color: siteLowStockItems > 0 ? '#ef4444' : '#0d1b4b' }}>{siteLowStockItems}</div>
              </div>
            </div>

            {/* Received Info Section */}
            <div style={styles.infoBox}>
              <h3 style={styles.infoBoxTitle}>ℹ️ Local Store Operations Info</h3>
              <p style={styles.infoBoxText}>
                This panel displays materials currently checked-out and stored at the local construction site. 
                Stock level increments automatically when issued from the Main Store.
              </p>
            </div>

            {/* Inventory table snippet */}
            <div style={styles.tableContainer}>
              <h3 style={{ padding: '16px 20px', color: '#0d1b4b', margin: 0, borderBottom: '1px solid #eee' }}>Current Site Stocks</h3>
              {materials.length === 0 ? (
                <div style={styles.emptyState}>No materials currently at site. Use Main Store to issue materials.</div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeaderRow}>
                      <th style={styles.th}>Material Name</th>
                      <th style={styles.th}>Category</th>
                      <th style={styles.th}>Unit</th>
                      <th style={styles.th}>Local Qty</th>
                      <th style={styles.th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.slice(0, 5).map(m => {
                      const isLow = m.quantity <= m.minimumStock;
                      return (
                        <tr key={m._id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={styles.tdBold}>{m.name}</td>
                          <td style={styles.td}>{m.category}</td>
                          <td style={styles.td}>{m.unit}</td>
                          <td style={styles.td}>{m.quantity}</td>
                          <td style={styles.td}>
                            {isLow ? (
                              <span style={{ background: '#ffebee', color: '#c62828', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>Low</span>
                            ) : (
                              <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>OK</span>
                            )}
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

        {view === 'site-inventory' && (
          <div style={styles.container}>
            <h1 style={styles.pageTitle}>Site Store Inventory Directory</h1>
            <div style={styles.tableContainer}>
              {materials.length === 0 ? (
                <div style={styles.emptyState}>No materials in site inventory.</div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeaderRow}>
                      <th style={styles.th}>Material Name</th>
                      <th style={styles.th}>Category</th>
                      <th style={styles.th}>Unit</th>
                      <th style={styles.th}>Local Qty Available</th>
                      <th style={styles.th}>Min Stock Limit</th>
                      <th style={styles.th}>Est. Unit Price (LKR)</th>
                      <th style={styles.th}>Total Value</th>
                      <th style={styles.th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map(m => {
                      const isLow = m.quantity <= m.minimumStock;
                      return (
                        <tr key={m._id} style={{ borderBottom: '1px solid #eee', backgroundColor: isLow ? 'rgba(239,68,68,0.08)' : 'white' }}>
                          <td style={styles.tdBold}>{m.name}</td>
                          <td style={styles.td}>{m.category}</td>
                          <td style={styles.td}>{m.unit}</td>
                          <td style={styles.td}>{m.quantity}</td>
                          <td style={styles.td}>{m.minimumStock}</td>
                          <td style={styles.td}>{m.unitPrice?.toLocaleString()}</td>
                          <td style={styles.td}>LKR {(m.quantity * (m.unitPrice || 0)).toLocaleString()}</td>
                          <td style={styles.td}>
                            {isLow ? (
                              <span style={{ background: '#ffebee', color: '#c62828', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>Low</span>
                            ) : (
                              <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>Normal</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* In-Transit Shipments Section */}
            <div style={{ ...styles.tableContainer, marginTop: '30px' }}>
              <div style={{ padding: '16px 20px', color: 'white', margin: 0, borderBottom: '1px solid #eee', background: '#0d1b4b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '15px', color: 'white' }}>🚚 In-Transit Shipments (Awaiting Receipt)</h3>
                <button onClick={fetchTransfers} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Refresh</button>
              </div>
              {transfers.filter(t => t.status === 'In-Transit').length === 0 ? (
                <div style={styles.emptyState}>No shipments currently in-transit.</div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeaderRow}>
                      <th style={styles.th}>Material Name</th>
                      <th style={styles.th}>Quantity</th>
                      <th style={styles.th}>Issued By</th>
                      <th style={styles.th}>Date Shipped</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.filter(t => t.status === 'In-Transit').map(t => (
                      <tr key={t._id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={styles.tdBold}>{t.materialName}</td>
                        <td style={styles.td}>{t.quantity}</td>
                        <td style={styles.td}>{t.issuedBy}</td>
                        <td style={styles.td}>{new Date(t.date).toLocaleDateString()}</td>
                        <td style={styles.td}>
                          <span style={{ background: '#fef3c7', color: '#d97706', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                            {t.status}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <button
                            onClick={() => handleConfirmReceipt(t._id)}
                            style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                          >
                            Confirm Receipt
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {view === 'create-pr' && (
          <div style={styles.container}>
            <h1 style={styles.pageTitle}>Create Purchase Request</h1>
            <div style={styles.formCard}>
              <form onSubmit={handlePrSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={styles.fieldLabel}>Project Name *</label>
                    <select
                      value={prForm.projectName}
                      onChange={e => handleProjectChange(e.target.value)}
                      style={styles.formSelect}
                      disabled={!!(user?.projectId || user?.project_id)}
                      required
                    >
                      <option value="">-- Select Project --</option>
                      {projects.map(p => (
                        <option key={p._id} value={p.projectName || p.name}>
                          {p.projectName || p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Date Requested</label>
                    <input
                      type="text"
                      value={new Date().toLocaleDateString()}
                      style={{ ...styles.formInput, background: '#f1f5f9' }}
                      disabled
                    />
                  </div>
                </div>

                {noApprovedBomError && (
                  <div style={{ padding: '12px', background: '#ffebee', border: '1px solid #ef5350', color: '#c62828', borderRadius: '6px', marginBottom: '16px', fontWeight: '500', textAlign: 'left' }}>
                    ⚠️ No approved BOM is available for this project. PR creation is disabled.
                  </div>
                )}

                <h4 style={{ color: '#0d1b4b', marginBottom: '12px' }}>Requested Materials</h4>
                {prForm.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <div>
                      <select
                        value={item.materialName}
                        onChange={e => {
                          const updated = [...prForm.items];
                          updated[idx].materialName = e.target.value;
                          const bomMat = bomMaterialsList.find(bm => bm.name === e.target.value);
                          if (bomMat) {
                            updated[idx].unit = bomMat.unit;
                            updated[idx].bomApprovedQty = bomMat.plannedQty;
                          } else {
                            updated[idx].bomApprovedQty = undefined;
                          }
                          setPrForm({ ...prForm, items: updated });
                        }}
                        style={styles.formSelect}
                        disabled={noApprovedBomError || bomMaterialsList.length === 0}
                        required
                      >
                        <option value="">-- Select Material --</option>
                        {bomMaterialsList.map(bm => (
                          <option key={bm._id || bm.name} value={bm.name}>
                            {bm.name}
                          </option>
                        ))}
                      </select>
                      {item.bomApprovedQty !== undefined && (
                        <div style={{ fontSize: '11px', color: '#ff9800', marginTop: '2px', fontWeight: '600', textAlign: 'left' }}>
                          BOM Approved: {item.bomApprovedQty} {item.unit}
                        </div>
                      )}
                    </div>
                    <input
                      type="number"
                      placeholder="Quantity"
                      value={item.quantity}
                      onChange={e => {
                        const updated = [...prForm.items];
                        updated[idx].quantity = e.target.value;
                        setPrForm({ ...prForm, items: updated });
                      }}
                      style={styles.formInput}
                      min="1"
                      max={item.bomApprovedQty}
                      required
                    />
                    <select
                      value={item.unit}
                      onChange={e => {
                        const updated = [...prForm.items];
                        updated[idx].unit = e.target.value;
                        setPrForm({ ...prForm, items: updated });
                      }}
                      style={styles.formSelect}
                      disabled
                    >
                      {['kg', 'ton', 'bag', 'piece', 'litre', 'm3'].map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                    <input
                      placeholder="Reason for requesting"
                      value={item.reason}
                      onChange={e => {
                        const updated = [...prForm.items];
                        updated[idx].reason = e.target.value;
                        setPrForm({ ...prForm, items: updated });
                      }}
                      style={styles.formInput}
                    />
                    {prForm.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setPrForm({ ...prForm, items: prForm.items.filter((_, i) => i !== idx) })}
                        style={{ background: '#ffebee', color: '#c62828', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setPrForm({ ...prForm, items: [...prForm.items, { materialName: '', quantity: '', unit: 'bag', reason: '' }] })}
                  disabled={noApprovedBomError || bomMaterialsList.length === 0}
                  style={{ background: '#e3f2fd', color: '#1565c0', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', marginBottom: '16px', fontSize: '13px' }}
                >
                  + Add Item
                </button>

                <div style={{ marginBottom: '16px' }}>
                  <label style={styles.fieldLabel}>Request Notes</label>
                  <textarea
                    placeholder="Enter extra instructions or remarks..."
                    value={prForm.notes}
                    onChange={e => setPrForm({ ...prForm, notes: e.target.value })}
                    style={{ ...styles.formInput, height: '80px' }}
                  />
                </div>

                <button type="submit" style={styles.orangeBtn} disabled={noApprovedBomError || prForm.projectName === ''}>Submit Purchase Request</button>
              </form>
            </div>
          </div>
        )}

        {view === 'usage' && (
          <div style={styles.container}>
            <h1 style={styles.pageTitle}>Log Local Material Usage</h1>
            <div style={styles.formCard}>
              <h3 style={{ color: '#0d1b4b', marginBottom: '16px' }}>Log Daily Usage</h3>
              <form onSubmit={handleUsageSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={styles.fieldLabel}>Select Material *</label>
                    <select
                      value={usageForm.materialId}
                      onChange={e => setUsageForm({ ...usageForm, materialId: e.target.value })}
                      style={styles.formSelect}
                      required
                    >
                      <option value="">-- Select Site Material --</option>
                      {materials.map(m => (
                        <option key={m._id} value={m._id}>{m.name} (Avail: {m.quantity} {m.unit})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Quantity Used *</label>
                    <input
                      type="number"
                      value={usageForm.quantityUsed}
                      onChange={e => setUsageForm({ ...usageForm, quantityUsed: e.target.value })}
                      style={styles.formInput}
                      min="1"
                      required
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={styles.fieldLabel}>Usage Date</label>
                    <input
                      type="date"
                      value={usageForm.date}
                      onChange={e => setUsageForm({ ...usageForm, date: e.target.value })}
                      style={styles.formInput}
                      required
                    />
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Activity / Purpose</label>
                    <input
                      type="text"
                      placeholder="e.g. Brick wall laying, slab plastering..."
                      value={usageForm.purpose}
                      onChange={e => setUsageForm({ ...usageForm, purpose: e.target.value })}
                      style={styles.formInput}
                      required
                    />
                  </div>
                </div>
                <button type="submit" style={styles.orangeBtn}>Record Usage</button>
              </form>

              {showMainStoreStock && mainStoreStock && (
                <div style={{ marginTop: '20px', padding: '16px', background: '#f8fafc', border: '1px dashed #ff9800', borderRadius: '8px', textAlign: 'left' }}>
                  <h4 style={{ margin: '0 0 12px', color: '#0d1b4b', fontWeight: '700', fontSize: '14px' }}>Main Store Stock (Read-Only)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', fontSize: '13px', color: '#475569', marginBottom: '16px' }}>
                    <div><strong>Material Name:</strong> {mainStoreStock.name}</div>
                    <div><strong>Available Qty:</strong> {mainStoreStock.quantity}</div>
                    <div><strong>Last Updated:</strong> {new Date(mainStoreStock.updatedAt).toLocaleString()}</div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => {
                      const selectedMaterial = materials.find(m => m._id === usageForm.materialId);
                      const neededQty = Number(usageForm.quantityUsed) - (selectedMaterial ? selectedMaterial.quantity : 0);
                      setPrForm({
                        projectName: '',
                        notes: `Shortage request for ${selectedMaterial ? selectedMaterial.name : ''}.`,
                        items: [{
                          materialName: selectedMaterial ? selectedMaterial.name : '',
                          quantity: neededQty > 0 ? neededQty : Number(usageForm.quantityUsed),
                          unit: selectedMaterial ? selectedMaterial.unit : 'bag',
                          reason: `Shortage at site store. Needed: ${usageForm.quantityUsed}, Available at site: ${selectedMaterial ? selectedMaterial.quantity : 0}`
                        }]
                      });
                      setView('create-pr');
                    }} 
                    style={{ ...styles.orangeBtn, padding: '8px 16px', fontSize: '12px', background: '#0d1b4b' }}
                  >
                    Request Materials (PR)
                  </button>
                </div>
              )}
            </div>

            <div style={styles.tableContainer}>
              <h3 style={{ padding: '16px 20px', color: '#0d1b4b', margin: 0, borderBottom: '1px solid #eee' }}>Usage Logs Ledger</h3>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeaderRow}>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Material Name</th>
                    <th style={styles.th}>Quantity Used</th>
                    <th style={styles.th}>Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {usageHistory.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#999' }}>No material usage logged.</td>
                    </tr>
                  ) : (
                    usageHistory.map((item, i) => (
                      <tr key={item.id || i} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={styles.td}>{item.date}</td>
                        <td style={styles.tdBold}>{item.materialName}</td>
                        <td style={styles.td}>{item.quantity} {item.unit}</td>
                        <td style={styles.td}>{item.purpose}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
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
    marginBottom: '24px',
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
    fontSize: '22px',
    fontWeight: '700',
    color: '#0d1b4b',
  },
  infoBox: {
    backgroundColor: 'rgba(13, 27, 75, 0.04)',
    border: '1px dashed #cbd5e1',
    borderRadius: '8px',
    padding: '16px 20px',
    marginBottom: '24px',
  },
  infoBoxTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#0d1b4b',
    marginBottom: '6px',
  },
  infoBoxText: {
    fontSize: '13px',
    color: '#475569',
    lineHeight: '1.5',
  },
  tableContainer: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    overflowX: 'auto',
    marginBottom: '24px',
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
    color: '#0d1b4b',
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

export default SiteStoreDashboard;
