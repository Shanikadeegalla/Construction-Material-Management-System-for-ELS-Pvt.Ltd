import React, { useState, useEffect } from 'react';
import SettingsPage from './SettingsPage';
import { formatDate, formatDateTime, formatDateLong } from '../utils/dateUtils';
import DateInput from '../components/DateInput';

const PMDashboard = ({ user, onLogout, onUserUpdate }) => {
  const [activePage, setActivePage] = useState('dashboard'); // 'dashboard', 'bom', 'settings'
  const [requests, setRequests] = useState([]);
  const [boms, setBoms] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [transfers, setTransfers] = useState([]);
  const [siteInventory, setSiteInventory] = useState([]);
  const [siteInventorySearch, setSiteInventorySearch] = useState('');

  // New BOM Form State (Phase 4)
  const [bomProjectId, setBomProjectId] = useState('');
  const emptyBomMaterialRow = { materialId: null, name: '', unit: '', plannedQty: 1, category: '', estimatedUnitCost: 0, totalCost: 0, supplierRef: '', remarks: '' };
  const [bomMaterials, setBomMaterials] = useState([{ ...emptyBomMaterialRow }]);
  const [materialMaster, setMaterialMaster] = useState([]);
  const [focusedRowIdx, setFocusedRowIdx] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [highlightedSuggestionIdx, setHighlightedSuggestionIdx] = useState(-1);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [bomVersions, setBomVersions] = useState([]);
  const [viewingVersionBOM, setViewingVersionBOM] = useState(null);
  const [currentBomMeta, setCurrentBomMeta] = useState(null); // { bomNumber, version, status, createdAt, createdBy }
  const [showBOMForm, setShowBOMForm] = useState(false);
  const [viewingBom, setViewingBom] = useState(null);
  const [showViewBomModal, setShowViewBomModal] = useState(false);
  const [viewBomVersions, setViewBomVersions] = useState([]);

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // BOM approval/rejection notifications (from Director actions)
  const [bomNotifications, setBomNotifications] = useState([]);
  const [bomUnreadCount, setBomUnreadCount] = useState(0);

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
  const [drawingFiles, setDrawingFiles] = useState([]);
  const [specFiles, setSpecFiles] = useState([]);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [viewingProject, setViewingProject] = useState(null);
  const [showViewProjectModal, setShowViewProjectModal] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [nextProjectId, setNextProjectId] = useState('');
  const [nextProjectIdLoading, setNextProjectIdLoading] = useState(false);

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
      setRequests(data.success ? (data.data || []) : []);
    } catch {
      setRequests([
        { _id: '1', projectName: 'Colombo Port Expansion', materials: [{ materialName: 'Portland Cement', quantity: 300, unit: 'bags', reason: 'Foundation concrete' }], status: 'Pending', requestedBy: 'Mike Storekeeper', createdAt: new Date().toISOString(), notes: 'Urgent request' },
        { _id: '2', projectName: 'Marina Heights', materials: [{ materialName: 'TMT Steel 12mm', quantity: 5, unit: 'ton', reason: 'Column reinforcement' }], status: 'Pending', requestedBy: 'Mike Storekeeper', createdAt: new Date(Date.now() - 86400000).toISOString(), notes: '' },
        { _id: '3', projectName: 'Highway Extension Project', materials: [{ materialName: 'River Sand', quantity: 40, unit: 'm3', reason: 'Concrete mix' }], status: 'Pending', requestedBy: 'Mike Storekeeper', createdAt: new Date(Date.now() - 172800000).toISOString(), notes: '' },
        { _id: '4', projectName: 'Water Treatment Plant', materials: [{ materialName: 'Coarse Aggregate', quantity: 100, unit: 'bags', reason: 'Filter bed' }], status: 'Pending', requestedBy: 'Mike Storekeeper', createdAt: new Date(Date.now() - 259200000).toISOString(), notes: 'Urgent' }
      ]);
    }
  };

  const fetchBoms = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/bom', {
        headers: getHeaders()
      });
      const data = await res.json();
      setBoms(data.success ? (data.data || []) : []);
    } catch {
      setBoms([
        { _id: '1', projectName: 'Colombo Port Expansion', version: 'v1.0', createdBy: 'John PM', createdAt: new Date().toISOString(), status: 'Pending', materials: [{ name: 'Portland Cement', unit: 'bags', plannedQty: 300, category: 'Cement' }] },
        { _id: '2', projectName: 'Marina Heights', version: 'v1.2', createdBy: 'Sarah PM', createdAt: new Date(Date.now() - 86400000).toISOString(), status: 'Approved', materials: [{ name: 'Portland Cement', unit: 'bags', plannedQty: 500, category: 'Cement' }] },
        { _id: '3', projectName: 'Highway Extension Project', version: 'v1.1', createdBy: 'John PM', createdAt: new Date(Date.now() - 172800000).toISOString(), status: 'Pending', materials: [{ name: 'River Sand', unit: 'cube', plannedQty: 150, category: 'Sand' }] },
        { _id: '4', projectName: 'Water Treatment Plant', version: 'v1.0', createdBy: 'Sarah PM', createdAt: new Date(Date.now() - 259200000).toISOString(), status: 'Approved', materials: [{ name: 'Coarse Aggregate', unit: 'bags', plannedQty: 200, category: 'Aggregate' }] },
        { _id: '5', projectName: 'City Center Mall', version: 'v1.0', createdBy: 'John PM', createdAt: new Date(Date.now() - 345600000).toISOString(), status: 'Pending', materials: [{ name: 'TMT Steel 12mm', unit: 'ton', plannedQty: 25, category: 'Steel' }] }
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
      let notifList = data.success ? data.data : [];
      if (!notifList || notifList.length === 0) {
        notifList = [
          { materialName: 'Portland Cement OPC', currentQty: 0, minimumStock: 10, location: 'MainStore', alertLevel: 'Critical' },
          { materialName: 'Steel Bars 12mm', currentQty: 2, minimumStock: 2, location: 'SiteStore', alertLevel: 'Low' }
        ];
      }
      setNotifications(notifList);

      const countRes = await fetch('http://localhost:5000/api/notifications/count', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const countData = await countRes.json();
      if (countData.success) {
        setUnreadCount(countData.count || 2);
      } else {
        setUnreadCount(2);
      }
    } catch (err) {
      setNotifications([
        { materialName: 'Portland Cement OPC', currentQty: 0, minimumStock: 10, location: 'MainStore', alertLevel: 'Critical' },
        { materialName: 'Steel Bars 12mm', currentQty: 2, minimumStock: 2, location: 'SiteStore', alertLevel: 'Low' }
      ]);
      setUnreadCount(2);
    }
  };

  // Fetches real BOM approval/rejection notifications (Director actions) so the
  // PM sees them in the bell, separate from the low-stock inventory alerts above.
  const fetchBomNotifications = async () => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        const bomNotifs = (data.data || []).filter(n => (n.type || '').toLowerCase().startsWith('bom'));
        setBomNotifications(bomNotifs);
        setBomUnreadCount(bomNotifs.filter(n => !n.isRead).length);
      }
    } catch (err) {
      console.error('Error fetching BOM notifications:', err);
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
      console.error('Error marking notification as read:', err);
    }
    setBomNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, isRead: true } : n));
    setBomUnreadCount(prev => Math.max(0, prev - (notif.isRead ? 0 : 1)));
    setShowNotifications(false);
    setActivePage('bom');
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/projects', {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setProjects(data.data || []);
      } else {
        setProjects([]);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      setProjects([
        { _id: '1', projectId: 'PRJ-2026-001', projectName: 'Colombo Port Expansion', status: 'Active', budget: 750000000, startDate: new Date(Date.now() - 30*24*60*60*1000).toISOString(), expectedEndDate: new Date(Date.now() + 180*24*60*60*1000).toISOString(), clientName: 'SLPA', location: 'Colombo Port' },
        { _id: '2', projectId: 'PRJ-2026-002', projectName: 'Marina Heights', status: 'Active', budget: 350000000, startDate: new Date(Date.now() - 5*24*60*60*1000).toISOString(), expectedEndDate: new Date(Date.now() + 240*24*60*60*1000).toISOString(), clientName: 'Marina Dev', location: 'Colombo 03' },
        { _id: '3', projectId: 'PRJ-2026-003', projectName: 'Highway Extension Project', status: 'Active', budget: 620000000, startDate: new Date(Date.now() - 15*24*60*60*1000).toISOString(), expectedEndDate: new Date(Date.now() + 120*24*60*60*1000).toISOString(), clientName: 'RDA', location: 'Southern Highway' }
      ]);
    }
  };

  const fetchNextProjectId = async (startDate) => {
    setNextProjectIdLoading(true);
    try {
      const query = startDate ? `?startDate=${encodeURIComponent(startDate)}` : '';
      const res = await fetch(`http://localhost:5000/api/projects/next-id${query}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      setNextProjectId(data.success ? data.projectId : '');
    } catch (err) {
      console.error('Error fetching next project ID:', err);
      setNextProjectId('');
    } finally {
      setNextProjectIdLoading(false);
    }
  };

  // Preview the auto-generated project ID whenever the create form is open
  // and the start date changes (the year drives the PRJ-YYYY-XXX sequence).
  useEffect(() => {
    if (showProjectForm && !editingProjectId) {
      fetchNextProjectId(projectForm.startDate);
    }
  }, [showProjectForm, editingProjectId, projectForm.startDate]);

  const fetchTransfers = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/inventory/transfers', {
        headers: getHeaders()
      });
      const data = await res.json();
      setTransfers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching transfers:', err);
      setTransfers([
        { _id: '1', materialName: 'Portland Cement OPC', quantity: 50, from: 'MainStore', to: 'SiteStore', issuedBy: 'Store Officer', date: new Date().toISOString() },
        { _id: '2', materialName: 'TMT Steel 12mm', quantity: 2, from: 'MainStore', to: 'SiteStore', issuedBy: 'Store Officer', date: new Date(Date.now() - 86400000).toISOString() },
        { _id: '3', materialName: 'River Sand', quantity: 15, from: 'MainStore', to: 'SiteStore', issuedBy: 'Store Officer', date: new Date(Date.now() - 172800000).toISOString() },
        { _id: '4', materialName: 'Coarse Aggregate', quantity: 20, from: 'MainStore', to: 'SiteStore', issuedBy: 'Store Officer', date: new Date(Date.now() - 259200000).toISOString() },
        { _id: '5', materialName: 'Plywood Sheets', quantity: 30, from: 'MainStore', to: 'SiteStore', issuedBy: 'Store Officer', date: new Date(Date.now() - 345600000).toISOString() },
        { _id: '6', materialName: 'PVC Pipes 2"', quantity: 45, from: 'MainStore', to: 'SiteStore', issuedBy: 'Store Officer', date: new Date(Date.now() - 432000000).toISOString() },
        { _id: '7', materialName: 'Binding Wire', quantity: 10, from: 'MainStore', to: 'SiteStore', issuedBy: 'Store Officer', date: new Date(Date.now() - 518400000).toISOString() },
        { _id: '8', materialName: 'Nails 3"', quantity: 25, from: 'MainStore', to: 'SiteStore', issuedBy: 'Store Officer', date: new Date(Date.now() - 604800000).toISOString() },
        { _id: '9', materialName: 'Paint Brilliant White', quantity: 12, from: 'MainStore', to: 'SiteStore', issuedBy: 'Store Officer', date: new Date(Date.now() - 691200000).toISOString() },
        { _id: '10', materialName: 'Paint Brush 4"', quantity: 15, from: 'MainStore', to: 'SiteStore', issuedBy: 'Store Officer', date: new Date(Date.now() - 777600000).toISOString() },
        { _id: '11', materialName: 'Brick Clay Red', quantity: 1000, from: 'MainStore', to: 'SiteStore', issuedBy: 'Store Officer', date: new Date(Date.now() - 864000000).toISOString() },
        { _id: '12', materialName: 'Metal CRS 3/4"', quantity: 8, from: 'MainStore', to: 'SiteStore', issuedBy: 'Store Officer', date: new Date(Date.now() - 950400000).toISOString() }
      ]);
    }
  };

  const fetchSiteInventory = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/admin/projects-overview', {
        headers: getHeaders()
      });
      const data = await res.json();
      let siteList = data.success && Array.isArray(data.data) ? data.data : [];
      if (!siteList || siteList.length === 0) {
        siteList = [
          { _id: '1', name: 'Portland Cement', quantity: 150, unit: 'bags', project_id: { projectName: 'Colombo Port Expansion' }, updatedAt: new Date().toISOString() },
          { _id: '2', name: 'TMT Steel 12mm', quantity: 15, unit: 'ton', project_id: { projectName: 'Marina Heights' }, updatedAt: new Date(Date.now() - 3600000).toISOString() },
          { _id: '3', name: 'River Sand', quantity: 45, unit: 'cube', projectId: { projectName: 'Colombo Port Expansion' }, updatedAt: new Date(Date.now() - 7200000).toISOString() }
        ];
      }
      setSiteInventory(siteList);
    } catch (err) {
      console.error('Error fetching site inventory:', err);
      setSiteInventory([
        { _id: '1', name: 'Portland Cement', quantity: 150, unit: 'bags', project_id: { projectName: 'Colombo Port Expansion' }, updatedAt: new Date().toISOString() },
        { _id: '2', name: 'TMT Steel 12mm', quantity: 15, unit: 'ton', project_id: { projectName: 'Marina Heights' }, updatedAt: new Date(Date.now() - 3600000).toISOString() },
        { _id: '3', name: 'River Sand', quantity: 45, unit: 'cube', projectId: { projectName: 'Colombo Port Expansion' }, updatedAt: new Date(Date.now() - 7200000).toISOString() }
      ]);
    }
  };

  const hasSession = () => {
    try {
      return !!JSON.parse(localStorage.getItem('user'))?.token;
    } catch {
      return false;
    }
  };

  const fetchAllData = async () => {
    if (!hasSession()) return;
    setLoading(true);
    await Promise.all([fetchRequests(), fetchBoms(), fetchNotifications(), fetchBomNotifications(), fetchProjects(), fetchTransfers(), fetchSiteInventory(), fetchMaterialMaster()]);
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
    drawingFiles.forEach(file => formData.append('drawings', file));
    specFiles.forEach(file => formData.append('specifications', file));

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
        setDrawingFiles([]);
        setSpecFiles([]);
        setEditingProjectId(null);
        setShowProjectForm(false);
        const drawingsInput = document.getElementById('projectDrawingsInput');
        if (drawingsInput) drawingsInput.value = '';
        const specsInput = document.getElementById('projectSpecsInput');
        if (specsInput) specsInput.value = '';

        fetchProjects();
      } else {
        setMessage(`⚠️ Error: ${data.message}`);
      }
    } catch (err) {
      setMessage('⚠️ Connection refused. Failed to save project.');
    }
  };

  const handleDocumentDownload = async (url, filename) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename || 'document';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      window.open(url, '_blank');
    }
  };

  const handleDocumentPrint = (url) => {
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.focus();
        printWindow.print();
      });
    }
  };

  // Loads the Admin-managed Master Material catalog (active items only) so BOM
  // rows can only reference materials that exist in the single source of truth.
  const fetchMaterialMaster = async () => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/item-master?status=Active', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setMaterialMaster(data.success ? data.data : []);
    } catch (err) {
      console.error('Error fetching material master:', err);
      setMaterialMaster([]);
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

  const handleOpenCreateBOM = () => {
    setBomProjectId('');
    setBomMaterials([{ ...emptyBomMaterialRow }]);
    setBomVersions([]);
    setViewingVersionBOM(null);
    setDuplicateWarning(null);
    setCurrentBomMeta(null);
    setShowBOMForm(true);
  };

  const handleProjectSelectChange = async (projId) => {
    setBomProjectId(projId);
    setViewingVersionBOM(null);
    setDuplicateWarning(null);
    setCurrentBomMeta(null);

    if (!projId) {
      setBomMaterials([{ ...emptyBomMaterialRow }]);
      setBomVersions([]);
      return;
    }

    fetchBOMVersions(projId);

    // The BOM number is derived from the project's own project code and stays
    // constant across every version/draft of that project's BOM, so any existing
    // record (draft or otherwise) already carries the same number the registry
    // will show. Fall back to previewing it in the same "BOM-<projectCode>"
    // shape the backend generates so the field never shows a placeholder.
    const selectedProject = projects.find(p => p._id === projId);
    const previewBomNumber = selectedProject?.projectId ? `BOM-${selectedProject.projectId}` : '';

    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch(`http://localhost:5000/api/bom/versions/${projId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.data) {
        const existingBomNumber = data.data.find(b => b.bomNumber)?.bomNumber;

        const draft = data.data.find(b => b.status === 'Draft');
        if (draft) {
          const mapped = draft.materials.map(m => ({
            materialId: m.materialId || null,
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
          setCurrentBomMeta({
            bomNumber: draft.bomNumber || existingBomNumber || previewBomNumber,
            version: draft.version,
            status: draft.status,
            createdAt: draft.createdAt,
            createdBy: draft.createdBy
          });
          setMessage('ℹ️ Loaded existing Draft BOM for editing.');
          return;
        }

        if (existingBomNumber) {
          setCurrentBomMeta({ bomNumber: existingBomNumber });
        } else if (previewBomNumber) {
          setCurrentBomMeta({ bomNumber: previewBomNumber });
        }
      } else if (previewBomNumber) {
        setCurrentBomMeta({ bomNumber: previewBomNumber });
      }
    } catch (err) {
      console.error(err);
      if (previewBomNumber) {
        setCurrentBomMeta({ bomNumber: previewBomNumber });
      }
    }

    setBomMaterials([{ ...emptyBomMaterialRow }]);
  };

  // Opens the View modal for one BOM and also loads every version of that BOM's
  // project (same status flow as the Create/Edit form's version history: Draft ->
  // Submitted -> Approved/Rejected, with rejections bumping the minor version and
  // approvals bumping the major version) so the PM can switch between versions
  // without leaving the modal.
  const handleViewBom = async (bom) => {
    setViewingBom(bom);
    setShowViewBomModal(true);
    setViewBomVersions([]);

    const projId = bom.projectId?._id || bom.projectId;
    if (!projId) return;

    try {
      const res = await fetch(`http://localhost:5000/api/bom/versions/${projId}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setViewBomVersions(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching BOM version history:', err);
    }
  };

  // Loads an Approved/Rejected BOM's materials into the create/edit form so the PM
  // can revise it. Since createBOM only reuses an existing Draft, submitting this
  // will create a new version for Director review rather than overwrite the original.
  const handleEditBom = (bom) => {
    const projId = bom.projectId?._id || bom.projectId;
    setShowViewBomModal(false);
    setActivePage('bom');
    setBomProjectId(projId);
    setViewingVersionBOM(null);
    setDuplicateWarning(null);
    setCurrentBomMeta(null);

    const mapped = (bom.materials || []).map(m => ({
      materialId: m.materialId || null,
      name: m.name,
      unit: m.unit,
      plannedQty: m.plannedQty,
      category: m.category,
      estimatedUnitCost: m.estimatedUnitCost || 0,
      totalCost: m.totalCost || (m.plannedQty * (m.estimatedUnitCost || 0)),
      supplierRef: m.supplierRef || '',
      remarks: m.remarks || ''
    }));
    setBomMaterials(mapped.length ? mapped : [{ ...emptyBomMaterialRow }]);
    setShowBOMForm(true);
    fetchBOMVersions(projId);
    setMessage(`ℹ️ Editing ${bom.status} BOM ${bom.bomNumber || ''} (${bom.version}). Saving will create a new version for Director review.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Sorted list of distinct categories in the active catalog, used to power the
  // "choose a category first" filter above the material search box.
  const materialCategories = Array.from(
    new Set(materialMaster.map(item => item.category || 'Other'))
  ).sort();

  // Returns the active Master Materials matching a search term (name or code), narrowed
  // to the row's chosen category when set. Empty term + no category returns the full
  // active catalog, used to power "click to browse" behavior.
  const getMatchingMaterials = (val, category) => {
    const q = (val || '').trim().toLowerCase();
    let list = materialMaster;
    if (category) {
      list = list.filter(item => (item.category || 'Other') === category);
    }
    if (!q) return list;
    return list.filter(item =>
      (item.materialName && item.materialName.toLowerCase().includes(q)) ||
      (item.materialCode && item.materialCode.toLowerCase().includes(q))
    );
  };

  const handleSuggestionClick = (rowIdx, item) => {
    const updated = [...bomMaterials];
    updated[rowIdx].materialId = item._id;
    updated[rowIdx].name = item.materialName;
    updated[rowIdx].category = item.category || 'Other';
    updated[rowIdx].unit = item.unit || '';
    updated[rowIdx].estimatedUnitCost = item.estimatedUnitCost || 0;

    const qty = Number(updated[rowIdx].plannedQty) || 0;
    updated[rowIdx].totalCost = qty * updated[rowIdx].estimatedUnitCost;

    setBomMaterials(updated);
    setSuggestions([]);
    setHighlightedSuggestionIdx(-1);
    setFocusedRowIdx(null);

    const dupIdx = bomMaterials.findIndex((m, i) =>
      i !== rowIdx && m.name.toLowerCase().trim() === item.materialName.toLowerCase().trim()
    );
    if (dupIdx !== -1) {
      setDuplicateWarning({
        materialName: item.materialName,
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

  // Picking a category narrows the Material Name browse list to that category. Any
  // previously chosen material is cleared since it may no longer belong to the new category.
  const handleCategoryChange = (idx, category) => {
    const updated = [...bomMaterials];
    updated[idx].category = category;
    updated[idx].materialId = null;
    updated[idx].name = '';
    updated[idx].unit = '';
    updated[idx].estimatedUnitCost = 0;
    updated[idx].totalCost = 0;
    setBomMaterials(updated);

    setFocusedRowIdx(idx);
    setHighlightedSuggestionIdx(-1);
    setSuggestions(getMatchingMaterials('', category));
  };

  const handleAddMaterialRow = () => {
    setBomMaterials([...bomMaterials, { ...emptyBomMaterialRow }]);
  };

  const handleRemoveMaterialRow = (idx) => {
    if (bomMaterials.length === 1) return;
    setBomMaterials(bomMaterials.filter((_, i) => i !== idx));
  };

  const handleMaterialChange = (idx, field, val) => {
    const updated = [...bomMaterials];
    updated[idx][field] = val;

    if (field === 'name') {
      // Typing invalidates any prior selection until the PM picks a material
      // from the Master Material dropdown again - free typed names must never
      // be submittable, only materials referenced from the master list. The chosen
      // category is left as-is since it's now a deliberate filter, not just an autofill.
      updated[idx].materialId = null;
      updated[idx].unit = '';
      updated[idx].estimatedUnitCost = 0;
      updated[idx].totalCost = 0;
    }

    if (field === 'plannedQty') {
      const qty = Number(updated[idx].plannedQty) || 0;
      const cost = Number(updated[idx].estimatedUnitCost) || 0;
      updated[idx].totalCost = qty * cost;
    }

    setBomMaterials(updated);

    if (field === 'name') {
      setFocusedRowIdx(idx);
      setHighlightedSuggestionIdx(-1);
      setSuggestions(getMatchingMaterials(val, updated[idx].category));

      if (val.trim() === '') {
        setDuplicateWarning(null);
      } else {
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

  const handleSubmitBOM = async () => {
    const status = 'Submitted';
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

    // Every row must reference an active Master Material - either selected
    // directly from the dropdown (materialId set) or matching one by name
    // (covers reloading an existing draft BOM). Free-typed names that don't
    // exist in the master list must never reach the backend.
    const unmatched = bomMaterials.some(m => {
      if (m.materialId) return false;
      return !materialMaster.some(mm => mm.materialName.toLowerCase().trim() === m.name.toLowerCase().trim());
    });
    if (unmatched) {
      setMessage('⚠️ Please select every material from the Master Material dropdown - manual entries are not allowed.');
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
            materialId: m.materialId || (materialMaster.find(mm => mm.materialName.toLowerCase().trim() === m.name.toLowerCase().trim())?._id || null),
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
        setMessage('✅ BOM submitted to Director successfully!');
        setCurrentBomMeta({
          bomNumber: data.data?.bomNumber,
          version: data.data?.version,
          status: data.data?.status,
          createdAt: data.data?.createdAt,
          createdBy: data.data?.createdBy || user
        });
        setBomProjectId('');
        setBomMaterials([{ ...emptyBomMaterialRow }]);
        setCurrentBomMeta(null);
        fetchBoms();
        if (bomProjectId) {
          fetchBOMVersions(bomProjectId);
        }
      } else {
        setMessage(`❌ Failed: ${data.message}`);
      }
    } catch {
      setMessage('✅ BOM submitted successfully! (Demo mode)');
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
      setBomMaterials([{ ...emptyBomMaterialRow }]);
    }
  };

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  // Scope every card to projects owned by this PM (mirrors the backend's
  // createdBy filter on GET /api/projects) so the row reflects one PM's
  // workload instead of every PM's data mixed together.
  const myProjectIds = new Set(projects.map(p => p._id));
  const myProjectNames = new Set(projects.map(p => p.projectName));

  const activeProjectsCount = projects.filter(p => p.status === 'Active' || p.status === 'active').length;
  const bomsSubmittedCount = boms.filter(b => {
    const projName = b.projectId?.projectName || b.projectName;
    const projId = b.projectId?._id || b.projectId;
    return b.status !== 'Draft' && (myProjectIds.has(projId) || myProjectNames.has(projName));
  }).length;
  // BOMs the Director has already reviewed (Approved or Rejected), scoped to this
  // PM's own projects, for the "view / edit reviewed BOM" section below. Only the
  // latest version per project is considered - once a Rejected BOM is edited and
  // resubmitted, the new version goes back to 'Submitted' and supersedes the old
  // Rejected row, which must stop showing here (and stop offering Edit) so the PM
  // can't spawn multiple concurrent resubmissions for the same project.
  const latestBomByProject = new Map();
  boms.forEach(b => {
    const key = b.projectId?._id || b.projectId || b.projectName;
    const existing = latestBomByProject.get(key);
    if (!existing || new Date(b.createdAt) > new Date(existing.createdAt)) {
      latestBomByProject.set(key, b);
    }
  });
  const directorReviewedBoms = Array.from(latestBomByProject.values()).filter(b => {
    const projName = b.projectId?.projectName || b.projectName;
    const projId = b.projectId?._id || b.projectId;
    return (b.status === 'Approved' || b.status === 'Rejected') && (myProjectIds.has(projId) || myProjectNames.has(projName));
  });
  const myPendingRequests = requests.filter(r =>
    r.status === 'Pending' && myProjectNames.has(r.projectName || r.project)
  );
  const pendingRequestsCount = myPendingRequests.length;
  const issuedThisMonthCount = transfers.filter(t =>
    new Date(t.date || t.createdAt) >= startOfMonth && myProjectIds.has(t.projectId || t.project_id)
  ).length;

  const stats = [
    { label: 'Active Projects', value: activeProjectsCount, color: '#0d1b4b', type: 'active-projects' },
    { label: 'BOM Submitted', value: bomsSubmittedCount, color: '#2563eb', type: 'boms-submitted' },
    { label: 'Pending Requests', value: pendingRequestsCount, color: '#1e3a8a', type: 'pending-requests' },
    { label: 'Issued This Month', value: issuedThisMonthCount, color: '#2e7d32', type: 'issued-this-month' },
  ];

  const renderProjects = () => {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}>
        {/* Project Form */}
        {!showProjectForm ? (
          <div style={{ background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: '#0d1b4b', fontWeight: '700' }}>🏗️ Construction Projects</h3>
            <button
              type="button"
              onClick={() => setShowProjectForm(true)}
              style={{ background: '#2563eb', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', boxShadow: '0 4px 10px rgba(37, 99, 235,0.15)' }}
            >
              + Create Project
            </button>
          </div>
        ) : (
        <div style={{ background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0d1b4b', paddingBottom: '10px', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, color: '#0d1b4b', fontWeight: '700' }}>
              {editingProjectId ? '📝 Edit Project Details' : '🏗️ Create New Construction Project'}
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowProjectForm(false);
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
                setDrawingFiles([]);
                setSpecFiles([]);
                const drawingsInput = document.getElementById('projectDrawingsInput');
                if (drawingsInput) drawingsInput.value = '';
                const specsInput = document.getElementById('projectSpecsInput');
                if (specsInput) specsInput.value = '';
              }}
              style={{ background: 'transparent', color: '#64748b', border: 'none', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '4px' }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <form onSubmit={handleProjectSubmit}>
            {!editingProjectId && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', fontWeight: '700', marginBottom: '6px' }}>PROJECT ID (AUTO-GENERATED)</label>
                <input
                  type="text"
                  value={nextProjectIdLoading ? 'Generating…' : (nextProjectId || 'Will be assigned on save')}
                  readOnly
                  disabled
                  style={{ width: '100%', maxWidth: '260px', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none', background: '#f1f5f9', color: '#475569', fontWeight: '700' }}
                />
              </div>
            )}
            {editingProjectId && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', fontWeight: '700', marginBottom: '6px' }}>PROJECT ID</label>
                <input
                  type="text"
                  value={projects.find(p => p._id === editingProjectId)?.projectId || ''}
                  readOnly
                  disabled
                  style={{ width: '100%', maxWidth: '260px', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none', background: '#f1f5f9', color: '#475569', fontWeight: '700' }}
                />
              </div>
            )}
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
                <DateInput
                  value={projectForm.startDate}
                  onChange={iso => setProjectForm({ ...projectForm, startDate: iso })}
                  style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', fontWeight: '700', marginBottom: '6px' }}>EXPECTED END DATE *</label>
                <DateInput
                  value={projectForm.expectedEndDate}
                  onChange={iso => setProjectForm({ ...projectForm, expectedEndDate: iso })}
                  style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', fontWeight: '700', marginBottom: '6px' }}>CONSTRUCTION DRAWINGS (PDF/IMAGE, MULTIPLE ALLOWED)</label>
                <input
                  id="projectDrawingsInput"
                  type="file"
                  multiple
                  onChange={e => setDrawingFiles(Array.from(e.target.files))}
                  style={{ width: '100%', padding: '8px', fontSize: '13px' }}
                  accept=".jpg,.jpeg,.png,.pdf"
                />
                {drawingFiles.length > 0 && (
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '6px' }}>
                    {drawingFiles.length} file(s) selected: {drawingFiles.map(f => f.name).join(', ')}
                  </div>
                )}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', fontWeight: '700', marginBottom: '6px' }}>SPECIFICATIONS / OTHER DOCUMENTS (MULTIPLE ALLOWED)</label>
                <input
                  id="projectSpecsInput"
                  type="file"
                  multiple
                  onChange={e => setSpecFiles(Array.from(e.target.files))}
                  style={{ width: '100%', padding: '8px', fontSize: '13px' }}
                  accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx"
                />
                {specFiles.length > 0 && (
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '6px' }}>
                    {specFiles.length} file(s) selected: {specFiles.map(f => f.name).join(', ')}
                  </div>
                )}
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
                style={{ background: '#2563eb', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', boxShadow: '0 4px 10px rgba(37, 99, 235,0.15)' }}
              >
                {editingProjectId ? 'Update Project' : 'Create Project'}
              </button>
              {editingProjectId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingProjectId(null);
                    setShowProjectForm(false);
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
                    setDrawingFiles([]);
                    setSpecFiles([]);
                    const drawingsInput = document.getElementById('projectDrawingsInput');
                    if (drawingsInput) drawingsInput.value = '';
                    const specsInput = document.getElementById('projectSpecsInput');
                    if (specsInput) specsInput.value = '';
                  }}
                  style={{ background: '#f5f5f5', color: '#333', border: '1px solid #ddd', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </div>
        )}

        {/* Project List Table */}
        <div style={{ background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: '0 0 20px', color: '#0d1b4b', borderBottom: '2px solid #0d1b4b', paddingBottom: '10px', fontWeight: '700' }}>📋 Construction Projects Registry</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                  {['Project ID', 'Name', 'Client', 'Location', 'Status', 'Start Date', 'Budget (LKR)', 'Created By', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: '#475569', fontWeight: '600' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projects.map((p, idx) => (
                  <tr key={p._id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px', fontSize: '13px', fontWeight: '700', color: '#0d1b4b' }}>{p.projectId}</td>
                    <td style={{ padding: '12px', fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{p.projectName}</td>
                    <td style={{ padding: '12px', fontSize: '13px', color: '#1e293b' }}>{p.clientName}</td>
                    <td style={{ padding: '12px', fontSize: '13px', color: '#1e293b' }}>{p.location}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        background: p.status === 'Active' ? '#e8f5e9' : p.status === 'Completed' ? '#e3f2fd' : p.status === 'On Hold' || p.status === 'OnHold' ? '#ffebee' : '#dbeafe',
                        color: p.status === 'Active' ? '#2e7d32' : p.status === 'Completed' ? '#1565c0' : p.status === 'On Hold' || p.status === 'OnHold' ? '#c62828' : '#1e3a8a',
                        padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700'
                      }}>{p.status}</span>
                    </td>
                    <td style={{ padding: '12px', fontSize: '12px', color: '#64748b' }}>
                      {formatDate(p.startDate)}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>
                      {Number(p.budget).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', color: '#1e293b' }}>
                      {p.createdBy?.name || user?.name || '-'}
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
                            setShowProjectForm(true);
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
                          style={{ background: '#2563eb', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                        >
                          ✏️ Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {projects.length === 0 && (
                  <tr>
                    <td colSpan="9" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
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

  const renderPMStatsModal = () => {
    if (!modal) return null;

    let title = '';
    let tableHeaders = [];
    let tableRows = [];
    
    const query = modalSearchTerm.toLowerCase();

    if (modal === 'active-projects') {
      title = "PM's Projects Directory";
      tableHeaders = ['Project ID', 'Name', 'Status', 'Start Date', 'Expected End Date'];
      
      const filtered = projects.filter(p => 
        (p.status === 'Active' || p.status === 'active') &&
        ((p.projectId || '').toLowerCase().includes(query) || (p.projectName || '').toLowerCase().includes(query))
      );

      tableRows = filtered.map((p, idx) => (
        <tr key={p._id || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '700', color: '#0d1b4b' }}>{p.projectId}</td>
          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600' }}>{p.projectName}</td>
          <td style={{ padding: '12px 16px', fontSize: '13px' }}>
            <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>Active</span>
          </td>
          <td style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b' }}>{formatDate(p.startDate)}</td>
          <td style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b' }}>{formatDate(p.expectedEndDate || p.endDate)}</td>
        </tr>
      ));
    } else if (modal === 'boms-submitted') {
      title = 'BOMs Submitted Registry';
      tableHeaders = ['Project', 'Version', 'Status', 'Submitted Date'];
      
      const submittedBoms = boms.filter(b => {
        const projName = b.projectId?.projectName || b.projectName;
        const projId = b.projectId?._id || b.projectId;
        return b.status !== 'Draft' && (myProjectIds.has(projId) || myProjectNames.has(projName));
      });
      const filtered = submittedBoms.filter(b =>
        (b.projectId?.projectName || b.projectName || '').toLowerCase().includes(query) ||
        (b.version || '').toLowerCase().includes(query) ||
        (b.status || '').toLowerCase().includes(query)
      );

      tableRows = filtered.map((b, idx) => (
        <tr key={b._id || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#0d1b4b' }}>{b.projectId?.projectName || b.projectId?.name || b.projectName || '-'}</td>
          <td style={{ padding: '12px 16px', fontSize: '13px' }}>{b.version || 'v1.0'}</td>
          <td style={{ padding: '12px 16px', fontSize: '13px' }}>
            <span style={{
              background: b.status === 'Approved' ? '#e8f5e9' : b.status === 'Rejected' ? '#ffebee' : '#dbeafe',
              color: b.status === 'Approved' ? '#2e7d32' : b.status === 'Rejected' ? '#c62828' : '#1e3a8a',
              padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700'
            }}>{b.status}</span>
          </td>
          <td style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b' }}>{formatDate(b.submittedAt || b.createdAt)}</td>
        </tr>
      ));
    } else if (modal === 'pending-requests') {
      title = 'Pending PR Requests Checklist';
      tableHeaders = ['PR Number', 'Material / Specification', 'Qty Requested', 'Urgency / Date', 'Status'];
      
      const pendingPrs = requests.filter(r => r.status === 'Pending' && myProjectNames.has(r.projectName || r.project));
      const filtered = pendingPrs.filter(r =>
        (r.projectName || r.project || '').toLowerCase().includes(query) ||
        (r.materials?.some(m => m.materialName?.toLowerCase().includes(query)))
      );

      tableRows = filtered.map((r, idx) => (
        <tr key={r._id || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1565c0', fontWeight: '600' }}>PR-{String(idx + 1).padStart(3, '0')}</td>
          <td style={{ padding: '12px 16px', fontSize: '12px', color: '#475569' }}>
            {r.materials?.map((m, mIdx) => (
              <div key={mIdx}>{m.materialName} ({m.unit})</div>
            ))}
          </td>
          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600' }}>
            {r.materials?.map((m, mIdx) => (
              <div key={mIdx}>{m.quantity}</div>
            ))}
          </td>
          <td style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b' }}>
            <div style={{ fontWeight: 'bold', color: r.urgency === 'Critical' ? '#c62828' : r.urgency === 'Urgent' ? '#1e3a8a' : '#1565c0' }}>{r.urgency || 'Normal'}</div>
            <div>{formatDate(r.createdAt)}</div>
          </td>
          <td style={{ padding: '12px 16px', fontSize: '13px' }}>
            <span style={{ background: '#dbeafe', color: '#1e3a8a', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>Pending</span>
          </td>
        </tr>
      ));
    } else if (modal === 'issued-this-month') {
      title = 'Issued Materials (Transfers)';
      tableHeaders = ['Material Name', 'Quantity Issued', 'Destination Site', 'Transfer Date', 'Issued By'];
      
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const transfersThisMonth = transfers.filter(t =>
        new Date(t.date || t.createdAt) >= startOfMonth && myProjectIds.has(t.projectId || t.project_id)
      );
      const filtered = transfersThisMonth.filter(t => 
        (t.materialName || '').toLowerCase().includes(query) ||
        (t.to || '').toLowerCase().includes(query)
      );

      tableRows = filtered.map((t, idx) => (
        <tr key={t._id || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600' }}>{t.materialName}</td>
          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '700', color: '#0d1b4b' }}>{t.quantity}</td>
          <td style={{ padding: '12px 16px', fontSize: '13px' }}>{t.to}</td>
          <td style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b' }}>{formatDate(t.date || t.createdAt)}</td>
          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569' }}>{t.issuedBy}</td>
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

  const renderSiteStoreInventory = () => {
    const query = siteInventorySearch.toLowerCase();
    const filtered = siteInventory.filter(item => {
      const siteName = item.project_id?.projectName || item.projectId?.projectName || item.project_id?.name || item.projectId?.name || 'Main Site Store';
      const matName = item.name || '';
      return siteName.toLowerCase().includes(query) || matName.toLowerCase().includes(query);
    });

    return (
      <div style={{ background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0d1b4b', paddingBottom: '12px', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: '#0d1b4b', fontWeight: '700', fontSize: '16px' }}>🏪 Real-Time Site Stores Inventory</h3>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <input 
            type="text" 
            placeholder="Search by Site Store Name or Material Name..."
            value={siteInventorySearch}
            onChange={e => setSiteInventorySearch(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
          />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                <th style={{ padding: '12px 16px', fontSize: '12px', color: '#475569', fontWeight: '700', textTransform: 'uppercase' }}>Site Store Name</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', color: '#475569', fontWeight: '700', textTransform: 'uppercase' }}>Material Name</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', color: '#475569', fontWeight: '700', textTransform: 'uppercase' }}>Current Stock Balance</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', color: '#475569', fontWeight: '700', textTransform: 'uppercase' }}>Unit</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', color: '#475569', fontWeight: '700', textTransform: 'uppercase' }}>Last Updated Date/Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, idx) => {
                const siteName = item.project_id?.projectName || item.projectId?.projectName || item.project_id?.name || item.projectId?.name || 'Main Site Store';
                return (
                  <tr key={item._id || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#0d1b4b' }}>{siteName}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px' }}>{item.name}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '700', color: item.quantity <= 10 ? '#ef4444' : '#0f172a' }}>{item.quantity}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>{item.unit}</td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b' }}>
                      {item.updatedAt ? formatDateTime(item.updatedAt) : formatDateTime(new Date())}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No site store stock balance records found.</td>
                </tr>
              )}
            </tbody>
          </table>
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
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#2563eb' }}>ELS Construction</div>
            <div style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: '500' }}>PM Workspace</div>
          </div>
        </div>
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px' }}>
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
            { id: 'site-inventory', label: 'Site Inventory', icon: '🏪' },
            { id: 'bom', label: 'BOM Management', icon: '🏗️' },
            { id: 'settings', label: 'Settings', icon: '⚙️' },
          ].map(item => (
            <div key={item.id} onClick={() => { setActivePage(item.id); setMessage(''); }}
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
      <div className="dashboard-content" style={{ marginLeft: '240px', flex: 1, background: '#f5f6fa', minHeight: '100vh' }}>
        <div style={{ background: 'white', padding: '16px 24px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: '#0d1b4b', fontWeight: '700' }}>
            {activePage === 'dashboard' && 'PM Executive Overview'}
            {activePage === 'projects' && 'Project Workspace Management'}
            {activePage === 'site-inventory' && 'Real-Time Site Stores Inventory'}
            {activePage === 'bom' && 'Bill of Materials (BOM) Management'}
            {activePage === 'settings' && 'User Settings & Preferences'}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {/* Notification Bell */}
            <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setShowNotifications(!showNotifications)}>
              <span style={{ fontSize: '20px' }}>🔔</span>
              {(unreadCount + bomUnreadCount) > 0 && (
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
                  {unreadCount + bomUnreadCount}
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
                    BOM Updates
                  </div>
                  {bomNotifications.length === 0 ? (
                    <div style={{ padding: '16px', color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
                      No BOM updates yet.
                    </div>
                  ) : (
                    bomNotifications.map((notif) => {
                      const isApproved = (notif.type || '').toLowerCase() === 'bom_approved';
                      const isRejected = (notif.type || '').toLowerCase() === 'bom_rejected';
                      const label = isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Submitted';
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
                            {formatDateTime(notif.createdAt)}
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

            <div style={{ fontSize: '13px', color: '#666', fontWeight: '500' }}>
              {formatDateLong(new Date())}
            </div>
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          {message && (
            <div style={{ background: message.includes('✅') ? '#e8f5e9' : message.includes('⚠️') ? '#dbeafe' : '#ffebee', border: `1px solid ${message.includes('✅') ? '#4caf50' : message.includes('⚠️') ? '#f59e0b' : '#ef5350'}`, color: message.includes('✅') ? '#2e7d32' : message.includes('⚠️') ? '#b7791f' : '#c62828', padding: '10px 16px', borderRadius: '6px', marginBottom: '16px', fontWeight: '500' }}>
              {message}
            </div>
          )}

          {/* Stats Summary */}
          {activePage === 'dashboard' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
              {stats.map((s, i) => (
                <div
                  key={i}
                  style={{
                    background: 'white',
                    borderRadius: '8px',
                    padding: '20px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                    borderTop: `4px solid ${s.color}`
                  }}
                >
                  <div style={{ fontSize: '24px', fontWeight: '700', color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '13px', color: '#666', marginTop: '6px' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {activePage === 'dashboard' && (
            <div style={{ background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
              <h3 style={{ margin: '0 0 20px', color: '#0d1b4b', borderBottom: '2px solid #0d1b4b', paddingBottom: '10px', fontWeight: '700' }}>Director-Reviewed BOMs</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                      {['BOM Number', 'Project Name', 'Date', 'Status', 'Director Note', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: '#475569', fontWeight: '600' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {directorReviewedBoms.map((b, idx) => (
                      <tr key={b._id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#334155' }}>{b.bomNumber || '-'}</td>
                        <td style={{ padding: '12px', fontSize: '13px', fontWeight: '600', color: '#0d1b4b' }}>{b.projectId?.projectName || b.projectId?.name || b.projectName || '-'}</td>
                        <td style={{ padding: '12px', fontSize: '12px', color: '#64748b' }}>{formatDate(b.updatedAt || b.createdAt)}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            background: b.status === 'Approved' ? '#e8f5e9' : '#ffebee',
                            color: b.status === 'Approved' ? '#2e7d32' : '#c62828',
                            padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700'
                          }}>{b.status}</span>
                        </td>
                        <td style={{ padding: '12px', fontSize: '12px', color: '#64748b' }}>{b.rejectionReason || '-'}</td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => handleViewBom(b)}
                              style={{ background: '#0d1b4b', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                            >
                              👁 View
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditBom(b)}
                              style={{ background: '#2563eb', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                            >
                              ✏️ Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {directorReviewedBoms.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                          No BOMs have been approved or rejected by the Director yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activePage === 'bom' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}>
              {/* Create BOM Form */}
              <div style={{ background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, color: '#0d1b4b', fontWeight: '700' }}>🏗️ Bill of Materials (BOM)</h3>
                  {!showBOMForm ? (
                    <button
                      type="button"
                      onClick={handleOpenCreateBOM}
                      style={{ background: '#2563eb', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', boxShadow: '0 4px 10px rgba(37, 99, 235,0.15)' }}
                    >
                      + Create BOM
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowBOMForm(false)}
                      style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '14px' }}
                    >
                      ✕ Close
                    </button>
                  )}
                </div>

              {showBOMForm && (
              <>
                {/* BOM Information Panel */}
                {bomProjectId && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', marginBottom: '4px' }}>BOM NUMBER</div>
                      <div style={{ fontSize: '13px', color: '#0d1b4b', fontWeight: '600' }}>{currentBomMeta?.bomNumber || 'Auto-generated on save'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', marginBottom: '4px' }}>BOM VERSION</div>
                      <div style={{ fontSize: '13px', color: '#0d1b4b', fontWeight: '600' }}>{currentBomMeta?.version || 'v1.0 (new)'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', marginBottom: '4px' }}>CREATED DATE</div>
                      <div style={{ fontSize: '13px', color: '#0d1b4b', fontWeight: '600' }}>{currentBomMeta?.createdAt ? formatDate(currentBomMeta.createdAt) : formatDate(new Date())}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', marginBottom: '4px' }}>PREPARED BY</div>
                      <div style={{ fontSize: '13px', color: '#0d1b4b', fontWeight: '600' }}>{currentBomMeta?.createdBy?.name || currentBomMeta?.createdBy || user?.name || 'Project Manager'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', marginBottom: '4px' }}>BOM STATUS</div>
                      <span style={{
                        display: 'inline-block',
                        background: currentBomMeta?.status === 'Approved' ? '#e8f5e9' : currentBomMeta?.status === 'Rejected' ? '#ffebee' : '#dbeafe',
                        color: currentBomMeta?.status === 'Approved' ? '#2e7d32' : currentBomMeta?.status === 'Rejected' ? '#c62828' : '#1e3a8a',
                        padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '700'
                      }}>{currentBomMeta?.status || 'Draft'}</span>
                    </div>
                  </div>
                )}

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
                        {p.projectId || 'Draft'} - {p.projectName || p.name}
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
                        📖 Viewing Version: {viewingVersionBOM.version} ({viewingVersionBOM.status}) - Created on {formatDate(viewingVersionBOM.createdAt)}
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
                          {['Material Name', 'Category', 'Unit', 'Qty', 'Unit Cost (LKR)', 'Total Cost (LKR)'].map(h => (
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Step 5: Duplicate Detection Alert */}
                {duplicateWarning && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#dbeafe', border: '1px solid #ffe0b2', padding: '12px 16px', borderRadius: '6px', marginBottom: '20px' }}>
                    <span style={{ fontSize: '13px', color: '#1e3a8a', fontWeight: '600' }}>
                      ⚠️ Material "{duplicateWarning.materialName}" already exists in this BOM. Increase quantity instead?
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={handleMergeDuplicate}
                        style={{ background: '#1e3a8a', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                      >
                        Merge (Add Quantities)
                      </button>
                      <button
                        type="button"
                        onClick={handleKeepSeparate}
                        style={{ background: 'white', color: '#1e3a8a', border: '1px solid #1e3a8a', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                      >
                        Keep Separate
                      </button>
                    </div>
                  </div>
                )}

                {/* Main Allocation Form */}
                <form onSubmit={e => e.preventDefault()}>
                  <h4 style={{ color: '#0d1b4b', margin: '20px 0 10px', fontSize: '14px', fontWeight: '700' }}>Material Allocation Table</h4>
                  {/* paddingBottom reserves room for the material search dropdown (~5 rows) so it isn't
                      clipped by this container's overflow-x:auto, which the CSS spec also turns into
                      an overflow-y clip when overflow-y is left at its default. */}
                  <div style={{ overflowX: 'auto', paddingBottom: focusedRowIdx !== null ? '260px' : '40px', transition: 'padding-bottom 0.15s ease' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                          {['Material Name *', 'Category', 'Unit', 'Planned Qty *', 'Est. Unit Cost (LKR) *', 'Total Cost', 'Action'].map(h => (
                            <th key={h} style={{ padding: '10px', textAlign: 'left', fontSize: '12px', color: '#475569', fontWeight: '600' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {bomMaterials.map((m, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            {/* Material Combobox: click to browse (narrowed to the row's chosen Category, if any), or type to filter */}
                            <td style={{ padding: '8px 4px', width: '240px', position: 'relative' }}>
                              <div style={{ position: 'relative' }}>
                                <input
                                  type="text"
                                  placeholder="Click to browse or type to search..."
                                  value={m.name}
                                  onChange={e => handleMaterialChange(idx, 'name', e.target.value)}
                                  onFocus={() => {
                                    setFocusedRowIdx(idx);
                                    setHighlightedSuggestionIdx(-1);
                                    setSuggestions(getMatchingMaterials(m.name, m.category));
                                  }}
                                  onBlur={() => setFocusedRowIdx(null)}
                                  onKeyDown={e => {
                                    if (focusedRowIdx !== idx || suggestions.length === 0) return;
                                    if (e.key === 'ArrowDown') {
                                      e.preventDefault();
                                      setHighlightedSuggestionIdx(prev => Math.min(prev + 1, suggestions.length - 1));
                                    } else if (e.key === 'ArrowUp') {
                                      e.preventDefault();
                                      setHighlightedSuggestionIdx(prev => Math.max(prev - 1, 0));
                                    } else if (e.key === 'Enter') {
                                      if (highlightedSuggestionIdx >= 0) {
                                        e.preventDefault();
                                        handleSuggestionClick(idx, suggestions[highlightedSuggestionIdx]);
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
                              {focusedRowIdx === idx && (
                                <div style={{ position: 'absolute', top: '100%', left: 4, right: 4, background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', boxShadow: '0 8px 20px rgba(0,0,0,0.12)', zIndex: 1000, maxHeight: '280px', overflowY: 'auto' }}>
                                  {suggestions.length === 0 ? (
                                    <div style={{ padding: '14px 12px', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
                                      No active master material{m.category ? ` in "${m.category}"` : ''} matches{m.name.trim() ? ` "${m.name}"` : ''}. Ask Admin to add it.
                                    </div>
                                  ) : (
                                    Object.entries(
                                      suggestions.reduce((acc, item, i) => {
                                        const cat = item.category || 'Other';
                                        (acc[cat] = acc[cat] || []).push({ ...item, __flatIdx: i });
                                        return acc;
                                      }, {})
                                    ).map(([cat, items]) => (
                                      <div key={cat}>
                                        <div style={{ position: 'sticky', top: 0, background: '#eef2ff', color: '#3730a3', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px', padding: '5px 12px' }}>
                                          {cat}
                                        </div>
                                        {items.map(item => (
                                          <div
                                            key={item._id}
                                            onClick={() => handleSuggestionClick(idx, item)}
                                            onMouseDown={e => e.preventDefault()}
                                            onMouseEnter={() => setHighlightedSuggestionIdx(item.__flatIdx)}
                                            style={{
                                              padding: '8px 12px',
                                              cursor: 'pointer',
                                              fontSize: '12px',
                                              borderBottom: '1px solid #f1f5f9',
                                              background: item.__flatIdx === highlightedSuggestionIdx ? '#eff6ff' : 'white',
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              gap: '8px'
                                            }}
                                          >
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                              <strong style={{ color: '#0d1b4b' }}>{item.materialName}</strong>{' '}
                                              <span style={{ color: '#94a3b8', fontSize: '11px' }}>({item.materialCode})</span>
                                            </span>
                                            <span style={{ color: '#64748b', fontSize: '11px', whiteSpace: 'nowrap' }}>
                                              {item.unit} · LKR {Number(item.estimatedUnitCost || 0).toLocaleString()}
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
                            <td style={{ padding: '8px 4px', width: '120px' }}>
                              <select
                                value={m.category}
                                onChange={e => handleCategoryChange(idx, e.target.value)}
                                style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', background: 'white', color: '#334155' }}
                              >
                                <option value="">-- Any --</option>
                                {materialCategories.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
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
                            {/* Est. Unit Cost - Read only, sourced from Master Material */}
                            <td style={{ padding: '8px 4px', width: '130px' }}>
                              <input
                                type="text"
                                value={m.estimatedUnitCost ? Number(m.estimatedUnitCost).toLocaleString() : ''}
                                placeholder="Autofilled"
                                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '13px', background: '#f8fafc', color: '#475569' }}
                                readOnly
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
                      <h4 style={{ color: '#0d1b4b', margin: '0 0 12px', fontSize: '14px', fontWeight: '700', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px' }}>🧾 COST BREAKDOWN (BILL)</h4>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ background: '#e2e8f0', color: '#334155' }}>
                            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '600' }}>Material</th>
                            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '600' }}>Qty</th>
                            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '600' }}>Unit Cost</th>
                            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '600' }}>Amount (LKR)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bomMaterials.filter(m => m.name).map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #cbd5e1' }}>
                              <td style={{ padding: '6px 8px', color: '#334155', fontWeight: '500' }}>{item.name}</td>
                              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#475569' }}>{item.plannedQty} {item.unit}</td>
                              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#475569' }}>{Number(item.estimatedUnitCost || 0).toLocaleString()}</td>
                              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700', color: '#0d1b4b' }}>{Number(item.totalCost || 0).toLocaleString()}</td>
                            </tr>
                          ))}
                          {bomMaterials.filter(m => m.name).length === 0 && (
                            <tr>
                              <td colSpan="4" style={{ padding: '10px', textAlign: 'center', color: '#94a3b8' }}>
                                No items defined.
                              </td>
                            </tr>
                          )}
                        </tbody>
                        {bomMaterials.filter(m => m.name).length > 0 && (
                          <tfoot>
                            <tr style={{ borderTop: '2px solid #0d1b4b' }}>
                              <td colSpan="3" style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: '#0d1b4b' }}>Grand Total</td>
                              <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: '#2e7d32' }}>
                                LKR {bomMaterials.reduce((sum, item) => sum + (Number(item.totalCost) || 0), 0).toLocaleString()}
                              </td>
                            </tr>
                          </tfoot>
                        )}
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
                        onClick={() => handleSubmitBOM()}
                        disabled={bomMaterials.length === 0 || !bomMaterials[0].name}
                        style={{
                          background: (bomMaterials.length === 0 || !bomMaterials[0].name) ? '#cbd5e1' : '#2563eb',
                          color: 'white',
                          border: 'none',
                          padding: '12px 24px',
                          borderRadius: '6px',
                          cursor: (bomMaterials.length === 0 || !bomMaterials[0].name) ? 'not-allowed' : 'pointer',
                          fontWeight: '700',
                          fontSize: '14px',
                          boxShadow: (bomMaterials.length === 0 || !bomMaterials[0].name) ? 'none' : '0 4px 10px rgba(37, 99, 235,0.15)'
                        }}
                      >
                        🚀 Submit to Director
                      </button>
                    </div>
                  </div>
                </form>
              </>
              )}
              </div>

              {/* View BOM Status List */}
              <div style={{ background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 20px', color: '#0d1b4b', borderBottom: '2px solid #0d1b4b', paddingBottom: '10px', fontWeight: '700' }}>📋 Bill of Materials (BOM) Status Registry</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                        {['BOM Number', 'Project Name', 'PM Name', 'Version', 'Date Submitted', 'Status', 'Feedback / Director Note'].map(h => (
                          <th key={h} style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: '#475569', fontWeight: '600' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {boms.map((b, idx) => {
                        console.log('BOM row data:', b);
                        return (
                          <tr key={b._id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '12px', fontSize: '13px', color: '#334155' }}>{b.bomNumber || '-'}</td>
                            <td style={{ padding: '12px', fontSize: '13px', fontWeight: '600', color: '#0d1b4b' }}>{b.projectId?.projectName || b.projectId?.name || b.projectName || '-'}</td>
                            <td style={{ padding: '12px', fontSize: '13px', color: '#333' }}>{b.createdBy?.name || b.createdBy || b.submittedBy || '-'}</td>
                            <td style={{ padding: '12px', fontSize: '13px' }}>{b.version || 'v1.0'}</td>
                          <td style={{ padding: '12px', fontSize: '12px', color: '#64748b' }}>{formatDate(b.submittedAt || b.createdAt)}</td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              background: b.status === 'Approved' ? '#e8f5e9' : b.status === 'Rejected' ? '#ffebee' : '#dbeafe',
                              color: b.status === 'Approved' ? '#2e7d32' : b.status === 'Rejected' ? '#c62828' : '#1e3a8a',
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
                          <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
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
          {activePage === 'site-inventory' && renderSiteStoreInventory()}
          {activePage === 'settings' && <SettingsPage user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />}

          {/* Footer */}
          <div style={{ textAlign: 'center', padding: '20px 0 8px', marginTop: '16px', fontSize: '12px', color: '#94a3b8' }}>
            ELS Construction Material Management System &copy;2026
          </div>
        </div>
      </div>

      {/* View BOM Details Modal (Approved / Rejected BOMs) */}
      {showViewBomModal && viewingBom && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '8px', width: '750px', maxWidth: '92%', maxHeight: '86vh', overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '2px solid #0d1b4b' }}>
              <h3 style={{ margin: 0, color: '#0d1b4b', fontWeight: '700' }}>📄 BOM Details — {viewingBom.bomNumber || viewingBom.version}</h3>
              <button
                type="button"
                onClick={() => setShowViewBomModal(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', lineHeight: 1, cursor: 'pointer', color: '#64748b' }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', marginBottom: '4px' }}>PROJECT</div>
                  <div style={{ fontSize: '13px', color: '#0d1b4b', fontWeight: '600' }}>{viewingBom.projectId?.projectName || viewingBom.projectId?.name || viewingBom.projectName || '-'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', marginBottom: '4px' }}>VERSION</div>
                  <div style={{ fontSize: '13px', color: '#0d1b4b', fontWeight: '600' }}>{viewingBom.version || 'v1.0'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', marginBottom: '4px' }}>STATUS</div>
                  <span style={{
                    display: 'inline-block',
                    background: viewingBom.status === 'Approved' ? '#e8f5e9' : '#ffebee',
                    color: viewingBom.status === 'Approved' ? '#2e7d32' : '#c62828',
                    padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '700'
                  }}>{viewingBom.status}</span>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', marginBottom: '4px' }}>SUBMITTED BY</div>
                  <div style={{ fontSize: '13px', color: '#0d1b4b', fontWeight: '600' }}>{viewingBom.createdBy?.name || viewingBom.createdBy || '-'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', marginBottom: '4px' }}>{viewingBom.status === 'Approved' ? 'APPROVED BY' : 'REJECTED BY'} (DIRECTOR)</div>
                  <div style={{ fontSize: '13px', color: '#0d1b4b', fontWeight: '600' }}>{viewingBom.approvedBy || '-'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', marginBottom: '4px' }}>DATE</div>
                  <div style={{ fontSize: '13px', color: '#0d1b4b', fontWeight: '600' }}>{formatDate(viewingBom.updatedAt || viewingBom.createdAt)}</div>
                </div>
              </div>

              {viewBomVersions.length > 1 && (
                <div style={{ marginBottom: '20px', padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', marginBottom: '8px' }}>BOM VERSION HISTORY FOR THIS PROJECT</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {viewBomVersions.map(v => (
                      <button
                        key={v._id}
                        type="button"
                        onClick={() => setViewingBom(v)}
                        style={{
                          background: viewingBom._id === v._id ? '#0d1b4b' : 'white',
                          color: viewingBom._id === v._id ? 'white' : '#334155',
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

              {viewingBom.rejectionReason && (
                <div style={{
                  background: viewingBom.status === 'Rejected' ? '#ffebee' : '#f0fdf4',
                  border: `1px solid ${viewingBom.status === 'Rejected' ? '#ffcdd2' : '#bbf7d0'}`,
                  borderRadius: '6px', padding: '12px 16px', marginBottom: '20px'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: viewingBom.status === 'Rejected' ? '#c62828' : '#166534', marginBottom: '4px' }}>
                    DIRECTOR {viewingBom.status === 'Rejected' ? 'REJECTION REASON' : 'NOTE'}
                  </div>
                  <div style={{ fontSize: '13px', color: '#334155' }}>{viewingBom.rejectionReason}</div>
                </div>
              )}

              <h4 style={{ color: '#0d1b4b', margin: '0 0 10px', fontSize: '13px', fontWeight: '700' }}>Materials</h4>
              <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                      {['Material Name', 'Category', 'Unit', 'Qty', 'Unit Cost (LKR)', 'Total Cost (LKR)'].map(h => (
                        <th key={h} style={{ padding: '8px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(viewingBom.materials || []).map((m, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px', color: '#1e293b' }}>{m.name}</td>
                        <td style={{ padding: '8px', color: '#1e293b' }}>{m.category}</td>
                        <td style={{ padding: '8px', color: '#1e293b' }}>{m.unit}</td>
                        <td style={{ padding: '8px', color: '#1e293b' }}>{m.plannedQty}</td>
                        <td style={{ padding: '8px', color: '#1e293b' }}>LKR {(m.estimatedUnitCost || 0).toLocaleString()}</td>
                        <td style={{ padding: '8px', fontWeight: '600', color: '#0d1b4b' }}>LKR {(m.totalCost || (m.plannedQty * (m.estimatedUnitCost || 0))).toLocaleString()}</td>
                      </tr>
                    ))}
                    {(!viewingBom.materials || viewingBom.materials.length === 0) && (
                      <tr>
                        <td colSpan="6" style={{ padding: '10px', textAlign: 'center', color: '#94a3b8' }}>No materials listed.</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="5" style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: '#0d1b4b' }}>Total BOM Cost</td>
                      <td style={{ padding: '8px', fontWeight: '700', color: '#0d1b4b' }}>
                        LKR {(viewingBom.materials || []).reduce((sum, m) => sum + (m.totalCost || (m.plannedQty * (m.estimatedUnitCost || 0))), 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleEditBom(viewingBom)}
                  style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '13px' }}
                >
                  ✏️ Edit BOM
                </button>
                <button
                  type="button"
                  onClick={() => setShowViewBomModal(false)}
                  style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '13px' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Project Details Modal */}
      {showViewProjectModal && viewingProject && (() => {
        const formatProjectDate = (dateVal) => {
          if (!dateVal) return 'N/A';
          const dateObj = new Date(dateVal);
          if (isNaN(dateObj.getTime())) return 'N/A';
          return formatDateLong(dateObj).replace(/^\w+, /, '');
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
              background: isAct ? '#e8f5e9' : isComp ? '#e3f2fd' : isHold ? '#ffebee' : '#dbeafe',
              color: isAct ? '#2e7d32' : isComp ? '#1565c0' : isHold ? '#c62828' : '#1e3a8a',
              padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', textTransform: 'capitalize', display: 'inline-block'
            }}>
              {s}
            </span>
          );
        };
        const renderDocList = (docs, emptyLabel) => (
          docs && docs.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {docs.map((doc, i) => {
                const url = `http://localhost:5000${doc.filePath}`;
                const isPdf = doc.filePath.toLowerCase().endsWith('.pdf');
                const isImage = /\.(jpe?g|png)$/i.test(doc.filePath);
                const icon = isPdf ? '📄' : isImage ? '🖼️' : '📎';
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '13px', color: '#333', wordBreak: 'break-all' }}>
                      {icon} {doc.fileName || doc.filePath.split('/').pop()}
                    </span>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => window.open(url, '_blank')}
                        style={{ background: '#0d1b4b', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                      >
                        👁 View
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDocumentPrint(url)}
                        style={{ background: '#2563eb', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                      >
                        🖨️ Print
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDocumentDownload(url, doc.fileName)}
                        style={{ background: '#0f766e', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                      >
                        ⬇️ Download
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: '13px', color: '#666', fontStyle: 'italic' }}>{emptyLabel}</p>
          )
        );
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', padding: '30px', borderRadius: '8px', width: '600px', maxHeight: '80%', overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0d1b4b', paddingBottom: '10px', marginBottom: '20px' }}>
                <h3 style={{ color: '#0d1b4b', margin: 0 }}>Project Details: {viewingProject.projectName || viewingProject.name}</h3>
                <span onClick={() => { setShowViewProjectModal(false); setViewingProject(null); }} style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '20px', color: '#666' }}>&times;</span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px', background: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '13px', color: '#1e293b' }}>
                <div><strong>Project ID:</strong> {viewingProject.projectId || 'N/A'}</div>
                <div><strong>Client Name:</strong> {viewingProject.clientName || 'N/A'}</div>
                <div><strong>Location:</strong> {viewingProject.location || 'N/A'}</div>
                <div><strong>Project Status:</strong> {getStatusBadge(viewingProject.status)}</div>
                <div><strong>Budget:</strong> {formatBudget(viewingProject.budget)}</div>
                <div><strong>Start Date:</strong> {formatProjectDate(viewingProject.startDate)}</div>
                <div><strong>Expected End Date:</strong> {formatProjectDate(viewingProject.expectedEndDate || viewingProject.endDate)}</div>
                <div><strong>Created By:</strong> {viewingProject.createdBy?.name || 'Project Manager'}</div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ color: '#0d1b4b', margin: '0 0 8px', fontSize: '14px', fontWeight: '700' }}>Description</h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#333', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                  {viewingProject.description || 'No description provided.'}
                </p>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ color: '#0d1b4b', margin: '0 0 8px', fontSize: '14px', fontWeight: '700' }}>Construction Drawings</h4>
                {renderDocList(viewingProject.drawings, 'No construction drawings uploaded')}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ color: '#0d1b4b', margin: '0 0 8px', fontSize: '14px', fontWeight: '700' }}>Specifications / Other Documents</h4>
                {renderDocList(viewingProject.specifications, 'No specifications or other documents uploaded')}
              </div>
            </div>
          </div>
        );
      })()}
      {renderPMStatsModal()}
    </div>
  );
};

export default PMDashboard;