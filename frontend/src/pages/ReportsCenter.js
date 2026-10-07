import React, { useState, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { formatDate, formatDateTime } from '../utils/dateUtils';
import { API_BASE } from '../config';
import { useToast } from '../context/ToastContext';
import { getAuthHeaders, fetchWithAuth } from '../utils/authUtils';

const num = (v) => Number(v) || 0;
const money = (v) => num(v).toLocaleString(undefined, { maximumFractionDigits: 2 });

const stockStatus = (m) => {
  const reorder = m.reorderLevel ?? m.minimumStock;
  if (num(m.quantity) <= num(m.minimumStock)) return 'Critical';
  if (num(m.quantity) <= num(reorder)) return 'Reorder';
  return 'Normal';
};

// Every report is described the same way - a title, the columns to show and
// export, the rows, and a few headline figures - so the table, the PDF and the
// Excel export always carry exactly the same data.
const REPORT_TABS = [
  { id: 'inventory', label: 'Inventory / Stock', icon: '📦' },
  { id: 'procurement', label: 'Procurement', icon: '🧾' },
  { id: 'usage', label: 'Material Usage', icon: '🔧' },
  { id: 'bom', label: 'BOM vs Actual', icon: '📐' },
  { id: 'payment', label: 'Payment', icon: '💳' }
];

const SUB_VIEWS = {
  inventory: [
    { id: 'levels', label: 'Stock Levels' },
    { id: 'ledger', label: 'Stock Movements (Ledger)' }
  ],
  procurement: [
    { id: 'pos', label: 'Purchase Orders' },
    { id: 'prs', label: 'Purchase Requests' }
  ]
};

const badgeColors = {
  Critical: ['#ffebee', '#c62828'], Reorder: ['#fff3e0', '#b7791f'], Normal: ['#e8f5e9', '#2e7d32'],
  Overused: ['#ffebee', '#c62828'], Unplanned: ['#ffebee', '#c62828'], 'Within Plan': ['#e8f5e9', '#2e7d32'],
  'On Plan': ['#e8f5e9', '#2e7d32'], 'Not Started': ['#f1f5f9', '#475569'],
  Paid: ['#dcfce7', '#15803d'], Approved: ['#fef3c7', '#b45309'], 'Pending Approval': ['#dbeafe', '#1d4ed8'],
  Rejected: ['#ffebee', '#c62828'], Pending: ['#fff3e0', '#b7791f'], Sent: ['#e3f2fd', '#1565c0'],
  Delivered: ['#e8f5e9', '#2e7d32'], 'PO Created': ['#e8f5e9', '#2e7d32'], Declined: ['#ffebee', '#c62828'],
  Cancelled: ['#f1f5f9', '#475569'], Closed: ['#f1f5f9', '#475569'], Draft: ['#f1f5f9', '#475569']
};

function ReportsCenter({ tabs }) {
  const toast = useToast();
  const visibleTabs = REPORT_TABS.filter(t => !tabs || tabs.includes(t.id));
  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.id || 'inventory');
  const [subView, setSubView] = useState({ inventory: 'levels', procurement: 'pos' });
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [project, setProject] = useState('All');
  const [status, setStatus] = useState('All');
  const [location, setLocation] = useState('All');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const getHeaders = () => getAuthHeaders();

  // Fetches one endpoint and unwraps the list, tolerating both the
  // { success, data } envelope and bare-array responses used across the API.
  const getList = async (path, key = 'data') => {
    const res = await fetchWithAuth(path);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || `Failed to load ${path}`);
    if (Array.isArray(body)) return body;
    return Array.isArray(body[key]) ? body[key] : [];
  };

  const loadTab = async (tab) => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'inventory') {
        const [materials, ledger] = await Promise.all([
          getList('/api/inventory'),
          getList('/api/inventory/stock-ledger')
        ]);
        setData(prev => ({ ...prev, materials, ledger }));
      } else if (tab === 'procurement') {
        const [pos, prs] = await Promise.all([
          getList('/api/purchase-orders'),
          getList('/api/purchase-requests')
        ]);
        setData(prev => ({ ...prev, pos, prs }));
      } else if (tab === 'usage') {
        const usage = await getList('/api/material-usage');
        setData(prev => ({ ...prev, usage }));
      } else if (tab === 'bom') {
        const variance = await getList('/api/material-usage/variance', 'report');
        setData(prev => ({ ...prev, variance }));
      } else if (tab === 'payment') {
        const invoices = await getList('/api/invoices');
        // Payment records carry the cheque / voucher reference; roles that
        // cannot read them still get the invoice-level report.
        let payments = [];
        try {
          payments = await getList('/api/payments');
        } catch (e) {
          payments = [];
        }
        setData(prev => ({ ...prev, invoices, payments }));
      }
    } catch (err) {
      setError(err.message || 'Could not load report data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSearch(''); setProject('All'); setStatus('All'); setLocation('All'); setFrom(''); setTo('');
    loadTab(activeTab);
  }, [activeTab]);

  const inRange = (dateValue) => {
    if (!from && !to) return true;
    if (!dateValue) return false;
    const d = new Date(dateValue);
    if (from && d < new Date(from)) return false;
    if (to && d > new Date(`${to}T23:59:59`)) return false;
    return true;
  };
  const matches = (...fields) => {
    const q = search.trim().toLowerCase();
    return !q || fields.some(f => String(f ?? '').toLowerCase().includes(q));
  };

  const report = useMemo(() => {
    const view = subView[activeTab];

    if (activeTab === 'inventory' && view === 'levels') {
      const rows = (data.materials || [])
        .filter(m => (location === 'All' || m.location === location))
        .filter(m => (status === 'All' || stockStatus(m) === status))
        .filter(m => matches(m.name, m.materialCode, m.category))
        .map(m => ({ ...m, _status: stockStatus(m), _value: num(m.quantity) * num(m.unitPrice) }));
      return {
        title: 'Inventory / Stock Report',
        filters: { location: ['MainStore', 'SiteStore'], status: ['Normal', 'Reorder', 'Critical'] },
        columns: [
          { label: 'Code', get: r => r.materialCode || '-' },
          { label: 'Material', get: r => r.name },
          { label: 'Category', get: r => r.category },
          { label: 'Location', get: r => (r.location === 'SiteStore' ? 'Site Store' : 'Main Store') },
          { label: 'Qty', get: r => num(r.quantity), numeric: true },
          { label: 'Unit', get: r => r.unit },
          { label: 'Min', get: r => num(r.minimumStock), numeric: true },
          { label: 'Reorder', get: r => num(r.reorderLevel), numeric: true },
          { label: 'Unit Price', get: r => money(r.unitPrice), numeric: true },
          { label: 'Value (LKR)', get: r => money(r._value), numeric: true },
          { label: 'Status', get: r => r._status, badge: true }
        ],
        rows,
        summary: [
          { label: 'Materials', value: rows.length },
          { label: 'Stock Value (LKR)', value: money(rows.reduce((s, r) => s + r._value, 0)) },
          { label: 'At Reorder Level', value: rows.filter(r => r._status === 'Reorder').length, warn: true },
          { label: 'Critical / Low Stock', value: rows.filter(r => r._status === 'Critical').length, danger: true }
        ]
      };
    }

    if (activeTab === 'inventory') {
      const rows = (data.ledger || [])
        .filter(e => inRange(e.date))
        .filter(e => (status === 'All' || e.type === status))
        .filter(e => matches(e.materialName, e.reference, e.performedBy));
      return {
        title: 'Stock Movement Ledger',
        dated: true,
        filters: { status: ['GRN Receipt', 'MTN Transfer Out', 'MTN Transfer In', 'MIN Issue', 'MIN Receipt', 'Usage', 'Adjustment'] },
        statusLabel: 'Movement',
        columns: [
          { label: 'Date', get: r => formatDateTime(r.date) },
          { label: 'Material', get: r => r.materialName },
          { label: 'Movement', get: r => r.type },
          { label: 'Reference', get: r => r.reference || '-' },
          { label: 'In', get: r => r.inQty || '', numeric: true },
          { label: 'Out', get: r => r.outQty || '', numeric: true },
          { label: 'Balance', get: r => r.balance, numeric: true },
          { label: 'Unit', get: r => r.unit },
          { label: 'By', get: r => r.performedBy || '-' },
          { label: 'Remarks', get: r => r.remarks || '' }
        ],
        rows,
        summary: [
          { label: 'Movements', value: rows.length },
          { label: 'Total In', value: money(rows.reduce((s, r) => s + num(r.inQty), 0)) },
          { label: 'Total Out', value: money(rows.reduce((s, r) => s + num(r.outQty), 0)) }
        ]
      };
    }

    if (activeTab === 'procurement' && view === 'pos') {
      const rows = (data.pos || [])
        .filter(p => inRange(p.createdAt))
        .filter(p => (status === 'All' || p.status === status))
        .filter(p => matches(p.poNumber, p.supplier, p.prId?.projectName));
      return {
        title: 'Procurement Report - Purchase Orders',
        dated: true,
        filters: { status: ['Pending', 'Approved', 'Rejected', 'Sent', 'Delivered', 'Closed', 'Cancelled'] },
        columns: [
          { label: 'PO No.', get: r => r.poNumber },
          { label: 'Date', get: r => formatDate(r.createdAt) },
          { label: 'Supplier', get: r => r.supplier || '-' },
          { label: 'Project', get: r => r.prId?.projectName || r.prId?.project || '-' },
          { label: 'Items', get: r => (r.items || []).map(i => `${i.materialName} (${i.quantity} ${i.unit})`).join('; ') },
          { label: 'Total (LKR)', get: r => money(r.totalAmount), numeric: true },
          { label: 'Expected Delivery', get: r => (r.expectedDeliveryDate ? formatDate(r.expectedDeliveryDate) : '-') },
          { label: 'Status', get: r => r.status, badge: true }
        ],
        rows,
        summary: [
          { label: 'Purchase Orders', value: rows.length },
          { label: 'Total Value (LKR)', value: money(rows.reduce((s, r) => s + num(r.totalAmount), 0)) },
          { label: 'Awaiting Approval', value: rows.filter(r => r.status === 'Pending').length, warn: true },
          { label: 'Delivered', value: rows.filter(r => r.status === 'Delivered').length }
        ]
      };
    }

    if (activeTab === 'procurement') {
      const rows = (data.prs || [])
        .filter(p => inRange(p.createdAt))
        .filter(p => (status === 'All' || p.status === status))
        .filter(p => matches(p.projectName, p.requestedBy, ...(p.materials || []).map(m => m.materialName)));
      return {
        title: 'Procurement Report - Purchase Requests',
        dated: true,
        filters: { status: ['Pending', 'PO Created', 'Declined'] },
        columns: [
          { label: 'Date', get: r => formatDate(r.createdAt) },
          { label: 'Project', get: r => r.projectName || r.project },
          { label: 'Requested By', get: r => r.requestedBy },
          { label: 'Materials', get: r => (r.materials || []).map(m => `${m.materialName} (${m.quantity} ${m.unit})`).join('; ') },
          { label: 'Est. Value (LKR)', get: r => money((r.materials || []).reduce((s, m) => s + num(m.quantity) * num(m.estimatedUnitCost), 0)), numeric: true },
          { label: 'Urgency', get: r => r.urgency || 'Normal' },
          { label: 'Status', get: r => r.status, badge: true }
        ],
        rows,
        summary: [
          { label: 'Purchase Requests', value: rows.length },
          { label: 'Pending', value: rows.filter(r => r.status === 'Pending').length, warn: true },
          { label: 'Converted to PO', value: rows.filter(r => r.status === 'PO Created').length },
          { label: 'Declined', value: rows.filter(r => r.status === 'Declined').length }
        ]
      };
    }

    if (activeTab === 'usage') {
      const all = data.usage || [];
      const rows = all
        .filter(u => inRange(u.usageDate))
        .filter(u => (project === 'All' || u.projectName === project))
        .filter(u => matches(u.materialName, u.minNumber, u.activity, u.recordedBy));
      return {
        title: 'Material Usage Report',
        dated: true,
        projects: Array.from(new Set(all.map(u => u.projectName))).filter(Boolean).sort(),
        columns: [
          { label: 'MIN No.', get: r => r.minNumber || '-' },
          { label: 'Date', get: r => formatDate(r.usageDate) },
          { label: 'Project', get: r => r.projectName },
          { label: 'Material', get: r => r.materialName },
          { label: 'Qty Used', get: r => num(r.actualQty), numeric: true },
          { label: 'Unit', get: r => r.unit },
          { label: 'Activity / Purpose', get: r => r.activity || '-' },
          { label: 'Recorded By', get: r => r.recordedBy }
        ],
        rows,
        summary: [
          { label: 'Usage Records', value: rows.length },
          { label: 'Projects', value: new Set(rows.map(r => r.projectName)).size },
          { label: 'Materials Used', value: new Set(rows.map(r => r.materialName)).size }
        ]
      };
    }

    if (activeTab === 'bom') {
      const all = data.variance || [];
      const rows = all
        .filter(v => (project === 'All' || v.projectName === project))
        .filter(v => (status === 'All' || (v.status || (v.varianceQty > 0 ? 'Overused' : 'Within Plan')) === status))
        .filter(v => matches(v.materialName, v.projectName));
      return {
        title: 'BOM vs Actual Report',
        projects: Array.from(new Set(all.map(v => v.projectName))).filter(Boolean).sort(),
        filters: { status: ['Overused', 'Unplanned', 'Within Plan', 'On Plan', 'Not Started'] },
        columns: [
          { label: 'Project', get: r => r.projectName },
          { label: 'Material', get: r => r.materialName },
          { label: 'Unit', get: r => r.unit },
          { label: 'Planned (BOM)', get: r => num(r.plannedQty), numeric: true },
          { label: 'Actual', get: r => num(r.actualQty), numeric: true },
          { label: 'Variance', get: r => `${r.varianceQty > 0 ? '+' : ''}${num(r.varianceQty)}`, numeric: true },
          { label: 'Variance %', get: r => `${r.variancePct > 0 ? '+' : ''}${num(r.variancePct)}%`, numeric: true },
          { label: 'Overuse Qty', get: r => num(r.wastageQty), numeric: true },
          { label: 'Overuse Cost (LKR)', get: r => money(r.wastageCost), numeric: true },
          { label: 'Status', get: r => r.status || (r.varianceQty > 0 ? 'Overused' : 'Within Plan'), badge: true }
        ],
        rows,
        summary: [
          { label: 'BOM Lines', value: rows.length },
          { label: 'Overused Lines', value: rows.filter(r => r.varianceQty > 0).length, danger: true },
          { label: 'Overuse Cost (LKR)', value: money(rows.reduce((s, r) => s + num(r.wastageCost), 0)), danger: true },
          { label: 'Within Plan', value: rows.filter(r => r.varianceQty <= 0).length }
        ]
      };
    }

    // payment
    const paymentByInvoice = {};
    (data.payments || []).forEach(p => {
      const id = p.invoice?._id || p.invoice;
      if (id) paymentByInvoice[id] = p;
    });
    const rows = (data.invoices || [])
      .filter(i => inRange(i.invoiceDate))
      .filter(i => (status === 'All' || i.status === status))
      .filter(i => matches(i.invoiceNumber, i.po?.poNumber, i.supplier?.name))
      .map(i => ({ ...i, _payment: paymentByInvoice[i._id] }));
    return {
      title: 'Payment Report',
      dated: true,
      filters: { status: ['Pending Approval', 'Approved', 'Paid', 'Rejected'] },
      columns: [
        { label: 'Invoice No.', get: r => r.invoiceNumber },
        { label: 'PO No.', get: r => r.po?.poNumber || '-' },
        { label: 'GRN No.', get: r => r.grn?.grnNumber || '-' },
        { label: 'Supplier', get: r => r.supplier?.name || '-' },
        { label: 'Amount (LKR)', get: r => money(r.amount), numeric: true },
        { label: 'Invoice Date', get: r => formatDate(r.invoiceDate) },
        { label: 'Due Date', get: r => (r.dueDate ? formatDate(r.dueDate) : '-') },
        { label: 'Approved By', get: r => r.approvedBy || '-' },
        { label: 'Status', get: r => r.status, badge: true },
        { label: 'Paid On', get: r => (r.paidAt ? formatDate(r.paidAt) : '-') },
        { label: 'Method', get: r => (r.status === 'Paid' ? (r.paymentMethod || 'Stripe') : '-') },
        { label: 'Reference', get: r => (r.status === 'Paid' ? (r._payment?.reference || (r.stripeSessionId ? `..${r.stripeSessionId.slice(-8)}` : '-')) : '-') }
      ],
      rows,
      summary: [
        { label: 'Invoices', value: rows.length },
        { label: 'Total Invoiced (LKR)', value: money(rows.reduce((s, r) => s + num(r.amount), 0)) },
        { label: 'Paid (LKR)', value: money(rows.filter(r => r.status === 'Paid').reduce((s, r) => s + num(r.amount), 0)) },
        { label: 'Outstanding (LKR)', value: money(rows.filter(r => ['Pending Approval', 'Approved'].includes(r.status)).reduce((s, r) => s + num(r.amount), 0)), warn: true }
      ]
    };
  }, [activeTab, subView, data, search, project, status, location, from, to]);

  const fileStem = `ELS_${report.title.replace(/[^A-Za-z]+/g, '_')}_${new Date().toISOString().split('T')[0]}`;
  const filterText = [
    project !== 'All' && `Project: ${project}`,
    location !== 'All' && `Location: ${location}`,
    status !== 'All' && `${report.statusLabel || 'Status'}: ${status}`,
    from && `From: ${from}`,
    to && `To: ${to}`,
    search && `Search: "${search}"`
  ].filter(Boolean).join('  |  ');

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('ELS Construction (Pvt) Ltd', 14, 16);
    doc.setFontSize(12);
    doc.text(report.title, 14, 24);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${formatDateTime(new Date())}${filterText ? `   |   ${filterText}` : ''}`, 14, 30);
    doc.text(report.summary.map(s => `${s.label}: ${s.value}`).join('     '), 14, 36);
    autoTable(doc, {
      startY: 41,
      head: [report.columns.map(c => c.label)],
      body: report.rows.map(r => report.columns.map(c => String(c.get(r) ?? ''))),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [13, 27, 75] },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });
    doc.save(`${fileStem}.pdf`);
    toast.success(`PDF Report "${report.title}" generated and downloaded`);
  };

  const exportExcel = () => {
    const sheet = [
      ['ELS Construction (Pvt) Ltd'],
      [report.title],
      [`Generated: ${formatDateTime(new Date())}`, filterText],
      [],
      report.columns.map(c => c.label),
      ...report.rows.map(r => report.columns.map(c => c.get(r) ?? ''))
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheet);
    ws['!cols'] = report.columns.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${fileStem}.xlsx`);
    toast.success(`Excel Spreadsheet "${report.title}" generated and downloaded`);
  };

  const subViews = SUB_VIEWS[activeTab];
  const statusOptions = report.filters?.status;
  const locationOptions = report.filters?.location;

  const reportPagination = usePagination(
    report.rows,
    10,
    [activeTab, subView[activeTab], search, project, status, location, from, to],
    { storageKey: `report_${activeTab}_${subView[activeTab] || 'default'}` }
  );

  return (
    <div>
      <div style={styles.tabBar}>
        {visibleTabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={activeTab === t.id ? styles.tabActive : styles.tab}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {subViews && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          {subViews.map(v => (
            <button
              key={v.id}
              onClick={() => { setSubView(prev => ({ ...prev, [activeTab]: v.id })); setStatus('All'); }}
              style={subView[activeTab] === v.id ? styles.pillActive : styles.pill}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      <div style={styles.summaryGrid}>
        {report.summary.map((s, i) => (
          <div key={i} style={{ ...styles.summaryCard, borderTop: `4px solid ${s.danger ? '#ef4444' : s.warn ? '#d97706' : '#0d1b4b'}` }}>
            <div style={{ fontSize: '20px', fontWeight: '700', color: s.danger ? '#ef4444' : s.warn ? '#d97706' : '#0d1b4b' }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={styles.filterBar}>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...styles.input, minWidth: '180px', flex: 1 }}
        />
        {report.projects && (
          <select value={project} onChange={e => setProject(e.target.value)} style={styles.input}>
            <option value="All">All Projects</option>
            {report.projects.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        {locationOptions && (
          <select value={location} onChange={e => setLocation(e.target.value)} style={styles.input}>
            <option value="All">All Locations</option>
            {locationOptions.map(l => <option key={l} value={l}>{l === 'SiteStore' ? 'Site Store' : 'Main Store'}</option>)}
          </select>
        )}
        {statusOptions && (
          <select value={status} onChange={e => setStatus(e.target.value)} style={styles.input}>
            <option value="All">All {report.statusLabel ? `${report.statusLabel}s` : 'Statuses'}</option>
            {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {report.dated && (
          <>
            <label style={styles.dateLabel}>From <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={styles.input} /></label>
            <label style={styles.dateLabel}>To <input type="date" value={to} onChange={e => setTo(e.target.value)} style={styles.input} /></label>
          </>
        )}
        <button onClick={() => loadTab(activeTab)} style={styles.ghostBtn}>↻ Refresh</button>
        <button onClick={exportPDF} disabled={report.rows.length === 0} style={{ ...styles.exportBtn, background: '#c62828', opacity: report.rows.length === 0 ? 0.5 : 1 }}>⬇ PDF</button>
        <button onClick={exportExcel} disabled={report.rows.length === 0} style={{ ...styles.exportBtn, background: '#2e7d32', opacity: report.rows.length === 0 ? 0.5 : 1 }}>⬇ Excel</button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.tableWrap}>
        <div style={styles.tableHeader}>
          <h3 style={{ margin: 0, color: 'white', fontSize: '15px' }}>{report.title}</h3>
          <span style={{ color: '#cbd5e1', fontSize: '12px' }}>{report.rows.length} record{report.rows.length === 1 ? '' : 's'}</span>
        </div>
        {loading ? (
          <div style={styles.empty}>Loading report...</div>
        ) : report.rows.length === 0 ? (
          <div style={styles.empty}>
            No records match the selected filters.
            <button
              onClick={() => { setSearch(''); setProject('All'); setStatus('All'); setLocation('All'); setFrom(''); setTo(''); }}
              style={{ marginLeft: '12px', padding: '4px 10px', fontSize: '12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5f6fa' }}>
                  {report.columns.map(c => (
                    <th key={c.label} style={{ ...styles.th, textAlign: c.numeric ? 'right' : 'left' }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportPagination.paginatedData.map((r, i) => (
                  <tr key={r._id || i} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    {report.columns.map(c => {
                      const value = c.get(r);
                      const colors = c.badge ? (badgeColors[value] || ['#f1f5f9', '#475569']) : null;
                      return (
                        <td key={c.label} style={{ ...styles.td, textAlign: c.numeric ? 'right' : 'left' }}>
                          {colors
                            ? <span style={{ background: colors[0], color: colors[1], padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{value}</span>
                            : value}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              pagination={reportPagination}
              onClearFilters={() => { setSearch(''); setProject('All'); setStatus('All'); setLocation('All'); setFrom(''); setTo(''); }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  tabBar: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px', borderBottom: '2px solid #e2e8f0', paddingBottom: '0' },
  tab: { background: 'transparent', border: 'none', borderBottom: '3px solid transparent', padding: '10px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#64748b' },
  tabActive: { background: 'transparent', border: 'none', borderBottom: '3px solid #ff9800', padding: '10px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: '#0d1b4b' },
  pill: { background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },
  pillActive: { background: '#0d1b4b', border: '1px solid #0d1b4b', color: 'white', padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px', marginBottom: '16px' },
  summaryCard: { background: 'white', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', textAlign: 'left' },
  filterBar: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', background: 'white', padding: '12px 14px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', marginBottom: '16px' },
  input: { padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', outline: 'none', color: '#0f172a', background: 'white' },
  dateLabel: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569', fontWeight: '600' },
  ghostBtn: { background: '#f1f5f9', color: '#0d1b4b', border: '1px solid #cbd5e1', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },
  exportBtn: { color: 'white', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' },
  error: { background: '#ffebee', border: '1px solid #ef5350', color: '#c62828', padding: '10px 16px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' },
  tableWrap: { background: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', overflow: 'hidden' },
  tableHeader: { padding: '14px 20px', background: '#0d1b4b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  th: { padding: '11px 14px', fontSize: '12px', color: '#475569', fontWeight: '700', whiteSpace: 'nowrap' },
  td: { padding: '10px 14px', fontSize: '12.5px', color: '#0f172a' },
  empty: { padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '13px' }
};

export default ReportsCenter;
