import React, { useState, useEffect } from 'react';

/**
 * Helper to get local date in YYYY-MM-DD format
 */
const getTodayDateString = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().substring(0, 10);
};

/**
 * PaymentModal Component
 * 
 * Clean, robust modal for recording manual payments (Cash / Cheque) against Director-approved invoices.
 * Toggles seamlessly between Cash and Cheque, preserving state and posting cleanly to /api/payments.
 */
export default function PaymentModal({ isOpen, onClose, onSuccess, invoice, apiBase = '' }) {
  const [paymentMethod, setPaymentMethod] = useState('Cash'); // 'Cash' | 'Cheque'
  const [voucherNo, setVoucherNo] = useState('');
  const [bankName, setBankName] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [paymentDate, setPaymentDate] = useState(getTodayDateString());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Reset form when modal opens or invoice changes
  useEffect(() => {
    if (isOpen) {
      setPaymentMethod('Cash');
      setVoucherNo('');
      setBankName('');
      setChequeDate('');
      setPaymentDate(getTodayDateString());
      setNotes('');
      setError('');
      setFieldErrors({});
    }
  }, [isOpen, invoice]);

  if (!isOpen || !invoice) return null;

  const invoiceAmount = Number(invoice.amount || invoice.totalAmount || 0);
  const invoiceNumber = invoice.invoiceNumber || invoice.invoiceNo || 'N/A';
  const supplierName = invoice.supplier?.name || invoice.supplierName || 'Authorized Supplier';
  const poNumber = invoice.po?.poNumber || invoice.poNumber || '-';

  const validateForm = () => {
    const errs = {};
    const trimmedVoucher = voucherNo.trim();

    if (!paymentDate) {
      errs.paymentDate = 'Payment date is required.';
    } else if (paymentDate > getTodayDateString()) {
      errs.paymentDate = 'Payment date cannot be in the future.';
    }

    if (paymentMethod === 'Cash') {
      if (trimmedVoucher.length > 50) {
        errs.voucherNo = 'Voucher / Receipt No cannot exceed 50 characters.';
      } else if (trimmedVoucher && !/^[a-zA-Z0-9\-_/]+$/.test(trimmedVoucher)) {
        errs.voucherNo = 'Only alphanumeric characters, -, _ and / are allowed.';
      }
    } else if (paymentMethod === 'Cheque') {
      if (!trimmedVoucher) {
        errs.voucherNo = 'Cheque number is required.';
      } else if (!/^\d{6}$/.test(trimmedVoucher)) {
        errs.voucherNo = 'Cheque number must be exactly 6 digits (e.g. 004512).';
      }

      if (!bankName.trim()) {
        errs.bankName = 'Bank name is required.';
      }
      if (!chequeDate) {
        errs.chequeDate = 'Cheque date is required.';
      }
    }

    if (notes.trim().length > 500) {
      errs.notes = 'Notes cannot exceed 500 characters.';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validateForm()) return;

    setLoading(true);

    try {
      const token = JSON.parse(localStorage.getItem('user') || '{}')?.token;
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const payload = {
        invoiceId: invoice._id,
        invoiceNo: invoiceNumber,
        purchaseOrderId: invoice.po?._id || invoice.po || invoice.purchaseOrderId,
        paymentMethod,
        method: paymentMethod,
        voucherNo: voucherNo.trim(),
        reference: voucherNo.trim(),
        bankName: paymentMethod === 'Cheque' ? bankName.trim() : '',
        chequeNumber: paymentMethod === 'Cheque' ? voucherNo.trim() : '',
        chequeDate: paymentMethod === 'Cheque' ? chequeDate : undefined,
        paymentDate,
        paidAt: paymentDate,
        notes: notes.trim()
      };

      const endpoint = `${apiBase}/api/payments/record`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (onSuccess) onSuccess(data);
        onClose();
      } else {
        setError(data.message || 'Failed to record the payment.');
      }
    } catch (err) {
      setError('Could not connect to the payment server. Please verify network connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <h3 style={styles.title}>Record Supplier Payment</h3>
          <button type="button" onClick={onClose} disabled={loading} style={styles.closeBtn}>&times;</button>
        </div>

        <p style={styles.subtitle}>
          Invoice <strong>{invoiceNumber}</strong> · {supplierName} · PO {poNumber}
        </p>

        {/* Amount Box */}
        <div style={styles.amountBox}>
          <span style={styles.amountLabel}>Total Payable Amount:</span>
          <span style={styles.amountValue}>LKR {invoiceAmount.toLocaleString()}</span>
        </div>

        {error && <div style={styles.errorAlert}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Payment Method Selector */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Payment Method *</label>
            <div style={styles.toggleRow}>
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('Cash');
                  setFieldErrors({});
                }}
                style={{
                  ...styles.toggleBtn,
                  ...(paymentMethod === 'Cash' ? styles.toggleBtnActive : styles.toggleBtnInactive)
                }}
              >
                💵 Cash
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('Cheque');
                  setFieldErrors({});
                }}
                style={{
                  ...styles.toggleBtn,
                  ...(paymentMethod === 'Cheque' ? styles.toggleBtnActive : styles.toggleBtnInactive)
                }}
              >
                🏦 Cheque
              </button>
            </div>
          </div>

          {/* Reference / Voucher / Cheque Number */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>
              {paymentMethod === 'Cheque' ? 'Cheque Number *' : 'Voucher / Receipt No.'}
            </label>
            <input
              type="text"
              value={voucherNo}
              onChange={(e) => setVoucherNo(e.target.value)}
              placeholder={paymentMethod === 'Cheque' ? '6 digits (e.g. 004512)' : 'Optional cash receipt code'}
              style={{
                ...styles.input,
                borderColor: fieldErrors.voucherNo ? '#ef4444' : '#cbd5e1'
              }}
            />
            {fieldErrors.voucherNo && <span style={styles.fieldError}>{fieldErrors.voucherNo}</span>}
          </div>

          {/* Cheque Specific Fields */}
          {paymentMethod === 'Cheque' && (
            <>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Bank Name *</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. Commercial Bank, BOC, Sampath Bank"
                  style={{
                    ...styles.input,
                    borderColor: fieldErrors.bankName ? '#ef4444' : '#cbd5e1'
                  }}
                />
                {fieldErrors.bankName && <span style={styles.fieldError}>{fieldErrors.bankName}</span>}
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Cheque Date *</label>
                <input
                  type="date"
                  value={chequeDate}
                  onChange={(e) => setChequeDate(e.target.value)}
                  style={{
                    ...styles.input,
                    borderColor: fieldErrors.chequeDate ? '#ef4444' : '#cbd5e1'
                  }}
                />
                {fieldErrors.chequeDate && <span style={styles.fieldError}>{fieldErrors.chequeDate}</span>}
              </div>
            </>
          )}

          {/* Payment Date */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Payment Date *</label>
            <input
              type="date"
              value={paymentDate}
              max={getTodayDateString()}
              onChange={(e) => setPaymentDate(e.target.value)}
              style={{
                ...styles.input,
                borderColor: fieldErrors.paymentDate ? '#ef4444' : '#cbd5e1'
              }}
            />
            {fieldErrors.paymentDate && <span style={styles.fieldError}>{fieldErrors.paymentDate}</span>}
          </div>

          {/* Notes */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional remarks (e.g., handed to supplier representative)..."
              style={{ ...styles.textarea, borderColor: fieldErrors.notes ? '#ef4444' : '#cbd5e1' }}
            />
            {fieldErrors.notes && <span style={styles.fieldError}>{fieldErrors.notes}</span>}
          </div>

          {/* Actions */}
          <div style={styles.actionRow}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={styles.cancelBtn}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={loading ? styles.submitBtnDisabled : styles.submitBtn}
            >
              {loading ? 'Recording Payment…' : `Confirm ${paymentMethod} Payment`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    padding: '16px'
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: '14px',
    width: '100%',
    maxWidth: '480px',
    padding: '28px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    borderTop: '6px solid #0d1b4b',
    color: '#0f172a',
    maxHeight: '90vh',
    overflowY: 'auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px'
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '700',
    color: '#0d1b4b'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    lineHeight: '1',
    color: '#94a3b8',
    cursor: 'pointer'
  },
  subtitle: {
    margin: '0 0 16px',
    fontSize: '13px',
    color: '#64748b'
  },
  amountBox: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '16px'
  },
  amountLabel: {
    fontSize: '13px',
    color: '#475569',
    fontWeight: '500'
  },
  amountValue: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#0d1b4b'
  },
  errorAlert: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#991b1b',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '14px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px'
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  label: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#334155'
  },
  toggleRow: {
    display: 'flex',
    gap: '10px'
  },
  toggleBtn: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  toggleBtnActive: {
    backgroundColor: '#fff7ed',
    border: '2px solid #ff9800',
    color: '#0d1b4b'
  },
  toggleBtnInactive: {
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    color: '#64748b'
  },
  input: {
    width: '100%',
    padding: '9px 12px',
    fontSize: '13px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    outline: 'none',
    boxSizing: 'border-box'
  },
  textarea: {
    width: '100%',
    height: '65px',
    padding: '9px 12px',
    fontSize: '13px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    outline: 'none',
    boxSizing: 'border-box',
    resize: 'vertical'
  },
  fieldError: {
    fontSize: '11px',
    color: '#dc2626',
    fontWeight: '500'
  },
  actionRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '6px'
  },
  cancelBtn: {
    padding: '10px 18px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#f1f5f9',
    color: '#334155',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer'
  },
  submitBtn: {
    padding: '10px 20px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#2e7d32',
    color: '#ffffff',
    fontWeight: '700',
    fontSize: '13px',
    cursor: 'pointer'
  },
  submitBtnDisabled: {
    padding: '10px 20px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#94a3b8',
    color: '#ffffff',
    fontWeight: '700',
    fontSize: '13px',
    cursor: 'not-allowed'
  }
};
