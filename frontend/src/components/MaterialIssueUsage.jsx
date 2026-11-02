import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { API_BASE } from '../config';
import { decryptTransit, decryptDB } from '../utils/cryptoUtils';
import DateInput from './DateInput';
import LoadingButton from './LoadingButton';
import Pagination, { usePagination } from './Pagination';

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateStr;
  }
};

export default function MaterialIssueUsage({ user, onIssueSuccess, initialProjectId = '' }) {
  const [projects, setProjects] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [selectedProjId, setSelectedProjId] = useState(initialProjectId);
  const [selectedProjectName, setSelectedProjectName] = useState('');
  
  const [issueForm, setIssueForm] = useState({
    projectName: '',
    materialId: '',
    quantity: '',
    activity: '',
    notes: '',
    date: new Date().toISOString().substring(0, 10)
  });

  const [issueSubmitting, setIssueSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [issueWarning, setIssueWarning] = useState('');

  const [planVsActual, setPlanVsActual] = useState([]);
  const [issueHistory, setIssueHistory] = useState([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);

  const getHeaders = useCallback(() => {
    const token = JSON.parse(localStorage.getItem('user'))?.token;
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-site-store': 'true'
    };
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/projects`, { headers: getHeaders() });
      let data = await res.json();
      if (data && data.ciphertext) {
        try {
          const dec = decryptTransit(data.ciphertext);
          data = typeof dec === 'string' ? JSON.parse(dec) : dec;
        } catch (e) {}
      }
      const list = Array.isArray(data) ? data : (data.data || data.projects || []);
      setProjects(list);
      if (list.length > 0 && !selectedProjId) {
        const first = list[0];
        const pId = first._id || first.id;
        const pName = first.projectName || first.name;
        setSelectedProjId(pId);
        setSelectedProjectName(pName);
        setIssueForm(prev => ({ ...prev, projectName: pName }));
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  }, [getHeaders, selectedProjId]);

  const fetchMaterials = useCallback(async () => {
    try {
      let res = await fetch(`${API_BASE}/api/site/inventory`, { headers: getHeaders() });
      if (!res.ok) {
        res = await fetch(`${API_BASE}/api/inventory/site`, { headers: getHeaders() });
      }
      let data = await res.json();
      if (data && data.ciphertext) {
        try {
          const dec = decryptTransit(data.ciphertext);
          data = typeof dec === 'string' ? JSON.parse(dec) : dec;
        } catch (e) {}
      }
      let list = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data && Array.isArray(data.data)) {
        list = data.data;
      } else if (data && Array.isArray(data.materials)) {
        list = data.materials;
      }
      const normalized = list.map(m => ({
        ...m,
        name: decryptDB(m.name) || m.name,
        quantity: typeof m.quantity === 'number' ? m.quantity : (Number(decryptDB(m.quantity)) || Number(m.quantity) || 0)
      }));
      setMaterials(normalized);
    } catch (err) {
      console.error('Error fetching site materials:', err);
    }
  }, [getHeaders]);

  const fetchPlanVsActual = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/material-usage/variance`, { headers: getHeaders() });
      let data = await res.json();
      if (data && data.ciphertext) {
        try {
          const dec = decryptTransit(data.ciphertext);
          data = typeof dec === 'string' ? JSON.parse(dec) : dec;
        } catch (e) {}
      }
      if (data.success && Array.isArray(data.report)) {
        setPlanVsActual(data.report);
      }
    } catch (err) {
      console.error('Error fetching planned vs actual usage:', err);
    }
  }, [getHeaders]);

  const fetchIssueHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/material-usage`, { headers: getHeaders() });
      let data = await res.json();
      if (data && data.ciphertext) {
        try {
          const dec = decryptTransit(data.ciphertext);
          data = typeof dec === 'string' ? JSON.parse(dec) : dec;
        } catch (e) {}
      }
      if (data.success && Array.isArray(data.data)) {
        setIssueHistory(data.data);
      }
    } catch (err) {
      console.error('Error fetching issue history:', err);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchProjects();
    fetchMaterials();
    fetchPlanVsActual();
    fetchIssueHistory();
  }, [fetchProjects, fetchMaterials, fetchPlanVsActual, fetchIssueHistory]);

  const handleProjectChange = (projectName) => {
    const proj = projects.find(p => (p.projectName || p.name) === projectName);
    if (proj) {
      const pId = proj._id || proj.id;
      setSelectedProjId(pId);
      setSelectedProjectName(proj.projectName || proj.name);
      setIssueForm(prev => ({
        ...prev,
        projectName: proj.projectName || proj.name,
        materialId: '',
        quantity: '',
        activity: '',
        notes: ''
      }));
    } else {
      setSelectedProjId('');
      setSelectedProjectName('');
      setIssueForm(prev => ({
        ...prev,
        projectName: '',
        materialId: '',
        quantity: '',
        activity: '',
        notes: ''
      }));
    }
  };

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const { materialId, quantity, activity, notes, date } = issueForm;

    if (!selectedProjId) {
      setError('Please select a project first.');
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

    const selectedMaterial = siteStockMaterials.find(m => String(m._id) === String(materialId)) ||
                             materials.find(m => String(m._id) === String(materialId));
    const availableQty = selectedMaterial ? (selectedMaterial.parsedQuantity !== undefined ? selectedMaterial.parsedQuantity : (typeof selectedMaterial.quantity === 'number' ? selectedMaterial.quantity : (Number(decryptDB(selectedMaterial.quantity)) || 0))) : 0;
    if (selectedMaterial && qty > availableQty) {
      setError(`Insufficient site stock. Available quantity: ${availableQty} ${selectedMaterial.unit || ''}.`);
      return;
    }

    setIssueSubmitting(true);
    setIssueWarning('');

    try {
      const payload = {
        projectId: selectedProjId,
        materialId,
        quantityUsed: qty,
        quantity: qty,
        activity: activity.trim(),
        notes: notes || '',
        usageDate: date,
        date
      };

      const res = await fetch(`${API_BASE}/api/site/material-usage`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });

      let data = await res.json();
      if (data && data.ciphertext) {
        try {
          const dec = decryptTransit(data.ciphertext);
          data = typeof dec === 'string' ? JSON.parse(dec) : dec;
        } catch (e) {}
      }

      if (res.ok && data.success) {
        setSuccess(`✅ ${data.message || 'Material issued and usage recorded successfully.'}`);
        setIssueWarning(data.warning || '');
        setIssueForm(prev => ({
          ...prev,
          materialId: '',
          quantity: '',
          activity: '',
          notes: '',
          date: new Date().toISOString().substring(0, 10)
        }));
        fetchMaterials();
        fetchPlanVsActual();
        fetchIssueHistory();
        if (onIssueSuccess) onIssueSuccess(data);
      } else {
        setError(data.message || 'Failed to record the material issue.');
      }
    } catch (err) {
      setError('Could not connect to the backend server to record the material issue.');
    } finally {
      setIssueSubmitting(false);
    }
  };

  // Site Store stock items with positive quantity (> 0), shared across projects
  const siteStockMaterials = useMemo(() => {
    return (materials || [])
      .filter(m => {
        const isSiteStore = m.location === 'SiteStore' || !m.location;
        const rawQty = m.quantity;
        const qty = typeof rawQty === 'number' ? rawQty : (Number(decryptDB(rawQty)) || Number(rawQty) || 0);
        return isSiteStore && qty > 0;
      })
      .map(m => {
        const rawName = m.name || '';
        const decName = decryptDB(rawName) || rawName;
        const rawQty = m.quantity;
        const parsedQty = typeof rawQty === 'number' ? rawQty : (Number(decryptDB(rawQty)) || Number(rawQty) || 0);
        return {
          ...m,
          displayName: decName,
          parsedQuantity: parsedQty
        };
      });
  }, [materials]);

  const displayProjectPlanRows = useMemo(() => {
    if (!selectedProjId) return [];
    return planVsActual.filter(r => String(r.projectId) === String(selectedProjId));
  }, [planVsActual, selectedProjId]);

  const displayIssueHistory = useMemo(() => {
    if (!selectedProjId) return issueHistory;
    return issueHistory.filter(u => String(u.projectId) === String(selectedProjId) || String(u.project_id) === String(selectedProjId));
  }, [issueHistory, selectedProjId]);

  const projectPlanPagination = usePagination(displayProjectPlanRows, 10, [selectedProjId, displayProjectPlanRows.length], { storageKey: 'site_project_plan' });
  const issueHistoryPagination = usePagination(displayIssueHistory, 8, [selectedProjId, displayIssueHistory.length], { storageKey: 'site_issue_history' });

  return (
    <div style={styles.container}>
      <h1 style={styles.pageTitle}>Material Issue & Usage</h1>

      {error && <div style={styles.errorAlert}>{error}</div>}
      {success && <div style={styles.successAlert}>{success}</div>}

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
                  <option key={p._id || p.id} value={p.projectName || p.name}>
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
                {siteStockMaterials.length === 0 ? (
                  <option value="">No stock at Site Store. Request materials from Main Store first.</option>
                ) : (
                  <>
                    <option value="">-- Select Material --</option>
                    {siteStockMaterials.map(m => (
                      <option key={m._id} value={m._id}>
                        {m.displayName || m.name} ({m.unit || 'unit'})
                      </option>
                    ))}
                  </>
                )}
              </select>
              {siteStockMaterials.length === 0 && selectedProjId && (
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#dc2626', fontWeight: 500 }}>
                  No stock at Site Store. Request materials from Main Store first.
                </p>
              )}
            </div>
            <div>
              <label style={styles.fieldLabel}>Available at Site</label>
              <input
                type="text"
                value={(() => {
                  const m = siteStockMaterials.find(mat => String(mat._id) === String(issueForm.materialId)) ||
                            materials.find(mat => String(mat._id) === String(issueForm.materialId));
                  if (!m) return '';
                  const qty = m.parsedQuantity !== undefined ? m.parsedQuantity : (typeof m.quantity === 'number' ? m.quantity : (Number(decryptDB(m.quantity)) || Number(m.quantity) || 0));
                  return `${qty} ${m.unit || ''}`.trim();
                })()}
                placeholder="Select a material above"
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
                  const m = siteStockMaterials.find(mat => String(mat._id) === String(issueForm.materialId)) ||
                            materials.find(mat => String(mat._id) === String(issueForm.materialId));
                  if (!m) return undefined;
                  return m.parsedQuantity !== undefined ? m.parsedQuantity : (typeof m.quantity === 'number' ? m.quantity : (Number(decryptDB(m.quantity)) || Number(m.quantity) || 0));
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
                  const m = siteStockMaterials.find(mat => String(mat._id) === String(issueForm.materialId)) ||
                            materials.find(mat => String(mat._id) === String(issueForm.materialId));
                  return m ? (m.unit || '') : '';
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

          <LoadingButton
            type="submit"
            style={styles.primaryBtn}
            loading={issueSubmitting}
            loadingText="Recording..."
            disabled={!selectedProjId}
          >
            Record Material Issue
          </LoadingButton>
        </form>
      </div>

      {issueWarning && (
        <div style={styles.warningBox}>
          ⚠️ Overuse warning: {issueWarning} The Project Manager and Director have been notified.
        </div>
      )}

      {/* Planned vs Actual Table */}
      <div style={{ ...styles.tableContainer, marginBottom: '24px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ color: '#0d1b4b', margin: 0, fontSize: '15px' }}>
            📐 Planned vs Actual Usage {selectedProjectName ? `— ${selectedProjectName}` : ''}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Project:</span>
            <select
              value={selectedProjectName || ''}
              onChange={e => handleProjectChange(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="">-- Select Project --</option>
              {projects.map(p => (
                <option key={p._id || p.id} value={p.projectName || p.name}>
                  {p.projectName || p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {displayProjectPlanRows.length === 0 ? (
          <div style={styles.emptyState}>No approved BOM or usage recorded for this project yet.</div>
        ) : (
          <>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeaderRow}>
                  <th style={styles.th}>Material</th>
                  <th style={styles.th}>Unit</th>
                  <th style={styles.th}>Planned (BOM)</th>
                  <th style={styles.th}>Actual Used</th>
                  <th style={styles.th}>Remaining</th>
                  <th style={styles.th}>Variance</th>
                  <th style={styles.th}>Variance %</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {projectPlanPagination.paginatedData.map((r, i) => {
                  const over = r.varianceQty > 0;
                  const badge = over || r.status === 'Unplanned'
                    ? { bg: '#ffebee', color: '#c62828' }
                    : r.status === 'Not Started' ? { bg: '#f1f5f9', color: '#475569' } : { bg: '#e8f5e9', color: '#2e7d32' };
                  return (
                    <tr key={r._id || i} style={{ borderBottom: '1px solid #eee', backgroundColor: over ? 'rgba(239,68,68,0.06)' : 'white' }}>
                      <td style={styles.tdBold}>{r.materialName}</td>
                      <td style={styles.td}>{r.unit}</td>
                      <td style={styles.td}>{r.plannedQty}</td>
                      <td style={styles.td}>{r.actualQty}</td>
                      <td style={styles.td}>{r.remainingQty ?? Math.max(r.plannedQty - r.actualQty, 0)}</td>
                      <td style={{ ...styles.td, color: over ? '#c62828' : '#2e7d32', fontWeight: 'bold' }}>
                        {r.varianceQty > 0 ? '+' : ''}{r.varianceQty}
                      </td>
                      <td style={styles.td}>{r.variancePct > 0 ? '+' : ''}{r.variancePct}%</td>
                      <td style={styles.td}>
                        <span style={{ background: badge.bg, color: badge.color, padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                          {r.status || (over ? 'Overused' : 'Within Plan')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination pagination={projectPlanPagination} />
          </>
        )}
      </div>

      {/* Material Issue & Usage History */}
      <div style={styles.tableContainer}>
        <h3 style={{ padding: '16px 20px', color: '#0d1b4b', margin: 0, borderBottom: '1px solid #eee' }}>
          Material Issue & Usage History
        </h3>
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
            {issueHistoryPagination.paginatedData.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ padding: '24px', textAlign: 'center', color: '#999' }}>
                  No material issue & usage records found.
                </td>
              </tr>
            ) : (
              issueHistoryPagination.paginatedData.map((item, i) => (
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
                        style={styles.actionBtn}
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
                            <strong>Cumulative variance after this issue:</strong> {item.variance > 0 ? '+' : ''}{item.variance} {item.unit}
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
        <Pagination pagination={issueHistoryPagination} />
      </div>
    </div>
  );
}

const styles = {
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
    fontSize: '14px',
  },
  formSelect: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    boxSizing: 'border-box',
    backgroundColor: 'white',
    fontSize: '14px',
  },
  filterSelect: {
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#0d1b4b',
    minWidth: '220px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    backgroundColor: 'white'
  },
  primaryBtn: {
    background: '#2563eb',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
  },
  actionBtn: {
    background: '#e3f2fd',
    color: '#1565c0',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
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
  warningBox: {
    background: '#fff7ed',
    border: '1px solid #fdba74',
    color: '#9a3412',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '20px',
    fontSize: '13px',
    fontWeight: '600',
    textAlign: 'left'
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
  emptyState: {
    padding: '40px',
    textAlign: 'center',
    color: '#64748b',
    fontSize: '14px',
  }
};

