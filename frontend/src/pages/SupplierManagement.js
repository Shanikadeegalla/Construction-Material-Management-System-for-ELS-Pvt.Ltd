import React, { useState, useEffect } from 'react';

function SupplierManagement() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    category: 'Cement',
    status: 'Active'
  });

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    category: 'Cement',
    status: 'Active'
  });

  const API_SUPPLIER_URL = 'http://localhost:5000/api/suppliers';

  // Fetch suppliers
  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_SUPPLIER_URL);
      const data = await res.json();
      if (Array.isArray(data)) {
        setSuppliers(data);
      } else {
        setError('Failed to fetch suppliers.');
      }
    } catch (err) {
      setError('Could not connect to the backend server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const res = await fetch(API_SUPPLIER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Supplier added successfully!');
        setShowAddForm(false);
        setForm({
          name: '',
          contactPerson: '',
          phone: '',
          email: '',
          address: '',
          category: 'Cement',
          status: 'Active'
        });
        fetchSuppliers();
      } else {
        setError(data.message || 'Failed to add supplier.');
      }
    } catch (err) {
      setError('Connection error occurred.');
    }
  };

  const handleEditClick = (supplier) => {
    setEditingId(supplier._id);
    setEditForm({
      name: supplier.name,
      contactPerson: supplier.contactPerson || '',
      phone: supplier.phone,
      email: supplier.email || '',
      address: supplier.address || '',
      category: supplier.category,
      status: supplier.status
    });
  };

  const handleEditSubmit = async (e, id) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_SUPPLIER_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Supplier updated successfully!');
        setEditingId(null);
        fetchSuppliers();
      } else {
        setError(data.message || 'Failed to update supplier.');
      }
    } catch (err) {
      setError('Connection error occurred.');
    }
  };

  const toggleStatus = async (supplier) => {
    setError('');
    setSuccess('');
    const newStatus = supplier.status === 'Active' ? 'Inactive' : 'Active';
    try {
      const res = await fetch(`${API_SUPPLIER_URL}/${supplier._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setSuccess(`Supplier status changed to ${newStatus}!`);
        fetchSuppliers();
      } else {
        setError('Failed to update supplier status.');
      }
    } catch (err) {
      setError('Connection error.');
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.pageTitle}>Supplier Registry Directory</h1>

      {error && <div style={styles.errorAlert}>{error}</div>}
      {success && <div style={styles.successAlert}>{success}</div>}

      <div style={styles.actionsBar}>
        <button onClick={() => setShowAddForm(!showAddForm)} style={styles.orangeBtn}>
          {showAddForm ? '✕ Hide Form' : '+ Register New Supplier'}
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>Register New Partner / Supplier</h3>
          <form onSubmit={handleAddSubmit} style={styles.form}>
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Company Name</label>
                <input
                  type="text"
                  placeholder="e.g. Holcim Lanka Ltd"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Amal Perera"
                  value={form.contactPerson}
                  onChange={e => setForm({ ...form, contactPerson: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Category Type</label>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  style={styles.select}
                >
                  {['Cement', 'Steel', 'Bricks', 'Sand', 'Gravel', 'Wood', 'Paint', 'Other'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Phone Number</label>
                <input
                  type="text"
                  placeholder="+94 77 123 4567"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Email Address</label>
                <input
                  type="email"
                  placeholder="sales@holcim.lk"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Corporate Address</label>
                <input
                  type="text"
                  placeholder="123 Galle Road, Colombo 3"
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  style={styles.input}
                />
              </div>
            </div>

            <button type="submit" style={styles.orangeBtn}>Register Supplier</button>
          </form>
        </div>
      )}

      {/* Supplier List */}
      <div style={styles.tableContainer}>
        {loading ? (
          <div style={styles.loadingText}>Fetching registry logs...</div>
        ) : suppliers.length === 0 ? (
          <div style={styles.emptyState}>No suppliers registered in the system.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.th}>Supplier Company</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Contact Person</th>
                <th style={styles.th}>Phone</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Address</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map(s => {
                const isEditing = editingId === s._id;
                return (
                  <tr key={s._id} style={styles.tableRow(s.status === 'Inactive')}>
                    {isEditing ? (
                      // Editing Row Content
                      <td colSpan="8" style={styles.editRowCell}>
                        <form onSubmit={(e) => handleEditSubmit(e, s._id)} style={styles.editInlineForm}>
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                            style={styles.editInput}
                            required
                          />
                          <select
                            value={editForm.category}
                            onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                            style={styles.editSelect}
                          >
                            {['Cement', 'Steel', 'Bricks', 'Sand', 'Gravel', 'Wood', 'Paint', 'Other'].map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Contact Person"
                            value={editForm.contactPerson}
                            onChange={e => setEditForm({ ...editForm, contactPerson: e.target.value })}
                            style={styles.editInput}
                          />
                          <input
                            type="text"
                            placeholder="Phone"
                            value={editForm.phone}
                            onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                            style={styles.editInput}
                            required
                          />
                          <input
                            type="email"
                            placeholder="Email"
                            value={editForm.email}
                            onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                            style={styles.editInput}
                          />
                          <input
                            type="text"
                            placeholder="Address"
                            value={editForm.address}
                            onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                            style={styles.editInput}
                          />
                          <select
                            value={editForm.status}
                            onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                            style={styles.editSelect}
                          >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                          </select>
                          <button type="submit" style={styles.saveBtn}>Save</button>
                          <button type="button" onClick={() => setEditingId(null)} style={styles.cancelBtn}>Cancel</button>
                        </form>
                      </td>
                    ) : (
                      // Standard Row Content
                      <>
                        <td style={styles.tdBold}>{s.name}</td>
                        <td style={styles.td}>{s.category}</td>
                        <td style={styles.td}>{s.contactPerson || '-'}</td>
                        <td style={styles.td}>{s.phone}</td>
                        <td style={styles.td}>{s.email || '-'}</td>
                        <td style={styles.td}>{s.address || '-'}</td>
                        <td style={styles.td}>
                          {s.status === 'Active' ? (
                            <span style={styles.activeBadge}>✓ Active</span>
                          ) : (
                            <span style={styles.inactiveBadge}>✕ Inactive</span>
                          )}
                        </td>
                        <td style={styles.td}>
                          <div style={styles.actionGroup}>
                            <button onClick={() => handleEditClick(s)} style={styles.actionEditBtn}>Edit</button>
                            <button onClick={() => toggleStatus(s)} style={styles.actionStatusBtn}>
                              {s.status === 'Active' ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
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
    boxShadow: '0 4px 10px rgba(255,152,0,0.2)',
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    border: '1px solid #e2e8f0',
  },
  formTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#0d1b4b',
    marginBottom: '20px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
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
    fontSize: '11px',
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  input: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
  },
  select: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    backgroundColor: 'white',
    fontSize: '14px',
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
  tableRow: (isInactive) => ({
    borderBottom: '1px solid #f1f5f9',
    backgroundColor: 'white',
    opacity: isInactive ? 0.6 : 1,
  }),
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
  activeBadge: {
    backgroundColor: '#d1fae5',
    color: '#10b981',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '700',
  },
  inactiveBadge: {
    backgroundColor: '#fee2e2',
    color: '#ef4444',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '700',
  },
  actionGroup: {
    display: 'flex',
    gap: '8px',
  },
  actionEditBtn: {
    background: 'none',
    border: '1px solid #cbd5e1',
    color: '#334155',
    padding: '4px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  actionStatusBtn: {
    background: 'none',
    border: '1px solid #0d1b4b',
    color: '#0d1b4b',
    padding: '4px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  editRowCell: {
    padding: '12px 18px',
    backgroundColor: '#f8fafc',
  },
  editInlineForm: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    alignItems: 'center',
  },
  editInput: {
    padding: '6px 10px',
    borderRadius: '4px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    flex: '1',
    minWidth: '100px',
  },
  editSelect: {
    padding: '6px 10px',
    borderRadius: '4px',
    border: '1px solid #cbd5e1',
    backgroundColor: 'white',
    fontSize: '13px',
  },
  saveBtn: {
    backgroundColor: '#ff9800',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  cancelBtn: {
    backgroundColor: 'transparent',
    border: '1px solid #cbd5e1',
    color: '#64748b',
    borderRadius: '4px',
    padding: '6px 12px',
    fontSize: '13px',
    cursor: 'pointer',
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

export default SupplierManagement;
