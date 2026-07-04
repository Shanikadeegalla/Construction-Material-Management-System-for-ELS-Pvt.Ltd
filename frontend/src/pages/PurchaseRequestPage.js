import React, { useState, useEffect } from 'react';

function PurchaseRequestPage({ user }) {
  const [requests, setRequests] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form toggles
  const [showAddForm, setShowAddForm] = useState(false);

  // New PR form state
  const [formProject, setFormProject] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formItems, setFormItems] = useState([{ material: '', quantity: '' }]);

  const API_PR_URL = 'http://localhost:5000/api/purchase-requests';
  const API_INVENTORY_URL = 'http://localhost:5000/api/inventory';

  // Fetch purchase requests and materials
  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const token = user?.token || JSON.parse(localStorage.getItem('user'))?.token;
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch purchase requests
      const prRes = await fetch(API_PR_URL, { headers });
      const prData = await prRes.json();
      if (prData.success) {
        // Filter requests for this specific Store Officer
        const myRequests = prData.data.filter(r => r.requestedBy === user?.name);
        setRequests(myRequests);
      } else {
        setError(prData.message || 'Failed to fetch purchase requests.');
      }

      // Fetch inventory to populate material selection dropdown
      const invRes = await fetch(API_INVENTORY_URL);
      const invData = await invRes.json();
      if (Array.isArray(invData)) {
        // Only include MainStore materials for PRs
        setMaterials(invData.filter(m => m.location === 'MainStore'));
      }
    } catch (err) {
      setError('Could not connect to the backend server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleAddItemRow = () => {
    setFormItems([...formItems, { material: '', quantity: '' }]);
  };

  const handleRemoveItemRow = (index) => {
    const updated = formItems.filter((_, idx) => idx !== index);
    setFormItems(updated);
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...formItems];
    updated[index][field] = value;
    setFormItems(updated);
  };

  const handlePrSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Form validations
    if (!formProject.trim()) {
      setError('Please enter a project name.');
      return;
    }

    const invalidItems = formItems.some(item => !item.material || !item.quantity || Number(item.quantity) <= 0);
    if (invalidItems) {
      setError('Please select a material and enter a valid quantity for all rows.');
      return;
    }

    try {
      const token = user?.token || JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch(API_PR_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          project: formProject,
          notes: formNotes,
          materials: formItems.map(item => ({
            material: item.material,
            quantity: Number(item.quantity)
          })),
          requestedBy: user?.name || 'Store Officer'
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess('Purchase Request submitted successfully!');
        setShowAddForm(false);
        setFormProject('');
        setFormNotes('');
        setFormItems([{ material: '', quantity: '' }]);
        fetchData();
      } else {
        setError(data.message || 'Failed to submit purchase request.');
      }
    } catch (err) {
      setError('Connection error occurred.');
    }
  };

  // Stats calculations
  const totalPRs = requests.length;
  const pendingPRs = requests.filter(r => r.status === 'Pending').length;
  const approvedPRs = requests.filter(r => r.status === 'Approved').length;
  const rejectedPRs = requests.filter(r => r.status === 'Rejected').length;

  return (
    <div style={styles.container}>
      <h1 style={styles.pageTitle}>Purchase Requests Dashboard</h1>

      {error && <div style={styles.errorAlert}>{error}</div>}
      {success && <div style={styles.successAlert}>{success}</div>}

      {/* Stats Cards Section */}
      <div style={styles.statsGrid}>
        <div style={{ ...styles.statCard, borderLeft: '4px solid #0d1b4b' }}>
          <div style={styles.statLabel}>My Total Requests</div>
          <div style={styles.statValue}>{totalPRs}</div>
        </div>
        <div style={{ ...styles.statCard, borderLeft: '4px solid #ff9800' }}>
          <div style={styles.statLabel}>Pending Approvals</div>
          <div style={styles.statValue}>{pendingPRs}</div>
        </div>
        <div style={{ ...styles.statCard, borderLeft: '4px solid #10b981' }}>
          <div style={styles.statLabel}>Approved Requests</div>
          <div style={styles.statValue}>{approvedPRs}</div>
        </div>
        <div style={{ ...styles.statCard, borderLeft: '4px solid #ef4444' }}>
          <div style={styles.statLabel}>Rejected Requests</div>
          <div style={styles.statValue}>{rejectedPRs}</div>
        </div>
      </div>

      {/* Actions Bar */}
      <div style={styles.actionsBar}>
        <button onClick={() => setShowAddForm(!showAddForm)} style={styles.orangeBtn}>
          {showAddForm ? '✕ Close Form' : '+ New Purchase Request'}
        </button>
      </div>

      {/* Submit PR Form */}
      {showAddForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>Submit Material Requisition PR</h3>
          <form onSubmit={handlePrSubmit} style={styles.formVertical}>
            <div style={styles.formGroup}>
              <label style={styles.label}>PROJECT NAME *</label>
              <input
                type="text"
                placeholder="e.g. Colombo Port Expansion Project"
                value={formProject}
                onChange={e => setFormProject(e.target.value)}
                style={styles.formInput}
                required
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>REQUISITION MATERIALS *</label>
              {formItems.map((item, index) => (
                <div key={index} style={styles.formRow}>
                  <select
                    value={item.material}
                    onChange={e => handleItemChange(index, 'material', e.target.value)}
                    style={styles.formSelectWide}
                    required
                  >
                    <option value="">-- Select Material from Inventory --</option>
                    {materials.map(m => (
                      <option key={m._id} value={m._id}>
                        {m.name} ({m.category}) - Avail: {m.quantity} {m.unit}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={e => handleItemChange(index, 'quantity', e.target.value)}
                    style={styles.formInputSmall}
                    min="1"
                    required
                  />
                  {formItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItemRow(index)}
                      style={styles.removeBtn}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={handleAddItemRow} style={styles.addItemBtn}>
                + Add Another Material
              </button>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>ADDITIONAL REQUISITION NOTES</label>
              <textarea
                placeholder="Enter justification, special specifications, or timing requirements..."
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                style={styles.formTextarea}
                rows={3}
              />
            </div>

            <div style={styles.formButtonsRow}>
              <button type="submit" style={styles.submitFormBtn}>Submit Request</button>
              <button type="button" onClick={() => setShowAddForm(false)} style={styles.cancelFormBtn}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Previous Requests Table */}
      <div style={styles.tableContainer}>
        {loading ? (
          <div style={styles.loadingText}>Fetching your requisitions...</div>
        ) : requests.length === 0 ? (
          <div style={styles.emptyState}>No purchase requests submitted yet. Click above to create one.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.th}>PR No.</th>
                <th style={styles.th}>Project</th>
                <th style={styles.th}>Materials</th>
                <th style={styles.th}>Submitted Date</th>
                <th style={styles.th}>Notes</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req, i) => (
                <tr key={req._id} style={styles.tableRow}>
                  <td style={styles.tdBold}>PR-{String(requests.length - i).padStart(3, '0')}</td>
                  <td style={styles.tdBold}>{req.projectName || req.project}</td>
                  <td style={styles.td}>
                    {req.materials?.map((m, idx) => (
                      <div key={idx} style={styles.materialRow}>
                        • {m.materialName} ({m.quantity} {m.unit})
                      </div>
                    ))}
                  </td>
                  <td style={styles.td}>
                    {new Date(req.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td style={styles.td}>{req.notes || '—'}</td>
                  <td style={styles.td}>
                    {req.status === 'Approved' && (
                      <span style={{ ...styles.badge, backgroundColor: '#d1fae5', color: '#10b981' }}>✓ Approved</span>
                    )}
                    {req.status === 'Rejected' && (
                      <span style={{ ...styles.badge, backgroundColor: '#fee2e2', color: '#ef4444' }}>✕ Rejected</span>
                    )}
                    {req.status === 'Pending' && (
                      <span style={{ ...styles.badge, backgroundColor: '#fff3e0', color: '#ff9800' }}>⏳ Pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
  actionsBar: {
    display: 'flex',
    marginBottom: '24px',
  },
  orangeBtn: {
    backgroundColor: '#ff9800',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '10px 18px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 10px rgba(255,152,0,0.15)',
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    border: '1px solid #ff9800',
  },
  formTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#0d1b4b',
    marginBottom: '20px',
  },
  formVertical: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: '0.03em',
  },
  formInput: {
    padding: '10px 14px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
  },
  formInputSmall: {
    width: '100px',
    padding: '10px 14px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
  },
  formSelectWide: {
    flex: '1',
    padding: '10px 14px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    backgroundColor: 'white',
    fontSize: '14px',
  },
  formTextarea: {
    padding: '10px 14px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    resize: 'vertical',
  },
  formRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    marginBottom: '8px',
  },
  removeBtn: {
    backgroundColor: '#fee2e2',
    color: '#ef4444',
    border: 'none',
    borderRadius: '6px',
    width: '38px',
    height: '38px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  addItemBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#e3f2fd',
    color: '#1565c0',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '6px',
  },
  formButtonsRow: {
    display: 'flex',
    gap: '12px',
    marginTop: '10px',
  },
  submitFormBtn: {
    backgroundColor: '#0d1b4b',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  cancelFormBtn: {
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '10px 24px',
    fontSize: '14px',
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
  tableRow: {
    borderBottom: '1px solid #f1f5f9',
    transition: 'background-color 0.2s',
  },
  td: {
    padding: '14px 18px',
    fontSize: '14px',
    color: '#334155',
    verticalAlign: 'top',
  },
  tdBold: {
    padding: '14px 18px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#0d1b4b',
    verticalAlign: 'top',
  },
  materialRow: {
    marginBottom: '4px',
  },
  badge: {
    display: 'inline-block',
    padding: '6px 12px',
    borderRadius: '9999px',
    fontSize: '12px',
    fontWeight: '700',
    textAlign: 'center',
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

export default PurchaseRequestPage;