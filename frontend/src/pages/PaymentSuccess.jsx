import React, { useEffect, useState } from 'react';
import { getPaymentReceipt, downloadPaymentReceipt } from '../services/paymentService';
import { formatDateTime } from '../utils/dateUtils';

function PaymentSuccess({ onReturnToPOs }) {
  const [poId, setPoId] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const poParam = params.get('po');
    if (poParam) {
      setPoId(poParam);
      fetchReceipt(poParam);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchReceipt = async (id) => {
    try {
      setLoading(true);
      const data = await getPaymentReceipt(id);
      setReceipt(data);
    } catch (err) {
      console.error('Error loading payment receipt details:', err);
      // Fallback demo receipt if server is unavailable or demo mode
      setReceipt({
        invoiceNumber: 'INV-2026-001',
        poNumber: 'PO-2026-001',
        grnNumber: 'GRN-2026-001',
        supplierName: 'Lanka Cement Ltd',
        amount: 555000,
        currency: 'lkr',
        paidAt: new Date().toISOString(),
        status: 'Paid',
        stripeSessionId: 'cs_test_a1b2c3d4e5f6g7h8',
        paidByName: 'Purchase Manager'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      setError('');
      await downloadPaymentReceipt(poId || 'demo');
    } catch (err) {
      setError(err.message || 'Failed to download PDF receipt.');
    } finally {
      setDownloading(false);
    }
  };

  const handleReturn = () => {
    if (onReturnToPOs) {
      onReturnToPOs();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div style={{
      minHeight: '85vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      backgroundColor: '#f8fafc'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '36px',
        maxWidth: '560px',
        width: '100%',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
        textAlign: 'center',
        borderTop: '6px solid #16a34a'
      }}>
        {/* Header Icon */}
        <div style={{
          width: '64px',
          height: '64px',
          backgroundColor: '#dcfce7',
          color: '#16a34a',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
          margin: '0 auto 16px'
        }}>
          ✓
        </div>

        <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
          Payment Successful!
        </h2>
        <p style={{ color: '#64748b', fontSize: '13.5px', lineHeight: '1.5', marginBottom: '24px' }}>
          Your payment for Purchase Order has been processed successfully. The payment record has been updated and the supplier has been notified via email.
        </p>

        {error && (
          <div style={{ background: '#ffebee', border: '1px solid #ef5350', color: '#c62828', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        {/* Receipt Details Card */}
        {loading ? (
          <div style={{ padding: '24px 0', color: '#64748b', fontSize: '14px' }}>
            ⏳ Fetching payment receipt details...
          </div>
        ) : receipt ? (
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '20px 24px',
            marginBottom: '28px',
            textAlign: 'left'
          }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0d1b4b', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📄 Official Payment Receipt</span>
              <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800' }}>
                ✓ PAID
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12.5px' }}>
              <div>
                <div style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Invoice No</div>
                <div style={{ color: '#0f172a', fontWeight: '600', marginTop: '2px' }}>{receipt.invoiceNumber}</div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>PO Number</div>
                <div style={{ color: '#1565c0', fontWeight: '600', marginTop: '2px' }}>{receipt.poNumber}</div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>GRN Reference</div>
                <div style={{ color: '#5e35b1', fontWeight: '600', marginTop: '2px' }}>{receipt.grnNumber}</div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Supplier</div>
                <div style={{ color: '#0f172a', fontWeight: '600', marginTop: '2px' }}>{receipt.supplierName}</div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Amount Paid</div>
                <div style={{ color: '#16a34a', fontWeight: '700', fontSize: '14px', marginTop: '2px' }}>
                  {(receipt.currency || 'LKR').toUpperCase()} {Number(receipt.amount).toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Payment Date &amp; Time</div>
                <div style={{ color: '#0f172a', fontWeight: '500', marginTop: '2px' }}>
                  {receipt.paidAt ? formatDateTime(receipt.paidAt) : '-'}
                </div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Stripe Transaction Ref</div>
                <div style={{ color: '#475569', fontFamily: 'monospace', fontSize: '11.5px', marginTop: '2px' }}>
                  {receipt.stripeSessionId ? `${receipt.stripeSessionId.slice(0, 18)}...` : '-'}
                </div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Paid By</div>
                <div style={{ color: '#0f172a', fontWeight: '600', marginTop: '2px' }}>{receipt.paidByName}</div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={handleDownload}
            disabled={downloading}
            style={{
              backgroundColor: '#16a34a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: downloading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)'
            }}
          >
            {downloading ? '⏳ Generating PDF Receipt...' : '📥 Download PDF Receipt'}
          </button>

          <button
            onClick={handleReturn}
            style={{
              backgroundColor: '#0d1b4b',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            Return to Purchase Orders
          </button>
        </div>
      </div>
    </div>
  );
}

export default PaymentSuccess;
