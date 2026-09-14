import React, { useState, useEffect } from 'react';
import { 
  Monitor, 
  Users, 
  ShieldAlert, 
  Clock, 
  Settings, 
  Bell, 
  Mail, 
  Pencil, 
  UserMinus,
  UserPlus,
  Key,
  Search,
  ChevronRight, 
  X, 
  CheckCircle2, 
  AlertTriangle,
  Plus,
  Truck,
  Package
} from 'lucide-react';
import SettingsPage from './SettingsPage';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { formatPhoneInput, isValidPhone, PHONE_PLACEHOLDER } from '../utils/phoneUtils';
import { formatDate, formatDateTime, formatDateLong, formatDateWeekdayShort } from '../utils/dateUtils';
import DateInput from '../components/DateInput';

// Taxonomy of gate-able actions in the app, grouped by module. This mirrors the
// backend's Permission collection (role + action -> Full/View/Partial/Approve/None).
// Live values are always fetched from the API (see dbPermissions/getPermissionLevel) —
// this constant only defines the structure and labels shown in the matrix.
// Actions marked "not yet enforced" have no server-side route gate; the entry exists
// so Admins can see/configure intent, but toggling it has no functional effect today.
const MODULES_MATRIX = [
  {
    category: "User Management",
    actions: [
      { name: "Create/Edit Users" },
      { name: "View User List" },
      { name: "Audit Logs" }
    ]
  },
  {
    category: "Project Management",
    actions: [
      { name: "Create Project" },
      { name: "View Projects" },
      { name: "BOM Creation" },
      { name: "BOM Approval" }
    ]
  },
  {
    category: "Procurement",
    actions: [
      { name: "Create PR" },
      { name: "Approve PR" },
      { name: "Create PO" },
      { name: "Approve PO" },
      { name: "Manage PO Lifecycle" },
      { name: "Supplier Management" }
    ]
  },
  {
    category: "Inventory & Stores",
    actions: [
      { name: "Create GRN" },
      { name: "View Stock", notEnforced: true },
      { name: "Issue Materials" },
      { name: "Stock Adjustments", notEnforced: true },
      { name: "Manage Materials" },
      { name: "Manage Item Master" },
      { name: "Log Material Usage" },
      { name: "Confirm Material Receipt" }
    ]
  },
  {
    category: "Reports & Analytics",
    actions: [
      { name: "View Reports" },
      { name: "Export PDF/Excel", notEnforced: true }
    ]
  },
  {
    category: "System Administration",
    actions: [
      { name: "Manage Roles & Permissions", notEnforced: true }
    ]
  }
];

const ALL_MODULE_ACTIONS = MODULES_MATRIX.flatMap(cat => cat.actions.map(a => a.name));

