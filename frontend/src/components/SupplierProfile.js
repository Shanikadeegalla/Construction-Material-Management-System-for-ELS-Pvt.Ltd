import React, { useState, useEffect, useCallback } from 'react';
import { formatDate } from '../utils/dateUtils';
import Pagination, { usePagination } from './Pagination';
import { useToast } from '../context/ToastContext';
import scrollToElement from '../utils/scrollToElement';
import LoadingButton from './LoadingButton';
import openUploadedFile from '../utils/openUploadedFile';

const API_BASE = 'http://localhost:5000';

const styles = {
  tabButton: (active) => ({
    padding: '12px 24px',
    fontWeight: '600',
    fontSize: '14px',
    border: 'none',
    background: active ? '#2563eb' : 'transparent',
    color: active ? 'white' : '#64748b',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginRight: '8px'
  }),
  card: { background: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', overflow: 'hidden' },
  th: { padding: '14px 16px', textAlign: 'left', fontSize: '13px' },
  td: { padding: '14px 16px', fontSize: '13px', color: '#333' },
  label: { display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: '600' },
  input: { width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' },
  infoLabel: { fontSize: '12px', color: '#666', fontWeight: '600', marginBottom: '4px' },
  infoValue: { fontSize: '14px', color: '#0d1b4b', fontWeight: '500' }
};

const statusBadge = (status) => {
  const map = {
    'Active': { bg: '#e8f5e9', color: '#2e7d32' },
    'Inactive': { bg: '#ffebee', color: '#c62828' },
    'Approved': { bg: '#e8f5e9', color: '#2e7d32' },
    'Paid': { bg: '#e0f2f1', color: '#00695c' },
    'Rejected': { bg: '#ffebee', color: '#c62828' },
    'Pending Approval': { bg: '#dbeafe', color: '#0d1b4b' },
    'Pending': { bg: '#dbeafe', color: '#0d1b4b' },
    'Accepted': { bg: '#e8f5e9', color: '#2e7d32' },
    'Expired': { bg: '#f5f5f5', color: '#666' },
    'Delivered': { bg: '#e8f5e9', color: '#2e7d32' },
    'Sent': { bg: '#e3f2fd', color: '#1565c0' }
  };
  const { bg, color } = map[status] || { bg: '#f5f5f5', color: '#666' };
  return { background: bg, color, padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' };
};

const InfoField = ({ label, value }) => (
  <div>
    <div style={styles.infoLabel}>{label}</div>
    <div style={styles.infoValue}>{value || '-'}</div>
  </div>
);

const SupplierProfile = ({ supplierId, onBack, getHeaders, canManageQuotations, user }) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('info');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submittingQuote, setSubmittingQuote] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteForm, setQuoteForm] = useState({ material: '', quantity: '', unit: '', price: '', date: new Date().toISOString().substring(0, 10), notes: '' });
  const [quoteFile, setQuoteFile] = useState(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError('');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const headers = typeof getHeaders === 'function' ? getHeaders() : { Authorization: `Bearer ${token}` };

      const res = await fetch(`${API_BASE}/api/suppliers/${supplierId}/profile`, {
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (data.success) {
        setProfile(data.data);
      } else {
        setError(data.message || 'Failed to load supplier profile.');
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        setError('Could not load supplier details (request timed out). Please retry.');
      } else {
        setError('Could not load supplier details. Please check your connection and retry.');
      }
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleQuoteSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    setSubmittingQuote(true);
    try {
      const fd = new FormData();
      fd.append('supplier', supplierId);
      fd.append('material', quoteForm.material);
      fd.append('quantity', quoteForm.quantity);
      fd.append('unit', quoteForm.unit);
      fd.append('price', quoteForm.price);
      fd.append('date', quoteForm.date);
      fd.append('notes', quoteForm.notes);
      if (quoteFile) fd.append('file', quoteFile);

      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch(`${API_BASE}/api/quotations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Quotation for "${quoteForm.material}" added successfully!`);
        setShowQuoteForm(false);
        setQuoteForm({ material: '', quantity: '', unit: '', price: '', date: new Date().toISOString().substring(0, 10), notes: '' });
        setQuoteFile(null);
        await fetchProfile();
        scrollToElement('quotations-list-section', { focusFirstInput: false, highlight: true });
      } else {
        toast.error(data.message || 'Failed to add quotation.');
        setError(data.message || 'Failed to add quotation.');
      }
    } catch (err) {
      toast.error('Failed to add quotation.');
      setError('Failed to add quotation.');
    } finally {
      setSubmittingQuote(false);
    }
  };

  const purchaseOrders = profile?.purchaseOrders || [];
  const quotations = profile?.quotations || [];
  const invoices = profile?.invoices || [];
  const grns = profile?.grns || [];
  const supplier = profile?.supplier;
  const performance = profile?.performance;

  const poPagination = usePagination(purchaseOrders, 8, [purchaseOrders.length]);
  const quotePagination = usePagination(quotations, 8, [quotations.length]);
  const invPagination = usePagination(invoices, 8, [invoices.length]);
  const grnPagination = usePagination(grns, 8, [grns.length]);

  if (loading) {
    return (
      <div style={{ padding: '40px', fontFamily: 'Segoe UI, Arial, sans-serif', textAlign: 'center' }}>
        <div style={{ fontSize: '16px', fontWeight: '600', color: '#0d1b4b', marginBottom: '8px' }}>
          ⏳ Loading supplier details...
        </div>
        <div style={{ fontSize: '13px', color: '#64748b' }}>Please wait while we fetch the profile data.</div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div style={{ padding: '40px', fontFamily: 'Segoe UI, Arial, sans-serif' }}>
        <button onClick={onBack} style={{ background: '#0d1b4b', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', marginBottom: '16px' }}>← Back to Suppliers</button>
        <div style={{ color: '#c62828', background: '#ffebee', padding: '16px', borderRadius: '8px', marginBottom: '16px', fontWeight: '600', border: '1px solid #ffcdd2' }}>
          ⚠️ {error}
        </div>
        <button onClick={() => fetchProfile()} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
          🔄 Retry Loading Supplier Details
        </button>
      </div>
    );
  }

  if (!supplier) return null;

  return (
    <div style={{ padding: '32px', fontFamily: 'Segoe UI, Arial, sans-serif', background: '#f5f6fa', minHeight: '100vh' }}>
      <button onClick={onBack} style={{ background: '#0d1b4b', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', marginBottom: '16px', fontSize: '13px' }}>← Back to Suppliers</button>

      <div style={{ ...styles.card, padding: '20px 24px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#666', fontWeight: '600' }}>{supplier.supplierId}</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: '#0d1b4b' }}>{supplier.name}</div>
        </div>
        <span style={statusBadge(supplier.status)}>{supplier.status}</span>
      </div>

      {message && <div style={{ color: '#22c55e', background: '#f0fdf4', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{message}</div>}
      {error && <div style={{ color: '#ef4444', background: '#fef2f2', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}

      {/* Tabs Menu */}
      <div style={{ display: 'flex', background: '#f1f5f9', padding: '6px', borderRadius: '10px', marginBottom: '20px', width: 'fit-content' }}>
        <button onClick={() => setActiveTab('info')} style={styles.tabButton(activeTab === 'info')}>🏢 Supplier Information</button>
        <button onClick={() => setActiveTab('history')} style={styles.tabButton(activeTab === 'history')}>📦 Purchase History</button>
        <button onClick={() => setActiveTab('quotations')} style={styles.tabButton(activeTab === 'quotations')}>📄 Quotations</button>
        <button onClick={() => setActiveTab('invoices')} style={styles.tabButton(activeTab === 'invoices')}>💰 Invoice & Payment History</button>
      </div>

      {/* TAB 1: Supplier Information */}
      {activeTab === 'info' && (
        <div style={{ ...styles.card, padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            <InfoField label="Contact Person" value={supplier.contactPerson} />
            <InfoField label="Phone Number" value={supplier.phone} />
            <InfoField label="Email" value={supplier.email} />
            <InfoField label="Address" value={supplier.address} />
            <InfoField label="Category" value={(supplier.categories || []).join(', ') || supplier.category} />
            <InfoField label="Registration Date" value={supplier.createdAt ? formatDate(supplier.createdAt) : '-'} />
          </div>

          <div style={{ borderTop: '1px solid #eee', paddingTop: '20px', marginBottom: '24px' }}>
            <h4 style={{ margin: '0 0 16px', color: '#0d1b4b', fontSize: '14px', textTransform: 'uppercase' }}>Bank & Registration Details</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
              <InfoField label="Bank Name" value={supplier.bankName} />
              <InfoField label="Account Number" value={supplier.accountNumber} />
              <InfoField label="Bank Branch" value={supplier.bankBranch} />
              <InfoField label="Business Registration No." value={supplier.businessRegistrationNumber} />
              <InfoField label="VAT Number" value={supplier.vatNumber} />
              <InfoField label="Rating" value={supplier.rating ? `${supplier.rating} / 5` : '-'} />
            </div>
          </div>

          {performance && (
            <div style={{ borderTop: '1px solid #eee', paddingTop: '20px', marginBottom: '24px' }}>
              <h4 style={{ margin: '0 0 16px', color: '#0d1b4b', fontSize: '14px', textTransform: 'uppercase' }}>Performance Summary</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '20px' }}>
                <InfoField label="Total Orders" value={performance.totalOrders} />
                <InfoField label="On-Time Deliveries" value={`${performance.onTimeDeliveries} (${performance.onTimePercent}%)`} />
                <InfoField label="Delivery Accuracy" value={`${performance.deliveryAccuracy}%`} />
                <InfoField label="Performance Rating" value={performance.performanceRating} />
              </div>
            </div>
          )}

          {supplier.documents && (
            <div style={{ borderTop: '1px solid #eee', paddingTop: '20px' }}>
              <h4 style={{ margin: '0 0 16px', color: '#0d1b4b', fontSize: '14px', textTransform: 'uppercase' }}>Documents</h4>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {['businessRegistration', 'taxCertificate', 'supplierAgreement', 'idPhoto'].map(key => {
                  const doc = supplier.documents[key];
                  if (!doc || !doc.url) return null;
                  return (
                    <a key={key} href={`${API_BASE}${doc.url}`} target="_blank" rel="noreferrer"
                      style={{ padding: '8px 14px', background: '#e3f2fd', color: '#1565c0', borderRadius: '6px', fontSize: '12px', fontWeight: '600', textDecoration: 'none' }}>
                      📎 {key.replace(/([A-Z])/g, ' $1')}
                    </a>
                  );
                })}
                {(!supplier.documents.businessRegistration?.url && !supplier.documents.taxCertificate?.url && !supplier.documents.supplierAgreement?.url && !supplier.documents.idPhoto?.url) && (
                  <div style={{ fontSize: '13px', color: '#999' }}>No documents uploaded.</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Purchase History */}
      {activeTab === 'history' && (
        <div style={styles.card}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0d1b4b', color: 'white' }}>
                {['PO Number', 'Date', 'Project', 'Amount', 'Status'].map(h => <th key={h} style={styles.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {poPagination.paginatedData.length === 0 && (
                <tr><td colSpan={5} style={{ ...styles.td, textAlign: 'center', padding: '24px', color: '#999' }}>No purchase orders yet.</td></tr>
              )}
              {poPagination.paginatedData.map((po, i) => (
                <tr key={po._id} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ ...styles.td, fontWeight: '600', color: '#0d1b4b' }}>{po.poNumber}</td>
                  <td style={styles.td}>{formatDate(po.createdAt)}</td>
                  <td style={styles.td}>{po.prId?.projectName || (typeof po.prId?.project === 'object' ? (po.prId?.project?.projectName || po.prId?.project?.name) : po.prId?.project) || '-'}</td>
                  <td style={styles.td}>LKR {Number(po.totalAmount).toLocaleString()}</td>
                  <td style={styles.td}><span style={statusBadge(po.status)}>{po.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination pagination={poPagination} />
        </div>
      )}

      {/* TAB 3: Quotations */}
      {activeTab === 'quotations' && (
        <div>
          {canManageQuotations && (
            <div style={{ marginBottom: '16px' }}>
              {!showQuoteForm ? (
                <button onClick={() => setShowQuoteForm(true)} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>+ Add Quotation</button>
              ) : (
                <div style={{ ...styles.card, padding: '20px', marginBottom: '16px' }}>
                  <h4 style={{ margin: '0 0 16px', color: '#0d1b4b' }}>Add Quotation</h4>
                  <form onSubmit={handleQuoteSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div>
                        <label style={styles.label}>MATERIAL *</label>
                        <input value={quoteForm.material} onChange={e => setQuoteForm({ ...quoteForm, material: e.target.value })} required style={styles.input} />
                      </div>
                      <div>
                        <label style={styles.label}>QUANTITY</label>
                        <input type="number" value={quoteForm.quantity} onChange={e => setQuoteForm({ ...quoteForm, quantity: e.target.value })} style={styles.input} />
                      </div>
                      <div>
                        <label style={styles.label}>UNIT</label>
                        <input value={quoteForm.unit} onChange={e => setQuoteForm({ ...quoteForm, unit: e.target.value })} placeholder="e.g. bag" style={styles.input} />
                      </div>
                      <div>
                        <label style={styles.label}>PRICE (LKR) *</label>
                        <input type="number" value={quoteForm.price} onChange={e => setQuoteForm({ ...quoteForm, price: e.target.value })} required style={styles.input} />
                      </div>
                      <div>
                        <label style={styles.label}>DATE</label>
                        <input type="date" value={quoteForm.date} onChange={e => setQuoteForm({ ...quoteForm, date: e.target.value })} style={styles.input} />
                      </div>
                      <div>
                        <label style={styles.label}>ATTACH PDF/JPG</label>
                        <input type="file" accept=".pdf,.jpg,.jpeg" onChange={e => setQuoteFile(e.target.files[0])} style={styles.input} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <LoadingButton type="submit" loading={submittingQuote} loadingText="Saving Quotation..." style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Save Quotation</LoadingButton>
                      <button type="button" onClick={() => setShowQuoteForm(false)} style={{ background: '#f5f5f5', color: '#333', border: '1px solid #ddd', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
          <div id="quotations-list-section" style={styles.card}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#0d1b4b', color: 'white' }}>
                  {['Quotation No', 'Date', 'Material', 'Price', 'Status', 'Actions'].map(h => <th key={h} style={styles.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {quotePagination.paginatedData.length === 0 && (
                  <tr><td colSpan={6} style={{ ...styles.td, textAlign: 'center', padding: '24px', color: '#999' }}>No quotations yet.</td></tr>
                )}
                {quotePagination.paginatedData.map((q, i) => (
                  <tr key={q._id} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ ...styles.td, fontWeight: '600', color: '#0d1b4b' }}>{q.quotationNumber}</td>
                    <td style={styles.td}>{formatDate(q.date)}</td>
                    <td style={styles.td}>{q.material}{q.unit ? ` (${q.quantity || ''} ${q.unit})` : ''}</td>
                    <td style={styles.td}>LKR {Number(q.price).toLocaleString()}</td>
                    <td style={styles.td}><span style={statusBadge(q.status)}>{q.status}</span></td>
                    <td style={styles.td}>
                      {q.file?.url ? (
                        <button
                          type="button"
                          onClick={() => openUploadedFile(q.file.url, { fileType: 'quotation', toast })}
                          style={{ color: '#1565c0', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                          👁 View
                        </button>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination pagination={quotePagination} />
          </div>
        </div>
      )}

      {/* TAB 4: Invoice & Payment History */}
      {activeTab === 'invoices' && (
        <div style={styles.card}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0d1b4b', color: 'white' }}>
                {['Invoice', 'PO', 'GRN', 'Amount', 'Date', 'Status'].map(h => <th key={h} style={styles.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {invPagination.paginatedData.length === 0 && (
                <tr><td colSpan={6} style={{ ...styles.td, textAlign: 'center', padding: '24px', color: '#999' }}>No invoices recorded yet. Invoices are recorded by MainStore when goods are received.</td></tr>
              )}
              {invPagination.paginatedData.map((inv, i) => (
                <tr key={inv._id} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ ...styles.td, fontWeight: '600', color: '#0d1b4b' }}>{inv.invoiceNumber}</td>
                  <td style={styles.td}>{inv.po?.poNumber || '-'}</td>
                  <td style={styles.td}>{inv.grn?.grnNumber || '-'}</td>
                  <td style={styles.td}>LKR {Number(inv.amount).toLocaleString()}</td>
                  <td style={styles.td}>{formatDate(inv.invoiceDate)}</td>
                  <td style={styles.td}><span style={statusBadge(inv.status)}>{inv.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination pagination={invPagination} />

          {grns && grns.length > 0 && (
            <div style={{ padding: '20px 16px', borderTop: '1px solid #eee' }}>
              <h4 style={{ margin: '0 0 12px', color: '#0d1b4b', fontSize: '14px', textTransform: 'uppercase' }}>Goods Received Notes</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f5f6fa' }}>
                    {['GRN Number', 'PO Reference', 'Received Date', 'Status'].map(h => <th key={h} style={{ ...styles.th, color: '#0d1b4b' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {grnPagination.paginatedData.map((g, i) => (
                    <tr key={g._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ ...styles.td, fontWeight: '600' }}>{g.grnNumber}</td>
                      <td style={styles.td}>{g.poReference}</td>
                      <td style={styles.td}>{formatDate(g.receivedDate)}</td>
                      <td style={styles.td}><span style={statusBadge(g.status)}>{g.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination pagination={grnPagination} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SupplierProfile;
