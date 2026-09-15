import React, { useEffect, useState } from 'react';

function PaymentCancel({ onReturnToPOs }) {
  const [poId, setPoId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const poParam = params.get('po');
    if (poParam) setPoId(poParam);
  }, []);

  return (
    <div style={{
      minHeight: '80vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      backgroundColor: '#f8fafc'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '40px',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
        textAlign: 'center',
        borderTop: '6px solid #ef4444'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          backgroundColor: '#fee2e2',
          color: '#ef4444',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
          margin: '0 auto 20px'
        }}>
          ✕
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginBottom: '10px' }}>
          Payment Cancelled
        </h2>
        <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
          The checkout process was cancelled or not completed. No charges were made to your account for this Purchase Order.
        </p>
        <button
          onClick={() => {
            if (onReturnToPOs) {
              onReturnToPOs();
            } else {
              window.location.href = '/';
            }
          }}
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
  );
}

export default PaymentCancel;