const AdminDashboard = ({ user, onLogout, onUserUpdate }) => {
  const [activePage, setActivePage] = useState('dashboard');
  const [userViewMode, setUserViewMode] = useState('list'); // 'list', 'details'
  const [selectedUser, setSelectedUser] = useState(null); // User for Details page
  
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logStatusFilter, setLogStatusFilter] = useState('All');
  const [logModuleFilter, setLogModuleFilter] = useState('All');

  // Clickable stats modal state
  const [activeStatsModal, setActiveStatsModal] = useState(null); // 'total' | 'active' | 'deactivated' | 'logs'
  const [statsSearchTerm, setStatsSearchTerm] = useState('');
  const [statsLogStartDate, setStatsLogStartDate] = useState('');
  const [statsLogEndDate, setStatsLogEndDate] = useState('');
  const [statsLogActionFilter, setStatsLogActionFilter] = useState('All');

  // Roles & Permissions matrix states
  const [rolesViewMode, setRolesViewMode] = useState('module'); // 'module' | 'role'
  const [matrixModuleFilter, setMatrixModuleFilter] = useState('All');
  const [matrixSelectedRole, setMatrixSelectedRole] = useState('All');
  const [rolesSubTab, setRolesSubTab] = useState('roles'); // 'roles' | 'permissions'

  // Role CRUD States
  const [dbRoles, setDbRoles] = useState([]);
  const [dbPermissions, setDbPermissions] = useState([]);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleFormName, setRoleFormName] = useState('');
  const [roleFormDesc, setRoleFormDesc] = useState('');
  const [roleFormStatus, setRoleFormStatus] = useState('Active');
  const [roleFormPermissions, setRoleFormPermissions] = useState({});
  const [showRoleViewModal, setShowRoleViewModal] = useState(false);
  const [viewingRole, setViewingRole] = useState(null);
  const [showPermissionCellModal, setShowPermissionCellModal] = useState(false);
  const [selectedPermissionCell, setSelectedPermissionCell] = useState(null);
  const [permissionFormLevel, setPermissionFormLevel] = useState('None');
  const [selectedModulesList, setSelectedModulesList] = useState([]);
  const [roleSearchTerm, setRoleSearchTerm] = useState('');

  // Supplier Registry state
  const emptySupplierForm = {
    supplierId: '', name: '', contactPerson: '', phone: '', email: '', address: '',
    status: 'Active',
    bankName: '', accountNumber: '', bankBranch: '',
    documents: { idPhoto: null }
  };
  const [suppliers, setSuppliers] = useState([]);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [editingSupplierId, setEditingSupplierId] = useState(null);
  const [supForm, setSupForm] = useState(emptySupplierForm);
  const [docUploading, setDocUploading] = useState({});

  // Master Material state
  const MATERIAL_CATEGORY_OPTIONS = [
    'Cement & Concrete', 'Aggregates', 'Road Construction', 'Bridge Construction',
    'Reinforcement Steel', 'Structural Steel', 'Railway Materials', 'Drainage & Culvert',
    'Geotechnical', 'Formwork & Scaffolding', 'Fasteners & Hardware', 'Waterproofing & Joints',
    'Safety Materials', 'Survey & Site', 'Miscellaneous', 'plumbbing','Other'//change1
  ];
  const MATERIAL_UNIT_OPTIONS = ['Bag', 'Piece', 'Kg', 'Ton', 'Meter', 'm³', 'm²', 'Cum', 'Litre', 'Roll', 'Sheet', 'Set', 'Coil'];
  const emptyMaterialForm = {
    materialCode: '', materialName: '', category: 'Cement & Concrete', unit: 'Bag',
    estimatedUnitCost: '', minimumStock: '', maximumStock: '', reorderLevel: '', description: '', status: 'Active'
  };
  const [materialMasterList, setMaterialMasterList] = useState([]);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [materialSearch, setMaterialSearch] = useState('');
  const [editingMaterialId, setEditingMaterialId] = useState(null);
  const [materialForm, setMaterialForm] = useState(emptyMaterialForm);

  const fetchMaterialMaster = async () => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/item-master', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setMaterialMasterList(data.data);
      }
    } catch (err) {
      console.error('Error fetching material master:', err);
    }
  };

  const openMaterialForm = async () => {
    if (showMaterialForm && !editingMaterialId) {
      setShowMaterialForm(false);
      return;
    }
    setEditingMaterialId(null);
    setMaterialForm(emptyMaterialForm);
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/item-master/next-code', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const nextCode = data.materialCode || `MAT${String(materialMasterList.length + 1).padStart(4, '0')}`;
      setMaterialForm(prev => ({ ...prev, materialCode: nextCode }));
    } catch (err) {
      setMaterialForm(prev => ({ ...prev, materialCode: `MAT${String(materialMasterList.length + 1).padStart(4, '0')}` }));
    }
    setShowMaterialForm(true);
  };

  const handleMaterialFormSubmit = async (e) => {
    e.preventDefault();
    if (!materialForm.materialCode.trim() || !materialForm.materialName.trim() || !materialForm.category || !materialForm.unit) {
      showErrorMessage('Please fill in Material Code, Name, Category, and Unit.');
      return;
    }
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const url = editingMaterialId
        ? `http://localhost:5000/api/item-master/${editingMaterialId}`
        : 'http://localhost:5000/api/item-master';
      const res = await fetch(url, {
        method: editingMaterialId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...materialForm,
          estimatedUnitCost: Number(materialForm.estimatedUnitCost) || 0,
          minimumStock: Number(materialForm.minimumStock) || 0,
          maximumStock: Number(materialForm.maximumStock) || 0,
          reorderLevel: Number(materialForm.reorderLevel) || 0
        })
      });
      const data = await res.json();
      if (data.success) {
        showSuccessMessage(`✅ Material ${editingMaterialId ? 'updated' : 'created'} successfully!`);
        setShowMaterialForm(false);
        setEditingMaterialId(null);
        setMaterialForm(emptyMaterialForm);
        fetchMaterialMaster();
      } else {
        showErrorMessage(`❌ ${data.message || 'Failed to save material.'}`);
      }
    } catch (err) {
      showErrorMessage('❌ Error connecting to server.');
    }
  };

  const handleMaterialEditClick = (item) => {
    setEditingMaterialId(item._id);
    setMaterialForm({
      materialCode: item.materialCode || '',
      materialName: item.materialName || '',
      category: item.category || 'Cement & Concrete',
      unit: item.unit || 'Bag',
      estimatedUnitCost: item.estimatedUnitCost ?? '',
      minimumStock: item.minimumStock ?? '',
      maximumStock: item.maximumStock ?? '',
      reorderLevel: item.reorderLevel ?? '',
      description: item.description || '',
      status: item.status || 'Active'
    });
    setShowMaterialForm(true);
  };

  const handleToggleMaterialStatus = async (item) => {
    const newStatus = item.status === 'Active' ? 'Inactive' : 'Active';
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch(`http://localhost:5000/api/item-master/${item._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        showSuccessMessage(`✅ Material ${newStatus === 'Active' ? 'activated' : 'deactivated'} successfully!`);
        fetchMaterialMaster();
      } else {
        showErrorMessage(`❌ ${data.message || 'Failed to update status.'}`);
      }
    } catch (err) {
      showErrorMessage('❌ Error connecting to server.');
    }
  };

  const fetchSuppliers = async () => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/suppliers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      let rawSuppliers = data.success ? data.data : (Array.isArray(data) ? data : []);
      if (!rawSuppliers || rawSuppliers.length === 0) {
        rawSuppliers = [
          { _id: '1', supplierId: 'SUP-0001', contactPerson: 'Lanka Cement Ltd', phone: '0711122334', email: 'nimal@lankacement.lk', categories: ['Cement'], status: 'Active', rating: 4.5 },
          { _id: '2', supplierId: 'SUP-0002', contactPerson: 'Melwa Steel', phone: '0722233445', email: 'kamal@melwa.lk', categories: ['Steel'], status: 'Active', rating: 4 },
          { _id: '3', supplierId: 'SUP-0003', contactPerson: 'Mahaweli Sand Co.', phone: '0777345678', email: 'sunil@mahawelisand.lk', categories: ['Sand', 'Aggregate'], status: 'Active', rating: 3.5 }
        ];
      }
      setSuppliers(rawSuppliers);
    } catch (err) {
      setSuppliers([
        { _id: '1', supplierId: 'SUP-0001', contactPerson: 'Lanka Cement Ltd', phone: '0711122334', email: 'nimal@lankacement.lk', categories: ['Cement'], status: 'Active', rating: 4.5 },
        { _id: '2', supplierId: 'SUP-0002', contactPerson: 'Melwa Steel', phone: '0722233445', email: 'kamal@melwa.lk', categories: ['Steel'], status: 'Active', rating: 4 },
        { _id: '3', supplierId: 'SUP-0003', contactPerson: 'Mahaweli Sand Co.', phone: '0777345678', email: 'sunil@mahawelisand.lk', categories: ['Sand', 'Aggregate'], status: 'Active', rating: 3.5 }
      ]);
    }
  };

  const openSupplierForm = async () => {
    if (showSupplierForm && !editingSupplierId) {
      setShowSupplierForm(false);
      return;
    }
    setEditingSupplierId(null);
    setSupForm(emptySupplierForm);
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/suppliers/next-id', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setSupForm(prev => ({ ...prev, supplierId: data.supplierId || '' }));
    } catch (err) {
      setSupForm(prev => ({ ...prev, supplierId: `SUP-${String(suppliers.length + 1).padStart(4, '0')}` }));
    }
    setShowSupplierForm(true);
  };

  const handleSupplierDocUpload = async (docType, file) => {
    if (!file) return;
    const isValid = /\.(pdf|jpe?g)$/i.test(file.name);
    if (!isValid) {
      alert('Only PDF or JPG files are allowed.');
      return;
    }
    setDocUploading(prev => ({ ...prev, [docType]: true }));
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const formData = new FormData();
      formData.append('document', file);
      const res = await fetch('http://localhost:5000/api/suppliers/upload-document', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        const doc = { url: data.url, filename: data.filename };
        setSupForm(prev => ({ ...prev, documents: { ...prev.documents, [docType]: doc } }));
      } else {
        alert(data.message || 'Failed to upload document.');
      }
    } catch (err) {
      alert('Error uploading document.');
    } finally {
      setDocUploading(prev => ({ ...prev, [docType]: false }));
    }
  };

  const handleSupplierSubmit = async (e) => {
    e.preventDefault();
    if (!supForm.supplierId || !supForm.name || !supForm.phone) {
      alert('Please fill in Supplier ID, Company/Supplier Name and Phone.');
      return;
    }
    if (!isValidPhone(supForm.phone)) {
      alert(`Phone number must be a 10-digit number, e.g. ${PHONE_PLACEHOLDER}.`);
      return;
    }
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const url = editingSupplierId ? `http://localhost:5000/api/suppliers/${editingSupplierId}` : 'http://localhost:5000/api/suppliers';
      const res = await fetch(url, {
        method: editingSupplierId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(supForm)
      });
      const data = await res.json();
      if (res.ok && (data.success || data.supplier)) {
        showSuccessMessage(editingSupplierId ? '✅ Supplier updated successfully!' : '✅ Supplier registered successfully!');
        setShowSupplierForm(false);
        setEditingSupplierId(null);
        setSupForm(emptySupplierForm);
        fetchSuppliers();
      } else {
        showErrorMessage(`❌ ${data.message || 'Failed to save supplier.'}`);
      }
    } catch {
      showErrorMessage('❌ Error connecting to server.');
    }
  };

  const handleSupplierEditClick = (supplier) => {
    setEditingSupplierId(supplier._id);
    setSupForm({
      supplierId: supplier.supplierId || '',
      name: supplier.name || '',
      contactPerson: supplier.contactPerson || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      status: supplier.status || 'Active',
      bankName: supplier.bankName || '',
      accountNumber: supplier.accountNumber || '',
      bankBranch: supplier.bankBranch || '',
      documents: {
        idPhoto: supplier.documents?.idPhoto || null
      }
    });
    setShowSupplierForm(true);
  };

  const handleSupplierDeactivate = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this supplier?')) return;
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch(`http://localhost:5000/api/suppliers/${id}/deactivate`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showSuccessMessage('✅ Supplier deactivated successfully!');
        fetchSuppliers();
      }
    } catch {
      setSuppliers(prev => prev.map(s => s._id === id ? { ...s, status: 'Inactive' } : s));
    }
  };

  const handleSupplierActivate = async (id) => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch(`http://localhost:5000/api/suppliers/${id}/activate`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showSuccessMessage('✅ Supplier activated successfully!');
        fetchSuppliers();
      }
    } catch {
      setSuppliers(prev => prev.map(s => s._id === id ? { ...s, status: 'Active' } : s));
    }
  };

  const getBadgeStyle = (level) => {
    switch (level) {
      case 'Full':
        return { backgroundColor: '#2e7d32', color: '#ffffff', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', display: 'inline-block' };
      case 'View':
        return { backgroundColor: '#1565c0', color: '#ffffff', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', display: 'inline-block' };
      case 'Approve':
        return { backgroundColor: '#6a1b9a', color: '#ffffff', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', display: 'inline-block' };
      case 'Partial':
        return { backgroundColor: '#f5af17', color: '#ffffff', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', display: 'inline-block' };
      case 'None':
      default:
        return { backgroundColor: '#f1f5f9', color: '#94a3b8', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', display: 'inline-block' };
    }
  };

  const getPermissionDescription = (level, actionName) => {
    switch (level) {
      case 'Full':
        return `Full control: Can view, create, update, and manage all aspects of ${actionName}.`;
      case 'View':
        return `View access: Can read and check details of ${actionName} without permission to edit or create.`;
      case 'Approve':
        return `Approve access: Authorized to review, reject, or approve entries within ${actionName}.`;
      case 'Partial':
        return `Partial access: Limited capability to perform specific actions inside ${actionName}.`;
      case 'None':
      default:
        return `No access: This role is entirely blocked from performing or viewing ${actionName}.`;
    }
  };

  const exportLogsToPDF = (filteredLogs) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("ELS Construction (Pvt) Ltd", 14, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("SYSTEM AUDIT LOGS REPORT", 14, 26);
    
    doc.setDrawColor(13, 27, 75);
    doc.setLineWidth(1);
    doc.line(14, 28, 196, 28);

    const tableColumn = ["User", "Action Executed", "System Module", "Timestamp", "Status"];
    const tableRows = filteredLogs.map(log => [
      log.userName || log.userId?.name || 'System',
      log.action || '',
      log.module || '',
      formatDateTime(log.timestamp || log.time),
      log.status || ''
    ]);

    autoTable(doc, {
      startY: 32,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [13, 27, 75] },
      margin: { left: 14, right: 14 }
    });

    doc.save("system_audit_logs.pdf");
  };

  const renderStatsDrawer = () => {
    if (!activeStatsModal) return null;

    let drawerTitle = '';
    let tableContent = null;
    let searchBar = null;
    const userSearchQuery = statsSearchTerm.toLowerCase();
    
    if (activeStatsModal === 'total' || activeStatsModal === 'active' || activeStatsModal === 'deactivated') {
      let filteredList = [];
      if (activeStatsModal === 'total') {
        drawerTitle = `Total Accounts Directory (${users.length})`;
        filteredList = users;
      } else if (activeStatsModal === 'active') {
        const activeUsersCount = users.filter(u => u.status !== false).length;
        drawerTitle = `Active Accounts Directory (Count: ${activeUsersCount})`;
        filteredList = users.filter(u => u.status !== false);
      } else {
        drawerTitle = `Deactivated Accounts Directory (${users.filter(u => u.status === false).length})`;
        filteredList = users.filter(u => u.status === false);
      }

      filteredList = filteredList.filter(u => 
        (u.name || '').toLowerCase().includes(userSearchQuery) ||
        (u.email || '').toLowerCase().includes(userSearchQuery) ||
        (u.role || '').toLowerCase().includes(userSearchQuery)
      );

      searchBar = (
        <div style={{ position: 'relative', marginBottom: '20px' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input 
            placeholder="Search accounts by name, email, or role..." 
            value={statsSearchTerm} 
            onChange={e => setStatsSearchTerm(e.target.value)}
            style={{ padding: '12px 16px 12px 42px', border: '1px solid #e2e8f0', borderRadius: '12px', width: '100%', fontSize: '14px', background: 'white', color: '#0f172a', outline: 'none' }} 
          />
        </div>
      );

      tableContent = (
        <div style={{ overflowX: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#0d1b4b', color: 'white' }}>
                {['Name', 'Email Address', 'Workspace Role', 'Status', 'Created Date', ...(activeStatsModal === 'deactivated' ? ['Actions'] : [])].map(h => (
                  <th key={h} style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={activeStatsModal === 'deactivated' ? 6 : 5} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No matching users found.</td>
                </tr>
              ) : (
                filteredList.map((u, i) => {
                  const rColor = getRoleColor(u.role);
                  return (
                    <tr key={u._id || i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#0d1b4b' }}>{u.name}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#475569' }}>{u.email}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: rColor.bg, color: rColor.text, padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', display: 'inline-block', minWidth: '110px', textAlign: 'center' }}>
                          {formatRoleLabel(u.role)}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>{getStatusBadge(u.status)}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b' }}>
                        {u.createdAt ? formatDate(u.createdAt) : 'N/A'}
                      </td>
                      {activeStatsModal === 'deactivated' && (
                        <td style={{ padding: '12px 16px' }}>
                          <button 
                            onClick={() => handleToggleStatus(u)} 
                            style={{ background: '#ecfdf5', color: '#10b981', border: '1px solid #10b98130', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: '600', transition: 'all 0.2s' }}
                          >
                            Activate
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      );
    } else if (activeStatsModal === 'logs') {
      drawerTitle = `System Audit Logs Directory (${auditLogs.length})`;

      const filteredList = auditLogs.filter(log => {
        if (statsLogStartDate) {
          const start = new Date(statsLogStartDate);
          start.setHours(0,0,0,0);
          if (new Date(log.timestamp) < start) return false;
        }
        if (statsLogEndDate) {
          const end = new Date(statsLogEndDate);
          end.setHours(23,59,59,999);
          if (new Date(log.timestamp) > end) return false;
        }
        if (statsLogActionFilter !== 'All' && log.action !== statsLogActionFilter) return false;
        
        if (statsSearchTerm) {
          const q = statsSearchTerm.toLowerCase();
          const userName = log.userName || log.userId?.name || 'System';
          return userName.toLowerCase().includes(q) ||
                 (log.action || '').toLowerCase().includes(q) ||
                 (log.module || '').toLowerCase().includes(q);
        }
        return true;
      });

      const uniqueActions = Array.from(new Set(auditLogs.map(l => l.action))).filter(Boolean);

      searchBar = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              placeholder="Search logs by user, action, or module..." 
              value={statsSearchTerm} 
              onChange={e => setStatsSearchTerm(e.target.value)}
              style={{ padding: '12px 16px 12px 42px', border: '1px solid #e2e8f0', borderRadius: '12px', width: '100%', fontSize: '14px', background: 'white', color: '#0f172a', outline: 'none' }} 
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Start Date</label>
              <DateInput
                value={statsLogStartDate}
                onChange={iso => setStatsLogStartDate(iso)}
                style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>End Date</label>
              <DateInput
                value={statsLogEndDate}
                onChange={iso => setStatsLogEndDate(iso)}
                style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Action Type</label>
              <select 
                value={statsLogActionFilter} 
                onChange={e => setStatsLogActionFilter(e.target.value)} 
                style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', background: 'white', width: '100%', cursor: 'pointer' }}
              >
                <option value="All">All Actions</option>
                {uniqueActions.map(action => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
            </div>
            <button 
              onClick={() => exportLogsToPDF(filteredList)} 
              style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              Export PDF
            </button>
          </div>
        </div>
      );

      tableContent = (
        <div style={{ overflowX: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#0d1b4b', color: 'white' }}>
                {['User', 'Action', 'Module', 'Timestamp', 'Status'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No system logs found matching criteria.</td>
                </tr>
              ) : (
                filteredList.map((log, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
                      {log.userName || log.userId?.name || 'System'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#334155' }}>{log.action}</td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b' }}>{log.module}</td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#475569' }}>
                      {formatDateTime(log.timestamp || log.time)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ 
                        background: log.status === 'Success' ? '#dcfce7' : '#fee2e2', 
                        color: log.status === 'Success' ? '#166534' : '#991b1b', 
                        padding: '2px 8px', 
                        borderRadius: '9999px', 
                        fontSize: '10px', 
                        fontWeight: '700' 
                      }}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'flex-end',
          animation: 'fadeIn 0.2s ease-out'
        }} 
        onClick={() => setActiveStatsModal(null)}
      >
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>
        <div 
          style={{
            width: '850px',
            maxWidth: '95%',
            height: '100%',
            backgroundColor: '#ffffff',
            boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideIn 0.3s ease-out',
            color: '#1e293b'
          }} 
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ background: '#0d1b4b', color: 'white', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', borderLeft: '4px solid #2563eb', paddingLeft: '12px' }}>{drawerTitle}</h3>
            <button 
              onClick={() => setActiveStatsModal(null)} 
              style={{ background: 'transparent', border: 'none', color: '#2563eb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', borderRadius: '50%', transition: 'all 0.2s' }}
              className="close-drawer-btn"
            >
              <style>{`
                .close-drawer-btn:hover {
                  background-color: rgba(37, 99, 235, 0.15);
                  transform: scale(1.1);
                }
              `}</style>
              <X size={22} />
            </button>
          </div>

          <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            {searchBar}
            {tableContent}
          </div>
        </div>
      </div>
    );
  };

  // New User Form State
  const emptyUserForm = {
    name: '',
    username: '',
    email: '',
    password: '',
    role: '',
    employeeId: '',
    gender: '',
    phone: '',
    alternatePhone: '',
    avatarUrl: ''
  };
  const [newUser, setNewUser] = useState(emptyUserForm);

  // Edit User Form State
  const [editForm, setEditForm] = useState({
    name: '',
    username: '',
    email: '',
    role: '',
    employeeId: '',
    gender: '',
    phone: '',
    alternatePhone: '',
    avatarUrl: '',
    status: true
  });
  const [isEditing, setIsEditing] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState('');



  const [message, setMessage] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Dashboard: User Activity Chart range toggle (7 or 30 days)
  const [activityRange, setActivityRange] = useState(7);

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  const hasSession = () => {
    try {
      return !!JSON.parse(localStorage.getItem('user'))?.token;
    } catch {
      return false;
    }
  };

  const fetchAllDashboardData = () => {
    if (!hasSession()) return;
    fetchUsers();
    fetchAuditLogs();
    fetchNotifications();
    fetchRoles();
    fetchPermissions();
    fetchSuppliers();
    fetchMaterialMaster();
  };

  useEffect(() => {
    fetchAllDashboardData();
    const interval = setInterval(fetchAllDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchUsers = async () => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/auth/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      let userList = data.success ? data.data : [];
      if (!userList || userList.length < 8) {
        userList = [
          { _id: '1', name: 'John Smith', email: 'john@els.com', role: 'ProjectManager', status: true, phone: '+94 77 987 6543', createdAt: new Date(Date.now() - 30*24*60*60*1000).toISOString(), lastLogin: new Date(Date.now() - 2*60*60*1000).toISOString() },
          { _id: '2', name: 'Sarah Johnson', email: 'sarah@els.com', role: 'Director', status: true, phone: '+94 77 123 4567', createdAt: new Date(Date.now() - 60*24*60*60*1000).toISOString(), lastLogin: new Date(Date.now() - 4*60*60*1000).toISOString() },
          { _id: '3', name: 'Mike Davis', email: 'mike@els.com', role: 'MainStoreOfficer', status: false, phone: '+94 77 444 5555', createdAt: new Date(Date.now() - 10*24*60*60*1000).toISOString(), lastLogin: new Date(Date.now() - 24*60*60*1000).toISOString() },
          { _id: '4', name: 'Emily Brown', email: 'emily@els.com', role: 'PurchaseManager', status: true, phone: '+94 77 888 9999', createdAt: new Date(Date.now() - 15*24*60*60*1000).toISOString(), lastLogin: new Date(Date.now() - 12*60*60*1000).toISOString() },
          { _id: '5', name: 'Ruwan Perera', email: 'ruwan@els.com', role: 'SiteStoreOfficer', status: true, phone: '+94 77 555 6666', createdAt: new Date(Date.now() - 20*24*60*60*1000).toISOString(), lastLogin: new Date(Date.now() - 6*60*60*1000).toISOString() },
          { _id: '6', name: 'Admin Principal', email: 'admin@els.com', role: 'Admin', status: true, phone: '+94 77 777 7777', createdAt: new Date(Date.now() - 100*24*60*60*1000).toISOString(), lastLogin: new Date().toISOString() },
          { _id: '7', name: 'Kanishka Silva', email: 'kanishka@els.com', role: 'ProjectManager', status: true, phone: '+94 77 333 4444', createdAt: new Date(Date.now() - 40*24*60*60*1000).toISOString(), lastLogin: new Date(Date.now() - 1*24*60*60*1000).toISOString() },
          { _id: '8', name: 'Nishan Fernando', email: 'nishan@els.com', role: 'SiteStoreOfficer', status: true, phone: '+94 77 222 1111', createdAt: new Date(Date.now() - 12*24*60*60*1000).toISOString(), lastLogin: new Date(Date.now() - 3*60*60*1000).toISOString() }
        ];
      } else {
        userList = userList.map(u => ({
          ...u,
          phone: u.phone || '+94 77 ' + Math.floor(1000000 + Math.random() * 9000000),
          lastLogin: u.lastLogin || new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000).toISOString()
        }));
      }
      setUsers(userList);
    } catch (err) {
      setUsers([
        { _id: '1', name: 'John Smith', email: 'john@els.com', role: 'ProjectManager', status: true, phone: '+94 77 987 6543', createdAt: new Date(Date.now() - 30*24*60*60*1000).toISOString(), lastLogin: new Date(Date.now() - 2*60*60*1000).toISOString() },
        { _id: '2', name: 'Sarah Johnson', email: 'sarah@els.com', role: 'Director', status: true, phone: '+94 77 123 4567', createdAt: new Date(Date.now() - 60*24*60*60*1000).toISOString(), lastLogin: new Date(Date.now() - 4*60*60*1000).toISOString() },
        { _id: '3', name: 'Mike Davis', email: 'mike@els.com', role: 'MainStoreOfficer', status: false, phone: '+94 77 444 5555', createdAt: new Date(Date.now() - 10*24*60*60*1000).toISOString(), lastLogin: new Date(Date.now() - 24*60*60*1000).toISOString() },
        { _id: '4', name: 'Emily Brown', email: 'emily@els.com', role: 'PurchaseManager', status: true, phone: '+94 77 888 9999', createdAt: new Date(Date.now() - 15*24*60*60*1000).toISOString(), lastLogin: new Date(Date.now() - 12*60*60*1000).toISOString() },
        { _id: '5', name: 'Ruwan Perera', email: 'ruwan@els.com', role: 'SiteStoreOfficer', status: true, phone: '+94 77 555 6666', createdAt: new Date(Date.now() - 20*24*60*60*1000).toISOString(), lastLogin: new Date(Date.now() - 6*60*60*1000).toISOString() },
        { _id: '6', name: 'Admin Principal', email: 'admin@els.com', role: 'Admin', status: true, phone: '+94 77 777 7777', createdAt: new Date(Date.now() - 100*24*60*60*1000).toISOString(), lastLogin: new Date().toISOString() },
        { _id: '7', name: 'Kanishka Silva', email: 'kanishka@els.com', role: 'ProjectManager', status: true, phone: '+94 77 333 4444', createdAt: new Date(Date.now() - 40*24*60*60*1000).toISOString(), lastLogin: new Date(Date.now() - 1*24*60*60*1000).toISOString() },
        { _id: '8', name: 'Nishan Fernando', email: 'nishan@els.com', role: 'SiteStoreOfficer', status: true, phone: '+94 77 222 1111', createdAt: new Date(Date.now() - 12*24*60*60*1000).toISOString(), lastLogin: new Date(Date.now() - 3*60*60*1000).toISOString() }
      ]);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/auth/audit-logs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setAuditLogs(data.success && Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setAuditLogs([]);
    }
  };

  const fetchRoles = async () => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/roles', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setDbRoles(data.data);
      }
    } catch (err) {
      console.error('Error fetching roles:', err);
    }
  };

  const fetchPermissions = async () => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/permissions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setDbPermissions(data.data);
      }
    } catch (err) {
      console.error('Error fetching permissions:', err);
    }
  };

  const getPermissionLevel = (roleName, moduleName) => {
    const perm = dbPermissions.find(p => p.role === roleName && p.module === moduleName);
    return perm ? perm.permissionLevel : 'None';
  };

  const handleCreateRoleClick = () => {
    setEditingRole(null);
    setRoleFormName('');
    setRoleFormDesc('');
    setRoleFormStatus('Active');
    const perms = {};
    ALL_MODULE_ACTIONS.forEach(mod => { perms[mod] = 'None'; });
    setRoleFormPermissions(perms);
    setShowRoleModal(true);
  };

  const handleEditRoleClick = (role) => {
    setEditingRole(role);
    setRoleFormName(role.name);
    setRoleFormDesc(role.description || '');
    setRoleFormStatus(role.status || 'Active');
    const perms = {};
    ALL_MODULE_ACTIONS.forEach(mod => {
      const match = dbPermissions.find(p => p.role === role.name && p.module === mod);
      perms[mod] = match ? match.permissionLevel : 'None';
    });
    setRoleFormPermissions(perms);
    setShowRoleModal(true);
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!roleFormName.trim()) {
      showErrorMessage('Please enter a role name');
      return;
    }
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const url = editingRole 
        ? `http://localhost:5000/api/roles/${editingRole._id}`
        : 'http://localhost:5000/api/roles';
      const method = editingRole ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          name: roleFormName.trim(),
          description: roleFormDesc,
          status: roleFormStatus
        })
      });
      const data = await res.json();
      if (data.success) {
        const roleName = roleFormName.trim();
        for (const [moduleName, level] of Object.entries(roleFormPermissions)) {
          await fetch('http://localhost:5000/api/permissions/edit', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ role: roleName, module: moduleName, permissionLevel: level })
          });
        }
        showSuccessMessage(`✅ Role ${editingRole ? 'updated' : 'created'} successfully!`);
        setShowRoleModal(false);
        fetchRoles();
        fetchPermissions();
      } else {
        showErrorMessage(`❌ ${data.message || 'Failed to save role'}`);
      }
    } catch (err) {
      showErrorMessage('❌ Error connecting to server');
    }
  };

  const handleToggleRoleStatus = async (role) => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const newStatus = role.status === 'Active' ? 'Inactive' : 'Active';
      const res = await fetch(`http://localhost:5000/api/roles/${role._id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        showSuccessMessage(`✅ Role status updated to ${newStatus}!`);
        fetchRoles();
      } else {
        showErrorMessage(`❌ ${data.message || 'Failed to toggle status'}`);
      }
    } catch (err) {
      showErrorMessage('❌ Error connecting to server');
    }
  };

  const handleSavePermission = async () => {
    if (!selectedPermissionCell) return;
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/permissions/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          role: selectedPermissionCell.role,
          module: selectedPermissionCell.module,
          permissionLevel: permissionFormLevel
        })
      });
      const data = await res.json();
      if (data.success) {
        showSuccessMessage(`✅ Permission updated successfully!`);
        setShowPermissionCellModal(false);
        fetchPermissions();
      } else {
        showErrorMessage(`❌ ${data.message || 'Failed to save permission'}`);
      }
    } catch (err) {
      showErrorMessage('❌ Error connecting to server');
    }
  };

  const handleBulkEditPermissions = async (roleName, level) => {
    if (selectedModulesList.length === 0) {
      showErrorMessage('No modules selected');
      return;
    }
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/permissions/bulk-edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          role: roleName,
          modules: selectedModulesList,
          permissionLevel: level
        })
      });
      const data = await res.json();
      if (data.success) {
        showSuccessMessage(`✅ Bulk permissions updated successfully!`);
        setSelectedModulesList([]);
        fetchPermissions();
      } else {
        showErrorMessage(`❌ ${data.message || 'Failed to bulk update permissions'}`);
      }
    } catch (err) {
      showErrorMessage('❌ Error connecting to server');
    }
  };

  const handleDirectPermissionEdit = async (role, module, level) => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/permissions/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          role,
          module,
          permissionLevel: level
        })
      });
      const data = await res.json();
      if (data.success) {
        showSuccessMessage(`✅ Permission for ${role} on ${module} updated to ${level}!`);
        fetchPermissions();
      } else {
        showErrorMessage(`❌ ${data.message || 'Failed to update permission'}`);
      }
    } catch (err) {
      showErrorMessage('❌ Error connecting to server');
    }
  };

  const handleResetFilters = () => {
    setStatsSearchTerm('');
    setMatrixModuleFilter('All');
    setMatrixSelectedRole('All');
  };

  const openAddUserForm = async () => {
    setSelectedUser(null);
    setIsEditing(false);
    setAvatarPreview('');
    setNewUser(emptyUserForm);
    setUserViewMode('details');
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/auth/next-employee-id', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.employeeId) {
        setNewUser(prev => ({ ...prev, employeeId: data.employeeId }));
      }
    } catch (err) {
      // Employee ID stays blank; admin can type one in manually.
    }
  };

  const handlePhotoFile = async (file, isEdit) => {
    if (!file || !file.type.startsWith('image/')) {
      showErrorMessage('❌ Please select a valid image file.');
      return;
    }
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarUploading(true);
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await fetch('http://localhost:5000/api/auth/upload-avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        if (isEdit) {
          setEditForm(prev => ({ ...prev, avatarUrl: data.avatarUrl }));
        } else {
          setNewUser(prev => ({ ...prev, avatarUrl: data.avatarUrl }));
        }
      } else {
        showErrorMessage('❌ Failed to upload photo.');
      }
    } catch (err) {
      showErrorMessage('❌ Error uploading photo.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const passwordChecks = (password) => ({
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password)
  });

  const isPasswordStrong = (password) => Object.values(passwordChecks(password)).every(Boolean);

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUser.role) {
      showErrorMessage('❌ Please select a workspace role.');
      return;
    }
    if (!isPasswordStrong(newUser.password)) {
      showErrorMessage('❌ Password does not meet all requirements.');
      return;
    }
    if (!isValidPhone(newUser.phone)) {
      showErrorMessage(`❌ Primary phone must be a 10-digit number, e.g. ${PHONE_PLACEHOLDER}.`);
      return;
    }
    if (newUser.alternatePhone && !isValidPhone(newUser.alternatePhone)) {
      showErrorMessage(`❌ Alternate phone must be a 10-digit number, e.g. ${PHONE_PLACEHOLDER}.`);
      return;
    }
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newUser)
      });
      const data = await res.json();
      if (data.success) {
        showSuccessMessage(`✅ User "${newUser.name}" added successfully!`);
        setNewUser(emptyUserForm);
        setAvatarPreview('');
        setUserViewMode('list');
        fetchUsers();
        fetchAuditLogs();
      } else {
        showErrorMessage(`❌ ${data.message || 'Failed to add user'}`);
      }
    } catch (err) {
      showErrorMessage('❌ Error connecting to server');
    }
  };

  const handleToggleStatus = async (targetUser) => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const endpoint = `http://localhost:5000/api/auth/users/${targetUser._id}/${targetUser.status !== false ? 'deactivate' : 'activate'}`;
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        showSuccessMessage(`✅ User status updated successfully!`);
        fetchUsers();
        fetchAuditLogs();
        if (selectedUser && selectedUser._id === targetUser._id) {
          setSelectedUser({ ...selectedUser, status: !targetUser.status });
        }
      } else {
        showErrorMessage(`❌ ${data.message || 'Failed to change status'}`);
      }
    } catch (err) {
      showErrorMessage('❌ Error connecting to server');
    }
  };

  const handleEditClick = (u) => {
    setSelectedUser(u);
    setEditForm({
      name: u.name,
      username: u.username || '',
      email: u.email,
      role: u.role,
      employeeId: u.employeeId || '',
      gender: u.gender || '',
      phone: u.phone || '',
      alternatePhone: u.alternatePhone || '',
      avatarUrl: u.avatarUrl || '',
      status: u.status !== false
    });
    setAvatarPreview(u.avatarUrl || '');
    setIsEditing(true);
    setUserViewMode('details');
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!isValidPhone(editForm.phone)) {
      showErrorMessage(`❌ Primary phone must be a 10-digit number, e.g. ${PHONE_PLACEHOLDER}.`);
      return;
    }
    if (editForm.alternatePhone && !isValidPhone(editForm.alternatePhone)) {
      showErrorMessage(`❌ Alternate phone must be a 10-digit number, e.g. ${PHONE_PLACEHOLDER}.`);
      return;
    }
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;

      // If email changed, call the specific update-email endpoint first
      if (editForm.email.trim().toLowerCase() !== selectedUser.email.toLowerCase()) {
        const emailRes = await fetch(`http://localhost:5000/api/users/${selectedUser._id}/email`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ newEmail: editForm.email.trim() })
        });
        const emailData = await emailRes.json();
        if (!emailRes.ok || !emailData.success) {
          showErrorMessage(`❌ Email update failed: ${emailData.message || 'Email already in use'}`);
          return;
        }
      }

      // Then save the remaining fields (name, role, phone, etc.)
      const res = await fetch(`http://localhost:5000/api/auth/users/${selectedUser._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      });
      const data = await res.json();
      if (data.success) {
        showSuccessMessage('✅ User profile updated successfully!');
        setIsEditing(false);
        setUserViewMode('list');
        fetchUsers();
        fetchAuditLogs();
      } else {
        showErrorMessage(`❌ ${data.message || 'Failed to update user'}`);
      }
    } catch (err) {
      showErrorMessage('❌ Error connecting to server');
    }
  };

  const handleResetPasswordClick = (u) => {
    setResetPasswordUser(u);
    setNewPassword('');
    setConfirmPassword('');
    setResetPasswordError('');
  };



  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setResetPasswordError('');
    
    if (newPassword.length < 6) {
      setResetPasswordError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetPasswordError('Passwords do not match.');
      return;
    }
    
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch(`http://localhost:5000/api/auth/users/${resetPasswordUser._id}/reset-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ password: newPassword })
      });
      const data = await res.json();
      if (data.success) {
        showSuccessMessage(`🔑 Password reset successfully for user "${resetPasswordUser.name}"`);
        setResetPasswordUser(null);
      } else {
        setResetPasswordError(data.message || 'Failed to reset password.');
      }
    } catch (err) {
      setResetPasswordError('Server connection error.');
    }
  };

  const showSuccessMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 5000);
  };

  const showErrorMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 5000);
  };

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLogs = auditLogs.filter(log => {
    const nameMatch = log.userName?.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
                      log.action?.toLowerCase().includes(logSearchQuery.toLowerCase());
    const statusMatch = logStatusFilter === 'All' || log.status === logStatusFilter;
    const moduleMatch = logModuleFilter === 'All' || log.module === logModuleFilter;
    return nameMatch && statusMatch && moduleMatch;
  });

  const formatRoleLabel = (role) => (role || '').replace(/([a-z])([A-Z])/g, '$1 $2');

  const getRoleColor = (role) => {
    switch (role) {
      case 'Admin': return { bg: '#e0f2fe', text: '#0369a1' };
      case 'Director': return { bg: '#faf5ff', text: '#7e22ce' };
      case 'ProjectManager': return { bg: '#ecfdf5', text: '#047857' };
      case 'PurchaseManager': return { bg: '#fff7ed', text: '#c2410c' };
      default: return { bg: '#f1f5f9', text: '#475569' };
    }
  };

  const getStatusBadge = (status) => {
    const isActive = status !== false;
    return (
      <span style={{
        padding: '4px 10px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: '600',
        backgroundColor: isActive ? '#dcfce7' : '#fee2e2',
        color: isActive ? '#15803d' : '#b91c1c'
      }}>
        {isActive ? 'Active' : 'Inactive'}
      </span>
    );
  };

  const activePageStyle = (page) => ({
    padding: '12px 20px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '14px',
    fontWeight: activePage === page ? '600' : '500',
    backgroundColor: activePage === page ? 'rgba(37, 99, 235,0.2)' : 'transparent',
    borderLeft: activePage === page ? '3px solid #2563eb' : '3px solid transparent',
    color: activePage === page ? '#2563eb' : '#ccc',
    transition: 'all 0.2s ease',
    marginBottom: '6px'
  });

  // Breadcrumbs
  const renderBreadcrumbs = () => {
    let parts = [];
    if (activePage === 'dashboard') parts = ['Dashboard', 'Overview'];
    if (activePage === 'users') {
      parts = ['User Management', userViewMode === 'details' ? (selectedUser ? 'User Details' : 'Create User') : 'User Account Directory'];
    }
    if (activePage === 'suppliers') {
      parts = ['Supplier Management', 'Supplier Registry Directory'];
    }
    if (activePage === 'material-management') {
      parts = ['Material Management', 'Master Material Catalog'];
    }
    if (activePage === 'roles-permissions') {
      parts = ['Roles & Permissions', rolesSubTab === 'roles' ? 'System Role Profiles' : 'Workspace Access Matrix'];
    }
    if (activePage === 'activity') parts = ['Activity Log', 'System Audit Trails'];
    if (activePage === 'settings') parts = ['Settings', 'User Preferences'];

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
        <span>ELS Panel</span>
        <ChevronRight size={14} />
        {parts.map((p, i) => (
          <React.Fragment key={p}>
            <span style={{ color: i === parts.length - 1 ? '#0d1b4b' : '#64748b', fontWeight: i === parts.length - 1 ? '600' : '400' }}>{p}</span>
            {i < parts.length - 1 && <ChevronRight size={14} />}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const renderRoleModal = () => {
    if (!showRoleModal) return null;
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
        <div style={{ background: 'white', padding: '32px', borderRadius: '16px', width: '650px', maxWidth: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '16px', marginBottom: '20px' }}>
            <h3 style={{ color: '#0d1b4b', margin: 0, fontSize: '18px', fontWeight: '700' }}>
              {editingRole ? `Edit Role: ${editingRole.name}` : 'Create New Role'}
            </h3>
            <button onClick={() => setShowRoleModal(false)} style={{ background: 'transparent', border: 'none', color: '#2563eb', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSaveRole} style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1 }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Role Name</label>
              <input 
                type="text" 
                value={roleFormName} 
                onChange={e => setRoleFormName(e.target.value)} 
                required 
                placeholder="e.g. Estimator"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Description</label>
              <textarea 
                value={roleFormDesc} 
                onChange={e => setRoleFormDesc(e.target.value)} 
                placeholder="Brief description of responsibilities..."
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', minHeight: '80px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Status</label>
              <select 
                value={roleFormStatus} 
                onChange={e => setRoleFormStatus(e.target.value)} 
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', background: 'white' }}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '700', color: '#0d1b4b' }}>Assign Permissions</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px' }}>
                {ALL_MODULE_ACTIONS.map(mod => (
                  <div key={mod} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>{mod}</span>
                    <select 
                      value={roleFormPermissions[mod] || 'None'}
                      onChange={(e) => {
                        const newPerms = { ...roleFormPermissions };
                        newPerms[mod] = e.target.value;
                        setRoleFormPermissions(newPerms);
                      }}
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', outline: 'none', background: 'white' }}
                    >
                      <option value="Full">Full</option>
                      <option value="View">View</option>
                      <option value="Approve">Approve</option>
                      <option value="Partial">Partial</option>
                      <option value="None">None</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: 'auto' }}>
              <button type="button" onClick={() => setShowRoleModal(false)} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>Cancel</button>
              <button type="submit" style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderRoleViewModal = () => {
    if (!showRoleViewModal || !viewingRole) return null;
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
        <div style={{ background: 'white', padding: '32px', borderRadius: '16px', width: '550px', maxWidth: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '16px', marginBottom: '20px' }}>
            <h3 style={{ color: '#0d1b4b', margin: 0, fontSize: '18px', fontWeight: '700' }}>
              🔍 Role Details: {viewingRole.name}
            </h3>
            <button onClick={() => setShowRoleViewModal(false)} style={{ background: 'transparent', border: 'none', color: '#2563eb', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1 }}>
            <div>
              <strong style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase' }}>Description</strong>
              <p style={{ fontSize: '14px', color: '#1e293b', margin: '4px 0 0 0' }}>{viewingRole.description || 'No description provided.'}</p>
            </div>
            <div>
              <strong style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase' }}>Status</strong>
              <div style={{ margin: '4px 0 0 0' }}>
                <span style={{ 
                  padding: '4px 10px', 
                  borderRadius: '9999px', 
                  fontSize: '11px', 
                  fontWeight: '700', 
                  backgroundColor: viewingRole.status === 'Active' ? '#dcfce7' : '#fee2e2', 
                  color: viewingRole.status === 'Active' ? '#166534' : '#991b1b' 
                }}>
                  {viewingRole.status || 'Active'}
                </span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
              <strong style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>Role Permissions</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px' }}>
                {ALL_MODULE_ACTIONS.map(mod => {
                  const level = getPermissionLevel(viewingRole.name, mod);
                  return (
                    <div key={mod} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>{mod}</span>
                      <span style={getBadgeStyle(level)}>
                        {level}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: 'auto' }}>
              <button onClick={() => setShowRoleViewModal(false)} style={{ background: '#0d1b4b', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
                Close Details
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPermissionCellModal = () => {
    if (!showPermissionCellModal || !selectedPermissionCell) return null;
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
        <div style={{ background: 'white', padding: '32px', borderRadius: '16px', width: '400px', boxSizing: 'border-box', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '16px', marginBottom: '20px' }}>
            <h3 style={{ color: '#0d1b4b', margin: 0, fontSize: '17px', fontWeight: '700' }}>✏️ Edit Permission Badge</h3>
            <button onClick={() => setShowPermissionCellModal(false)} style={{ background: 'transparent', border: 'none', color: '#2563eb', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <strong style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Selected Role</strong>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#0d1b4b', marginTop: '4px' }}>{selectedPermissionCell.role}</div>
            </div>
            <div>
              <strong style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Selected Module / Action</strong>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#0d1b4b', marginTop: '4px' }}>{selectedPermissionCell.module}</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Permission Level</label>
              <select 
                value={permissionFormLevel} 
                onChange={e => setPermissionFormLevel(e.target.value)} 
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none', background: 'white', cursor: 'pointer' }}
              >
                <option value="Full">Full</option>
                <option value="View">View</option>
                <option value="Approve">Approve</option>
                <option value="Partial">Partial</option>
                <option value="None">None</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: '8px' }}>
              <button onClick={() => setShowPermissionCellModal(false)} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>Cancel</button>
              <button onClick={handleSavePermission} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>Save Permission</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc', color: '#0f172a', fontFamily: "'Inter', sans-serif" }}>
      
      {/* Sidebar */}
      <div style={{ width: '240px', background: '#0d1b4b', color: 'white', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh', zIndex: 10, boxShadow: '4px 0 10px rgba(0,0,0,0.05)' }}>
        
        {/* Logo area */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img
            src="/els-logo.png"
            alt="ELS Logo"
            style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '50%' }}
          />
          <div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#2563eb' }}>ELS Construction</div>
            <div style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: '500' }}>Admin Panel</div>
          </div>
        </div>

        {/* Current user context */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px', color: 'white' }}>
            {user?.name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: 'white' }}>{user?.name || 'Administrator'}</div>
            <div style={{ fontSize: '11px', color: '#cbd5e1' }}>{user?.role || 'Super Administrator'}</div>
          </div>
        </div>

        {/* Nav Items */}
        <nav style={{ flex: 1, padding: '20px 12px' }}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: <Monitor size={18} /> },
            { id: 'users', label: 'User Management', icon: <Users size={18} /> },
            { id: 'suppliers', label: 'Supplier Registry', icon: <Truck size={18} /> },
            { id: 'material-management', label: 'Material Management', icon: <Package size={18} /> },
            { id: 'roles-permissions', label: 'Roles & Permissions', icon: <ShieldAlert size={18} /> },
            { id: 'activity', label: 'Activity Log', icon: <Clock size={18} /> },
            { id: 'settings', label: 'Settings', icon: <Settings size={18} /> }
          ].map(item => (
            <div key={item.id} onClick={() => {
              setActivePage(item.id);
              if (item.id === 'users') setUserViewMode('list');
            }} style={activePageStyle(item.id)} className="sidebar-item">
              <style>{`
                .sidebar-item:hover {
                  background-color: rgba(255,255,255,0.05);
                }
              `}</style>
              {item.icon}
              <span style={{ fontSize: '14px', fontWeight: activePage === item.id ? '600' : '500' }}>{item.label}</span>
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={onLogout} style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid #ef4444', color: '#fca5a5', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
            🚪 Logout Session
          </button>
        </div>
      </div>

      {/* Main Content wrapper */}
      <div className="dashboard-content" style={{ marginLeft: '240px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        
        {/* Top Navbar */}
        <header style={{ height: '70px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 32px', position: 'sticky', top: 0, zIndex: 5, boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0d1b4b' }}>
            {activePage === 'dashboard' && 'Dashboard Overview'}
            {activePage === 'users' && 'User Management Console'}
            {activePage === 'suppliers' && 'Supplier Partner Registry'}
            {activePage === 'material-management' && 'Master Material Management'}
            {activePage === 'roles-permissions' && 'Roles & Permissions'}
            {activePage === 'activity' && 'Activity Logs & Audit Trails'}
            {activePage === 'settings' && 'Settings & Controls'}
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            
            {/* Header Utility Icons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              
              <div style={{ position: 'relative', cursor: 'pointer', width: '38px', height: '38px', borderRadius: '50%', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Mail size={18} style={{ color: '#475569' }} />
              </div>

              {/* Notifications dropdown bell */}
              <div style={{ position: 'relative', cursor: 'pointer', width: '38px', height: '38px', borderRadius: '50%', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowNotifications(!showNotifications)}>
                <Bell size={18} style={{ color: '#475569' }} />
                 {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: '2px', right: '2px', background: '#ef4444', color: 'white', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px #fff' }}>
                    {unreadCount}
                  </span>
                )}
                
                {showNotifications && (
                  <div style={{ position: 'absolute', top: '48px', right: '0', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', width: '320px', maxHeight: '400px', overflowY: 'auto', zIndex: 100, cursor: 'default', padding: '8px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ padding: '12px', borderBottom: '1px solid #f1f5f9', fontWeight: '700', color: '#0d1b4b', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>System Inventory Alerts</span>
                      <span style={{ fontSize: '11px', background: '#fee2e2', color: '#ef4444', padding: '2px 8px', borderRadius: '9999px', fontWeight: '600' }}>Stock alerts</span>
                    </div>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '24px', color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
                        All stock thresholds normal.
                      </div>
                    ) : (
                      notifications.map((notif, idx) => (
                        <div key={idx} style={{ padding: '12px', borderBottom: idx === notifications.length - 1 ? 'none' : '1px solid #f1f5f9', fontSize: '13px', borderRadius: '8px', transition: 'background 0.2s', ':hover': { background: '#f8fafc' } }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600', marginBottom: '4px' }}>
                            <span style={{ color: '#0f172a' }}>{notif.materialName}</span>
                            <span style={{ color: notif.alertLevel === 'Critical' ? '#ef4444' : '#f59e0b', background: notif.alertLevel === 'Critical' ? '#fef2f2' : '#fef3c7', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>
                              {notif.alertLevel}
                            </span>
                          </div>
                          <div style={{ color: '#475569', fontSize: '12px' }}>
                            Current: <strong>{notif.currentQty}</strong> | Threshold: {notif.minimumStock}
                          </div>
                          <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>📍</span> {notif.location}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

            </div>

            <div style={{ width: '1px', height: '24px', backgroundColor: '#e2e8f0' }} />

            {/* Time display */}
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', textAlign: 'right' }}>
              <div style={{ fontWeight: '600', color: '#0d1b4b' }}>{currentTime.toLocaleTimeString()}</div>
              <div style={{ fontSize: '11px' }}>{formatDateWeekdayShort(currentTime)}</div>
            </div>

          </div>
        </header>

        {/* Content Body */}
        <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
          
          {/* Breadcrumbs */}
          {renderBreadcrumbs()}

          {/* Banner messages */}
          {message && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: message.includes('✅') || message.includes('🔑') ? '#dcfce7' : '#fee2e2', border: `1px solid ${message.includes('✅') || message.includes('🔑') ? '#86efac' : '#fca5a5'}`, color: message.includes('✅') || message.includes('🔑') ? '#166534' : '#991b1b', padding: '14px 20px', borderRadius: '12px', marginBottom: '24px', fontSize: '14px', fontWeight: '500', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              {message.includes('✅') || message.includes('🔑') ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
              <span>{message}</span>
            </div>
          )}

          {/* DASHBOARD PAGE */}
          {activePage === 'dashboard' && (
            <div>
              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '32px' }}>
                {[
                  { label: 'Total Accounts', value: users.length, icon: <Users size={22} />, color: '#3b82f6', border: '#cbd5e1', keyType: 'total' },
                  { label: 'Active Users', value: users.filter(u => u.status !== false).length, icon: <CheckCircle2 size={22} />, color: '#10b981', border: '#cbd5e1', keyType: 'active' },
                  { label: 'Deactivated Accounts', value: users.filter(u => u.status === false).length, icon: <UserMinus size={22} />, color: '#ef4444', border: '#cbd5e1', keyType: 'deactivated' },
                  { label: 'System Logs Recorded', value: auditLogs.length, icon: <Clock size={22} />, color: '#6366f1', border: '#cbd5e1', keyType: 'logs' }
                ].map((stat, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'white',
                      borderRadius: '16px',
                      padding: '24px',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -2px rgba(0,0,0,0.02)',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{stat.label}</div>
                      <div style={{ fontSize: '28px', fontWeight: '800', color: '#0d1b4b', marginTop: '8px' }}>{stat.value}</div>
                    </div>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${stat.color}15`, color: stat.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {stat.icon}
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Actions & Recent Activity layout */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '24px' }}>
                
                {/* Recent Activity */}
                <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, color: '#0d1b4b', fontSize: '16px', fontWeight: '700' }}>Recent Audit Activities</h3>
                    <span onClick={() => setActivePage('activity')} style={{ fontSize: '12px', color: '#2563eb', fontWeight: '600', cursor: 'pointer' }}>View All</span>
                  </div>
                  {auditLogs.slice(0, 5).length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', padding: '40px' }}>No system logs yet.</div>
                  ) : (
                    auditLogs.slice(0, 5).map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 0', borderBottom: i === 4 ? 'none' : '1px solid #f1f5f9' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.status === 'Success' ? '#10b981' : '#ef4444', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: '600', fontSize: '14px', color: '#0f172a' }}>{item.userName || item.userId?.name || 'System'}</span>
                          <span style={{ fontSize: '13px', color: '#475569' }}> performed <strong style={{ color: '#0d1b4b' }}>{item.action}</strong> in <strong style={{ color: '#2563eb' }}>{item.module}</strong></span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Newly Created Users */}
                <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, color: '#0d1b4b', fontSize: '16px', fontWeight: '700' }}>Newly Created Users</h3>
                    <span onClick={() => { setActivePage('users'); setUserViewMode('list'); }} style={{ fontSize: '12px', color: '#2563eb', fontWeight: '600', cursor: 'pointer' }}>View All</span>
                  </div>
                  {[...users]
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .slice(0, 5).length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', padding: '40px' }}>No users yet.</div>
                  ) : (
                    [...users]
                      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                      .slice(0, 5)
                      .map((u, i, arr) => {
                        const rColor = getRoleColor(u.role);
                        return (
                          <div key={u._id || i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: i === arr.length - 1 ? 'none' : '1px solid #f1f5f9', cursor: 'pointer' }}
                            onClick={() => { setSelectedUser(u); setIsEditing(false); setActivePage('users'); setUserViewMode('details'); }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', color: '#94a3b8', flexShrink: 0 }}>
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: '600', fontSize: '13px', color: '#0f172a' }}>{u.name}</div>
                              <div style={{ fontSize: '12px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                            </div>
                            <span style={{ background: rColor.bg, color: rColor.text, padding: '4px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: '700', flexShrink: 0, display: 'inline-block', minWidth: '110px', textAlign: 'center' }}>
                              {formatRoleLabel(u.role)}
                            </span>
                          </div>
                        );
                      })
                  )}
                </div>

              </div>

              {/* User Activity Chart */}
              <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', marginTop: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, color: '#0d1b4b', fontSize: '16px', fontWeight: '700' }}>User Activity</h3>
                  <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', borderRadius: '10px', padding: '4px' }}>
                    {[7, 30].map(range => (
                      <button
                        key={range}
                        onClick={() => setActivityRange(range)}
                        style={{
                          padding: '6px 16px',
                          borderRadius: '8px',
                          border: 'none',
                          background: activityRange === range ? '#2563eb' : 'transparent',
                          color: activityRange === range ? 'white' : '#64748b',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {range} Days
                      </button>
                    ))}
                  </div>
                </div>
                {(() => {
                  const days = [];
                  const now = new Date();
                  for (let i = activityRange - 1; i >= 0; i--) {
                    const d = new Date(now);
                    d.setDate(d.getDate() - i);
                    d.setHours(0, 0, 0, 0);
                    days.push(d);
                  }
                  const chartData = days.map(day => {
                    const nextDay = new Date(day);
                    nextDay.setDate(nextDay.getDate() + 1);
                    const count = auditLogs.filter(log => {
                      const ts = new Date(log.timestamp || log.time);
                      return ts >= day && ts < nextDay;
                    }).length;
                    return {
                      date: activityRange === 7
                        ? day.toLocaleDateString('en-US', { weekday: 'short' })
                        : day.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
                      count
                    };
                  });
                  const totalActivity = chartData.reduce((sum, d) => sum + d.count, 0);
                  if (totalActivity === 0) {
                    return <div style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', padding: '40px' }}>No activity recorded in the last {activityRange} days.</div>;
                  }
                  return (
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12, fill: '#64748b' }}
                          axisLine={{ stroke: '#e2e8f0' }}
                          tickLine={false}
                          interval={activityRange === 30 ? 3 : 0}
                        />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} width={30} />
                        <Tooltip
                          formatter={(value) => [`${value} activit${value === 1 ? 'y' : 'ies'}`, 'Activity']}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                        />
                        <Area type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} fill="url(#activityGradient)" activeDot={{ r: 5 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            </div>
          )}

          {/* USER MANAGEMENT PAGE */}
          {activePage === 'users' && (
            <div>
              {/* LIST VIEW */}
              {userViewMode === 'list' && (
                <div>
                  <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>

                    {/* Search Bar */}
                    <div style={{ position: 'relative', width: '320px' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}><Search size={18} /></span>
                      <input placeholder="Search users by name or email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', background: 'white', color: '#0f172a' }} />
                    </div>

                    {/* Add New User Button */}
                    <button onClick={openAddUserForm}
                      style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Plus size={16} /> Add New User
                    </button>
                  </div>

                  {/* Users Table */}
                  <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#0d1b4b', color: 'white' }}>
                          {['Name', 'Email Address', 'Workspace Role', 'Status', 'Actions'].map(h => (
                            <th key={h} style={{ padding: '16px 20px', fontSize: '13px', fontWeight: '600', letterSpacing: '0.5px' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>No users match your search.</td>
                          </tr>
                        ) : (
                          filteredUsers.map((u, i) => {
                            const rColor = getRoleColor(u.role);
                            return (
                              <tr key={u._id || i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#f8fafc', transition: 'background 0.2s' }} className="table-row">
                                <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: '600', color: '#0d1b4b', cursor: 'pointer' }} onClick={() => { setSelectedUser(u); setIsEditing(false); setUserViewMode('details'); }}>
                                  {u.name}
                                </td>
                                <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{u.email}</td>
                                <td style={{ padding: '16px 20px' }}>
                                  <span style={{ background: rColor.bg, color: rColor.text, padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', display: 'inline-block', minWidth: '130px', textAlign: 'center' }}>
                                    {formatRoleLabel(u.role)}
                                  </span>
                                </td>
                                <td style={{ padding: '16px 20px' }}>{getStatusBadge(u.status)}</td>
                                <td style={{ padding: '16px 20px', display: 'flex', gap: '8px' }}>
                                  <button onClick={() => handleEditClick(u)} style={{ background: '#eff6ff', color: '#2563eb', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Pencil size={12} /> Edit
                                  </button>
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

              {/* USER DETAILS / CREATE VIEW */}
              {userViewMode === 'details' && (
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                  
                  {/* User details card header */}
                  <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', marginBottom: '24px', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      
                      {/* Avatar placeholder */}
                      <div style={{ width: '70px', height: '70px', borderRadius: '50%', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: '#94a3b8', fontWeight: 'bold' }}>
                        {selectedUser ? selectedUser.name.charAt(0).toUpperCase() : 'N'}
                      </div>

                      <div>
                        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#0d1b4b' }}>
                          {selectedUser ? selectedUser.name : 'New Account profile'}
                        </h2>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                          <span style={{ fontSize: '12px', background: '#eff6ff', color: '#2563eb', padding: '4px 8px', borderRadius: '6px', fontWeight: '700', display: 'inline-block', minWidth: '130px', textAlign: 'center' }}>
                            {formatRoleLabel(selectedUser ? selectedUser.role : newUser.role)}
                          </span>
                          {selectedUser && (
                            <span style={{ fontSize: '12px', background: selectedUser.status !== false ? '#dcfce7' : '#fee2e2', color: selectedUser.status !== false ? '#15803d' : '#b91c1c', padding: '4px 8px', borderRadius: '9999px', fontWeight: '700' }}>
                              {selectedUser.status !== false ? 'Active' : 'Inactive'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Actions (top right) */}
                    {selectedUser && (
                      <div style={{ position: 'absolute', top: '24px', right: '24px', display: 'flex', gap: '8px' }}>
                        <button onClick={() => setIsEditing(true)} style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #2563eb30', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Pencil size={14} /> Edit User
                        </button>
                        <button onClick={() => handleToggleStatus(selectedUser)} style={{ background: selectedUser.status !== false ? '#fef2f2' : '#ecfdf5', color: selectedUser.status !== false ? '#ef4444' : '#10b981', border: '1px solid #ef444430', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <UserMinus size={14} /> {selectedUser.status !== false ? 'Deactivate User' : 'Activate User'}
                        </button>
                        <button onClick={() => handleResetPasswordClick(selectedUser)} style={{ background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Key size={14} /> Password Reset
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Form Container */}
                  <div style={{ background: 'white', borderRadius: '16px', padding: '32px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                    <form onSubmit={selectedUser ? handleEditSave : handleAddUser} autoComplete="off">

                      {/* Profile Photo Upload */}
                      <div style={{ marginBottom: '32px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Profile Photo</label>
                        <div
                          onDragOver={e => { e.preventDefault(); if (!selectedUser || isEditing) setIsDraggingPhoto(true); }}
                          onDragLeave={() => setIsDraggingPhoto(false)}
                          onDrop={e => {
                            e.preventDefault();
                            setIsDraggingPhoto(false);
                            if (selectedUser && !isEditing) return;
                            if (e.dataTransfer.files?.[0]) handlePhotoFile(e.dataTransfer.files[0], !!selectedUser);
                          }}
                          style={{ border: `2px dashed ${isDraggingPhoto ? '#2563eb' : '#cbd5e1'}`, borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', gap: '20px', background: isDraggingPhoto ? '#eff6ff' : '#f8fafc', transition: 'all 0.2s' }}
                        >
                          <div style={{ width: '64px', height: '64px', borderRadius: '50%', overflow: 'hidden', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '22px', color: '#94a3b8', fontWeight: '700' }}>
                            {avatarPreview ? (
                              <img src={avatarPreview.startsWith('blob:') ? avatarPreview : `http://localhost:5000${avatarPreview}`} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              (selectedUser ? selectedUser.name : newUser.name || '?').charAt(0).toUpperCase()
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '600', fontSize: '14px', color: '#334155' }}>Upload Photo</div>
                            <div style={{ fontSize: '13px', color: '#94a3b8', margin: '2px 0 10px' }}>Drag image here</div>
                            <label style={{ display: 'inline-block', padding: '8px 16px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: (selectedUser && !isEditing) ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                              {avatarUploading ? 'Uploading...' : 'Choose File'}
                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                disabled={selectedUser && !isEditing}
                                onChange={e => e.target.files?.[0] && handlePhotoFile(e.target.files[0], !!selectedUser)}
                              />
                            </label>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>

                        {/* Left Column */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Full Name *</label>
                            <input
                              type="text"
                              placeholder="e.g. Nimal Perera"
                              value={selectedUser ? editForm.name : newUser.name}
                              onChange={e => selectedUser ? setEditForm({...editForm, name: e.target.value}) : setNewUser({...newUser, name: e.target.value})}
                              required
                              disabled={selectedUser && !isEditing}
                              style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', fontSize: '14px', color: '#0f172a', fontWeight: '500', outline: 'none' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Email Address *</label>
                            <input
                              type="email"
                              placeholder="e.g. nimal@els.com"
                              value={selectedUser ? editForm.email : newUser.email}
                              onChange={e => selectedUser ? setEditForm({...editForm, email: e.target.value}) : setNewUser({...newUser, email: e.target.value})}
                              required
                              autoComplete="off"
                              disabled={selectedUser && !isEditing}
                              style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', fontSize: '14px', color: '#0f172a', fontWeight: '500', outline: 'none' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Primary Phone *</label>
                            <input
                              type="text"
                              placeholder={`e.g. ${PHONE_PLACEHOLDER}`}
                              maxLength={12}
                              value={selectedUser ? editForm.phone : newUser.phone}
                              onChange={e => selectedUser ? setEditForm({...editForm, phone: formatPhoneInput(e.target.value)}) : setNewUser({...newUser, phone: formatPhoneInput(e.target.value)})}
                              required
                              disabled={selectedUser && !isEditing}
                              style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', fontSize: '14px', color: '#0f172a', fontWeight: '500', outline: 'none' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Alternate Phone</label>
                            <input
                              type="text"
                              placeholder={`e.g. ${PHONE_PLACEHOLDER}`}
                              maxLength={12}
                              value={selectedUser ? editForm.alternatePhone : newUser.alternatePhone}
                              onChange={e => selectedUser ? setEditForm({...editForm, alternatePhone: formatPhoneInput(e.target.value)}) : setNewUser({...newUser, alternatePhone: formatPhoneInput(e.target.value)})}
                              disabled={selectedUser && !isEditing}
                              style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', fontSize: '14px', color: '#0f172a', fontWeight: '500', outline: 'none' }}
                            />
                          </div>
                        </div>

                        {/* Right Column */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Employee ID *</label>
                            <input
                              type="text"
                              placeholder="e.g. EMP-0001"
                              value={selectedUser ? editForm.employeeId : newUser.employeeId}
                              readOnly
                              required
                              disabled={selectedUser && !isEditing}
                              title="Auto-generated by the system and cannot be edited"
                              style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f1f5f9', fontSize: '14px', color: '#475569', fontWeight: '500', outline: 'none', cursor: 'not-allowed' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Gender</label>
                            <select
                              value={selectedUser ? editForm.gender : newUser.gender}
                              onChange={e => selectedUser ? setEditForm({...editForm, gender: e.target.value}) : setNewUser({...newUser, gender: e.target.value})}
                              disabled={selectedUser && !isEditing}
                              style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', fontSize: '14px', color: '#0f172a', fontWeight: '500', outline: 'none', cursor: 'pointer' }}
                            >
                              <option value="">-- Select Gender --</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Workspace Role *</label>
                            <select
                              value={selectedUser ? editForm.role : newUser.role}
                              onChange={e => selectedUser ? setEditForm({...editForm, role: e.target.value}) : setNewUser({...newUser, role: e.target.value})}
                              required
                              disabled={selectedUser && !isEditing}
                              style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', fontSize: '14px', color: '#0f172a', fontWeight: '500', outline: 'none', cursor: 'pointer' }}
                            >
                              <option value="">-- Select Role --</option>
                              <option value="Director">Director</option>
                              <option value="ProjectManager">Project Manager</option>
                              <option value="PurchaseManager">Purchase Manager</option>
                              <option value="MainStoreOfficer">Main Store Officer</option>
                              <option value="SiteStoreOfficer">Site Store Officer</option>
                            </select>
                          </div>
                          {selectedUser ? (
                            <div>
                              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Created Date</label>
                              <div style={{ padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', fontSize: '13px', color: '#64748b' }}>
                                {formatDate(selectedUser.createdAt)}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Create Password *</label>
                              <div style={{ position: 'relative' }}>
                                <input
                                  type={showCreatePassword ? 'text' : 'password'}
                                  placeholder="Enter a strong password"
                                  value={newUser.password}
                                  onChange={e => setNewUser({...newUser, password: e.target.value})}
                                  required
                                  autoComplete="new-password"
                                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', fontSize: '14px', color: '#0f172a', outline: 'none' }}
                                />
                              </div>
                              {newUser.password && (
                                <span onClick={() => setShowCreatePassword(!showCreatePassword)} style={{ display: 'inline-block', marginTop: '6px', fontSize: '12px', color: '#2563eb', fontWeight: '600', cursor: 'pointer', userSelect: 'none' }}>
                                  {showCreatePassword ? '🙈 Hide Password' : '👁 Show Password'}
                                </span>
                              )}
                              <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
                                {[
                                  ['length', '8+ characters'],
                                  ['upper', 'Uppercase'],
                                  ['lower', 'Lowercase'],
                                  ['number', 'Number'],
                                  ['special', 'Special Character']
                                ].map(([key, label]) => {
                                  const passed = passwordChecks(newUser.password)[key];
                                  return (
                                    <div key={key} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: passed ? '#16a34a' : '#94a3b8' }}>
                                      <span>{passed ? '✓' : '○'}</span> {label}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                      </div>

                      {/* Bottom Action Buttons */}
                      <div style={{ display: 'flex', gap: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '24px' }}>
                        <button type="button" onClick={() => { setUserViewMode('list'); setIsEditing(false); }}
                          style={{ padding: '12px 24px', background: 'transparent', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>
                          Cancel
                        </button>
                        
                        {(!selectedUser || isEditing) && (
                          <button type="submit" 
                            style={{ background: '#0d1b4b', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <UserPlus size={16} /> {selectedUser ? 'Save Changes' : 'Create User'}
                          </button>
                        )}
                      </div>

                    </form>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* ROLES & PERMISSIONS PAGE */}
          {activePage === 'roles-permissions' && (
            <div>
              {/* Secondary Sub-Tabs */}
              <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px', width: 'fit-content', marginBottom: '24px', border: '1px solid #cbd5e1' }}>
                <button 
                  onClick={() => setRolesSubTab('roles')} 
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    backgroundColor: rolesSubTab === 'roles' ? '#0d1b4b' : 'transparent',
                    color: rolesSubTab === 'roles' ? '#ffffff' : '#475569',
                    transition: 'all 0.2s'
                  }}
                >
                  🎭 Role Profiles
                </button>
                <button 
                  onClick={() => setRolesSubTab('permissions')} 
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    backgroundColor: rolesSubTab === 'permissions' ? '#0d1b4b' : 'transparent',
                    color: rolesSubTab === 'permissions' ? '#ffffff' : '#475569',
                    transition: 'all 0.2s'
                  }}
                >
                  🔒 Access Permissions Matrix
                </button>
              </div>

              {rolesSubTab === 'roles' ? (
                <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ position: 'relative', width: '320px' }}>
                  <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input 
                    placeholder="Search roles..." 
                    value={roleSearchTerm} 
                    onChange={e => setRoleSearchTerm(e.target.value)}
                    style={{ padding: '12px 16px 12px 42px', border: '1px solid #e2e8f0', borderRadius: '12px', width: '100%', fontSize: '14px', background: 'white', color: '#0f172a', outline: 'none' }} 
                  />
                </div>
                <button 
                  onClick={handleCreateRoleClick}
                  style={{ background: '#2563eb', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(37, 99, 235,0.2)' }}
                >
                  <Plus size={16} /> Create New Role
                </button>
              </div>

              <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '35%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '30%' }} />
                  </colgroup>
                  <thead>
                    <tr style={{ background: '#0d1b4b', color: 'white' }}>
                      <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: '600', letterSpacing: '0.5px' }}>Role Name</th>
                      <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: '600', letterSpacing: '0.5px' }}>Description</th>
                      <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: '600', letterSpacing: '0.5px', textAlign: 'center' }}>Status</th>
                      <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: '600', letterSpacing: '0.5px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dbRoles.filter(r => r.name.toLowerCase().includes(roleSearchTerm.toLowerCase())).length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>No roles found.</td>
                      </tr>
                    ) : (
                      dbRoles.filter(r => r.name.toLowerCase().includes(roleSearchTerm.toLowerCase())).map((role, idx) => (
                        <tr key={role._id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#f8fafc' }} className="table-row">
                          <td style={{ padding: '18px 24px', fontSize: '14px', fontWeight: '700', color: '#0d1b4b', verticalAlign: 'middle' }}>{role.name}</td>
                          <td style={{ padding: '18px 24px', verticalAlign: 'middle', fontSize: '13px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={role.description || 'No description provided.'}>
                            {role.description || 'No description provided.'}
                          </td>
                          <td style={{ padding: '18px 24px', verticalAlign: 'middle', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block',
                              minWidth: '72px',
                              padding: '4px 10px',
                              borderRadius: '9999px',
                              fontSize: '11px',
                              fontWeight: '700',
                              backgroundColor: role.status === 'Active' ? '#dcfce7' : '#fee2e2',
                              color: role.status === 'Active' ? '#166534' : '#991b1b'
                            }}>
                              {role.status || 'Active'}
                            </span>
                          </td>
                          <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => {
                                  setViewingRole(role);
                                  setShowRoleViewModal(true);
                                }}
                                style={{ background: '#f1f5f9', color: '#0d1b4b', border: 'none', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                              >
                                View
                              </button>
                              <button
                                onClick={() => handleEditRoleClick(role)}
                                style={{ background: '#eff6ff', color: '#2563eb', border: 'none', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleToggleRoleStatus(role)}
                                style={{ background: role.status === 'Active' ? '#fff7ed' : '#ecfdf5', color: role.status === 'Active' ? '#ea580c' : '#10b981', border: 'none', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                              >
                                {role.status === 'Active' ? 'Disable' : 'Enable'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
              ) : (
                <div>
              {/* View Toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                  <button 
                    onClick={() => setRolesViewMode('module')} 
                    style={{
                      padding: '10px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px',
                      backgroundColor: rolesViewMode === 'module' ? '#0d1b4b' : 'transparent',
                      color: rolesViewMode === 'module' ? '#ffffff' : '#475569',
                      transition: 'all 0.2s'
                    }}
                  >
                    By Module
                  </button>
                  <button 
                    onClick={() => setRolesViewMode('role')} 
                    style={{
                      padding: '10px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px',
                      backgroundColor: rolesViewMode === 'role' ? '#0d1b4b' : 'transparent',
                      color: rolesViewMode === 'role' ? '#ffffff' : '#475569',
                      transition: 'all 0.2s'
                    }}
                  >
                    By Role
                  </button>
                </div>

                {/* Filters */}
                {rolesViewMode === 'module' ? (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', width: '220px' }}>
                      <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input 
                        placeholder="Search modules..." 
                        value={statsSearchTerm} 
                        onChange={e => setStatsSearchTerm(e.target.value)}
                        style={{ padding: '8px 12px 8px 34px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', width: '100%', outline: 'none' }} 
                      />
                    </div>
                    <select 
                      value={matrixModuleFilter} 
                      onChange={e => setMatrixModuleFilter(e.target.value)}
                      style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', background: 'white', cursor: 'pointer', outline: 'none' }}
                    >
                      <option value="All">All Categories</option>
                      {MODULES_MATRIX.map(cat => (
                        <option key={cat.category} value={cat.category}>{cat.category}</option>
                      ))}
                    </select>
                    <select 
                      value={matrixSelectedRole} 
                      onChange={e => setMatrixSelectedRole(e.target.value)}
                      style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', background: 'white', cursor: 'pointer', outline: 'none' }}
                    >
                      <option value="All">All Roles</option>
                      {dbRoles.filter(r => r.status === 'Active').map(r => (
                        <option key={r.name} value={r.name}>{r.name}</option>
                      ))}
                    </select>
                    <button 
                      onClick={handleResetFilters}
                      style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', color: '#475569', fontWeight: '600', cursor: 'pointer' }}
                    >
                      Reset
                    </button>
                  </div>
                ) : (
                  <div>
                    <select 
                      value={matrixSelectedRole === 'All' ? (dbRoles.filter(r => r.status === 'Active')[0]?.name || 'Admin') : matrixSelectedRole} 
                      onChange={e => setMatrixSelectedRole(e.target.value)}
                      style={{ padding: '10px 16px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '14px', background: 'white', cursor: 'pointer', outline: 'none' }}
                    >
                      {dbRoles.filter(r => r.status === 'Active').map(r => (
                        <option key={r.name} value={r.name}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Bulk Action Panel */}
              {rolesViewMode === 'module' && selectedModulesList.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#fff7ed', border: '1px solid #ffedd5', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#c2410c' }}>
                    Bulk Action: {selectedModulesList.length} modules selected
                  </span>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginLeft: 'auto' }}>
                    <span style={{ fontSize: '13px', color: '#475569' }}>Set Role:</span>
                    <select id="bulkRoleSelect" style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white' }}>
                      {dbRoles.filter(r => r.status === 'Active').map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                    </select>
                    <span style={{ fontSize: '13px', color: '#475569' }}>To Level:</span>
                    <select id="bulkLevelSelect" style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white' }}>
                      <option value="Full">Full</option>
                      <option value="View">View</option>
                      <option value="Approve">Approve</option>
                      <option value="Partial">Partial</option>
                      <option value="None">None</option>
                    </select>
                    <button 
                      onClick={() => {
                        const role = document.getElementById('bulkRoleSelect').value;
                        const level = document.getElementById('bulkLevelSelect').value;
                        handleBulkEditPermissions(role, level);
                      }}
                      style={{ background: '#2563eb', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}
                    >
                      Apply to Selected
                    </button>
                    <button 
                      onClick={() => setSelectedModulesList([])}
                      style={{ background: 'transparent', border: '1px solid #cbd5e1', color: '#475569', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {/* VIEW 1 - By Module (Matrix) */}
              {rolesViewMode === 'module' && (
                <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#0d1b4b', color: 'white' }}>
                        <th style={{ padding: '16px 20px', fontSize: '13px', fontWeight: '600' }}>
                          <input 
                            type="checkbox" 
                            checked={
                              selectedModulesList.length > 0 && 
                              MODULES_MATRIX.filter(cat => matrixModuleFilter === 'All' || cat.category === matrixModuleFilter)
                                .flatMap(cat => cat.actions)
                                .filter(act => act.name.toLowerCase().includes(statsSearchTerm.toLowerCase()))
                                .every(act => selectedModulesList.includes(act.name))
                            }
                            onChange={(e) => {
                              const visibleActions = MODULES_MATRIX.filter(cat => matrixModuleFilter === 'All' || cat.category === matrixModuleFilter)
                                .flatMap(cat => cat.actions)
                                .filter(act => act.name.toLowerCase().includes(statsSearchTerm.toLowerCase()))
                                .map(act => act.name);
                              if (e.target.checked) {
                                setSelectedModulesList(visibleActions);
                              } else {
                                setSelectedModulesList([]);
                              }
                            }}
                            style={{ marginRight: '10px', cursor: 'pointer' }}
                          />
                          Module / Action
                        </th>
                        {dbRoles.filter(r => r.status === 'Active' && (matrixSelectedRole === 'All' || r.name === matrixSelectedRole)).map(role => (
                          <th key={role.name} style={{ padding: '16px 20px', fontSize: '13px', fontWeight: '600' }}>{role.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MODULES_MATRIX.filter(cat => matrixModuleFilter === 'All' || cat.category === matrixModuleFilter).map((cat, catIdx) => {
                        const matchedActions = cat.actions.filter(act => act.name.toLowerCase().includes(statsSearchTerm.toLowerCase()));
                        if (matchedActions.length === 0) return null;
                        
                        return (
                          <React.Fragment key={catIdx}>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                              <td colSpan={1 + dbRoles.filter(r => r.status === 'Active' && (matrixSelectedRole === 'All' || r.name === matrixSelectedRole)).length} style={{ padding: '12px 20px', fontSize: '12px', fontWeight: '700', color: '#0d1b4b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                📁 {cat.category}
                              </td>
                            </tr>
                            {matchedActions.map((act, actIdx) => (
                              <tr key={actIdx} style={{ borderBottom: '1px solid #f1f5f9', background: 'white' }}>
                                <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: '600', color: '#334155', paddingLeft: '24px' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={selectedModulesList.includes(act.name)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedModulesList(prev => [...prev, act.name]);
                                      } else {
                                        setSelectedModulesList(prev => prev.filter(m => m !== act.name));
                                      }
                                    }}
                                    style={{ marginRight: '10px', cursor: 'pointer' }}
                                  />
                                  {act.name}
                                  {act.notEnforced && (
                                    <span title="Configurable, but not yet enforced by any backend route." style={{ marginLeft: '8px', fontSize: '10px', fontWeight: '700', color: '#94a3b8', background: '#f1f5f9', padding: '2px 6px', borderRadius: '6px', textTransform: 'uppercase' }}>Not Enforced</span>
                                  )}
                                </td>
                                {dbRoles.filter(r => r.status === 'Active' && (matrixSelectedRole === 'All' || r.name === matrixSelectedRole)).map(role => {
                                  const level = getPermissionLevel(role.name, act.name);
                                  return (
                                    <td 
                                      key={role.name} 
                                      style={{ padding: '14px 20px', cursor: 'pointer' }}
                                      onClick={() => {
                                        setSelectedPermissionCell({ role: role.name, module: act.name, level });
                                        setPermissionFormLevel(level);
                                        setShowPermissionCellModal(true);
                                      }}
                                      className="matrix-cell"
                                    >
                                      <style>{`
                                        .matrix-cell:hover {
                                          background-color: #f8fafc;
                                        }
                                      `}</style>
                                      <span style={getBadgeStyle(level)}>
                                        {level === 'None' ? '✕' : level}
                                      </span>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* VIEW 2 - By Role */}
              {rolesViewMode === 'role' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {MODULES_MATRIX.map((cat, catIdx) => {
                    const activeRoleForView = matrixSelectedRole === 'All' ? (dbRoles.filter(r => r.status === 'Active')[0]?.name || 'Admin') : matrixSelectedRole;
                    return (
                      <div key={catIdx} style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', padding: '24px' }}>
                        <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700', color: '#0d1b4b', borderBottom: '2px solid #2563eb', paddingBottom: '8px', textTransform: 'uppercase', display: 'inline-block' }}>
                          📁 {cat.category}
                        </h4>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          {cat.actions.map((act, actIdx) => {
                            const level = getPermissionLevel(activeRoleForView, act.name);
                            return (
                              <div key={actIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '70%' }}>
                                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#0d1b4b' }}>
                                    {act.name}
                                    {act.notEnforced && (
                                      <span title="Configurable, but not yet enforced by any backend route." style={{ marginLeft: '8px', fontSize: '10px', fontWeight: '700', color: '#94a3b8', background: '#f1f5f9', padding: '2px 6px', borderRadius: '6px', textTransform: 'uppercase' }}>Not Enforced</span>
                                    )}
                                  </span>
                                  <span style={{ fontSize: '13px', color: '#64748b' }}>
                                    {getPermissionDescription(level, act.name)}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                  <select 
                                    value={level} 
                                    onChange={(e) => handleDirectPermissionEdit(activeRoleForView, act.name, e.target.value)}
                                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', cursor: 'pointer', outline: 'none', background: 'white' }}
                                  >
                                    <option value="Full">Full</option>
                                    <option value="View">View</option>
                                    <option value="Approve">Approve</option>
                                    <option value="Partial">Partial</option>
                                    <option value="None">None</option>
                                  </select>
                                  <span style={{ ...getBadgeStyle(level), width: '80px', textAlign: 'center' }}>
                                    {level === 'None' ? '✕' : level}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
              )}
            </div>
          )}

          {/* ACTIVITY LOG PAGE */}
          {activePage === 'activity' && (
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
              
              {/* Header Controls */}
              <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                <h3 style={{ margin: 0, color: '#0d1b4b', fontSize: '16px', fontWeight: '700' }}>System Audit Logs</h3>
                
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  
                  {/* Search */}
                  <div style={{ position: 'relative', width: '220px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input placeholder="Search logs..." value={logSearchQuery} onChange={e => setLogSearchQuery(e.target.value)}
                      style={{ padding: '8px 12px 8px 34px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', width: '100%', outline: 'none' }} />
                  </div>

                  {/* Status filter */}
                  <select value={logStatusFilter} onChange={e => setLogStatusFilter(e.target.value)}
                    style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', background: 'white', outline: 'none', cursor: 'pointer' }}>
                    <option value="All">All Statuses</option>
                    <option value="Success">Success</option>
                    <option value="Failed">Failed</option>
                  </select>

                  {/* Module filter */}
                  <select value={logModuleFilter} onChange={e => setLogModuleFilter(e.target.value)}
                    style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', background: 'white', outline: 'none', cursor: 'pointer' }}>
                    <option value="All">All Modules</option>
                    <option value="Authentication">Authentication</option>
                    <option value="User Management">User Management</option>
                    <option value="BOM Approvals">BOM Approvals</option>
                    <option value="Purchase Orders">Purchase Orders</option>
                  </select>

                </div>
              </div>

              {/* Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#0d1b4b', color: 'white' }}>
                    {['User', 'Action Executed', 'System Module', 'Real Timestamp', 'Status'].map(h => (
                      <th key={h} style={{ padding: '16px 24px', fontSize: '13px', fontWeight: '600' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>No audit logs matching selection.</td>
                    </tr>
                  ) : (
                    filteredLogs.map((log, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                        <td style={{ padding: '14px 24px', fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>{log.userName || log.userId?.name || 'System'}</td>
                        <td style={{ padding: '14px 24px', fontSize: '13px', color: '#334155' }}>{log.action}</td>
                        <td style={{ padding: '14px 24px', fontSize: '13px', color: '#64748b' }}>{log.module}</td>
                        <td style={{ padding: '14px 24px', fontSize: '13px', color: '#475569' }}>
                          {formatDateTime(log.timestamp || log.time)}
                        </td>
                        <td style={{ padding: '14px 24px' }}>
                          <span style={{ 
                            background: log.status === 'Success' ? '#dcfce7' : '#fee2e2', 
                            color: log.status === 'Success' ? '#166534' : '#991b1b', 
                            padding: '4px 10px', 
                            borderRadius: '9999px', 
                            fontSize: '11px', 
                            fontWeight: '700' 
                          }}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

            </div>
          )}

          {/* SUPPLIERS PAGE */}
          {activePage === 'suppliers' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Header card with Add Supplier and Search */}
              <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                <div style={{ position: 'relative', width: '320px' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}><Search size={18} /></span>
                  <input
                    type="text"
                    placeholder="Search supplier registry..."
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', background: 'white' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={openSupplierForm}
                    style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {showSupplierForm && !editingSupplierId ? '✕ Close Form' : '＋ Add Supplier'}
                  </button>
                </div>
              </div>

              {/* Add/Edit Supplier Form */}
              {showSupplierForm && (
                <div style={{ background: 'white', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  <h3 style={{ margin: '0 0 20px', color: '#0d1b4b', fontSize: '16px', fontWeight: '700' }}>
                    {editingSupplierId ? '📋 Edit Supplier Partner' : '📋 Register New Supplier Partner'}
                  </h3>
                  <form onSubmit={handleSupplierSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Supplier ID *</label>
                      <input
                        type="text"
                        value={supForm.supplierId}
                        readOnly
                        title="Auto-generated by the system and cannot be edited"
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f1f5f9', color: '#475569', cursor: 'not-allowed' }}
                        placeholder="e.g. SUP-0001"
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Company/Supplier Name</label>
                      <input
                        type="text"
                        value={supForm.name}
                        onChange={(e) => setSupForm({ ...supForm, name: e.target.value })}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        placeholder="e.g. Lanka Cement Ltd"
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Contact Person</label>
                      <input
                        type="text"
                        value={supForm.contactPerson}
                        onChange={(e) => setSupForm({ ...supForm, contactPerson: e.target.value })}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        placeholder="e.g. Nimal Perera"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Phone Number *</label>
                      <input
                        type="text"
                        maxLength={12}
                        value={supForm.phone}
                        onChange={(e) => setSupForm({ ...supForm, phone: formatPhoneInput(e.target.value) })}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        placeholder={`e.g. ${PHONE_PLACEHOLDER}`}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Email Address</label>
                      <input
                        type="email"
                        value={supForm.email}
                        onChange={(e) => setSupForm({ ...supForm, email: e.target.value })}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        placeholder="e.g. contact@lankacement.lk"
                      />
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Office Address</label>
                      <input
                        type="text"
                        value={supForm.address}
                        onChange={(e) => setSupForm({ ...supForm, address: e.target.value })}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        placeholder="e.g. 45, Galle Road, Colombo 03"
                      />
                    </div>

                    {/* Bank Details */}
                    <div style={{ gridColumn: 'span 2', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                      <h4 style={{ margin: '0 0 12px', color: '#0d1b4b', fontSize: '14px', fontWeight: '700' }}>🏦 Bank Details</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Bank Name</label>
                          <input type="text" value={supForm.bankName} onChange={(e) => setSupForm({ ...supForm, bankName: e.target.value })}
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} placeholder="e.g. Commercial Bank" />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Account Number</label>
                          <input type="text" value={supForm.accountNumber} onChange={(e) => setSupForm({ ...supForm, accountNumber: e.target.value })}
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} placeholder="e.g. 8001234567" />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Branch</label>
                          <input type="text" value={supForm.bankBranch} onChange={(e) => setSupForm({ ...supForm, bankBranch: e.target.value })}
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} placeholder="e.g. Colombo Fort" />
                        </div>
                      </div>
                    </div>

                    {/* Document Uploads */}
                    <div style={{ gridColumn: 'span 2', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                      <h4 style={{ margin: '0 0 12px', color: '#0d1b4b', fontSize: '14px', fontWeight: '700' }}>📎 Upload Documents <span style={{ fontWeight: '400', color: '#94a3b8', fontSize: '12px' }}>(PDF or JPG)</span></h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>ID Photo</div>
                          {supForm.documents.idPhoto ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                              <a href={`http://localhost:5000${supForm.documents.idPhoto.url}`} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'underline', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                ⬇ {supForm.documents.idPhoto.filename}
                              </a>
                              <button type="button" onClick={() => setSupForm(prev => ({ ...prev, documents: { ...prev.documents, idPhoto: null } }))}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>✕</button>
                            </div>
                          ) : (
                            <label style={{ display: 'inline-block', padding: '6px 14px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                              {docUploading.idPhoto ? 'Uploading...' : 'Choose File'}
                              <input type="file" accept=".pdf,.jpg,.jpeg" style={{ display: 'none' }}
                                onChange={(e) => e.target.files?.[0] && handleSupplierDocUpload('idPhoto', e.target.files[0])} />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                      <button type="button" onClick={() => { setShowSupplierForm(false); setEditingSupplierId(null); }} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Cancel</button>
                      <button type="submit" style={{ background: '#2e7d32', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>{editingSupplierId ? 'Save Changes' : 'Submit Partner'}</button>
                    </div>
                  </form>
                </div>
              )}

              {/* Suppliers List Table */}
              <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#0d1b4b', color: 'white' }}>
                      {['Supplier ID', 'Company/Supplier Name', 'Contact Person', 'Phone', 'Email', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.filter(s => {
                      const q = supplierSearch.toLowerCase();
                      return s.supplierId?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q) || s.contactPerson?.toLowerCase().includes(q);
                    }).map((s, i) => {
                      return (
                        <tr key={s._id || i} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '600', color: '#0d1b4b' }}>{s.supplierId}</td>
                          <td style={{ padding: '14px 16px', fontSize: '13px' }}>{(s.name && s.name !== s.supplierId) ? s.name : (s.contactPerson || '-')}</td>
                          <td style={{ padding: '14px 16px', fontSize: '13px' }}>{s.contactPerson || '-'}</td>
                          <td style={{ padding: '14px 16px', fontSize: '13px' }}>{s.phone}</td>
                          <td style={{ padding: '14px 16px', fontSize: '13px', color: '#666' }}>{s.email || '-'}</td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{
                              background: s.status === 'Active' ? '#e8f5e9' : '#ffebee',
                              color: s.status === 'Active' ? '#2e7d32' : '#c62828',
                              padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600'
                            }}>{s.status}</span>
                          </td>
                          <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                            <button onClick={() => handleSupplierEditClick(s)}
                              style={{ background: '#1565c0', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '6px', fontWeight: 'bold' }}>
                              Edit
                            </button>
                            {s.status === 'Active' ? (
                              <button onClick={() => handleSupplierDeactivate(s._id)}
                                style={{ background: '#c62828', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                                Deactivate
                              </button>
                            ) : (
                              <button onClick={() => handleSupplierActivate(s._id)}
                                style={{ background: '#2e7d32', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                                Activate
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {suppliers.filter(s => {
                      const q = supplierSearch.toLowerCase();
                      return s.supplierId?.toLowerCase().includes(q) || s.contactPerson?.toLowerCase().includes(q);
                    }).length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>No suppliers match your search criteria.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MATERIAL MANAGEMENT PAGE */}
          {activePage === 'material-management' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Header card with Add Material and Search */}
              <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                <div style={{ position: 'relative', width: '320px' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}><Search size={18} /></span>
                  <input
                    type="text"
                    placeholder="Search master materials..."
                    value={materialSearch}
                    onChange={(e) => setMaterialSearch(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', background: 'white' }}
                  />
                </div>
                <button
                  onClick={openMaterialForm}
                  style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {showMaterialForm && !editingMaterialId ? '✕ Close Form' : '＋ Add Material'}
                </button>
              </div>

              {/* Add/Edit Material Form */}
              {showMaterialForm && (
                <div style={{ background: 'white', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  <h3 style={{ margin: '0 0 20px', color: '#0d1b4b', fontSize: '16px', fontWeight: '700' }}>
                    {editingMaterialId ? '📦 Edit Master Material' : '📦 Add New Master Material'}
                  </h3>
                  <form onSubmit={handleMaterialFormSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Material Code *</label>
                      <input
                        type="text"
                        value={materialForm.materialCode}
                        readOnly
                        title="Auto-generated by the system and cannot be edited"
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f1f5f9', color: '#475569', cursor: 'not-allowed' }}
                        placeholder="e.g. MAT0001"
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Material Name *</label>
                      <input
                        type="text"
                        value={materialForm.materialName}
                        onChange={(e) => setMaterialForm({ ...materialForm, materialName: e.target.value })}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        placeholder="e.g. Portland Cement OPC"
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Material Category *</label>
                      <select
                        value={materialForm.category}
                        onChange={(e) => setMaterialForm({ ...materialForm, category: e.target.value })}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white' }}
                        required
                      >
                        {MATERIAL_CATEGORY_OPTIONS.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Unit of Measure *</label>
                      <select
                        value={materialForm.unit}
                        onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white' }}
                        required
                      >
                        {MATERIAL_UNIT_OPTIONS.map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Estimated Unit Cost (LKR) *</label>
                      <input
                        type="number"
                        min="0"
                        value={materialForm.estimatedUnitCost}
                        onChange={(e) => setMaterialForm({ ...materialForm, estimatedUnitCost: e.target.value })}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        placeholder="e.g. 1850"
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Minimum Stock</label>
                      <input
                        type="number"
                        min="0"
                        value={materialForm.minimumStock}
                        onChange={(e) => setMaterialForm({ ...materialForm, minimumStock: e.target.value })}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        placeholder="e.g. 10"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Maximum Stock</label>
                      <input
                        type="number"
                        min="0"
                        value={materialForm.maximumStock}
                        onChange={(e) => setMaterialForm({ ...materialForm, maximumStock: e.target.value })}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        placeholder="e.g. 100"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Reorder Level</label>
                      <input
                        type="number"
                        min="0"
                        value={materialForm.reorderLevel}
                        onChange={(e) => setMaterialForm({ ...materialForm, reorderLevel: e.target.value })}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        placeholder="e.g. 50"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Status</label>
                      <select
                        value={materialForm.status}
                        onChange={(e) => setMaterialForm({ ...materialForm, status: e.target.value })}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white' }}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Description (optional)</label>
                      <input
                        type="text"
                        value={materialForm.description}
                        onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        placeholder="e.g. 50kg Ordinary Portland Cement bags"
                      />
                    </div>

                    <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                      <button type="button" onClick={() => { setShowMaterialForm(false); setEditingMaterialId(null); }} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Cancel</button>
                      <button type="submit" style={{ background: '#2e7d32', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>{editingMaterialId ? 'Save Changes' : 'Add Material'}</button>
                    </div>
                  </form>
                </div>
              )}

              {/* Master Material List Table */}
              <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#0d1b4b', color: 'white' }}>
                      {['Material Code', 'Material Name', 'Category', 'Unit', 'Est. Unit Cost (LKR)', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {materialMasterList.filter(m => {
                      const q = materialSearch.toLowerCase();
                      return m.materialCode?.toLowerCase().includes(q) || m.materialName?.toLowerCase().includes(q) || m.category?.toLowerCase().includes(q);
                    }).map((m, i) => (
                      <tr key={m._id || i} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '600', color: '#0d1b4b' }}>{m.materialCode}</td>
                        <td style={{ padding: '14px 16px', fontSize: '13px' }}>{m.materialName}</td>
                        <td style={{ padding: '14px 16px', fontSize: '13px' }}>{m.category}</td>
                        <td style={{ padding: '14px 16px', fontSize: '13px' }}>{m.unit}</td>
                        <td style={{ padding: '14px 16px', fontSize: '13px' }}>{Number(m.estimatedUnitCost || 0).toLocaleString()}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            background: m.status === 'Active' ? '#e8f5e9' : '#ffebee',
                            color: m.status === 'Active' ? '#2e7d32' : '#c62828',
                            padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600'
                          }}>{m.status}</span>
                        </td>
                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                          <button onClick={() => handleMaterialEditClick(m)}
                            style={{ background: '#1565c0', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '6px', fontWeight: 'bold' }}>
                            Edit
                          </button>
                          <button onClick={() => handleToggleMaterialStatus(m)}
                            style={{ background: m.status === 'Active' ? '#c62828' : '#2e7d32', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                            {m.status === 'Active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {materialMasterList.filter(m => {
                      const q = materialSearch.toLowerCase();
                      return m.materialCode?.toLowerCase().includes(q) || m.materialName?.toLowerCase().includes(q) || m.category?.toLowerCase().includes(q);
                    }).length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>No materials match your search criteria.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SETTINGS PAGE */}
          {activePage === 'settings' && (
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '32px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <SettingsPage user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />
            </div>
          )}

          {/* Footer */}
          <div style={{ textAlign: 'center', padding: '20px 0 8px', marginTop: '16px', fontSize: '12px', color: '#94a3b8' }}>
            ELS Construction Material Management System &copy;2026
          </div>

        </main>
      </div>

      {resetPasswordUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '16px', width: '420px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <h3 style={{ color: '#0d1b4b', marginTop: 0, marginBottom: '20px', fontSize: '18px', fontWeight: '700' }}>🔑 Reset Password</h3>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>Set a new password for <strong>{resetPasswordUser.name}</strong> ({resetPasswordUser.email}).</p>
            
            {resetPasswordError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                {resetPasswordError}
              </div>
            )}
            
            <form onSubmit={handleResetPasswordSubmit} autoComplete="off">
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', fontWeight: '600', marginBottom: '6px', textTransform: 'uppercase' }}>New Password</label>
                <input
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '14px', outline: 'none' }}
                  required
                />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', fontWeight: '600', marginBottom: '6px', textTransform: 'uppercase' }}>Confirm Password</label>
                <input
                  type="password"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '14px', outline: 'none' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setResetPasswordUser(null)} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>Cancel</button>
                <button type="submit" style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', boxShadow: '0 4px 12px rgba(37, 99, 235,0.2)' }}>Save Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {renderStatsDrawer()}
      {renderRoleModal()}
      {renderRoleViewModal()}
      {renderPermissionCellModal()}
    </div>
  );
};

export default AdminDashboard;