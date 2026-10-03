import React, { useState, useEffect } from 'react';
import SettingsPage from './SettingsPage';
import { Calendar } from 'lucide-react';
import SupplierProfile from '../components/SupplierProfile';
import { formatPhoneInput, isValidPhone, PHONE_PLACEHOLDER } from '../utils/phoneUtils';
import { formatDate, formatFullDate, formatShortDate, formatTime, formatDateTime, formatDateLong } from '../utils/dateUtils';
import DateInput from '../components/DateInput';
import { downloadPaymentReport, downloadPaymentReceipt } from '../services/paymentService';
import ReportsCenter from './ReportsCenter';
import { API_BASE } from '../config';
import Pagination, { usePagination } from '../components/Pagination';
import { scrollToElement } from '../utils/scrollToElement';
import { useToast } from '../context/ToastContext';
import LoadingButton from '../components/LoadingButton';
import openUploadedFile from '../utils/openUploadedFile';
import MaterialsViewButton from '../components/MaterialsViewButton';

const PurchaseOrderPage = ({ user, onLogout, onUserUpdate }) => {
  const toast = useToast();
  const [poSubmitting, setPoSubmitting] = useState(false);
  const [supplierSubmitting, setSupplierSubmitting] = useState(false);
  const [activePage, setActivePage] = useState('dashboard'); // 'dashboard', 'orders', 'suppliers'
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
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
  const [invoices, setInvoices] = useState([]);
  const [modal, setModal] = useState(null);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [poSearchTerm, setPoSearchTerm] = useState('');
  const [payingInvoiceId, setPayingInvoiceId] = useState(null);
  const [downloadingReport, setDownloadingReport] = useState(false);

  // Offline (Cash / Cheque) payment being recorded against an approved invoice.
  const emptyManualPay = { method: 'Cash', reference: '', bankName: '', chequeDate: '', paidAt: new Date().toISOString().substring(0, 10), notes: '' };
  const [manualPayInvoice, setManualPayInvoice] = useState(null);
  const [manualPayForm, setManualPayForm] = useState(emptyManualPay);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [manualPayError, setManualPayError] = useState('');
  const [manualPayFieldErrors, setManualPayFieldErrors] = useState({});

  const handleDownloadReport = async () => {
    try {
      setDownloadingReport(true);
      setError('');
      await downloadPaymentReport();
      setMessage('✅ Payment report downloaded successfully!');
    } catch (err) {
      setError(err.message || 'Failed to download payment report.');
    } finally {
      setDownloadingReport(false);
    }
  };

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

  // Search Filter for Suppliers
  const [supplierSearch, setSupplierSearch] = useState('');

  // Supplier Profile view state
  const [viewingSupplierId, setViewingSupplierId] = useState(null);

  const filteredOrders = React.useMemo(() => {
    const query = poSearchTerm.trim().toLowerCase();
    if (!query) return orders;
    return orders.filter(po =>
      (po.poNumber || '').toLowerCase().includes(query) ||
      (po.supplier || '').toLowerCase().includes(query) ||
      (po.status || '').toLowerCase().includes(query) ||
      (po.items || []).some(item => (item.materialName || '').toLowerCase().includes(query))
    );
  }, [orders, poSearchTerm]);

  const filteredSuppliers = React.useMemo(() => {
    const query = supplierSearch.trim().toLowerCase();
    if (!query) return suppliers;
    return suppliers.filter(s =>
      (s.name || '').toLowerCase().includes(query) ||
      (s.supplierId || '').toLowerCase().includes(query) ||
      (s.contactPerson || '').toLowerCase().includes(query) ||
      (s.category || '').toLowerCase().includes(query)
    );
  }, [suppliers, supplierSearch]);

  const poPagination = usePagination(filteredOrders, 8, [poSearchTerm]);
  const prPagination = usePagination(purchaseRequests, 8, [purchaseRequests.length]);
  const supplierPagination = usePagination(filteredSuppliers, 8, [supplierSearch]);
  const invoicesPagination = usePagination(invoices, 8, [invoices.length], { storageKey: 'po_invoices' });

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
      const poRes = await fetch(`${API_BASE}/api/purchase-orders`, { headers });
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
      const supRes = await fetch(`${API_BASE}/api/suppliers`, { headers });
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
      const prRes = await fetch(`${API_BASE}/api/purchase-requests?status=Pending`, { headers });
      const prData = await prRes.json();
      if (prData.success) setPendingPRs(prData.data);

      // Fetch ALL PRs
      const allPrRes = await fetch(`${API_BASE}/api/purchase-requests`, { headers });
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

      // Fetch Invoices / Payments
      const invRes = await fetch(`${API_BASE}/api/invoices`, { headers });
      const invData = await invRes.json();
      setInvoices(invData.success ? invData.data : []);

    } catch (err) {
      setError('Could not connect to the backend server. Please check your network connection.');
      setOrders([]);
      setSuppliers([]);
      setInvoices([]);
      setPurchaseRequests([]);
    }
  };

  const fetchNotifications = async () => {
    if (!hasSession()) return;
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch(`${API_BASE}/api/inventory/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data);
      }

      const countRes = await fetch(`${API_BASE}/api/notifications/count`, {
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
      const res = await fetch(`${API_BASE}/api/notifications`, { headers: getHeaders() });
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
      await fetch(`${API_BASE}/api/notifications/${notif._id}/read`, {
        method: 'PUT',
        headers: getHeaders()
      });
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
    setPrNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, isRead: true } : n));
    setPrUnreadCount(prev => Math.max(0, prev - (notif.isRead ? 0 : 1)));
    if (notif.link) setActivePage('prs');
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await fetch(`${API_BASE}/api/notifications/mark-all-read`, {
        method: 'PUT',
        headers: getHeaders()
      });
      setPrNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setPrUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications read:', err);
    }
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

  const handlePayInvoice = async (invoiceOrId) => {
    if (!hasSession()) return;
    setError(''); setMessage('');

    const targetInvoice = typeof invoiceOrId === 'object'
      ? invoiceOrId
      : invoices.find(i => i._id === invoiceOrId);

    const invoiceId = targetInvoice ? targetInvoice._id : invoiceOrId;
    const poRef = targetInvoice?.po;
    const purchaseOrderId = typeof poRef === 'object' ? poRef?._id : (poRef || null);
    const amount = targetInvoice?.amount;

    setPayingInvoiceId(invoiceId);
    try {
      const res = await fetch(`${API_BASE}/api/payments/create-checkout-session`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          invoiceId,
          purchaseOrderId,
          amount
        })
      });
      const data = await res.json();
      if (data.success) {
        if (data.url) {
          window.location.href = data.url;
        } else {
          setMessage(`✅ ${data.message || 'Payment successfully processed!'}`);
          setPayingInvoiceId(null);
          fetchData();
        }
      } else {
        setError(data.message || 'Failed to start Stripe checkout.');
        setPayingInvoiceId(null);
      }
    } catch (err) {
      setError('Could not connect to the payment server.');
      setPayingInvoiceId(null);
    }
  };

  const openManualPay = (invoice) => {
    setManualPayInvoice(invoice);
    setManualPayForm(emptyManualPay);
    setManualPayError('');
    setManualPayFieldErrors({});
  };

  // Records a Cash / Cheque payment for a Director-approved invoice.
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!manualPayInvoice) return;
    setManualPayError('');
    setManualPayFieldErrors({});

    const errors = {};
    const method = manualPayForm.method;
    const ref = (manualPayForm.reference || '').trim();
    const bank = (manualPayForm.bankName || '').trim();
    const paidAt = manualPayForm.paidAt;
    const chequeDate = manualPayForm.chequeDate;
    const notes = (manualPayForm.notes || '').trim();

    // Payment Date validation
    if (!paidAt) {
      errors.paidAt = 'Payment date is required.';
    } else {
      const todayStr = new Date().toISOString().substring(0, 10);
      if (paidAt > todayStr) {
        errors.paidAt = 'Payment date cannot be in the future.';
      } else if (manualPayInvoice.invoiceDate) {
        const invDateStr = new Date(manualPayInvoice.invoiceDate).toISOString().substring(0, 10);
        if (paidAt < invDateStr) {
          errors.paidAt = `Payment date cannot be earlier than invoice date (${invDateStr}).`;
        }
      }
    }

    if (method === 'Cash') {
      if (ref.length > 50) {
        errors.reference = 'Voucher / Receipt No. cannot exceed 50 characters.';
      } else if (ref && !/^[a-zA-Z0-9\-_/]+$/.test(ref)) {
        errors.reference = 'Only letters, numbers, -, _ and / are allowed.';
      }
    } else if (method === 'Cheque') {
      if (!ref) {
        errors.reference = 'Cheque number is required.';
      } else if (!/^\d{6}$/.test(ref)) {
        errors.reference = 'Cheque number must be exactly 6 digits (e.g. 004512).';
      }
      if (!bank) {
        errors.bankName = 'Bank name is required.';
      }
      if (!chequeDate) {
        errors.chequeDate = 'Cheque date is required.';
      }
    }

    if (notes.length > 500) {
      errors.notes = 'Notes cannot exceed 500 characters.';
    }

    if (Object.keys(errors).length > 0) {
      setManualPayFieldErrors(errors);
      return;
    }

    setRecordingPayment(true);
    try {
      const res = await fetch(`${API_BASE}/api/payments/record`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          invoiceId: manualPayInvoice._id,
          method,
          reference: ref,
          chequeNumber: method === 'Cheque' ? ref : '',
          bankName: method === 'Cheque' ? bank : '',
          chequeDate: method === 'Cheque' ? chequeDate : undefined,
          paidAt,
          notes
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Payment recorded successfully!');
        setMessage(`✅ ${data.message}`);
        setError('');
        setManualPayInvoice(null);
        setManualPayForm(emptyManualPay);
        setManualPayFieldErrors({});
        fetchData();
        setTimeout(() => scrollToElement('#payment-portal-section'), 100);
      } else {
        toast.error(data.message || 'Failed to record the payment.');
        setManualPayError(data.message || 'Failed to record the payment.');
      }
    } catch (err) {
      toast.error('Could not connect to the payment server.');
      setManualPayError('Could not connect to the payment server.');
    } finally {
      setRecordingPayment(false);
    }
  };

  const handleDownloadReceipt = async (invoice) => {
    setError('');
    try {
      await downloadPaymentReceipt(invoice.po?._id || invoice.po);
    } catch (err) {
      setError(err.message || 'Failed to download the payment receipt.');
    }
  };

  const handlePrSelectChange = (prId) => {
    const selected = pendingPRs.find(pr => pr._id === prId);
    if (selected && selected.materials) {
      const items = selected.materials.map(m => ({
        selected: true,
        materialName: m.materialName || m.name,
        quantity: m.quantity,
        unit: m.unit || 'bag',
        unitPrice: m.estimatedUnitCost ?? ''
      }));
      setForm({ ...form, prId, items });
    } else {
      setForm({ ...form, prId, items: [{ selected: true, materialName: '', quantity: '', unit: 'bag', unitPrice: '' }] });
    }
  };

  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  const updateItem = (index, field, value) => {
    const updated = [...form.items];
    updated[index][field] = value;
    setForm({ ...form, items: updated });
  };

  const calcTotal = () => form.items
    .filter(item => item.selected !== false)
    .reduce((sum, item) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0), 0);

  const handlePOSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');

    const selectedItems = form.items
      .filter(item => item.selected !== false)
      .map(({ selected, ...rest }) => rest);

    if (selectedItems.length === 0) {
      toast.warning('Please select at least one item.');
      setError('Please select at least one item.');
      return;
    }

    setPoSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/purchase-orders`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          ...form,
          items: selectedItems,
          totalAmount: calcTotal()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Purchase Order ${data.data?.poNumber || ''} created successfully!`);
        setMessage(`✅ Purchase Order ${data.data?.poNumber || ''} created successfully!`);
        setShowForm(false);
        setForm({
          prId: '',
          supplier: '',
          notes: '',
          expectedDeliveryDate: '',
          paymentTerms: '30 Days Credit',
          deliveryAddress: '',
          items: [{ selected: true, materialName: '', quantity: '', unit: 'bag', unitPrice: '' }]
        });
        fetchData();
        setTimeout(() => scrollToElement('#po-list-section'), 100);
      } else {
        toast.error(data.message || 'Failed to create PO.');
        setError(data.message || 'Failed to create PO.');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to create PO.');
      setError(err.message || 'Failed to create PO.');
    } finally {
      setPoSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    setError(''); setMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/purchase-orders/${id}/status`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`PO status updated to ${status}!`);
        setMessage(`✅ PO status updated to ${status}!`);
        fetchData();
      } else {
        toast.error(data.message || 'Failed to update status.');
        setError(data.message || 'Failed to update status.');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update status.');
      setError(err.message || 'Failed to update status.');
    }
  };

  // Payment state of a PO, derived from its supplier invoices so it matches the Payment Portal.
  const getPoPaymentState = (po) => {
    const poInvoices = invoices.filter(inv => (inv.po?._id || inv.po) === po._id && inv.status !== 'Rejected');
    if (poInvoices.some(inv => inv.status === 'Approved')) {
      return { label: '💳 Ready to pay', bg: '#ede9fe', color: '#5b21b6', ready: true };
    }
    if (poInvoices.some(inv => inv.status === 'Pending Approval')) {
      return { label: 'Awaiting Director', bg: '#dbeafe', color: '#1d4ed8' };
    }
    if (poInvoices.length > 0 || po.paymentStatus === 'paid') {
      return { label: '✓ Paid', bg: '#dcfce7', color: '#15803d' };
    }
    return { label: 'No invoice', bg: '#f1f5f9', color: '#475569' };
  };

  const handleConvertToPO = (pr) => {
    setForm({
      prId: pr._id,
      supplier: '',
      notes: pr.notes || `Derived from PR for project ${pr.projectName}`,
      expectedDeliveryDate: '',
      paymentTerms: '30 Days Credit',
      deliveryAddress: '',
      items: (pr.materials || []).map(m => ({
        selected: true,
        materialName: m.materialName || m.name,
        quantity: m.quantity,
        unit: m.unit || 'bags',
        unitPrice: m.estimatedUnitCost ?? ''
      }))
    });
    setShowForm(true);
    setActivePage('orders');
    setTimeout(() => scrollToElement('#po-form-section'), 100);
  };

  const handleSendToSupplier = async (id, poNumber, supplierName) => {
    setError(''); setMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/purchase-orders/${id}/send`, {
        method: 'PUT',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`${poNumber} emailed to ${supplierName} successfully!`);
        setMessage(`✅ ${poNumber} emailed to ${supplierName} successfully!`);
        fetchData();
      } else {
        toast.error(data.message || 'Failed to send PO.');
        setError(data.message || 'Failed to send PO.');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to send PO.');
      setError(err.message || 'Failed to send PO.');
    }
  };

  const handleSupplierSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    if (!isValidPhone(supForm.phone)) {
      toast.warning(`Phone number must be a 10-digit number, e.g. ${PHONE_PLACEHOLDER}.`);
      setError(`Phone number must be a 10-digit number, e.g. ${PHONE_PLACEHOLDER}.`);
      return;
    }
    setSupplierSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/suppliers/add`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(supForm)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Supplier added successfully!');
        setMessage('✅ Supplier added successfully!');
        setShowSupplierForm(false);
        setSupForm({ name: '', contactPerson: '', phone: '', email: '', address: '', category: 'Cement', status: 'Active' });
        fetchData();
        setTimeout(() => scrollToElement('#suppliers-list-section'), 100);
      } else {
        toast.error(data.message || 'Failed to add supplier.');
        setError(data.message || 'Failed to add supplier.');
      }
    } catch {
      toast.error('Connection failed.');
      setError('Connection failed.');
    } finally {
      setSupplierSubmitting(false);
    }
  };

  const handleSupplierDeactivate = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this supplier?')) return;
    setError(''); setMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/suppliers/${id}/deactivate`, {
        method: 'PUT',
        headers: getHeaders()
      });
      if (res.ok) {
        toast.success('Supplier deactivated successfully!');
        setMessage('✅ Supplier deactivated successfully!');
        fetchData();
      } else {
        toast.error('Failed to deactivate supplier.');
        setError('Failed to deactivate supplier.');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to deactivate supplier.');
      setError(err.message || 'Failed to deactivate supplier.');
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
      toast.warning(`Phone number must be a 10-digit number, e.g. ${PHONE_PLACEHOLDER}.`);
      setError(`Phone number must be a 10-digit number, e.g. ${PHONE_PLACEHOLDER}.`);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/suppliers/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(editSupForm)
      });
      if (res.ok) {
        toast.success('Supplier updated successfully!');
        setMessage('✅ Supplier updated successfully!');
        setEditingSupplierId(null);
        fetchData();
        setTimeout(() => scrollToElement('#suppliers-list-section'), 100);
      } else {
        toast.error('Failed to update supplier.');
        setError('Failed to update supplier.');
      }
    } catch {
      toast.error('Connection failed.');
      setError('Connection failed.');
    }
  };

  // Stats Calculations
  const stats = [
    { label: 'Total POs', value: orders.length, color: '#1565c0', type: 'total-pos' },
    { label: 'Pending POs', value: orders.filter(o => o.status === 'Pending').length, color: '#0d1b4b', type: 'pending-pos' },
    { label: 'Sent POs', value: orders.filter(o => o.status === 'Sent').length, color: '#1565c0', type: 'sent-pos' },
    { label: 'Delivered POs', value: orders.filter(o => o.status === 'Delivered').length, color: '#2e7d32', type: 'delivered-pos' },
  ];

  const supplierStats = [
    { label: 'Total Suppliers', value: suppliers.length, color: '#1565c0' },
    { label: 'Active Suppliers', value: suppliers.filter(s => s.status === 'Active').length, color: '#2e7d32' },
    { label: 'Inactive Suppliers', value: suppliers.filter(s => s.status === 'Inactive').length, color: '#c62828' },
  ];

  const now = new Date();
  const totalInvoiceSum = invoices.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
  const paidInvoiceSum = invoices.filter(i => i.status === 'Paid').reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
  const outstandingInvoiceSum = invoices.filter(i => i.status !== 'Paid').reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
  const overdueCount = invoices.filter(i => i.status !== 'Paid' && i.dueDate && new Date(i.dueDate) < now).length;

  const paymentStats = [
    { label: 'Total Invoices', value: invoices.length, color: '#1565c0' },
    { label: 'Total Amount', value: `LKR ${totalInvoiceSum.toLocaleString()}`, color: '#0d1b4b' },
    { label: 'Total Paid Amount', value: `LKR ${paidInvoiceSum.toLocaleString()}`, color: '#2e7d32' },
    { label: 'Outstanding Amount', value: `LKR ${outstandingInvoiceSum.toLocaleString()}`, color: '#d97706' },
    { label: 'Overdue Invoices', value: overdueCount, color: overdueCount > 0 ? '#ef4444' : '#64748b' }
  ];

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
          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500' }}>{typeof po.supplier === 'object' ? (po.supplier?.name || po.supplier?.supplierId || '—') : (po.supplier || '—')}</td>
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
              color: po.status === 'Delivered' ? '#2e7d32' : po.status === 'Sent' ? '#1565c0' : '#0d1b4b',
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
          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500' }}>{typeof po.supplier === 'object' ? (po.supplier?.name || po.supplier?.supplierId || '—') : (po.supplier || '—')}</td>
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
            <span style={{ fontSize: '12px', color: '#b45309', fontWeight: '600' }}>Awaiting Director approval</span>
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
          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500' }}>{typeof po.supplier === 'object' ? (po.supplier?.name || po.supplier?.supplierId || '—') : (po.supplier || '—')}</td>
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
          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500' }}>{typeof po.supplier === 'object' ? (po.supplier?.name || po.supplier?.supplierId || '—') : (po.supplier || '—')}</td>
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

  // Shared styling for the Create PO form fields/labels/section headers
  const poFieldStyle = { width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', fontSize: '13px', color: '#1e293b' };
  const poLabelStyle = { display: 'block', fontSize: '12px', color: '#666', marginBottom: '6px', fontWeight: '600' };
  const poSectionHeaderStyle = { color: '#0d1b4b', fontSize: '14px', fontWeight: '700', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.02em' };
  const poItemGridCols = '2fr 0.7fr 0.9fr 1.1fr 1.1fr 36px';

  if (viewingSupplierId) {
    return (
      <SupplierProfile
        supplierId={viewingSupplierId}
        onBack={() => setViewingSupplierId(null)}
        getHeaders={getHeaders}
        canManageQuotations={true}
        user={user}
      />
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Segoe UI, Arial, sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width: '240px', background: '#0d1b4b', color: 'white', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh', zIndex: 100 }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/els-logo.png" alt="ELS Logo" style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '50%' }} />
          <div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#2563eb' }}>ELS Construction</div>
            <div style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: '500' }}>Procurement</div>
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
            { id: 'payment', label: 'Payment', icon: '💳' },
            { id: 'reports', label: 'Reports', icon: '📑' },
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
      <div className="dashboard-content" style={{ marginLeft: '240px', flex: 1, background: '#f5f6fa', minHeight: '100vh' }}>
        <div style={{ background: 'white', padding: '16px 24px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: '#0d1b4b' }}>
            {activePage === 'dashboard' && 'Dashboard'}
            {activePage === 'prs' && 'Purchase Request'}
            {activePage === 'orders' && 'Purchase Orders Catalog'}
            {activePage === 'suppliers' && 'Supplier Registry'}
            {activePage === 'payment' && 'Payment Portal'}
            {activePage === 'reports' && 'Reports Center'}
            {activePage === 'settings' && 'User Settings & Preferences'}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Notification Bell */}
            <div style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', width: '38px', height: '38px', borderRadius: '50%', border: '1px solid #e2e8f0', justifyContent: 'center', background: '#ffffff' }} onClick={() => setShowNotifications(!showNotifications)}>
              <span style={{ fontSize: '18px' }}>🔔</span>
              {(unreadCount + prUnreadCount) > 0 && (
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
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold', color: '#0d1b4b', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Purchase Request & Order Updates</span>
                    <span onClick={handleMarkAllNotificationsRead} style={{ fontSize: '11px', color: '#2563eb', cursor: 'pointer', fontWeight: '600' }}>Mark all as read</span>
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
                      const color = isApproved ? '#2e7d32' : isRejected ? '#c62828' : '#0d1b4b';
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

            {/* Date display next to notification icon */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569', fontWeight: '600', background: '#f8fafc', padding: '6px 14px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <Calendar size={15} style={{ color: '#2563eb' }} />
              <span>{formatFullDate(currentTime)}</span>
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
          {activePage === 'settings' || activePage === 'reports' ? null : activePage === 'suppliers' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
              {supplierStats.map((s, i) => (
                <div key={i} style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', borderTop: `4px solid ${s.color}` }}>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>{s.label}</div>
                </div>
              ))}
            </div>
          ) : activePage === 'payment' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
              {paymentStats.map((s, i) => (
                <div key={i} style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', borderTop: `4px solid ${s.color}` }}>
                  <div style={{ fontSize: typeof s.value === 'string' && s.value.length > 10 ? '16px' : '24px', fontWeight: '700', color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>{s.label}</div>
                </div>
              ))}
            </div>
          ) : (
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
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500', color: '#1e293b' }}>{typeof po.supplier === 'object' ? (po.supplier?.name || po.supplier?.supplierId || '—') : (po.supplier || '—')}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{po.totalAmount?.toLocaleString()}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666' }}>{formatDate(po.createdAt)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          background: po.status === 'Delivered' ? '#e8f5e9' : po.status === 'Sent' ? '#e3f2fd' : '#dbeafe',
                          color: po.status === 'Delivered' ? '#2e7d32' : po.status === 'Sent' ? '#1565c0' : '#0d1b4b',
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
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500', color: '#1e293b' }}>{pr.projectName || (typeof pr.project === 'object' ? (pr.project?.projectName || pr.project?.name) : pr.project) || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#555' }}>
                        <MaterialsViewButton
                          items={pr.materials}
                          title={pr.prNumber || `PR-2026-${String(i+1).padStart(3,'0')}`}
                          subtitle={pr.projectName || (typeof pr.project === 'object' ? (pr.project?.projectName || pr.project?.name) : pr.project) || ''}
                          defaultUnit="bags"
                        />
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
                  {prPagination.paginatedData.map((pr, i) => (
                    <tr key={pr._id || i} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1565c0', fontWeight: '600' }}>{pr.prNumber || `PR-2026-${String(i+1).padStart(3,'0')}`}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500', color: '#1e293b' }}>{pr.projectName || (typeof pr.project === 'object' ? (pr.project?.projectName || pr.project?.name) : pr.project) || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#555' }}>
                        <MaterialsViewButton
                          items={pr.materials}
                          title={pr.prNumber || `PR-2026-${String(i+1).padStart(3,'0')}`}
                          subtitle={pr.projectName || (typeof pr.project === 'object' ? (pr.project?.projectName || pr.project?.name) : pr.project) || ''}
                          defaultUnit="bags"
                        />
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
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={() => handleConvertToPO(pr)}
                                style={{ background: '#2563eb', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                                Convert to PO
                              </button>
                              <button onClick={async () => {
                                const reason = window.prompt(`Enter reason for declining Purchase Request for ${pr.projectName || (typeof pr.project === 'object' ? (pr.project?.projectName || pr.project?.name) : pr.project) || '—'}:`);
                                if (reason === null) return;
                                try {
                                  const res = await fetch(`${API_BASE}/api/purchase-requests/${pr._id}/status`, {
                                    method: 'PUT',
                                    headers: getHeaders(),
                                    body: JSON.stringify({ status: 'Declined', reason })
                                  });
                                  const data = await res.json();
                                  if (data.success) {
                                    setMessage(`✅ Purchase Request declined.`);
                                    fetchData();
                                  } else {
                                    setError(data.message || 'Failed to decline Purchase Request.');
                                  }
                                } catch (err) {
                                  setError('Failed to decline Purchase Request.');
                                }
                              }}
                                style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                                Decline
                              </button>
                            </div>
                          )}
                          {pr.status === 'Declined' && (
                            <span style={{ fontSize: '11px', color: '#ef4444', fontStyle: 'italic', fontWeight: 'bold' }}>Declined ({pr.declineReason || 'No reason'})</span>
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
              <Pagination pagination={prPagination} />
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
                  style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', boxShadow: '0 2px 6px rgba(37, 99, 235,0.3)', whiteSpace: 'nowrap' }}>
                  {showForm ? 'Hide Form' : '+ Create PO'}
                </button>
              </div>

              {/* Create PO Form */}
              {showForm && (
                <div id="po-form-section" style={{ background: 'white', borderRadius: '10px', padding: '28px', marginBottom: '24px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: '0 0 4px', color: '#0d1b4b', fontSize: '18px' }}>Create New Purchase Order</h3>
                  <p style={{ margin: '0 0 20px', color: '#94a3b8', fontSize: '12px' }}>Fields marked * are required</p>
                  <form onSubmit={handlePOSubmit}>

                    {/* Order Details */}
                    <div style={{ paddingBottom: '20px', marginBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
                      <h4 style={poSectionHeaderStyle}>Order Details</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                          <label style={poLabelStyle}>SELECT PURCHASE REQUEST (PR)</label>
                          <select value={form.prId} onChange={e => handlePrSelectChange(e.target.value)}
                            className="po-field" style={poFieldStyle}>
                            <option value="">-- Create PO without PR (Manual) --</option>
                            {pendingPRs.map(pr => (
                              <option key={pr._id} value={pr._id}>{pr.projectName || pr.project} (Pending PR)</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={poLabelStyle}>SELECT SUPPLIER *</label>
                          <select value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} required
                            className="po-field" style={poFieldStyle}>
                            <option value="">-- Select Supplier --</option>
                            {suppliers.filter(s => s.status === 'Active').map(s => (
                              <option key={s._id} value={s.name}>{s.name} ({s.category})</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Order Items */}
                    <div style={{ paddingBottom: '20px', marginBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
                      <h4 style={poSectionHeaderStyle}>Order Items Specification</h4>

                      <div style={{ display: 'grid', gridTemplateColumns: form.prId ? '36px ' + poItemGridCols : poItemGridCols, gap: '8px', padding: '0 2px 8px', fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.02em', alignItems: 'center' }}>
                        {form.prId && <span style={{ textAlign: 'center' }}>Select</span>}
                        <span>Item</span>
                        <span>Qty</span>
                        <span>Unit</span>
                        <span style={{ textAlign: 'right' }}>Unit Price</span>
                        <span style={{ textAlign: 'right' }}>Line Total</span>
                        <span />
                      </div>

                      {form.items.map((item, index) => {
                        const isSelected = item.selected !== false;
                        const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0);
                        return (
                          <div key={index} style={{ display: 'grid', gridTemplateColumns: form.prId ? '36px ' + poItemGridCols : poItemGridCols, gap: '8px', marginBottom: '8px', alignItems: 'center', opacity: isSelected ? 1 : 0.45 }}>
                            {form.prId && (
                              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={e => updateItem(index, 'selected', e.target.checked)}
                                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#2563eb' }}
                                  title="Include item in PO"
                                />
                              </div>
                            )}
                            <input placeholder="Material Name" value={item.materialName}
                              disabled={!isSelected}
                              onChange={e => updateItem(index, 'materialName', e.target.value)} required={isSelected}
                              className="po-field" style={poFieldStyle} />
                            <input type="number" placeholder="Qty" value={item.quantity} min="0"
                              disabled={!isSelected}
                              onChange={e => updateItem(index, 'quantity', e.target.value)} required={isSelected}
                              className="po-field" style={{ ...poFieldStyle, textAlign: 'right' }} />
                            <select value={item.unit} onChange={e => updateItem(index, 'unit', e.target.value)}
                              disabled={!isSelected}
                              className="po-field" style={poFieldStyle}>
                              {!['kg', 'ton', 'bag', 'bags', 'm3', 'litre', 'piece'].includes(item.unit) && item.unit && (
                                <option value={item.unit}>{item.unit}</option>
                              )}
                              {['kg', 'ton', 'bag', 'bags', 'm3', 'litre', 'piece'].map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                            <input type="number" placeholder="0.00" value={item.unitPrice} min="0"
                              disabled={!isSelected}
                              onChange={e => updateItem(index, 'unitPrice', e.target.value)} required={isSelected}
                              className="po-field" style={{ ...poFieldStyle, textAlign: 'right' }} />
                            <div style={{ textAlign: 'right', fontSize: '13px', fontWeight: '600', color: isSelected ? '#334155' : '#94a3b8', padding: '10px 4px' }}>
                              {lineTotal.toLocaleString()}
                            </div>
                            {form.items.length > 1 ? (
                              <button type="button" onClick={() => removeItem(index)} title="Remove item" className="po-remove-btn">✕</button>
                            ) : <span />}
                          </div>
                        );
                      })}

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                        <div style={{ background: '#f0f7ff', border: '1px solid #dbeafe', borderRadius: '8px', padding: '12px 20px', display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                          <span style={{ fontSize: '13px', color: '#475569', fontWeight: '600' }}>Total PO Amount</span>
                          <span style={{ fontSize: '20px', fontWeight: '700', color: '#0d1b4b' }}>LKR {calcTotal().toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Delivery & Terms */}
                    <div style={{ paddingBottom: '20px', marginBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
                      <h4 style={poSectionHeaderStyle}>Delivery &amp; Terms</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                        <div>
                          <label style={poLabelStyle}>EXPECTED DELIVERY DATE *</label>
                          <DateInput value={form.expectedDeliveryDate || ''} onChange={iso => setForm({ ...form, expectedDeliveryDate: iso })} required
                            style={poFieldStyle} />
                        </div>
                        <div>
                          <label style={poLabelStyle}>PAYMENT TERMS *</label>
                          <select value={form.paymentTerms || ''} onChange={e => setForm({ ...form, paymentTerms: e.target.value })} required
                            className="po-field" style={poFieldStyle}>
                            <option value="30 Days Credit">30 Days Credit</option>
                            <option value="Cash on Delivery">Cash on Delivery</option>
                            <option value="50% Advance">50% Advance</option>
                            <option value="Full Payment">Full Payment</option>
                          </select>
                        </div>
                        <div>
                          <label style={poLabelStyle}>DELIVERY ADDRESS *</label>
                          <input placeholder="Enter delivery address..." value={form.deliveryAddress || ''} onChange={e => setForm({ ...form, deliveryAddress: e.target.value })} required
                            className="po-field" style={poFieldStyle} />
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    <div style={{ marginBottom: '20px' }}>
                      <label style={poLabelStyle}>NOTES</label>
                      <input placeholder="Enter terms, remarks or delivery location..." value={form.notes}
                        onChange={e => setForm({ ...form, notes: e.target.value })}
                        className="po-field" style={poFieldStyle} />
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <LoadingButton
                        type="submit"
                        loading={poSubmitting}
                        loadingText="Creating PO..."
                        style={{ background: '#2563eb', color: 'white', border: 'none', padding: '12px 28px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', boxShadow: '0 2px 6px rgba(37, 99, 235,0.3)' }}
                      >
                        Submit Purchase Order
                      </LoadingButton>
                      <button type="button" onClick={() => setShowForm(false)}
                        style={{ background: 'white', color: '#475569', border: '1px solid #cbd5e1', padding: '12px 28px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Purchase Orders Table */}
              <div id="po-list-section" style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#0d1b4b', color: 'white' }}>
                      {['PO No.', 'Supplier', 'Order Items Description', 'Total (LKR)', 'Expected Delivery', 'Payment Terms', 'Created Date', 'Status', 'Payment', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      if (poPagination.paginatedData.length === 0) {
                        return (
                          <tr>
                            <td colSpan="10" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>No purchase orders match your search criteria.</td>
                          </tr>
                        );
                      }
                      return poPagination.paginatedData.map((po, i) => (
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
                                  const res = await fetch(`${API_BASE}/api/purchase-orders/${po._id}/supplier`, {
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
                                    const data = await res.json().catch(() => ({}));
                                    setError(data.message || 'Failed to assign supplier.');
                                  }
                                } catch (err) {
                                  setError(err.message || 'Failed to assign supplier.');
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
                            <span style={{ fontWeight: '500' }}>{typeof po.supplier === 'object' ? (po.supplier?.name || po.supplier?.supplierId || '—') : (po.supplier || '—')}</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#555' }}>
                          <MaterialsViewButton
                            items={po.items}
                            title={po.poNumber || 'Purchase Order Items'}
                            subtitle={typeof po.supplier === 'object' ? (po.supplier?.name || '') : (po.supplier || '')}
                            showPrice
                          />
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
                          {(() => {
                            const pay = getPoPaymentState(po);
                            return (
                              <span
                                onClick={pay.ready ? () => setActivePage('payment') : undefined}
                                title={pay.ready ? 'Go to Payment Portal to pay this invoice' : undefined}
                                style={{
                                  background: pay.bg, color: pay.color,
                                  padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold',
                                  display: 'inline-block', cursor: pay.ready ? 'pointer' : 'default'
                                }}>
                                {pay.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '6px', flexDirection: 'column', width: '130px' }}>
                            {po.status === 'Pending' && (
                              <span style={{ fontSize: '11px', color: '#b45309', fontWeight: '600' }}>Awaiting Director approval</span>
                            )}
                            {/* A PO only stays Approved when the automatic supplier email on approval failed */}
                            {po.status === 'Approved' && (
                              <>
                                <span style={{ fontSize: '11px', color: '#b45309', fontWeight: '600' }}>Supplier email not sent</span>
                                <button onClick={() => handleSendToSupplier(po._id, po.poNumber, po.supplier)}
                                  style={{ background: '#2563eb', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                                  Resend Email
                                </button>
                              </>
                            )}
                            {po.status === 'Sent' && (
                              <span style={{ fontSize: '11px', color: '#1565c0', fontWeight: '600' }}>Awaiting delivery (GRN)</span>
                            )}
                            {['Pending', 'Approved', 'Sent'].includes(po.status) && (
                              <button onClick={() => { if (window.confirm(`Cancel ${po.poNumber}? This cannot be undone.`)) handleUpdateStatus(po._id, 'Cancelled'); }}
                                style={{ background: 'white', color: '#c62828', border: '1px solid #c62828', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                                Cancel PO
                              </button>
                            )}
                            {po.status === 'Delivered' && (
                              <button onClick={() => handleUpdateStatus(po._id, 'Closed')}
                                style={{ background: '#0d1b4b', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                                Close PO
                              </button>
                            )}
                            {['Rejected', 'Closed', 'Cancelled'].includes(po.status) && (
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                      ));
                    })()}
                  </tbody>
                </table>
                <Pagination pagination={poPagination} />
              </div>
            </div>
          )}

          {activePage === 'suppliers' && (
            <div>
              {/* Add Supplier Form */}
              {showSupplierForm && (
                <div id="supplier-form-section" style={{ background: 'white', borderRadius: '8px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', border: '1px solid #2563eb' }}>
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
                      <LoadingButton
                        type="submit"
                        loading={supplierSubmitting}
                        loadingText="Saving Supplier..."
                        style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                      >
                        Save Supplier
                      </LoadingButton>
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

              <div id="suppliers-list-section" style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#0d1b4b', color: 'white' }}>
                      {['Supplier Code', 'Company Name', 'Contact Person', 'Phone Number', 'Email', 'Address', 'Registration Date', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {supplierPagination.paginatedData.map((s, i) => (
                      <tr key={s._id || i} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                        {editingSupplierId === s._id ? (
                          // Editing Row
                          <>
                            <td style={{ padding: '10px 16px', fontSize: '13px', color: '#666' }}>{s.supplierId}</td>
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
                              <input value={editSupForm.address} onChange={e => setEditSupForm({ ...editSupForm, address: e.target.value })} style={{ padding: '6px', width: '90%', borderRadius: '4px', border: '1px solid #ccc' }} />
                            </td>
                            <td style={{ padding: '10px 16px', fontSize: '13px', color: '#666' }}>{s.createdAt ? formatDate(s.createdAt) : '-'}</td>
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
                            <td style={{ padding: '14px 16px', fontSize: '13px', color: '#666' }}>{s.supplierId}</td>
                            <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '500', color: '#1565c0', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setViewingSupplierId(s._id)}>{s.name}</td>
                            <td style={{ padding: '14px 16px', fontSize: '13px' }}>{s.contactPerson || '-'}</td>
                            <td style={{ padding: '14px 16px', fontSize: '13px' }}>{s.phone}</td>
                            <td style={{ padding: '14px 16px', fontSize: '13px', color: '#666' }}>{s.email || '-'}</td>
                            <td style={{ padding: '14px 16px', fontSize: '13px', color: '#666' }}>{s.address || '-'}</td>
                            <td style={{ padding: '14px 16px', fontSize: '13px', color: '#666' }}>{s.createdAt ? formatDate(s.createdAt) : '-'}</td>
                            <td style={{ padding: '14px 16px' }}>
                              <span style={{
                                background: s.status === 'Active' ? '#e8f5e9' : '#ffebee',
                                color: s.status === 'Active' ? '#2e7d32' : '#c62828',
                                padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600'
                              }}>{s.status}</span>
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <button onClick={() => setViewingSupplierId(s._id)}
                                style={{ background: '#0d1b4b', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '6px' }}>
                                View
                              </button>
                              {user?.role === 'Admin' && (
                                <>
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
                                </>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination pagination={supplierPagination} />
              </div>
            </div>
          )}

          {activePage === 'payment' && (
            <div id="payment-portal-section">
              <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', background: '#0d1b4b' }}>
                  <h3 style={{ margin: 0, color: 'white', fontSize: '15px' }}>💳 Supplier Invoice & Payment Status</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#0d1b4b', color: 'white' }}>
                      {['Invoice No', 'PO Number', 'GRN No', 'Supplier', 'Amount (LKR)', 'Invoice Date', 'Due Date', 'Status', 'Document', 'Paid Date', 'Payment Method/Ref', 'Action'].map(h => (
                        <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoicesPagination.paginatedData.map((inv, i) => {
                      const status = inv.status;
                      const isOverdue = status !== 'Paid' && inv.dueDate && new Date(inv.dueDate) < now;

                      let statusBg = '#f5f5f5';
                      let statusColor = '#666';
                      let displayStatus = status;

                      if (isOverdue) {
                        statusBg = '#fee2e2';
                        statusColor = '#991b1b';
                        displayStatus = 'Overdue';
                      } else if (status === 'Paid') {
                        statusBg = '#dcfce7';
                        statusColor = '#15803d';
                      } else if (status === 'Approved') {
                        statusBg = '#fef3c7';
                        statusColor = '#b45309';
                      } else if (status === 'Pending Approval') {
                        statusBg = '#dbeafe';
                        statusColor = '#1d4ed8';
                      } else if (status === 'Rejected') {
                        statusBg = '#ffebee';
                        statusColor = '#c62828';
                      }

                      let payMethodDisplay = '-';
                      if (status === 'Paid' && inv.paymentMethod) {
                        payMethodDisplay = inv.paymentMethod + (inv.stripeSessionId ? ` (..${inv.stripeSessionId.slice(-6)})` : '');
                      } else if (status === 'Paid') {
                        payMethodDisplay = 'Stripe';
                      }

                      return (
                        <tr key={inv._id || i} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '500', color: '#0d1b4b' }}>{inv.invoiceNumber}</td>
                          <td style={{ padding: '14px 16px', fontSize: '13px', color: '#1565c0', fontWeight: '600' }}>{inv.po?.poNumber || '-'}</td>
                          <td style={{ padding: '14px 16px', fontSize: '13px', color: '#5e35b1', fontWeight: '600' }}>{inv.grn?.grnNumber || '-'}</td>
                          <td style={{ padding: '14px 16px', fontSize: '13px' }}>{inv.supplier?.name || '-'}</td>
                          <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '600' }}>{Number(inv.amount).toLocaleString()}</td>
                          <td style={{ padding: '14px 16px', fontSize: '12px', color: '#666' }}>{formatDate(inv.invoiceDate)}</td>
                          <td style={{ padding: '14px 16px', fontSize: '12px', color: isOverdue ? '#991b1b' : '#666', fontWeight: isOverdue ? '600' : 'normal' }}>
                            {inv.dueDate ? formatDate(inv.dueDate) : '-'}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{
                              background: statusBg,
                              color: statusColor,
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}>{displayStatus}</span>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            {inv.file?.url ? (
                              inv.fileExists === false ? (
                                <span style={{ color: '#d97706', fontSize: '11px', fontWeight: 'bold' }} title="Invoice file is missing on disk. Ask Store Officer to re-upload.">
                                  ⚠️ File missing
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openUploadedFile(inv.file.url, { fileType: 'invoice', toast })}
                                  style={{ background: '#0d1b4b', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                  👁 View
                                </button>
                              )
                            ) : (
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>No file</span>
                            )}
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '12px', color: '#666' }}>
                            {inv.paidAt ? formatDate(inv.paidAt) : '-'}
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '12px', color: '#475569', fontWeight: '500' }}>
                            {payMethodDisplay}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            {status === 'Paid' ? (
                              <button
                                onClick={() => handleDownloadReceipt(inv)}
                                style={{ background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >
                                🧾 Receipt
                              </button>
                            ) : status === 'Approved' ? (
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => openManualPay(inv)}
                                style={{ background: '#0d1b4b', color: 'white', border: 'none', borderRadius: '6px', padding: '7px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >
                                💵 Cash / Cheque
                              </button>
                              <button
                                onClick={() => handlePayInvoice(inv)}
                                disabled={payingInvoiceId === inv._id}
                                style={{
                                  background: payingInvoiceId === inv._id ? '#9fa8da' : '#635bff',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '7px 14px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  cursor: payingInvoiceId === inv._id ? 'not-allowed' : 'pointer'
                                }}
                              >
                                {payingInvoiceId === inv._id ? 'Redirecting…' : '💳 Stripe'}
                              </button>
                              </div>
                            ) : (
                              <span style={{ color: '#bbb', fontSize: '12px' }}>-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {invoices.length === 0 && (
                      <tr>
                        <td colSpan={11} style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#999' }}>
                          No invoices recorded yet. Invoices are submitted by Main Store when goods are received against a PO.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <Pagination pagination={invoicesPagination} />
              </div>
            </div>
          )}

          {activePage === 'reports' && <ReportsCenter tabs={['procurement', 'payment', 'inventory']} />}

          {activePage === 'settings' && <SettingsPage user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />}

          {/* Footer */}
          <div style={{ textAlign: 'center', padding: '20px 0 8px', marginTop: '16px', fontSize: '12px', color: '#94a3b8' }}>
            ELS Construction Material Management System &copy;2026
          </div>
        </div>
      </div>

      {renderPOStatsModal()}

      {manualPayInvoice && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <form onSubmit={handleRecordPayment} style={{ background: 'white', borderRadius: '12px', width: '460px', maxWidth: '92vw', padding: '26px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', borderTop: '6px solid #0d1b4b', textAlign: 'left', color: '#0f172a' }}>
            <h3 style={{ margin: '0 0 4px', color: '#0d1b4b', fontSize: '17px' }}>Record Payment</h3>
            <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '13px' }}>
              Invoice <strong>{manualPayInvoice.invoiceNumber}</strong> · {manualPayInvoice.supplier?.name || 'Supplier'} · PO {manualPayInvoice.po?.poNumber || '-'}
            </p>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px', fontSize: '13px' }}>
              Amount to pay: <strong style={{ fontSize: '16px', color: '#0d1b4b' }}>LKR {Number(manualPayInvoice.amount).toLocaleString()}</strong>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Approved by {manualPayInvoice.approvedBy || 'Director'}</div>
            </div>

            {manualPayError && <div style={{ background: '#ffebee', border: '1px solid #ef5350', color: '#c62828', padding: '8px 12px', borderRadius: '6px', marginBottom: '12px', fontSize: '13px' }}>{manualPayError}</div>}

            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Payment Method *</label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
              {['Cash', 'Cheque'].map(mth => (
                <button
                  type="button"
                  key={mth}
                  onClick={() => setManualPayForm({ ...manualPayForm, method: mth })}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', border: manualPayForm.method === mth ? '2px solid #ff9800' : '1px solid #cbd5e1', background: manualPayForm.method === mth ? '#fff7ed' : 'white', color: '#0d1b4b' }}
                >
                  {mth === 'Cash' ? '💵 Cash' : '🏦 Cheque'}
                </button>
              ))}
            </div>

            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
              {manualPayForm.method === 'Cheque' ? 'Cheque Number *' : 'Voucher / Receipt No.'}
            </label>
            <input
              type="text"
              value={manualPayForm.reference}
              onChange={e => {
                setManualPayForm({ ...manualPayForm, reference: e.target.value });
                if (manualPayFieldErrors.reference) setManualPayFieldErrors({ ...manualPayFieldErrors, reference: null });
              }}
              placeholder={manualPayForm.method === 'Cheque' ? 'e.g. 004512' : 'Optional (e.g. VCH-001)'}
              style={{ width: '100%', padding: '9px 12px', border: `1px solid ${manualPayFieldErrors.reference ? '#ef4444' : '#cbd5e1'}`, borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
            />
            {manualPayFieldErrors.reference && (
              <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px', marginBottom: '10px', display: 'block', fontWeight: '600' }}>
                {manualPayFieldErrors.reference}
              </span>
            )}

            {manualPayForm.method === 'Cheque' && (
              <>
                <div style={{ marginTop: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Bank Name *</label>
                  <input
                    type="text"
                    value={manualPayForm.bankName}
                    onChange={e => {
                      setManualPayForm({ ...manualPayForm, bankName: e.target.value });
                      if (manualPayFieldErrors.bankName) setManualPayFieldErrors({ ...manualPayFieldErrors, bankName: null });
                    }}
                    placeholder="e.g. Commercial Bank"
                    style={{ width: '100%', padding: '9px 12px', border: `1px solid ${manualPayFieldErrors.bankName ? '#ef4444' : '#cbd5e1'}`, borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                  {manualPayFieldErrors.bankName && (
                    <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px', display: 'block', fontWeight: '600' }}>
                      {manualPayFieldErrors.bankName}
                    </span>
                  )}
                </div>

                <div style={{ marginTop: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                    Cheque Date * <span style={{ fontWeight: 'normal', color: '#64748b' }}>(Post-dated cheques allowed)</span>
                  </label>
                  <input
                    type="date"
                    value={manualPayForm.chequeDate}
                    onChange={e => {
                      setManualPayForm({ ...manualPayForm, chequeDate: e.target.value });
                      if (manualPayFieldErrors.chequeDate) setManualPayFieldErrors({ ...manualPayFieldErrors, chequeDate: null });
                    }}
                    style={{ width: '100%', padding: '9px 12px', border: `1px solid ${manualPayFieldErrors.chequeDate ? '#ef4444' : '#cbd5e1'}`, borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                  {manualPayFieldErrors.chequeDate && (
                    <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px', display: 'block', fontWeight: '600' }}>
                      {manualPayFieldErrors.chequeDate}
                    </span>
                  )}
                </div>
              </>
            )}

            <div style={{ marginTop: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Payment Date *</label>
              <input
                type="date"
                value={manualPayForm.paidAt}
                max={new Date().toISOString().substring(0, 10)}
                onChange={e => {
                  setManualPayForm({ ...manualPayForm, paidAt: e.target.value });
                  if (manualPayFieldErrors.paidAt) setManualPayFieldErrors({ ...manualPayFieldErrors, paidAt: null });
                }}
                required
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${manualPayFieldErrors.paidAt ? '#ef4444' : '#cbd5e1'}`, borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
              />
              {manualPayFieldErrors.paidAt && (
                <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px', display: 'block', fontWeight: '600' }}>
                  {manualPayFieldErrors.paidAt}
                </span>
              )}
            </div>

            <div style={{ marginTop: '12px', marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                Notes <span style={{ fontWeight: 'normal', color: '#64748b' }}>(Max 500 characters)</span>
              </label>
              <textarea
                value={manualPayForm.notes}
                maxLength={500}
                onChange={e => {
                  setManualPayForm({ ...manualPayForm, notes: e.target.value });
                  if (manualPayFieldErrors.notes) setManualPayFieldErrors({ ...manualPayFieldErrors, notes: null });
                }}
                placeholder="Optional payment reference or transaction notes..."
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${manualPayFieldErrors.notes ? '#ef4444' : '#cbd5e1'}`, borderRadius: '6px', fontSize: '13px', height: '60px', boxSizing: 'border-box' }}
              />
              {manualPayFieldErrors.notes && (
                <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px', display: 'block', fontWeight: '600' }}>
                  {manualPayFieldErrors.notes}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setManualPayInvoice(null)} disabled={recordingPayment} style={{ background: '#f1f5f9', color: '#0d1b4b', border: '1px solid #cbd5e1', padding: '9px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
                Cancel
              </button>
              <LoadingButton type="submit" loading={recordingPayment} loadingText="Recording Payment..." style={{ background: '#2e7d32', color: 'white', border: 'none', padding: '9px 18px', borderRadius: '6px', fontWeight: '700', fontSize: '13px' }}>
                Record Payment
              </LoadingButton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrderPage;