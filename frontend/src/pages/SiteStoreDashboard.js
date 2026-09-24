import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { encryptTransit, decryptTransit } from '../utils/cryptoUtils';
import { formatDate, formatFullDate, formatShortDate, formatTime, formatDateTime } from '../utils/dateUtils';
import DateInput from '../components/DateInput';

function SiteStoreDashboard({ user, onLogout }) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [view, setView] = useState('dashboard'); // 'dashboard', 'site-inventory', 'request-materials', 'issue-usage'
  const [showNotifications, setShowNotifications] = useState(false);
  const [userNotifications, setUserNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Site Inventory screen filters
  const [inventorySearchQuery, setInventorySearchQuery] = useState('');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('All');

  // Phase 8 - project selection (drives which project's Site Store inventory/history is shown)
  const [projects, setProjects] = useState([]);
  const [selectedProjId, setSelectedProjId] = useState('');

  // Phase 9 - Material Issuance Note (MIN) States - the Main Store request/receipt
  // lifecycle (Pending/Approved/Issued/Received), unrelated to Material Issue & Usage below.
  const [mins, setMins] = useState([]);
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState({});

  // Request Materials Form State (free-form Material Transfer Request, not
  // gated by an approved BOM)
  const [itemMasterList, setItemMasterList] = useState([]);
  const emptyRequestItemRow = { materialName: '', category: '', unit: '', quantity: '' };
  const [requestForm, setRequestForm] = useState({
    requiredDate: '',
    notes: '',
    items: [{ ...emptyRequestItemRow }]
  });
  // Material Name combobox state for the Request Materials table (mirrors the
  // "click to browse or type to search" behavior of the PM's BOM Material Allocation Table)
  const [requestFocusedRowIdx, setRequestFocusedRowIdx] = useState(null);
  const [requestSuggestions, setRequestSuggestions] = useState([]);
  const [requestHighlightedSuggestionIdx, setRequestHighlightedSuggestionIdx] = useState(-1);
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  // Site Store's own Material Request (SSR) history, shown below the Request
  // Materials form - Main Store -> Site Store replenishment requests, not
  // tied to any project/BOM.
  const [myRequests, setMyRequests] = useState([]);
  // The request whose material breakdown is currently shown in the "View
  // Materials" popup (null when closed) - keeps the history table itself
  // to one row per request instead of an expanded materials list per row.
  const [viewRequest, setViewRequest] = useState(null);

  // Material Issue & Usage Form State - combines the old Material Issuance
  // Note (project selection, MIN numbering) and Material Usage (material,
  // quantity, activity/purpose) screens into a single site-store-inventory ->
  // project transaction.
  const [issueForm, setIssueForm] = useState({
    projectName: '',
    materialId: '',
    quantity: '',
    activity: '',
    notes: '',
    date: new Date().toISOString().substring(0, 10)
  });
  const [issueSubmitting, setIssueSubmitting] = useState(false);

  // Material Issue & Usage History, fetched from the backend (MaterialUsage
  // records created by this screen), scoped to the selected project.
  const [issueHistory, setIssueHistory] = useState([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);

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
      const url = selectedProjId 
        ? `http://localhost:5000/api/site/inventory?projectId=${selectedProjId}` 
        : 'http://localhost:5000/api/site/inventory';
      const res = await fetch(url, {
        headers: getHeaders()
      });
      const data = await res.json();
      let finalData = data;
      if (data && data.ciphertext) {
        try {
          const decrypted = decryptTransit(data.ciphertext);
          finalData = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
        } catch (e) {
          finalData = data;
        }
      }
      if (Array.isArray(finalData)) {
        setMaterials(finalData);
      } else if (finalData && finalData.success && Array.isArray(finalData.data)) {
        setMaterials(finalData.data);
      } else {
        if (!res.ok && finalData && finalData.message) {
          setError(finalData.message);
        } else {
          setError(finalData?.message || 'Failed to fetch site inventory.');
        }
      }
    } catch (err) {
      console.error('Error fetching site materials:', err);
      setError('Could not connect to the backend server.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMINs = async () => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/min', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      let finalData = data;
      if (data && data.ciphertext) {
        try {
          const decrypted = decryptTransit(data.ciphertext);
          finalData = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
        } catch (e) {
          finalData = data;
        }
      }
      if (finalData && finalData.success && Array.isArray(finalData.data)) {
        const filtered = selectedProjId
          ? finalData.data.filter(m => String(m.projectId) === String(selectedProjId))
          : finalData.data;
        setMins(filtered);
      }
    } catch (err) {
      console.error('Error fetching Material Issuance Notes:', err);
    }
  };

  const fetchItemMasters = async () => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/item-master', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setItemMasterList(data.data);
      }
    } catch (err) {
      console.error('Error fetching item master list:', err);
    }
  };

  const fetchMyRequests = async () => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/material-requests/my-requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setMyRequests(data.data);
      }
    } catch (err) {
      console.error('Error fetching material requests:', err);
    }
  };

  // Material Issue & Usage history - MaterialUsage records created by this
  // screen's combined issue-and-use transaction, scoped to the selected project.
  const fetchIssueHistory = async () => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/material-usage', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const filtered = selectedProjId
          ? data.data.filter(u => String(u.projectId) === String(selectedProjId))
          : data.data;
        setIssueHistory(filtered);
      }
    } catch (err) {
      console.error('Error fetching Material Issue & Usage history:', err);
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

  // Drives the project selector shared by Site Inventory and Material Issue &
  // Usage - resolves the chosen project name to its _id (selectedProjId),
  // which everything else (site inventory, MIN history, issue history) is
  // scoped by.
  const handleProjectChange = (projectName) => {
    setError(''); setSuccess('');
    const proj = projects.find(p => p.projectName === projectName || p.name === projectName);
    setSelectedProjId(proj ? proj._id : '');
    setIssueForm(prev => ({ ...prev, projectName, materialId: '', quantity: '' }));
  };

  const handleConfirmReceipt = async (minId) => {
    setError(''); setSuccess('');
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch(`http://localhost:5000/api/min/${minId}/confirm-receipt`, {
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
        fetchMINs();
      } else {
        setError(data.message || 'Failed to confirm receipt.');
      }
    } catch (err) {
      setError('Connection error occurred.');
    }
  };

  const fetchUserNotifications = async () => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      if (!token) return;
      const res = await fetch('http://localhost:5000/api/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setUserNotifications(data.data || []);
        setUnreadCount((data.data || []).filter(n => !n.isRead).length);
      }
    } catch (err) {
      console.error('Error fetching user notifications:', err);
    }
  };

  const handleMarkNotificationRead = async (notif) => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      await fetch(`http://localhost:5000/api/notifications/${notif._id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
    setUserNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - (notif.isRead ? 0 : 1)));
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      await fetch('http://localhost:5000/api/notifications/mark-all-read', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications read:', err);
    }
  };

  useEffect(() => {
    fetchMaterials();
    fetchProjects();
    fetchMINs();
    fetchItemMasters();
    fetchMyRequests();
    fetchIssueHistory();
    fetchUserNotifications();
  }, [selectedProjId]);

  useEffect(() => {
    // Polls fairly frequently so a transfer/auto-generate Main Store performs
    // (stock quantities, and this request's fulfilledQty/status) shows up
    // here without the officer having to switch projects or reload.
    const interval = setInterval(() => {
      fetchMaterials();
      fetchMINs();
      fetchMyRequests();
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedProjId]);

  // Submits the combined Material Issue & Usage transaction: one call decreases
  // Site Store inventory and records the quantity as actual project usage.
  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');

    const { materialId, quantity, activity, notes, date } = issueForm;

    if (!selectedProjId) {
      setError('Please select a project.');
      return;
    }
    if (!materialId) {
      setError('Please select a material.');
      return;
    }
    const qty = Number(quantity);
    if (!quantity || Number.isNaN(qty) || qty <= 0) {
      setError('Please enter a valid quantity greater than 0.');
      return;
    }
    if (!activity || !activity.trim()) {
      setError('Activity / Purpose is required.');
      return;
    }

    const selectedMaterial = materials.find(m => m._id === materialId);
    if (selectedMaterial && qty > selectedMaterial.quantity) {
      setError(`Insufficient site stock. Available quantity: ${selectedMaterial.quantity} ${selectedMaterial.unit}.`);
      return;
    }

    setIssueSubmitting(true);
    try {
      const res = await fetch('http://localhost:5000/api/site/material-usage', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          projectId: selectedProjId,
          materialId,
          quantity: qty,
          activity: activity.trim(),
          notes: notes || '',
          date
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess(`✅ ${data.message || 'Material issued and usage recorded successfully.'}`);
        setIssueForm(prev => ({
          ...prev,
          materialId: '',
          quantity: '',
          activity: '',
          notes: '',
          date: new Date().toISOString().substring(0, 10)
        }));
        fetchMaterials();
        fetchIssueHistory();
      } else {
        setError(data.message || 'Failed to record the material issue.');
      }
    } catch (err) {
      setError('Could not connect to the backend server to record the material issue.');
    } finally {
      setIssueSubmitting(false);
    }
  };

  const currentProjectName = (() => {
    const userProjId = user?.projectId || user?.project_id;
    const userProj = projects.find(p => p._id === userProjId);
    return userProj ? (userProj.projectName || userProj.name) : issueForm.projectName;
  })();

  // Sorted list of distinct categories in the active Item Master catalog, used to
  // power the "choose a category first" filter above the material search box.
  const requestMaterialCategories = Array.from(
    new Set(itemMasterList.map(item => item.category || 'Other'))
  ).sort();

  // Best-effort preview of the next Request No. this officer would receive.
  // The server numbers requests off a global count across every Site Store
  // Officer, but this officer can only see their own request history, so this
  // is an estimate (same caveat as Main Store's GRN Number preview) rather
  // than a guarantee - the real number is confirmed once the request is submitted.
  const nextRequestNumber = () => {
    const year = new Date().getFullYear();
    const prefix = `SSR-${year}-`;
    const maxSerial = myRequests.reduce((max, r) => {
      if (typeof r.requestNo === 'string' && r.requestNo.startsWith(prefix)) {
        const n = parseInt(r.requestNo.slice(prefix.length), 10);
        if (!isNaN(n) && n > max) return n;
      }
      return max;
    }, 0);
    return `${prefix}${String(maxSerial + 1).padStart(3, '0')}`;
  };

  // Returns the active Item Master entries matching a search term (name or code),
  // narrowed to the row's chosen category when set.
  const getMatchingRequestMaterials = (val, category) => {
    const q = (val || '').trim().toLowerCase();
    let list = itemMasterList;
    if (category) {
      list = list.filter(item => (item.category || 'Other') === category);
    }
    if (!q) return list;
    return list.filter(item =>
      (item.materialName && item.materialName.toLowerCase().includes(q)) ||
      (item.materialCode && item.materialCode.toLowerCase().includes(q))
    );
  };

  const handleRequestCategoryChange = (idx, category) => {
    const updated = [...requestForm.items];
    updated[idx].category = category;
    updated[idx].materialName = '';
    updated[idx].unit = '';
    setRequestForm({ ...requestForm, items: updated });

    setRequestFocusedRowIdx(idx);
    setRequestHighlightedSuggestionIdx(-1);
    setRequestSuggestions(getMatchingRequestMaterials('', category));
  };

  const handleRequestSuggestionClick = (idx, item) => {
    const updated = [...requestForm.items];
    updated[idx].materialName = item.materialName;
    updated[idx].category = item.category || 'Other';
    updated[idx].unit = item.unit || '';
    setRequestForm({ ...requestForm, items: updated });

    setRequestSuggestions([]);
    setRequestHighlightedSuggestionIdx(-1);
    setRequestFocusedRowIdx(null);
  };

  const handleRequestMaterialNameChange = (idx, val) => {
    const updated = [...requestForm.items];
    updated[idx].materialName = val;
    // Typing invalidates any prior selection until a material is picked from
    // the Item Master dropdown again - only catalog materials are submittable.
    updated[idx].unit = '';
    setRequestForm({ ...requestForm, items: updated });

    setRequestFocusedRowIdx(idx);
    setRequestHighlightedSuggestionIdx(-1);
    setRequestSuggestions(getMatchingRequestMaterials(val, updated[idx].category));
  };

  const handleRequestMaterialsSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');

    if (!selectedProjId) {
      setError('Please select which Site Store this request is for.');
      return;
    }

    if (!requestForm.requiredDate) {
      setError('Please choose a required date.');
      return;
    }

    const invalid = requestForm.items.some(item => !item.materialName || !item.quantity || Number(item.quantity) <= 0);
    if (invalid) {
      setError('Please select a material and enter a valid request quantity for all rows.');
      return;
    }

    // A material must actually be picked from the Item Master catalog (not
    // just typed) - a picked row always has its Unit auto-filled.
    const unresolved = requestForm.items.some(item => !item.unit);
    if (unresolved) {
      setError('Please choose each material from the suggestion list so its category/unit can be confirmed.');
      return;
    }

    const names = requestForm.items.map(item => item.materialName.trim().toLowerCase());
    const hasDuplicates = new Set(names).size !== names.length;
    if (hasDuplicates) {
      setError('Each material can only appear once per request. Please remove the duplicate row.');
      return;
    }

    setRequestSubmitting(true);
    try {
      const payload = {
        siteStoreId: selectedProjId,
        requiredDate: requestForm.requiredDate,
        notes: requestForm.notes,
        materials: requestForm.items.map(item => ({
          materialName: item.materialName,
          quantity: item.quantity,
          unit: item.unit
        }))
      };

      const ciphertext = encryptTransit(JSON.stringify(payload));

      const res = await fetch('http://localhost:5000/api/material-requests', {
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
        setSuccess(`✅ Material request ${finalData.data.requestNo} submitted successfully to Main Store!`);
        setRequestForm({ requiredDate: '', notes: '', items: [{ ...emptyRequestItemRow }] });
        fetchMyRequests();
      } else {
        setError(finalData.message || 'Failed to submit material request.');
      }
    } catch (err) {
      setError('Could not connect to the backend server to submit the material request.');
    } finally {
      setRequestSubmitting(false);
    }
  };

  const handleCancelRequest = async (id) => {
    setError(''); setSuccess('');
    try {
      const res = await fetch(`http://localhost:5000/api/material-requests/${id}/cancel`, {
        method: 'PUT',
        headers: getHeaders()
      });
      const data = await res.json();
      let finalData = data;
      if (data && data.ciphertext) {
        finalData = JSON.parse(decryptTransit(data.ciphertext));
      }
      if (res.ok && finalData.success) {
        setSuccess('Request cancelled.');
        fetchMyRequests();
      } else {
        setError(finalData.message || 'Failed to cancel request.');
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

  // Stock status tiers, mirroring Main Store: NORMAL (above Pre-Order Level),
  // PRE_ORDER (at/below Pre-Order Level but above Minimum Level), CRITICAL
  // (at/below Minimum Level). Thresholds always come from the Material record.
  const inventoryMaterialStatus = (m) => {
    const preOrderLevel = m.reorderLevel ?? m.minimumStock;
    if (m.quantity <= m.minimumStock) return { label: 'Critical', tier: 'CRITICAL', bg: '#ffebee', color: '#c62828' };
    if (m.quantity <= preOrderLevel) return { label: 'Pre-Order', tier: 'PRE_ORDER', bg: '#fff3e0', color: '#b7791f' };
    return { label: 'Normal', tier: 'NORMAL', bg: '#e8f5e9', color: '#2e7d32' };
  };

  const siteWarningItems = materials.filter(m => inventoryMaterialStatus(m).tier !== 'NORMAL').length;

  // Site Inventory screen stats
  const sitePreOrderItems = materials.filter(m => inventoryMaterialStatus(m).tier === 'PRE_ORDER').length;
  const siteCriticalItems = materials.filter(m => inventoryMaterialStatus(m).tier === 'CRITICAL').length;
  const now = new Date();
  const receivedThisMonthCount = mins.filter(m => {
    if (m.status !== 'Received' || !m.receivedAt) return false;
    const d = new Date(m.receivedAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  // Total quantity historically confirmed as received at site, per material name
  const issuedToSiteByMaterial = {};
  mins.filter(m => m.status === 'Received').forEach(m => {
    (m.materials || []).forEach(mat => {
      issuedToSiteByMaterial[mat.materialName] = (issuedToSiteByMaterial[mat.materialName] || 0) + Number(mat.quantity || 0);
    });
  });

  // Total quantity consumed at site, per material name (from Material Issue & Usage history)
  const consumedByMaterial = {};
  issueHistory.forEach(u => {
    consumedByMaterial[u.materialName] = (consumedByMaterial[u.materialName] || 0) + Number(u.actualQty || 0);
  });

  const siteFilteredMaterials = materials.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(inventorySearchQuery.toLowerCase());
    const matchesCategory = inventoryCategoryFilter === 'All' || m.category === inventoryCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div style={styles.dashboardLayout}>
      {/* Navigation Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <img src="/els-logo.png" alt="ELS Logo" style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '50%' }} />
          <div>
            <div style={styles.sidebarTitle}>ELS Construction</div>
            <div style={styles.sidebarSubtitle}>Site Store Panel</div>
          </div>
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
            { id: 'request-materials', label: 'Request Materials', icon: '📦' },
            { id: 'issue-usage', label: 'Material Issue & Usage', icon: '🔧' },
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
        {error && <div style={styles.errorAlert}>{error}</div>}
        {success && <div style={styles.successAlert}>{success}</div>}

        {view === 'dashboard' && (
          <div style={styles.container}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h1 style={{ ...styles.pageTitle, marginBottom: 0 }}>
                Site Store Operations Center {(() => {
                  const userProjId = user.projectId || user.project_id;
                  const userProj = projects.find(p => p._id === userProjId);
                  return userProj ? `— ${userProj.projectName || userProj.name}` : '';
                })()}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {/* Notification Bell */}
                <div style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', width: '38px', height: '38px', borderRadius: '50%', border: '1px solid #e2e8f0', justifyContent: 'center', background: '#ffffff' }} onClick={() => setShowNotifications(!showNotifications)}>
                  <span style={{ fontSize: '18px' }}>🔔</span>
                  {unreadCount > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: '2px',
                      right: '2px',
                      background: '#ef4444',
                      color: 'white',
                      borderRadius: '50%',
                      width: '16px',
                      height: '16px',
                      fontSize: '10px',
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
                      top: '48px',
                      right: '0',
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                      width: '320px',
                      maxHeight: '400px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      cursor: 'default',
                      padding: '8px',
                      textAlign: 'left'
                    }} onClick={e => e.stopPropagation()}>
                      <div style={{ padding: '12px', borderBottom: '1px solid #f1f5f9', fontWeight: '700', color: '#0d1b4b', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Site Store Notifications</span>
                        <span onClick={handleMarkAllNotificationsRead} style={{ fontSize: '11px', color: '#2563eb', cursor: 'pointer', fontWeight: '600' }}>Mark all as read</span>
                      </div>
                      {userNotifications.length === 0 ? (
                        <div style={{ padding: '24px', color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
                          No new notifications.
                        </div>
                      ) : (
                        userNotifications.map((notif, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleMarkNotificationRead(notif)}
                            style={{
                              padding: '12px',
                              borderBottom: idx === userNotifications.length - 1 ? 'none' : '1px solid #f1f5f9',
                              fontSize: '13px',
                              cursor: 'pointer',
                              background: notif.isRead ? 'white' : '#f8fafc'
                            }}
                          >
                            <div style={{ color: notif.isRead ? '#475569' : '#0f172a', fontWeight: notif.isRead ? '400' : '600' }}>
                              {notif.message}
                            </div>
                            <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
                              {formatFullDate(notif.createdAt)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Date display next to notification icon */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569', fontWeight: '600', background: '#f8fafc', padding: '6px 14px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                  <Calendar size={15} style={{ color: '#2563eb' }} />
                  <span>{formatFullDate(currentTime)}</span>
                </div>
              </div>
            </div>

            {/* Low Stock Alert Section */}
            {materials.some(m => m.quantity < (m.reorderLevel !== undefined ? m.reorderLevel : 50)) && (
              <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '16px', marginBottom: '24px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', textAlign: 'left' }}>
                <h3 style={{ margin: '0 0 12px', color: '#b45309', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⚠️ Low Stock Alert (Below Reorder Level)
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #f59e0b', color: '#4b5563' }}>
                        <th style={{ padding: '6px 8px' }}>Project Name</th>
                        <th style={{ padding: '6px 8px' }}>Material Name</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Current Stock</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Min Level</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Reorder Level</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Max Level</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Shortage</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materials.filter(m => m.quantity < (m.reorderLevel !== undefined ? m.reorderLevel : 50)).map((m, idx) => {
                        const min = m.minimumStock || 10;
                        const reorder = m.reorderLevel !== undefined ? m.reorderLevel : 50;
                        const max = m.maximumStock || 100;
                        const shortage = Math.max(0, max - m.quantity);
                        const isCritical = m.quantity <= min;
                        const projName = m.project_id?.projectName || m.projectId?.projectName || m.project_id?.name || m.projectId?.name || 'Main Project';
                        return (
                          <tr key={m._id || idx} style={{ borderBottom: '1px solid #fef3c7' }}>
                            <td style={{ padding: '8px', fontWeight: '600' }}>{projName}</td>
                            <td style={{ padding: '8px' }}>{m.name}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{m.quantity} {m.unit}</td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>{min} {m.unit}</td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>{reorder} {m.unit}</td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>{max} {m.unit}</td>
                            <td style={{ padding: '8px', textAlign: 'right', color: '#dc2626', fontWeight: '700' }}>{shortage} {m.unit}</td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>
                              <span style={{ 
                                background: isCritical ? '#fee2e2' : '#ffedd5',
                                color: isCritical ? '#991b1b' : '#c2410c',
                                padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', fontSize: '10px'
                              }}>
                                {isCritical ? 'Critical' : 'Pre-Order'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

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
              <div style={{ ...styles.statCard, borderLeft: siteWarningItems > 0 ? '4px solid #ef4444' : '4px solid #0d1b4b' }}>
                <div style={styles.statLabel}>Stock Warnings</div>
                <div style={{ ...styles.statValue, color: siteWarningItems > 0 ? '#ef4444' : '#0d1b4b' }}>{siteWarningItems}</div>
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
                      const status = inventoryMaterialStatus(m);
                      return (
                        <tr key={m._id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={styles.tdBold}>{m.name}</td>
                          <td style={styles.td}>{m.category}</td>
                          <td style={styles.td}>{m.unit}</td>
                          <td style={styles.td}>{m.quantity}</td>
                          <td style={styles.td}>
                            <span style={{ background: status.bg, color: status.color, padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>{status.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Material Issuance Note Status List */}
            <div style={{ ...styles.tableContainer, marginTop: '24px' }}>
              <h3 style={{ padding: '16px 20px', color: '#0d1b4b', margin: 0, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                📋 Material Issuance Note Status Logs
              </h3>
              {mins.length === 0 ? (
                <div style={styles.emptyState}>No Material Issuance Note logs found.</div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeaderRow}>
                      <th style={styles.th}>MIN No.</th>
                      <th style={styles.th}>Materials Requested</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Notes</th>
                      <th style={styles.th}>Feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mins.map(m => (
                      <tr key={m._id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ ...styles.td, fontWeight: 'bold' }}>{m.minNumber}</td>
                        <td style={styles.td}>
                          {(m.materials || []).map((mat, i) => (
                            <div key={i} style={{ marginBottom: '4px' }}>
                              {mat.materialName} ({mat.quantity} {mat.unit})
                              {mat.exceedsBom && (
                                <div>
                                  <span style={{ background: '#ffedd5', color: '#c2410c', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', fontSize: '10px', display: 'inline-block', marginTop: '2px' }}>
                                    ⚠️ Exceeds BOM plan by {mat.exceedAmount} {mat.unit}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
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
                        <td style={styles.td}>{m.status === 'Rejected' ? m.rejectionReason : m.status === 'Issued' ? 'Shipped — confirm receipt under Site Inventory' : m.status === 'Received' ? 'Delivered & confirmed' : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {view === 'site-inventory' && (
          <div style={styles.container}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <h1 style={{ ...styles.pageTitle, marginBottom: 0 }}>Site Store Inventory Directory</h1>
            </div>
            <div style={{ color: '#64748b', fontSize: '13px', marginBottom: '16px' }}>
              What's currently available at this site, what's been issued here from Main Store, what's been consumed, and what's running low.
            </div>

            {/* Summary Cards */}
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Total Materials</div>
                <div style={styles.statValue}>{totalSiteSKUs}</div>
              </div>
              <div style={{ ...styles.statCard, borderLeft: sitePreOrderItems > 0 ? '4px solid #b7791f' : '4px solid #0d1b4b' }}>
                <div style={styles.statLabel}>Pre-Order</div>
                <div style={{ ...styles.statValue, color: sitePreOrderItems > 0 ? '#b7791f' : '#0d1b4b' }}>{sitePreOrderItems}</div>
              </div>
              <div style={{ ...styles.statCard, borderLeft: siteCriticalItems > 0 ? '4px solid #ef4444' : '4px solid #0d1b4b' }}>
                <div style={styles.statLabel}>Critical Stock</div>
                <div style={{ ...styles.statValue, color: siteCriticalItems > 0 ? '#ef4444' : '#0d1b4b' }}>{siteCriticalItems}</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Received This Month</div>
                <div style={styles.statValue}>{receivedThisMonthCount}</div>
              </div>
            </div>

            {/* Filters */}
            <div style={styles.filtersContainer}>
              <input
                type="text"
                placeholder="Search inventory by name..."
                value={inventorySearchQuery}
                onChange={e => setInventorySearchQuery(e.target.value)}
                style={styles.searchInput}
              />
              <div style={styles.filterGroup}>
                <span style={styles.filterLabel}>Category:</span>
                <select
                  value={inventoryCategoryFilter}
                  onChange={e => setInventoryCategoryFilter(e.target.value)}
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
                <div style={styles.loadingText}>Fetching site inventory...</div>
              ) : siteFilteredMaterials.length === 0 ? (
                <div style={styles.emptyState}>No materials found in the Site Store.</div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeaderRow}>
                      <th style={styles.th}>Material Name</th>
                      <th style={styles.th}>Category</th>
                      <th style={styles.th}>Unit</th>
                      <th style={styles.th}>Available at Site</th>
                      <th style={styles.th}>Issued to Site</th>
                      <th style={styles.th}>Consumed</th>
                      <th style={styles.th}>Min Level</th>
                      <th style={styles.th}>Pre-Order Level</th>
                      <th style={styles.th}>Max Level</th>
                      <th style={styles.th}>Total Value (LKR)</th>
                      <th style={styles.th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {siteFilteredMaterials.map(m => {
                      const status = inventoryMaterialStatus(m);
                      return (
                        <tr key={m._id} style={{ borderBottom: '1px solid #eee', backgroundColor: status.tier !== 'NORMAL' ? 'rgba(239,68,68,0.08)' : 'white' }}>
                          <td style={{ ...styles.tdBold, color: status.tier !== 'NORMAL' ? '#c62828' : '#0d1b4b' }}>{m.name}</td>
                          <td style={styles.td}>{m.category}</td>
                          <td style={styles.td}>{m.unit}</td>
                          <td style={styles.td}>{m.quantity}</td>
                          <td style={styles.td}>{issuedToSiteByMaterial[m.name] || 0}</td>
                          <td style={styles.td}>{consumedByMaterial[m.name] || 0}</td>
                          <td style={styles.td}>{m.minimumStock}</td>
                          <td style={styles.td}>{m.reorderLevel}</td>
                          <td style={styles.td}>{m.maximumStock}</td>
                          <td style={styles.td}>LKR {(m.quantity * (m.unitPrice || 0)).toLocaleString()}</td>
                          <td style={styles.td}>
                            <span style={{ background: status.bg, color: status.color, padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>{status.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* In-Transit Material Issuance Notes Section */}
            <div style={{ ...styles.tableContainer, marginTop: '30px' }}>
              <div style={{ padding: '16px 20px', color: 'white', margin: 0, borderBottom: '1px solid #eee', background: '#0d1b4b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '15px', color: 'white' }}>🚚 In-Transit Shipments (Awaiting Receipt)</h3>
              </div>
              {mins.filter(m => m.status === 'Issued').length === 0 ? (
                <div style={styles.emptyState}>No shipments currently in-transit.</div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeaderRow}>
                      <th style={styles.th}>MIN No.</th>
                      <th style={styles.th}>Materials</th>
                      <th style={styles.th}>Issued By</th>
                      <th style={styles.th}>Date Shipped</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mins.filter(m => m.status === 'Issued').map(m => (
                      <tr key={m._id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={styles.tdBold}>{m.minNumber}</td>
                        <td style={styles.td}>
                          {(m.materials || []).map((mat, i) => (
                            <div key={i}>{mat.materialName} ({mat.quantity} {mat.unit})</div>
                          ))}
                        </td>
                        <td style={styles.td}>{m.issuedBy}</td>
                        <td style={styles.td}>{formatDate(m.issuedAt)}</td>
                        <td style={styles.td}>
                          <span style={{ background: '#fef3c7', color: '#d97706', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                            {m.status}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <button
                            onClick={() => handleConfirmReceipt(m._id)}
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

        {view === 'request-materials' && (
          <div style={styles.container}>
            <h1 style={styles.pageTitle}>Request Materials</h1>
            <p style={{ color: '#64748b', fontSize: '13px', marginTop: '-12px', marginBottom: '20px' }}>
              Request additional stock from Main Store for {currentProjectName ? `${currentProjectName} Site Store` : 'your Site Store'} when your own stock isn't enough.
            </p>
            <div style={styles.formCard}>
              <form onSubmit={handleRequestMaterialsSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px', maxWidth: '760px' }}>
                  <div>
                    <label style={styles.fieldLabel}>Request No.</label>
                    <div style={{ ...styles.formInput, background: '#f1f5f9', color: '#0d1b4b', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                      {nextRequestNumber()}
                    </div>
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Project / Site Store *</label>
                    <select
                      value={issueForm.projectName}
                      onChange={e => handleProjectChange(e.target.value)}
                      style={styles.formSelect}
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
                    <label style={styles.fieldLabel}>Required Date *</label>
                    <DateInput
                      value={requestForm.requiredDate}
                      onChange={iso => setRequestForm({ ...requestForm, requiredDate: iso })}
                      style={styles.formInput}
                      required
                    />
                  </div>
                </div>

                <h4 style={{ color: '#0d1b4b', margin: '20px 0 10px', fontSize: '14px', fontWeight: '700' }}>Material Allocation Table</h4>
                {/* paddingBottom reserves room for the material search dropdown (~5 rows) so it isn't
                    clipped by this container's overflow-x:auto, which the CSS spec also turns into
                    an overflow-y clip when overflow-y is left at its default. */}
                <div style={{ overflowX: 'auto', paddingBottom: requestFocusedRowIdx !== null ? '260px' : '20px', transition: 'padding-bottom 0.15s ease' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                        {['Material Name *', 'Category', 'Unit', 'Available at Site', 'Request Qty *', 'Action'].map(h => (
                          <th key={h} style={{ padding: '10px', textAlign: 'left', fontSize: '12px', color: '#475569', fontWeight: '600' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {requestForm.items.map((item, idx) => {
                        const siteMat = materials.find(m => m.name === item.materialName);
                        const availableAtSite = siteMat ? siteMat.quantity : 0;
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            {/* Material Combobox: click to browse (narrowed to the row's chosen Category, if any), or type to filter */}
                            <td style={{ padding: '8px 4px', width: '220px', position: 'relative' }}>
                              <div style={{ position: 'relative' }}>
                                <input
                                  type="text"
                                  placeholder="Click to browse or type to search..."
                                  value={item.materialName}
                                  onChange={e => handleRequestMaterialNameChange(idx, e.target.value)}
                                  onFocus={() => {
                                    setRequestFocusedRowIdx(idx);
                                    setRequestHighlightedSuggestionIdx(-1);
                                    setRequestSuggestions(getMatchingRequestMaterials(item.materialName, item.category));
                                  }}
                                  onBlur={() => setRequestFocusedRowIdx(null)}
                                  onKeyDown={e => {
                                    if (requestFocusedRowIdx !== idx || requestSuggestions.length === 0) return;
                                    if (e.key === 'ArrowDown') {
                                      e.preventDefault();
                                      setRequestHighlightedSuggestionIdx(prev => Math.min(prev + 1, requestSuggestions.length - 1));
                                    } else if (e.key === 'ArrowUp') {
                                      e.preventDefault();
                                      setRequestHighlightedSuggestionIdx(prev => Math.max(prev - 1, 0));
                                    } else if (e.key === 'Enter') {
                                      if (requestHighlightedSuggestionIdx >= 0) {
                                        e.preventDefault();
                                        handleRequestSuggestionClick(idx, requestSuggestions[requestHighlightedSuggestionIdx]);
                                      }
                                    } else if (e.key === 'Escape') {
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  style={{ width: '100%', padding: '8px 28px 8px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }}
                                  required
                                />
                                <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#94a3b8', pointerEvents: 'none' }}>▼</span>
                              </div>
                              {requestFocusedRowIdx === idx && (
                                <div style={{ position: 'absolute', top: '100%', left: 4, right: 4, background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', boxShadow: '0 8px 20px rgba(0,0,0,0.12)', zIndex: 1000, maxHeight: '280px', overflowY: 'auto' }}>
                                  {requestSuggestions.length === 0 ? (
                                    <div style={{ padding: '14px 12px', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
                                      No active material{item.category ? ` in "${item.category}"` : ''} matches{item.materialName.trim() ? ` "${item.materialName}"` : ''}.
                                    </div>
                                  ) : (
                                    Object.entries(
                                      requestSuggestions.reduce((acc, sugg, i) => {
                                        const cat = sugg.category || 'Other';
                                        (acc[cat] = acc[cat] || []).push({ ...sugg, __flatIdx: i });
                                        return acc;
                                      }, {})
                                    ).map(([cat, items]) => (
                                      <div key={cat}>
                                        <div style={{ position: 'sticky', top: 0, background: '#eef2ff', color: '#3730a3', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px', padding: '5px 12px' }}>
                                          {cat}
                                        </div>
                                        {items.map(sugg => (
                                          <div
                                            key={sugg._id}
                                            onClick={() => handleRequestSuggestionClick(idx, sugg)}
                                            onMouseDown={e => e.preventDefault()}
                                            onMouseEnter={() => setRequestHighlightedSuggestionIdx(sugg.__flatIdx)}
                                            style={{
                                              padding: '8px 12px',
                                              cursor: 'pointer',
                                              fontSize: '12px',
                                              borderBottom: '1px solid #f1f5f9',
                                              background: sugg.__flatIdx === requestHighlightedSuggestionIdx ? '#eff6ff' : 'white',
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              gap: '8px'
                                            }}
                                          >
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                              <strong style={{ color: '#0d1b4b' }}>{sugg.materialName}</strong>{' '}
                                              <span style={{ color: '#94a3b8', fontSize: '11px' }}>({sugg.materialCode})</span>
                                            </span>
                                            <span style={{ color: '#64748b', fontSize: '11px', whiteSpace: 'nowrap' }}>
                                              {sugg.unit}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    ))
                                  )}
                                </div>
                              )}
                            </td>
                            {/* Category - choose first to narrow the Material Name list; auto-set once a material is picked */}
                            <td style={{ padding: '8px 4px', width: '150px' }}>
                              <select
                                value={item.category}
                                onChange={e => handleRequestCategoryChange(idx, e.target.value)}
                                style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', background: 'white', color: '#334155' }}
                              >
                                <option value="">-- Any --</option>
                                {requestMaterialCategories.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </td>
                            {/* Unit - Read only */}
                            <td style={{ padding: '8px 4px', width: '90px' }}>
                              <input
                                type="text"
                                value={item.unit || ''}
                                placeholder="Autofilled"
                                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '13px', background: '#f8fafc', color: '#475569' }}
                                readOnly
                              />
                            </td>
                            {/* Available at Site - Read only */}
                            <td style={{ padding: '8px 4px', width: '140px' }}>
                              <input
                                type="text"
                                value={item.materialName ? `${availableAtSite} ${item.unit || ''}`.trim() : ''}
                                placeholder="—"
                                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '13px', background: '#f8fafc', color: '#475569' }}
                                readOnly
                              />
                            </td>
                            {/* Request Quantity */}
                            <td style={{ padding: '8px 4px', width: '110px' }}>
                              <input
                                type="number"
                                min="1"
                                placeholder="Quantity"
                                value={item.quantity}
                                onChange={e => {
                                  const updated = [...requestForm.items];
                                  updated[idx].quantity = e.target.value;
                                  setRequestForm({ ...requestForm, items: updated });
                                }}
                                style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }}
                                required
                              />
                            </td>
                            {/* Remove button */}
                            <td style={{ padding: '8px 4px', width: '60px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => setRequestForm({ ...requestForm, items: requestForm.items.filter((_, i) => i !== idx) })}
                                disabled={requestForm.items.length === 1}
                                style={{ background: '#ef4444', color: 'white', border: 'none', width: '32px', height: '32px', borderRadius: '4px', cursor: requestForm.items.length === 1 ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={() => setRequestForm({ ...requestForm, items: [...requestForm.items, { ...emptyRequestItemRow }] })}
                  style={{ background: '#f1f5f9', color: '#0d1b4b', border: '1px solid #cbd5e1', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', marginBottom: '16px' }}
                >
                  ➕ Add Material Row
                </button>

                <div style={{ marginBottom: '16px' }}>
                  <label style={styles.fieldLabel}>Notes</label>
                  <textarea
                    placeholder="Enter extra instructions or remarks..."
                    value={requestForm.notes}
                    onChange={e => setRequestForm({ ...requestForm, notes: e.target.value })}
                    style={{ ...styles.formInput, height: '80px' }}
                  />
                </div>

                <button type="submit" disabled={requestSubmitting} style={styles.orangeBtn}>
                  {requestSubmitting ? 'Submitting...' : 'Submit Material Request'}
                </button>
              </form>
            </div>

            <div style={styles.tableContainer}>
              <h3 style={{ padding: '16px 20px', color: '#0d1b4b', margin: 0, borderBottom: '1px solid #eee' }}>My Material Requests</h3>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeaderRow}>
                    <th style={styles.th}>Request No.</th>
                    <th style={styles.th}>Site / Project</th>
                    <th style={styles.th}>Required Date</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>MTN No.</th>
                    <th style={styles.th}>Notes</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {myRequests.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={styles.emptyState}>No material requests submitted yet.</td>
                    </tr>
                  ) : (
                    myRequests.map(r => {
                      const statusStyle = {
                        Pending: { bg: '#fff3e0', color: '#b7791f' },
                        Processing: { bg: '#e3f2fd', color: '#1565c0' },
                        Transferred: { bg: '#e8f5e9', color: '#2e7d32' },
                        'Partially Transferred': { bg: '#e0f2f1', color: '#00695c' },
                        Rejected: { bg: '#ffebee', color: '#c62828' },
                        Cancelled: { bg: '#f1f5f9', color: '#64748b' }
                      }[r.status] || { bg: '#f1f5f9', color: '#64748b' };
                      return (
                        <tr key={r._id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ ...styles.tdBold, color: '#1a365d' }}>{r.requestNo}</td>
                          <td style={styles.td}>{r.siteStoreName}</td>
                          <td style={styles.td}>{r.requiredDate ? formatDate(r.requiredDate) : '-'}</td>
                          <td style={styles.td}>
                            <span style={{ background: statusStyle.bg, color: statusStyle.color, padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                              {r.status}
                            </span>
                            {r.status === 'Rejected' && r.rejectionReason && (
                              <div style={{ fontSize: '11px', color: '#c62828', marginTop: '4px' }}>{r.rejectionReason}</div>
                            )}
                          </td>
                          <td style={styles.td}>{r.mtnNumber || '-'}</td>
                          <td style={styles.td}>{r.notes || '-'}</td>
                          <td style={styles.td}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              <button
                                onClick={() => setViewRequest(r)}
                                style={{ background: '#1a73e8', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                              >
                                View
                              </button>
                              {r.status === 'Pending' && (
                                <button
                                  onClick={() => handleCancelRequest(r._id)}
                                  style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
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

        {view === 'issue-usage' && (
          <div style={styles.container}>
            <h1 style={styles.pageTitle}>Material Issue & Usage</h1>
            <div style={styles.formCard}>
              <h3 style={{ color: '#0d1b4b', marginBottom: '16px' }}>Issue Material to Project</h3>
              <form onSubmit={handleIssueSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={styles.fieldLabel}>Project Name *</label>
                    <select
                      value={issueForm.projectName}
                      onChange={e => handleProjectChange(e.target.value)}
                      style={styles.formSelect}
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
                    <label style={styles.fieldLabel}>Date *</label>
                    <DateInput
                      value={issueForm.date}
                      onChange={iso => setIssueForm({ ...issueForm, date: iso })}
                      style={styles.formInput}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={styles.fieldLabel}>Material *</label>
                    <select
                      value={issueForm.materialId}
                      onChange={e => setIssueForm({ ...issueForm, materialId: e.target.value, quantity: '' })}
                      style={styles.formSelect}
                      disabled={!selectedProjId}
                      required
                    >
                      <option value="">-- Select Material --</option>
                      {materials.map(m => (
                        <option key={m._id} value={m._id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Available at Site</label>
                    <input
                      type="text"
                      value={(() => {
                        const m = materials.find(mat => mat._id === issueForm.materialId);
                        return m ? `${m.quantity} ${m.unit}` : '-';
                      })()}
                      style={{ ...styles.formInput, background: '#f1f5f9' }}
                      disabled
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={styles.fieldLabel}>Quantity *</label>
                    <input
                      type="number"
                      value={issueForm.quantity}
                      onChange={e => setIssueForm({ ...issueForm, quantity: e.target.value })}
                      style={styles.formInput}
                      min="1"
                      max={(() => {
                        const m = materials.find(mat => mat._id === issueForm.materialId);
                        return m ? m.quantity : undefined;
                      })()}
                      disabled={!issueForm.materialId}
                      required
                    />
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Unit</label>
                    <input
                      type="text"
                      value={(() => {
                        const m = materials.find(mat => mat._id === issueForm.materialId);
                        return m ? m.unit : '';
                      })()}
                      style={{ ...styles.formInput, background: '#f1f5f9' }}
                      disabled
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={styles.fieldLabel}>Activity / Purpose *</label>
                  <input
                    type="text"
                    placeholder="e.g. Brick wall laying, slab plastering, formwork..."
                    value={issueForm.activity}
                    onChange={e => setIssueForm({ ...issueForm, activity: e.target.value })}
                    style={styles.formInput}
                    required
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={styles.fieldLabel}>Notes</label>
                  <textarea
                    placeholder="Enter extra instructions or remarks..."
                    value={issueForm.notes}
                    onChange={e => setIssueForm({ ...issueForm, notes: e.target.value })}
                    style={{ ...styles.formInput, height: '80px' }}
                  />
                </div>

                <button type="submit" style={styles.orangeBtn} disabled={issueSubmitting || !selectedProjId}>
                  {issueSubmitting ? 'Recording...' : 'Record Material Issue'}
                </button>
              </form>
            </div>

            <div style={styles.tableContainer}>
              <h3 style={{ padding: '16px 20px', color: '#0d1b4b', margin: 0, borderBottom: '1px solid #eee' }}>Material Issue & Usage History</h3>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeaderRow}>
                    <th style={styles.th}>MIN No.</th>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Project</th>
                    <th style={styles.th}>Material</th>
                    <th style={styles.th}>Quantity</th>
                    <th style={styles.th}>Unit</th>
                    <th style={styles.th}>Activity / Purpose</th>
                    <th style={styles.th}>Issued By</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {issueHistory.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ padding: '24px', textAlign: 'center', color: '#999' }}>No material issue & usage records found.</td>
                    </tr>
                  ) : (
                    issueHistory.map((item, i) => (
                      <React.Fragment key={item._id || i}>
                        <tr style={{ borderBottom: '1px solid #eee' }}>
                          <td style={styles.tdBold}>{item.minNumber || '-'}</td>
                          <td style={styles.td}>{formatDate(item.usageDate)}</td>
                          <td style={styles.td}>{item.projectName}</td>
                          <td style={styles.tdBold}>{item.materialName}</td>
                          <td style={styles.td}>{item.actualQty}</td>
                          <td style={styles.td}>{item.unit}</td>
                          <td style={styles.td}>{item.activity || '-'}</td>
                          <td style={styles.td}>{item.recordedBy}</td>
                          <td style={styles.td}>
                            <button
                              type="button"
                              onClick={() => setExpandedHistoryId(expandedHistoryId === (item._id || i) ? null : (item._id || i))}
                              style={{ background: '#e3f2fd', color: '#1565c0', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                            >
                              {expandedHistoryId === (item._id || i) ? 'Hide' : 'View'}
                            </button>
                          </td>
                        </tr>
                        {expandedHistoryId === (item._id || i) && (
                          <tr>
                            <td colSpan="9" style={{ padding: '12px 20px', background: '#f8fafc', textAlign: 'left', fontSize: '13px', color: '#475569' }}>
                              <strong>Notes:</strong> {item.notes || 'None'}<br />
                              {item.plannedQty > 0 && (
                                <>
                                  <strong>BOM Planned Qty:</strong> {item.plannedQty} {item.unit} &nbsp;|&nbsp;
                                  <strong>Variance:</strong> {item.variance > 0 ? '+' : ''}{item.variance} {item.unit}
                                </>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '20px 0 8px', marginTop: '16px', fontSize: '12px', color: '#94a3b8' }}>
          ELS Construction Material Management System &copy;2026
        </div>
      </main>

      {/* Requested Materials popup - opened via "View" on a My Material Requests row */}
      {viewRequest && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }} onClick={() => setViewRequest(null)}>
          <div style={{ background: 'white', padding: '28px', borderRadius: '12px', width: '560px', maxWidth: '90%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, color: '#0d1b4b', fontSize: '18px' }}>Requested Materials</h3>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{viewRequest.requestNo} — {viewRequest.siteStoreName}</div>
              </div>
              <button
                onClick={() => setViewRequest(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeaderRow}>
                  <th style={styles.th}>Material</th>
                  <th style={styles.th}>Requested</th>
                  <th style={styles.th}>Received</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {viewRequest.materials.map((m, i) => {
                  const outstanding = m.quantity - (m.fulfilledQty || 0);
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={styles.td}>{m.materialName}</td>
                      <td style={styles.td}>{m.quantity} {m.unit}</td>
                      <td style={styles.td}>{m.fulfilledQty || 0} {m.unit}</td>
                      <td style={styles.td}>
                        {outstanding <= 0 && m.fulfilledQty > 0 ? (
                          <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>Fully received</span>
                        ) : m.fulfilledQty > 0 ? (
                          <span style={{ background: '#fff3e0', color: '#b7791f', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>{outstanding} short</span>
                        ) : (
                          <span style={{ background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>Awaiting</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {viewRequest.notes && (
              <div style={{ marginTop: '16px', fontSize: '13px', color: '#475569' }}>
                <strong>Notes:</strong> {viewRequest.notes}
              </div>
            )}
            <button
              onClick={() => setViewRequest(null)}
              style={{ marginTop: '20px', width: '100%', padding: '10px', background: '#0d1b4b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Low Stock Popup Alerts (Mandatory overlay) */}
      {(() => {
        const alertsToTrigger = materials.filter(m => {
          const reorder = m.reorderLevel !== undefined ? m.reorderLevel : 50;
          return m.quantity < reorder;
        });
        const unacknowledged = alertsToTrigger.filter(m => !acknowledgedAlerts[m._id]);
        if (unacknowledged.length === 0) return null;
        
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
            <div style={{ background: 'white', padding: '30px', borderRadius: '12px', width: '500px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', borderTop: '6px solid #ef4444', textAlign: 'left' }}>
              <h3 style={{ color: '#ef4444', margin: '0 0 16px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🚨 Low Stock Alert Notification
              </h3>
              <p style={{ color: '#475569', fontSize: '14px', marginBottom: '20px' }}>
                The following materials have fallen below their reorder levels. Please review and requisition stock:
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
                        {isCritical ? 'Critical' : 'Pre-Order'}
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
};

export default SiteStoreDashboard;
