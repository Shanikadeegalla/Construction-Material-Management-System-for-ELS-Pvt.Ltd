import React, { useState, useEffect } from 'react';
import SettingsPage from './SettingsPage';

const PMDashboard = ({ user, onLogout }) => {
  const [activePage, setActivePage] = useState('dashboard'); // 'dashboard', 'approvals', 'all-prs', 'bom', 'settings'
  const [requests, setRequests] = useState([]);
  const [boms, setBoms] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // New BOM Form State (Phase 4)
  const [bomProjectId, setBomProjectId] = useState('');
  const [bomMaterials, setBomMaterials] = useState([
    { name: '', unit: '', plannedQty: 1, category: '', estimatedUnitCost: 0, totalCost: 0, supplierRef: '', remarks: '' }
  ]);
  const [inventory, setInventory] = useState([]);
  const [focusedRowIdx, setFocusedRowIdx] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [bomVersions, setBomVersions] = useState([]);
  const [viewingVersionBOM, setViewingVersionBOM] = useState(null);

  // Rejection modal/popup state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingPrId, setRejectingPrId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Project state variables for Phase 3
  const [projects, setProjects] = useState([]);
  const [projectForm, setProjectForm] = useState({
    projectName: '',
    clientName: '',
    location: '',
    startDate: '',
    expectedEndDate: '',
    budget: '',
    description: '',
    status: 'Planning'
  });
  const [drawingFile, setDrawingFile] = useState(null);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [viewingProject, setViewingProject] = useState(null);
  const [showViewProjectModal, setShowViewProjectModal] = useState(false);

  const getHeaders = () => {
    const token = JSON.parse(localStorage.getItem('user'))?.token;
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };
  };

  const fetchRequests = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/purchase-requests', {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setRequests(data.data);
      }
    } catch {
      setRequests([
        { _id: '1', projectName: 'Colombo Port Expansion', materials: [{ materialName: 'Portland Cement', quantity: 300, unit: 'bags', reason: 'Foundation concrete' }], status: 'Pending', requestedBy: 'Mike Storekeeper', createdAt: new Date().toISOString(), notes: 'Urgent request' },
        { _id: '2', projectName: 'Marina Heights', materials: [{ materialName: 'TMT Steel 12mm', quantity: 5, unit: 'ton', reason: 'Column reinforcement' }], status: 'Pending', requestedBy: 'Mike Storekeeper', createdAt: new Date(Date.now() - 86400000).toISOString(), notes: '' },
        { _id: '3', projectName: 'Business Bay Office', materials: [{ materialName: 'River Sand', quantity: 20, unit: 'm3', reason: 'Plastering work' }], status: 'Approved', requestedBy: 'Mike Storekeeper', approvedBy: 'John PM', createdAt: new Date(Date.now() - 172800000).toISOString(), notes: '' },
      ]);
    }
  };

  const fetchBoms = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/bom', {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setBoms(data.data);
      }
    } catch {
      setBoms([
        { _id: '1', projectName: 'Colombo Port Expansion', version: 'v1.0', createdBy: 'John PM', createdAt: new Date().toISOString(), status: 'Pending', materials: [{ name: 'Portland Cement', unit: 'bags', plannedQty: 300, category: 'Cement' }] }
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

  const fetchProjects = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/projects', {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setProjects(data.data);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([fetchRequests(), fetchBoms(), fetchNotifications(), fetchProjects()]);
    setLoading(false);
  };

  const handleProjectSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    const formData = new FormData();
    formData.append('projectName', projectForm.projectName);
    formData.append('clientName', projectForm.clientName);
    formData.append('location', projectForm.location);
    formData.append('startDate', projectForm.startDate);
    formData.append('expectedEndDate', projectForm.expectedEndDate);
    formData.append('budget', projectForm.budget);
    formData.append('description', projectForm.description);
    formData.append('status', projectForm.status);
    if (drawingFile) {
      formData.append('drawingFile', drawingFile);
    }

    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      let url = 'http://localhost:5000/api/projects';
      let method = 'POST';

      if (editingProjectId) {
        url = `http://localhost:5000/api/projects/${editingProjectId}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method: method,
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (data.success) {
        setMessage(`✅ Success! Project saved with ID: ${data.data.projectId}`);
        setProjectForm({
          projectName: '',
          clientName: '',
          location: '',
          startDate: '',
          expectedEndDate: '',
          budget: '',
          description: '',
          status: 'Planning'
        });
        setDrawingFile(null);
        setEditingProjectId(null);
        const fileInput = document.getElementById('projectDrawingInput');
        if (fileInput) fileInput.value = '';

        fetchProjects();
      } else {
        setMessage(`⚠️ Error: ${data.message}`);
      }
    } catch (err) {
      setMessage('⚠️ Connection refused. Failed to save project.');
    }
  };

  const fetchInventory = async () => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/inventory', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setInventory(data);
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
    }
  };

  const fetchBOMVersions = async (projId) => {
    if (!projId) {
      setBomVersions([]);
      return;
    }
    try {
      const res = await fetch(`http://localhost:5000/api/bom/versions/${projId}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setBomVersions(data.data);
      }
    } catch (err) {
      console.error('Error fetching BOM versions:', err);
    }
  };

  const handleProjectSelectChange = async (projId) => {
    setBomProjectId(projId);
    setViewingVersionBOM(null);
    setDuplicateWarning(null);

    if (!projId) {
      setBomMaterials([{ name: '', unit: '', plannedQty: 1, category: '', estimatedUnitCost: 0, totalCost: 0, supplierRef: '', remarks: '' }]);
      setBomVersions([]);
      return;
    }

    fetchBOMVersions(projId);

    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch(`http://localhost:5000/api/bom/versions/${projId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.data) {
        const draft = data.data.find(b => b.status === 'Draft');
        if (draft) {
          const mapped = draft.materials.map(m => ({
            name: m.name,
            unit: m.unit,
            plannedQty: m.plannedQty,
            category: m.category,
            estimatedUnitCost: m.estimatedUnitCost || 0,
            totalCost: m.totalCost || (m.plannedQty * (m.estimatedUnitCost || 0)),
            supplierRef: m.supplierRef || '',
            remarks: m.remarks || ''
          }));
          setBomMaterials(mapped);
          setMessage('ℹ️ Loaded existing Draft BOM for editing.');
          return;
        }
      }
    } catch (err) {
      console.error(err);
    }

    setBomMaterials([{ name: '', unit: '', plannedQty: 1, category: '', estimatedUnitCost: 0, totalCost: 0, supplierRef: '', remarks: '' }]);
  };

  const handleSuggestionClick = (rowIdx, item) => {
    const updated = [...bomMaterials];
    updated[rowIdx].name = item.name;
    updated[rowIdx].category = item.category || 'Other';
    updated[rowIdx].unit = item.unit || 'bag';
    updated[rowIdx].estimatedUnitCost = item.unitPrice || 0;

    const qty = Number(updated[rowIdx].plannedQty) || 0;
    updated[rowIdx].totalCost = qty * updated[rowIdx].estimatedUnitCost;

    setBomMaterials(updated);
    setSuggestions([]);
    setFocusedRowIdx(null);

    const dupIdx = bomMaterials.findIndex((m, i) => 
      i !== rowIdx && m.name.toLowerCase().trim() === item.name.toLowerCase().trim()
    );
    if (dupIdx !== -1) {
      setDuplicateWarning({
        materialName: item.name,
        duplicateIndex: rowIdx,
        originalIndex: dupIdx
      });
    }
  };

  const handleMergeDuplicate = () => {
    if (!duplicateWarning) return;
    const { duplicateIndex, originalIndex } = duplicateWarning;
    const updated = [...bomMaterials];

    const originalQty = Number(updated[originalIndex].plannedQty) || 0;
    const duplicateQty = Number(updated[duplicateIndex].plannedQty) || 0;

    updated[originalIndex].plannedQty = originalQty + duplicateQty;
    updated[originalIndex].totalCost = updated[originalIndex].plannedQty * (Number(updated[originalIndex].estimatedUnitCost) || 0);

    const filtered = updated.filter((_, i) => i !== duplicateIndex);
    setBomMaterials(filtered);
    setDuplicateWarning(null);
  };

  const handleKeepSeparate = () => {
    setDuplicateWarning(null);
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/api/purchase-requests/${id}/approve`, {
        method: 'PUT',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setMessage('✅ PR Approved successfully!');
      } else {
        setMessage(`⚠️ Error: ${data.message}`);
      }
      fetchRequests();
    } catch {
      setMessage('✅ PR Approved! (Demo mode)');
      setRequests(prev => prev.map(r => r._id === id ? { ...r, status: 'Approved', approvedBy: user?.name || 'Project Manager' } : r));
    }
  };

  const handleRejectClick = (id) => {
    setRejectingPrId(id);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) return;

    try {
      const res = await fetch(`http://localhost:5000/api/purchase-requests/${rejectingPrId}/reject`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ rejectionReason })
      });
      const data = await res.json();
      if (data.success) {
        setMessage('❌ PR Rejected successfully!');
      } else {
        setMessage(`⚠️ Error: ${data.message}`);
      }
      setShowRejectModal(false);
      fetchRequests();
    } catch {
      setMessage('❌ PR Rejected! (Demo mode)');
      setRequests(prev => prev.map(r => r._id === rejectingPrId ? { ...r, status: 'Rejected', rejectionReason } : r));
      setShowRejectModal(false);
    }
  };

  const handleAddMaterialRow = () => {
    setBomMaterials([...bomMaterials, { name: '', unit: '', plannedQty: 1, category: '', estimatedUnitCost: 0, totalCost: 0, supplierRef: '', remarks: '' }]);
  };

  const handleRemoveMaterialRow = (idx) => {
    if (bomMaterials.length === 1) return;
    setBomMaterials(bomMaterials.filter((_, i) => i !== idx));
  };

  const handleMaterialChange = (idx, field, val) => {
    const updated = [...bomMaterials];
    updated[idx][field] = val;

    if (field === 'plannedQty' || field === 'estimatedUnitCost') {
      const qty = Number(updated[idx].plannedQty) || 0;
      const cost = Number(updated[idx].estimatedUnitCost) || 0;
      updated[idx].totalCost = qty * cost;
    }

    setBomMaterials(updated);

    if (field === 'name') {
      if (val.trim() === '') {
        setSuggestions([]);
        setFocusedRowIdx(null);
      } else {
        setFocusedRowIdx(idx);
        const filtered = inventory.filter(item => 
          item.name && item.name.toLowerCase().includes(val.toLowerCase())
        );
        const unique = [];
        const seen = new Set();
        filtered.forEach(item => {
          if (!seen.has(item.name.toLowerCase())) {
            seen.add(item.name.toLowerCase());
            unique.push(item);
          }
        });
        setSuggestions(unique.slice(0, 8));
        
        const dupIdx = bomMaterials.findIndex((m, i) => 
          i !== idx && m.name.toLowerCase().trim() === val.toLowerCase().trim()
        );
        if (dupIdx !== -1) {
          setDuplicateWarning({
            materialName: val,
            duplicateIndex: idx,
            originalIndex: dupIdx
          });
        } else {
          setDuplicateWarning(null);
        }
      }
    }
  };

  const handleSubmitBOM = async (status) => {
    setMessage('');
    
    if (!bomProjectId) {
      setMessage('⚠️ Please select a project.');
      return;
    }

    const invalid = bomMaterials.some(m => !m.name.trim() || m.plannedQty <= 0);
    if (invalid) {
      setMessage('⚠️ Please provide valid names and positive quantities for all materials.');
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/bom', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          projectId: bomProjectId,
          status: status,
          materials: bomMaterials.map(m => ({
            name: m.name,
            unit: m.unit,
            plannedQty: Number(m.plannedQty),
            category: m.category,
            estimatedUnitCost: Number(m.estimatedUnitCost) || 0,
            supplierRef: m.supplierRef || '',
            remarks: m.remarks || ''
          }))
        })
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`✅ BOM ${status === 'Submitted' ? 'submitted to Director' : 'saved as draft'} successfully!`);
        if (status === 'Submitted') {
          setBomProjectId('');
          setBomMaterials([{ name: '', unit: '', plannedQty: 1, category: '', estimatedUnitCost: 0, totalCost: 0, supplierRef: '', remarks: '' }]);
        }
        fetchBoms();
        if (bomProjectId) {
          fetchBOMVersions(bomProjectId);
        }
      } else {
        setMessage(`❌ Failed: ${data.message}`);
      }
    } catch {
      setMessage(`✅ BOM ${status === 'Submitted' ? 'submitted' : 'saved as draft'} successfully! (Demo mode)`);
      if (status === 'Submitted') {
        const newMockBom = {
          _id: String(Date.now()),
          projectId: { _id: bomProjectId, name: 'Project Name' },
          version: 'v1.0',
          createdBy: user?.name || 'Project Manager',
          status: 'Submitted',
          materials: bomMaterials,
          createdAt: new Date().toISOString()
        };
        setBoms(prev => [newMockBom, ...prev]);
        setBomProjectId('');
        setBomMaterials([{ name: '', unit: '', plannedQty: 1, category: '', estimatedUnitCost: 0, totalCost: 0, supplierRef: '', remarks: '' }]);
      }
    }
  };

  const stats = [
    { label: 'Total PRs', value: requests.length, color: '#1565c0' },
    { label: 'Pending PR Approval', value: requests.filter(r => r.status === 'Pending').length, color: '#e65100' },
    { label: 'Total BOMs Tracked', value: boms.length, color: '#0d1b4b' },
    { label: 'Pending BOM Approvals', value: boms.filter(b => b.status === 'Pending').length, color: '#ff9800' },
  ];

  const renderProjects = () => {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}>
        {/* Project Form */}
        <div style={{ background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: '0 0 20px', color: '#0d1b4b', borderBottom: '2px solid #0d1b4b', paddingBottom: '10px', fontWeight: '700' }}>
            {editingProjectId ? '📝 Edit Project Details' : '🏗️ Create New Construction Project'}
          </h3>
          <form onSubmit={handleProjectSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', fontWeight: '700', marginBottom: '6px' }}>PROJECT NAME *</label>
                <input
                  type="text"
                  placeholder="e.g. Colombo Port Expansion"
                  value={projectForm.projectName}
                  onChange={e => setProjectForm({ ...projectForm, projectName: e.target.value })}
                  style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', fontWeight: '700', marginBottom: '6px' }}>CLIENT NAME *</label>
                <input
                  type="text"
                  placeholder="e.g. SLPA"
                  value={projectForm.clientName}
                  onChange={e => setProjectForm({ ...projectForm, clientName: e.target.value })}
                  style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', fontWeight: '700', marginBottom: '6px' }}>LOCATION *</label>
                <input
                  type="text"
                  placeholder="e.g. Colombo Harbour"
                  value={projectForm.location}
                  onChange={e => setProjectForm({ ...projectForm, location: e.target.value })}
                  style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', fontWeight: '700', marginBottom: '6px' }}>START DATE *</label>
                <input
                  type="date"
                  value={projectForm.startDate}
                  onChange={e => setProjectForm({ ...projectForm, startDate: e.target.value })}
                  style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', fontWeight: '700', marginBottom: '6px' }}>EXPECTED END DATE *</label>
                <input
                  type="date"
                  value={projectForm.expectedEndDate}
                  onChange={e => setProjectForm({ ...projectForm, expectedEndDate: e.target.value })}
                  style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', fontWeight: '700', marginBottom: '6px' }}>BUDGET (LKR) *</label>
                <input
                  type="number"
                  placeholder="e.g. 750000000"
                  value={projectForm.budget}
                  onChange={e => setProjectForm({ ...projectForm, budget: e.target.value })}
                  style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', fontWeight: '700', marginBottom: '6px' }}>CONSTRUCTION DRAWING (PDF/IMAGE)</label>
                <input
                  id="projectDrawingInput"
                  type="file"
                  onChange={e => setDrawingFile(e.target.files[0])}
                  style={{ width: '100%', padding: '8px', fontSize: '13px' }}
                  accept=".jpg,.jpeg,.png,.pdf"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', fontWeight: '700', marginBottom: '6px' }}>PROJECT STATUS *</label>
                <select
                  value={projectForm.status}
                  onChange={e => setProjectForm({ ...projectForm, status: e.target.value })}
                  style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none', background: 'white' }}
                  required
                >
                  <option value="Planning">Planning</option>
                  <option value="Active">Active</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', fontWeight: '700', marginBottom: '6px' }}>PROJECT DESCRIPTION</label>
              <textarea
                placeholder="Brief description of the construction project, scope, deliverables..."
                value={projectForm.description}
                onChange={e => setProjectForm({ ...projectForm, description: e.target.value })}
                style={{ width: '100%', height: '80px', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none', fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="submit"
                style={{ background: '#ff9800', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', boxShadow: '0 4px 10px rgba(255,152,0,0.15)' }}
              >
                {editingProjectId ? 'Update Project' : 'Create Project'}
              </button>
              {editingProjectId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingProjectId(null);
                    setProjectForm({
                      projectName: '',
                      clientName: '',
                      location: '',
                      startDate: '',
                      expectedEndDate: '',
                      budget: '',
                      description: '',
                      status: 'Planning'
                    });
                    setDrawingFile(null);
                    const fileInput = document.getElementById('projectDrawingInput');
                    if (fileInput) fileInput.value = '';
                  }}
                  style={{ background: '#f5f5f5', color: '#333', border: '1px solid #ddd', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Project List Table */}
        <div style={{ background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: '0 0 20px', color: '#0d1b4b', borderBottom: '2px solid #0d1b4b', paddingBottom: '10px', fontWeight: '700' }}>📋 Construction Projects Registry</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                  {['Project ID', 'Name', 'Client', 'Location', 'Status', 'Start Date', 'Budget (LKR)', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: '#475569', fontWeight: '600' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projects.map((p, idx) => (
                  <tr key={p._id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px', fontSize: '13px', fontWeight: '700', color: '#0d1b4b' }}>{p.projectId}</td>
                    <td style={{ padding: '12px', fontSize: '13px', fontWeight: '600' }}>{p.projectName}</td>
                    <td style={{ padding: '12px', fontSize: '13px' }}>{p.clientName}</td>
                    <td style={{ padding: '12px', fontSize: '13px' }}>{p.location}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        background: p.status === 'Active' ? '#e8f5e9' : p.status === 'Completed' ? '#e3f2fd' : p.status === 'On Hold' || p.status === 'OnHold' ? '#ffebee' : '#fff3e0',
                        color: p.status === 'Active' ? '#2e7d32' : p.status === 'Completed' ? '#1565c0' : p.status === 'On Hold' || p.status === 'OnHold' ? '#c62828' : '#e65100',
                        padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700'
                      }}>{p.status}</span>
                    </td>
                    <td style={{ padding: '12px', fontSize: '12px', color: '#64748b' }}>
                      {new Date(p.startDate).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', fontWeight: '600' }}>
                      {Number(p.budget).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => {
                            setViewingProject(p);
                            setShowViewProjectModal(true);
                          }}
                          style={{ background: '#0d1b4b', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                        >
                          👁 View
                        </button>
                        <button
                          onClick={() => {
                            setEditingProjectId(p._id);
                            setProjectForm({
                              projectName: p.projectName,
                              clientName: p.clientName,
                              location: p.location,
                              startDate: new Date(p.startDate).toISOString().substring(0, 10),
                              expectedEndDate: new Date(p.expectedEndDate).toISOString().substring(0, 10),
                              budget: p.budget,
                              description: p.description || '',
                              status: p.status
                            });
                          }}
                          style={{ background: '#ff9800', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                        >
                          ✏️ Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {projects.length === 0 && (
                  <tr>
                    <td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                      No projects registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px', color: 'white' }}>E</div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: 'white' }}>ELS CMMS</div>
            <div style={{ fontSize: '11px', color: '#ff9800' }}>PM Workspace</div>
          </div>
        </div>
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#ff9800', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px' }}>
            {user?.name?.charAt(0).toUpperCase() || 'P'}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600' }}>{user?.name || 'Project Manager'}</div>
            <div style={{ fontSize: '11px', color: '#90caf9' }}>Project Manager</div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: '⊞' },
            { id: 'projects', label: 'Projects', icon: '📁' },
            { id: 'approvals', label: 'PR Approvals', icon: '📋' },
            { id: 'all-prs', label: 'All PRs', icon: '📁' },
            { id: 'bom', label: 'BOM Management', icon: '🏗️' },
            { id: 'settings', label: 'Settings', icon: '⚙️' },
          ].map(item => (
            <div key={item.id} onClick={() => { setActivePage(item.id); setMessage(''); }}
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
          <h2 style={{ margin: 0, fontSize: '20px', color: '#0d1b4b', fontWeight: '700' }}>
            {activePage === 'dashboard' && 'PM Executive Overview'}
            {activePage === 'projects' && 'Project Workspace Management'}
            {activePage === 'approvals' && 'Purchase Request Approvals'}
            {activePage === 'all-prs' && 'Purchase Request Archive'}
            {activePage === 'bom' && 'Bill of Materials (BOM) Management'}
            {activePage === 'settings' && 'User Settings & Preferences'}
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
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          {message && (
            <div style={{ background: message.includes('✅') ? '#e8f5e9' : message.includes('⚠️') ? '#fff3e0' : '#ffebee', border: `1px solid ${message.includes('✅') ? '#4caf50' : message.includes('⚠️') ? '#f59e0b' : '#ef5350'}`, color: message.includes('✅') ? '#2e7d32' : message.includes('⚠️') ? '#b7791f' : '#c62828', padding: '10px 16px', borderRadius: '6px', marginBottom: '16px', fontWeight: '500' }}>
              {message}
            </div>
          )}

          {/* Stats Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            {stats.map((s, i) => (
              <div key={i} style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', borderTop: `4px solid ${s.color}` }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '13px', color: '#666', marginTop: '6px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {activePage === 'dashboard' && (
            <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', background: '#0d1b4b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: 'white', fontSize: '15px' }}>⏳ Pending PR Material Requests checklist</h3>
                <button onClick={fetchRequests} style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid white', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}>Refresh</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f5f6fa' }}>
                    {['PR No.', 'Project', 'Materials requested', 'Date', 'Requested By', 'Notes', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#666', fontWeight: '600', borderBottom: '1px solid #e0e0e0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requests.filter(r => r.status === 'Pending').map((req, i) => (
                    <tr key={req._id} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1565c0', fontWeight: '600' }}>PR-{String(i + 1).padStart(3, '0')}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500' }}>{req.projectName || req.project}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>
                        {req.materials?.map((m, idx) => (
                          <div key={idx}>{m.materialName} ({m.quantity} {m.unit}) {m.reason && ` - [Reason: ${m.reason}]`}</div>
                        ))}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px' }}>{req.requestedBy}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>{req.notes || '-'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => handleApprove(req._id)}
                            style={{ background: '#2e7d32', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                            ✓ Approve
                          </button>
                          <button onClick={() => handleRejectClick(req._id)}
                            style={{ background: '#c62828', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                            ✕ Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {requests.filter(r => r.status === 'Pending').length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#999', fontSize: '14px' }}>
                        🎉 No pending purchase requests requiring approval!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activePage === 'approvals' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Pending Section */}
              <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', background: '#e65100' }}>
                  <h3 style={{ margin: 0, color: 'white', fontSize: '15px' }}>⏳ Pending Section</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f5f6fa' }}>
                      {['PR No.', 'Project', 'Materials list', 'Date', 'Requested By', 'Notes', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#666', fontWeight: '600' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {requests.filter(r => r.status === 'Pending').map((req, i) => (
                      <tr key={req._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1565c0', fontWeight: '600' }}>PR-{String(i + 1).padStart(3, '0')}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500' }}>{req.projectName || req.project}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>
                          {req.materials?.map((m, idx) => (
                            <div key={idx}>{m.materialName} ({m.quantity} {m.unit})</div>
                          ))}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>{new Date(req.createdAt).toLocaleDateString()}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px' }}>{req.requestedBy}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>{req.notes || '-'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => handleApprove(req._id)}
                              style={{ background: '#2e7d32', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✓ Approve</button>
                            <button onClick={() => handleRejectClick(req._id)}
                              style={{ background: '#c62828', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✕ Reject</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {requests.filter(r => r.status === 'Pending').length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>No pending PRs.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Approved Section */}
              <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', background: '#2e7d32' }}>
                  <h3 style={{ margin: 0, color: 'white', fontSize: '15px' }}>✓ Approved Section</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f5f6fa' }}>
                      {['PR No.', 'Project', 'Materials list', 'Date', 'Requested By', 'Approved By'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#666', fontWeight: '600' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {requests.filter(r => r.status === 'Approved').map((req, i) => (
                      <tr key={req._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1565c0', fontWeight: '600' }}>PR-{String(i + 1).padStart(3, '0')}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500' }}>{req.projectName || req.project}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>
                          {req.materials?.map((m, idx) => (
                            <div key={idx}>{m.materialName} ({m.quantity} {m.unit})</div>
                          ))}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>{new Date(req.createdAt).toLocaleDateString()}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px' }}>{req.requestedBy}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#2e7d32' }}>{req.approvedBy || 'Project Manager'}</td>
                      </tr>
                    ))}
                    {requests.filter(r => r.status === 'Approved').length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>No approved PRs yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activePage === 'all-prs' && (
            <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
                <h3 style={{ margin: 0, color: '#0d1b4b' }}>PR History Archive</h3>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#0d1b4b', color: 'white' }}>
                    {['PR No.', 'Project Name', 'Materials list', 'Requested By', 'Notes', 'Date', 'Status', 'Status Info'].map(h => (
                      <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req, i) => (
                    <tr key={req._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1565c0', fontWeight: '600' }}>PR-{String(i + 1).padStart(3, '0')}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500' }}>{req.projectName || req.project}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>
                        {req.materials?.map((m, idx) => (
                          <div key={idx}>{m.materialName} ({m.quantity} {m.unit})</div>
                        ))}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px' }}>{req.requestedBy}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>{req.notes || '-'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>{new Date(req.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          background: req.status === 'Approved' ? '#e8f5e9' : req.status === 'Rejected' ? '#ffebee' : '#fff3e0',
                          color: req.status === 'Approved' ? '#2e7d32' : req.status === 'Rejected' ? '#c62828' : '#e65100',
                          padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600'
                        }}>
                          {req.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>
                        {req.status === 'Approved' && `Approved by ${req.approvedBy || 'PM'}`}
                        {req.status === 'Rejected' && `Reason: ${req.rejectionReason || 'No reason'}`}
                        {req.status === 'Pending' && 'Awaiting PM action'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activePage === 'bom' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}>
              {/* Create BOM Form */}
              <div style={{ background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 20px', color: '#0d1b4b', borderBottom: '2px solid #0d1b4b', paddingBottom: '10px', fontWeight: '700' }}>🏗️ Create / Edit Bill of Materials (BOM)</h3>
                
                {/* Step 1: Select Project Dropdown */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#475569', fontWeight: '700', marginBottom: '6px' }}>SELECT PROJECT *</label>
                  <select
                    value={bomProjectId}
                    onChange={e => handleProjectSelectChange(e.target.value)}
                    style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none', background: 'white' }}
                  >
                    <option value="">-- Choose a Project --</option>
                    {projects.map(p => (
                      <option key={p._id} value={p._id}>
                        {p.projectName || p.name} ({p.projectId || 'Draft'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Step 8: Version History View */}
                {bomVersions.length > 0 && (
                  <div style={{ marginBottom: '24px', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <h4 style={{ color: '#0d1b4b', margin: '0 0 10px', fontSize: '13px', fontWeight: '700' }}>📄 BOM VERSION HISTORY FOR SELECTED PROJECT</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {bomVersions.map(v => (
                        <button
                          key={v._id}
                          type="button"
                          onClick={() => setViewingVersionBOM(v)}
                          style={{
                            background: viewingVersionBOM?._id === v._id ? '#0d1b4b' : 'white',
                            color: viewingVersionBOM?._id === v._id ? 'white' : '#334155',
                            border: '1px solid #cbd5e1',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                        >
                          {v.version} ({v.status})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Version History Modal / Panel */}
                {viewingVersionBOM && (
                  <div style={{ marginBottom: '24px', padding: '20px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h4 style={{ color: '#166534', margin: 0, fontSize: '14px', fontWeight: '700' }}>
                        📖 Viewing Version: {viewingVersionBOM.version} ({viewingVersionBOM.status}) - Created on {new Date(viewingVersionBOM.createdAt).toLocaleDateString()}
                      </h4>
                      <button
                        type="button"
                        onClick={() => setViewingVersionBOM(null)}
                        style={{ background: 'white', color: '#166534', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                      >
                        Close View
                      </button>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#dcfce7', borderBottom: '1px solid #bbf7d0' }}>
                          {['Material Name', 'Category', 'Unit', 'Qty', 'Unit Cost (LKR)', 'Total Cost (LKR)', 'Supplier Ref', 'Remarks'].map(h => (
                            <th key={h} style={{ padding: '8px', textAlign: 'left', fontWeight: '600' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {viewingVersionBOM.materials?.map((m, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #e8f5e9' }}>
                            <td style={{ padding: '8px' }}>{m.name}</td>
                            <td style={{ padding: '8px' }}>{m.category}</td>
                            <td style={{ padding: '8px' }}>{m.unit}</td>
                            <td style={{ padding: '8px' }}>{m.plannedQty}</td>
                            <td style={{ padding: '8px' }}>LKR {(m.estimatedUnitCost || 0).toLocaleString()}</td>
                            <td style={{ padding: '8px', fontWeight: '600' }}>LKR {(m.totalCost || (m.plannedQty * (m.estimatedUnitCost || 0))).toLocaleString()}</td>
                            <td style={{ padding: '8px' }}>{m.supplierRef || '-'}</td>
                            <td style={{ padding: '8px' }}>{m.remarks || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Step 5: Duplicate Detection Alert */}
                {duplicateWarning && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff3e0', border: '1px solid #ffe0b2', padding: '12px 16px', borderRadius: '6px', marginBottom: '20px' }}>
                    <span style={{ fontSize: '13px', color: '#e65100', fontWeight: '600' }}>
                      ⚠️ Material "{duplicateWarning.materialName}" already exists in this BOM. Increase quantity instead?
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={handleMergeDuplicate}
                        style={{ background: '#e65100', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                      >
                        Merge (Add Quantities)
                      </button>
                      <button
                        type="button"
                        onClick={handleKeepSeparate}
                        style={{ background: 'white', color: '#e65100', border: '1px solid #e65100', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                      >
                        Keep Separate
                      </button>
                    </div>
                  </div>
                )}

                {/* Main Allocation Form */}
                <form onSubmit={e => e.preventDefault()}>
                  <h4 style={{ color: '#0d1b4b', margin: '20px 0 10px', fontSize: '14px', fontWeight: '700' }}>Material Allocation Table</h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                          {['Material Name *', 'Category', 'Unit', 'Planned Qty *', 'Est. Unit Cost (LKR) *', 'Total Cost', 'Supplier Ref', 'Remarks', 'Action'].map(h => (
                            <th key={h} style={{ padding: '10px', textAlign: 'left', fontSize: '12px', color: '#475569', fontWeight: '600' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {bomMaterials.map((m, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            {/* Autocomplete Input */}
                            <td style={{ padding: '8px 4px', width: '220px', position: 'relative' }}>
                              <input
                                type="text"
                                placeholder="Type to search..."
                                value={m.name}
                                onChange={e => handleMaterialChange(idx, 'name', e.target.value)}
                                style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }}
                                required
                              />
                              {focusedRowIdx === idx && suggestions.length > 0 && (
                                <div style={{ position: 'absolute', top: '100%', left: 4, right: 4, background: 'white', border: '1px solid #cbd5e1', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}>
                                  {suggestions.map(item => (
                                    <div
                                      key={item._id}
                                      onClick={() => handleSuggestionClick(idx, item)}
                                      style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f1f5f9' }}
                                      onMouseDown={e => e.preventDefault()}
                                    >
                                      <strong>{item.name}</strong> <span style={{ color: '#64748b', fontSize: '11px' }}>({item.category} • {item.unit})</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                            {/* Category - Read only */}
                            <td style={{ padding: '8px 4px', width: '120px' }}>
                              <input
                                type="text"
                                value={m.category}
                                placeholder="Autofilled"
                                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '13px', background: '#f8fafc', color: '#475569' }}
                                readOnly
                              />
                            </td>
                            {/* Unit - Read only */}
                            <td style={{ padding: '8px 4px', width: '90px' }}>
                              <input
                                type="text"
                                value={m.unit}
                                placeholder="Autofilled"
                                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '13px', background: '#f8fafc', color: '#475569' }}
                                readOnly
                              />
                            </td>
                            {/* Planned Qty */}
                            <td style={{ padding: '8px 4px', width: '110px' }}>
                              <input
                                type="number"
                                min="1"
                                value={m.plannedQty}
                                onChange={e => handleMaterialChange(idx, 'plannedQty', e.target.value)}
                                style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }}
                                required
                              />
                            </td>
                            {/* Est. Unit Cost */}
                            <td style={{ padding: '8px 4px', width: '130px' }}>
                              <input
                                type="number"
                                min="0"
                                value={m.estimatedUnitCost}
                                onChange={e => handleMaterialChange(idx, 'estimatedUnitCost', e.target.value)}
                                style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }}
                                required
                              />
                            </td>
                            {/* Total Cost - Read only */}
                            <td style={{ padding: '8px 4px', width: '120px' }}>
                              <input
                                type="text"
                                value={`LKR ${(m.totalCost || 0).toLocaleString()}`}
                                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '13px', background: '#f8fafc', color: '#0d1b4b', fontWeight: 'bold' }}
                                readOnly
                              />
                            </td>
                            {/* Supplier Ref */}
                            <td style={{ padding: '8px 4px', width: '130px' }}>
                              <input
                                type="text"
                                placeholder="Optional"
                                value={m.supplierRef}
                                onChange={e => handleMaterialChange(idx, 'supplierRef', e.target.value)}
                                style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }}
                              />
                            </td>
                            {/* Remarks */}
                            <td style={{ padding: '8px 4px' }}>
                              <input
                                type="text"
                                placeholder="Remarks"
                                value={m.remarks}
                                onChange={e => handleMaterialChange(idx, 'remarks', e.target.value)}
                                style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }}
                              />
                            </td>
                            {/* Remove button */}
                            <td style={{ padding: '8px 4px', width: '60px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveMaterialRow(idx)}
                                disabled={bomMaterials.length === 1}
                                style={{ background: '#ef4444', color: 'white', border: 'none', width: '32px', height: '32px', borderRadius: '4px', cursor: bomMaterials.length === 1 ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Step 7: BOM Summary Box */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', background: '#f8fafc', padding: '20px', borderRadius: '8px', marginBottom: '24px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <h4 style={{ color: '#0d1b4b', margin: '0 0 12px', fontSize: '14px', fontWeight: '700', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px' }}>💰 ESTIMATED SUMMARY</h4>
                      <div style={{ fontSize: '13px', marginBottom: '8px', color: '#475569' }}>
                        Total Material Items: <strong style={{ color: '#0d1b4b' }}>{bomMaterials.length}</strong>
                      </div>
                      <div style={{ fontSize: '14px', color: '#2e7d32', fontWeight: '700' }}>
                        Total Cost: LKR {bomMaterials.reduce((sum, item) => sum + (Number(item.totalCost) || 0), 0).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <h4 style={{ color: '#0d1b4b', margin: '0 0 12px', fontSize: '14px', fontWeight: '700', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px' }}>📂 COST BREAKDOWN BY CATEGORY</h4>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ background: '#e2e8f0', color: '#334155' }}>
                            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '600' }}>Category</th>
                            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '600' }}>Total Cost (LKR)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(
                            bomMaterials.reduce((acc, item) => {
                              const cat = item.category || 'Unassigned';
                              if (item.name) {
                                acc[cat] = (acc[cat] || 0) + (Number(item.totalCost) || 0);
                              }
                              return acc;
                            }, {})
                          ).map(([category, cost]) => (
                            <tr key={category} style={{ borderBottom: '1px solid #cbd5e1' }}>
                              <td style={{ padding: '6px 8px', color: '#334155', fontWeight: '500' }}>{category}</td>
                              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700', color: '#0d1b4b' }}>LKR {cost.toLocaleString()}</td>
                            </tr>
                          ))}
                          {bomMaterials.filter(m => m.name).length === 0 && (
                            <tr>
                              <td colSpan="2" style={{ padding: '10px', textAlign: 'center', color: '#94a3b8' }}>
                                No items defined.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={handleAddMaterialRow}
                      style={{ background: '#f1f5f9', color: '#0d1b4b', border: '1px solid #cbd5e1', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
                    >
                      ➕ Add Material Row
                    </button>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={() => handleSubmitBOM('Draft')}
                        style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '12px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '14px' }}
                      >
                        💾 Save as Draft
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSubmitBOM('Submitted')}
                        disabled={bomMaterials.length === 0 || !bomMaterials[0].name}
                        style={{
                          background: (bomMaterials.length === 0 || !bomMaterials[0].name) ? '#cbd5e1' : '#ff9800',
                          color: 'white',
                          border: 'none',
                          padding: '12px 24px',
                          borderRadius: '6px',
                          cursor: (bomMaterials.length === 0 || !bomMaterials[0].name) ? 'not-allowed' : 'pointer',
                          fontWeight: '700',
                          fontSize: '14px',
                          boxShadow: (bomMaterials.length === 0 || !bomMaterials[0].name) ? 'none' : '0 4px 10px rgba(255,152,0,0.15)'
                        }}
                      >
                        🚀 Submit to Director
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* View BOM Status List */}
              <div style={{ background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 20px', color: '#0d1b4b', borderBottom: '2px solid #0d1b4b', paddingBottom: '10px', fontWeight: '700' }}>📋 Bill of Materials (BOM) Status Registry</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                        {['Project Name', 'PM Name', 'Version', 'Date Submitted', 'Status', 'Feedback / Director Note'].map(h => (
                          <th key={h} style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: '#475569', fontWeight: '600' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {boms.map((b, idx) => {
                        console.log('BOM row data:', b);
                        return (
                          <tr key={b._id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '12px', fontSize: '13px', fontWeight: '600', color: '#0d1b4b' }}>{b.projectId?.projectName || b.projectId?.name || b.projectName || '-'}</td>
                            <td style={{ padding: '12px', fontSize: '13px', color: '#333' }}>{b.createdBy?.name || b.createdBy || b.submittedBy || '-'}</td>
                            <td style={{ padding: '12px', fontSize: '13px' }}>{b.version || 'v1.0'}</td>
                          <td style={{ padding: '12px', fontSize: '12px', color: '#64748b' }}>{new Date(b.createdAt).toLocaleDateString()}</td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              background: b.status === 'Approved' ? '#e8f5e9' : b.status === 'Rejected' ? '#ffebee' : '#fff3e0',
                              color: b.status === 'Approved' ? '#2e7d32' : b.status === 'Rejected' ? '#c62828' : '#e65100',
                              padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700'
                            }}>{b.status}</span>
                          </td>
                          <td style={{ padding: '12px', fontSize: '13px', color: '#c62828', fontWeight: '500' }}>
                            {b.status === 'Rejected' ? `❌ Reason: ${b.rejectionReason || 'No feedback details'}` : b.status === 'Approved' ? '✅ Ready for material logging' : '⏳ Awaiting director validation'}
                          </td>
                        </tr>
                      );
                    })}
                      {boms.length === 0 && (
                        <tr>
                          <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                            No BOM logs found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activePage === 'projects' && renderProjects()}
          {activePage === 'settings' && <SettingsPage user={user} onLogout={onLogout} />}
        </div>
      </div>

      {/* Rejection reason popup / modal */}
      {showRejectModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '8px', width: '400px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <h3 style={{ color: '#0d1b4b', marginTop: 0, marginBottom: '16px' }}>Reject Purchase Request</h3>
            <form onSubmit={handleRejectSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#666', fontWeight: '600', marginBottom: '6px' }}>REJECTION REASON *</label>
                <input
                  type="text"
                  placeholder="Specify why this PR is rejected"
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="submit" style={{ background: '#c62828', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Reject PR</button>
                <button type="button" onClick={() => setShowRejectModal(false)} style={{ background: '#f5f5f5', color: '#333', border: '1px solid #ddd', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Project Details Modal */}
      {showViewProjectModal && viewingProject && (() => {
        const formatDate = (dateVal) => {
          if (!dateVal) return 'N/A';
          const dateObj = new Date(dateVal);
          if (isNaN(dateObj.getTime())) return 'N/A';
          return dateObj.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        };
        const formatBudget = (budgetVal) => {
          if (budgetVal === undefined || budgetVal === null || isNaN(Number(budgetVal))) return 'LKR 0';
          return `LKR ${Number(budgetVal).toLocaleString()}`;
        };
        const getStatusBadge = (statusVal) => {
          const s = statusVal || 'Planning';
          const isAct = s === 'Active' || s === 'active';
          const isComp = s === 'Completed' || s === 'completed';
          const isHold = s === 'On Hold' || s === 'OnHold' || s === 'on-hold';
          return (
            <span style={{
              background: isAct ? '#e8f5e9' : isComp ? '#e3f2fd' : isHold ? '#ffebee' : '#fff3e0',
              color: isAct ? '#2e7d32' : isComp ? '#1565c0' : isHold ? '#c62828' : '#e65100',
              padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', textTransform: 'capitalize', display: 'inline-block'
            }}>
              {s}
            </span>
          );
        };
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', padding: '30px', borderRadius: '8px', width: '600px', maxHeight: '80%', overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0d1b4b', paddingBottom: '10px', marginBottom: '20px' }}>
                <h3 style={{ color: '#0d1b4b', margin: 0 }}>Project Details: {viewingProject.projectName || viewingProject.name}</h3>
                <span onClick={() => { setShowViewProjectModal(false); setViewingProject(null); }} style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '20px', color: '#666' }}>&times;</span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px', background: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
                <div><strong>Project ID:</strong> {viewingProject.projectId || 'N/A'}</div>
                <div><strong>Client Name:</strong> {viewingProject.clientName || 'N/A'}</div>
                <div><strong>Location:</strong> {viewingProject.location || 'N/A'}</div>
                <div><strong>Project Status:</strong> {getStatusBadge(viewingProject.status)}</div>
                <div><strong>Budget:</strong> {formatBudget(viewingProject.budget)}</div>
                <div><strong>Start Date:</strong> {formatDate(viewingProject.startDate)}</div>
                <div><strong>Expected End Date:</strong> {formatDate(viewingProject.expectedEndDate || viewingProject.endDate)}</div>
                <div><strong>Created By:</strong> {viewingProject.createdBy?.name || 'Project Manager'}</div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ color: '#0d1b4b', margin: '0 0 8px', fontSize: '14px', fontWeight: '700' }}>Description</h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#333', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                  {viewingProject.description || 'No description provided.'}
                </p>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ color: '#0d1b4b', margin: '0 0 8px', fontSize: '14px', fontWeight: '700' }}>Construction Drawing</h4>
                {viewingProject.drawingFile ? (
                  viewingProject.drawingFile.toLowerCase().endsWith('.pdf') ? (
                    <a
                      href={`http://localhost:5000${viewingProject.drawingFile}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ background: '#0d1b4b', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', textDecoration: 'none', display: 'inline-block' }}
                    >
                      📄 View Drawing (PDF)
                    </a>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div>
                        <a
                          href={`http://localhost:5000${viewingProject.drawingFile}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ background: '#0d1b4b', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', textDecoration: 'none', display: 'inline-block', marginBottom: '8px' }}
                        >
                          🖼️ View Drawing (Image)
                        </a>
                      </div>
                      <img
                        src={`http://localhost:5000${viewingProject.drawingFile}`}
                        alt="Drawing"
                        style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', border: '1px solid #ddd', borderRadius: '4px' }}
                      />
                    </div>
                  )
                ) : (
                  <p style={{ margin: 0, fontSize: '13px', color: '#666', fontStyle: 'italic' }}>No drawing uploaded</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default PMDashboard;