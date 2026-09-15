import React, { useState, useEffect } from 'react';
import { formatShortDate } from '../utils/dateUtils';

function GRNPage({ user }) {
  const [grns, setGrns] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [grnNumber, setGrnNumber] = useState('');
  const [poReference, setPoReference] = useState('');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([
    { material: '', expectedQty: '', receivedQty: '', condition: 'Good' }
  ]);

  const API_INVENTORY_URL = 'http://localhost:5000/api/inventory';

  // Fetch GRNs and Materials
  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch materials
      const matRes = await fetch(API_INVENTORY_URL);
      const matData = await matRes.json();
      if (Array.isArray(matData)) {
        setMaterials(matData.filter(m => m.location === 'MainStore'));
      }

      // Fetch GRNs
      const grnRes = await fetch(`${API_INVENTORY_URL}/grn`);
      const grnData = await grnRes.json();
      if (Array.isArray(grnData)) {
        setGrns(grnData);
      }
    } catch (err) {
      setError('Could not connect to the backend server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Items handlers
  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([...items, { material: '', expectedQty: '', receivedQty: '', condition: 'Good' }]);
  };

  const handleRemoveItem = (index) => {
    if (items.length === 1) return;
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  // Submit GRN
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate items
    const invalidItem = items.some(item => !item.material || !item.expectedQty || !item.receivedQty);
    if (invalidItem) {
      setError('Please select a material and fill in all expected and received quantities.');
      return;
    }

    const payload = {
      grnNumber,
      poReference,
      supplier,
      receivedBy: user ? user.name : 'Store Officer',
      receivedDate: new Date(),
      items: items.map(item => ({
        material: item.material,
        expectedQty: Number(item.expectedQty),
        receivedQty: Number(item.receivedQty),
        condition: item.condition
      })),
      notes
    };

    try {
      const res = await fetch(`${API_INVENTORY_URL}/grn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok) {
        setSuccess(data.message || 'GRN successfully accepted and inventory updated!');
        setGrnNumber('');
        setPoReference('');
        setSupplier('');
        setNotes('');
        setItems([{ material: '', expectedQty: '', receivedQty: '', condition: 'Good' }]);
        fetchData();
      } else {
        setError(data.message || 'Failed to submit GRN.');
      }
    } catch (err) {
      setError('Connection error occurred.');
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.pageTitle}>Goods Received Note (GRN) Management</h1>

      {error && <div style={styles.errorAlert}>{error}</div>}
      {success && <div style={styles.successAlert}>{success}</div>}

      {/* GRN Entry Form */}
      <div style={styles.formCard}>
        <h3 style={styles.formTitle}>Record Incoming Goods (Create GRN)</h3>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>GRN Number</label>
              <input
                type="text"
                placeholder="e.g. GRN-2026-001"
                value={grnNumber}
                onChange={e => setGrnNumber(e.target.value)}
                style={styles.input}
                required
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>PO Reference</label>
              <input
                type="text"
                placeholder="e.g. PO-ELS-9988"
                value={poReference}
                onChange={e => setPoReference(e.target.value)}
                style={styles.input}
                required
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Supplier Name</label>
              <input
                type="text"
                placeholder="e.g. Tokyo Cement Group"
                value={supplier}
                onChange={e => setSupplier(e.target.value)}
                style={styles.input}
                required
              />
            </div>
          </div>

          <h4 style={styles.sectionSubtitle}>Received Items List</h4>
          {items.map((item, index) => (
            <div key={index} style={styles.itemRow}>
              <div style={styles.itemFieldSelect}>
                <label style={styles.itemLabel}>Material</label>
                <select
                  value={item.material}
                  onChange={e => handleItemChange(index, 'material', e.target.value)}
                  style={styles.select}
                  required
                >
                  <option value="">-- Choose Material --</option>
                  {materials.map(m => (
                    <option key={m._id} value={m._id}>
                      {m.name} ({m.category} - {m.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.itemField}>
                <label style={styles.itemLabel}>Expected Qty</label>
                <input
                  type="number"
                  placeholder="Expected"
                  value={item.expectedQty}
                  onChange={e => handleItemChange(index, 'expectedQty', e.target.value)}
                  style={styles.input}
                  min="1"
                  required
                />
              </div>
              <div style={styles.itemField}>
                <label style={styles.itemLabel}>Received Qty</label>
                <input
                  type="number"
                  placeholder="Received"
                  value={item.receivedQty}
                  onChange={e => handleItemChange(index, 'receivedQty', e.target.value)}
                  style={styles.input}
                  min="0"
                  required
                />
              </div>
              <div style={styles.itemFieldSelect}>
                <label style={styles.itemLabel}>Condition</label>
                <select
                  value={item.condition}
                  onChange={e => handleItemChange(index, 'condition', e.target.value)}
                  style={styles.select}
                >
                  <option value="Good">Good Condition</option>
                  <option value="Damaged">Damaged / Reject</option>
                  <option value="Shortage">Shortage</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveItem(index)}
                style={styles.removeBtn}
                disabled={items.length === 1}
              >
                ✕
              </button>
            </div>
          ))}

          <button type="button" onClick={handleAddItem} style={styles.addMoreBtn}>
            + Add Another Item
          </button>

          <div style={styles.formGroup}>
            <label style={styles.label}>Notes / Observations</label>
            <textarea
              placeholder="Enter any notes, shortages, or cargo inspection comments..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={styles.textarea}
              rows="3"
            />
          </div>

          <button type="submit" style={styles.orangeBtn}>
            Verify and Accept Goods
          </button>
        </form>
      </div>

      {/* GRN History Table */}
      <h2 style={styles.historyTitle}>GRN Log Registry</h2>
      <div style={styles.tableContainer}>
        {loading ? (
          <div style={styles.loadingText}>Fetching GRN logs...</div>
        ) : grns.length === 0 ? (
          <div style={styles.emptyState}>No Goods Received Notes recorded yet.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.th}>GRN Number</th>
                <th style={styles.th}>PO Reference</th>
                <th style={styles.th}>Supplier</th>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Received By</th>
                <th style={styles.th}>Items Received</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {grns.map(g => (
                <tr key={g._id} style={styles.tableRow}>
                  <td style={styles.tdBold}>{g.grnNumber}</td>
                  <td style={styles.td}>{g.poReference}</td>
                  <td style={styles.td}>{g.supplier}</td>
                  <td style={styles.td}>{formatShortDate(g.receivedDate)}</td>
                  <td style={styles.td}>{g.receivedBy}</td>
                  <td style={styles.td}>
                    <ul style={styles.itemList}>
                      {g.items.map((item, idx) => (
                        <li key={idx} style={styles.itemBullet}>
                          {item.material ? item.material.name : 'Unknown Material'}:{' '}
                          <strong>{item.receivedQty}</strong> / {item.expectedQty}{' '}
                          <span style={styles.condBadge(item.condition)}>({item.condition})</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.statusBadge}>{g.status}</span>
                  </td>
                  <td style={styles.tdItalic}>{g.notes || '-'}</td>
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
  formCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '30px',
    marginBottom: '30px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    border: '1px solid #e2e8f0',
  },
  formTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#0d1b4b',
    marginBottom: '20px',
  },
  sectionSubtitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#475569',
    marginTop: '10px',
    marginBottom: '10px',
    borderBottom: '1px solid #f1f5f9',
    paddingBottom: '8px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  formRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
  },
  formGroup: {
    flex: '1',
    minWidth: '200px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  input: {
    padding: '10px 14px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    color: '#334155',
  },
  select: {
    padding: '10px 14px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    backgroundColor: 'white',
    fontSize: '14px',
    color: '#334155',
  },
  textarea: {
    padding: '10px 14px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    color: '#334155',
    resize: 'vertical',
  },
  itemRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: '12px',
    backgroundColor: '#f8fafc',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid #f1f5f9',
  },
  itemLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#64748b',
    marginBottom: '4px',
  },
  itemField: {
    flex: '1',
    minWidth: '80px',
    display: 'flex',
    flexDirection: 'column',
  },
  itemFieldSelect: {
    flex: '2',
    minWidth: '150px',
    display: 'flex',
    flexDirection: 'column',
  },
  removeBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#ef4444',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '10px',
  },
  addMoreBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#0d1b4b',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    marginBottom: '10px',
  },
  orangeBtn: {
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    alignSelf: 'flex-start',
    boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)',
  },
  historyTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#0d1b4b',
    marginBottom: '16px',
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
    backgroundColor: 'white',
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
  tdItalic: {
    padding: '14px 18px',
    fontSize: '13px',
    color: '#64748b',
    fontStyle: 'italic',
    verticalAlign: 'top',
  },
  itemList: {
    listStyleType: 'none',
    paddingLeft: '0',
    margin: '0',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  itemBullet: {
    fontSize: '13px',
    color: '#334155',
  },
  condBadge: (cond) => {
    let color = '#10b981';
    let bg = '#d1fae5';
    if (cond === 'Damaged') {
      color = '#ef4444';
      bg = '#fee2e2';
    } else if (cond === 'Shortage') {
      color = '#f59e0b';
      bg = '#fef3c7';
    }
    return {
      color,
      backgroundColor: bg,
      padding: '2px 6px',
      borderRadius: '4px',
      fontSize: '10px',
      fontWeight: '600',
      marginLeft: '4px'
    };
  },
  statusBadge: {
    backgroundColor: '#d1fae5',
    color: '#10b981',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '700',
  },
  errorAlert: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fca5a5',
    color: '#b91c1c',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '20px',
  },
  successAlert: {
    backgroundColor: '#f0fdf4',
    border: '1px solid #86efac',
    color: '#15803d',
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

export default GRNPage;
