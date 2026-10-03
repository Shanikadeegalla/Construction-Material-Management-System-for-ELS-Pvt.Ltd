import React, { useState } from 'react';

const th = { padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#666', fontWeight: '600' };
const td = { padding: '12px 16px', fontSize: '13px', color: '#334155' };

// "View (n)" button that opens a popup listing a record's materials/items.
const MaterialsViewButton = ({ items, title, subtitle, showPrice = false, defaultUnit = '-' }) => {
  const [open, setOpen] = useState(false);
  const list = items || [];
  const hasWarning = list.some(m => m.exceedsBom);
  const colCount = showPrice ? 4 : 3;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{ background: '#2563eb', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}
      >
        View ({list.length})
      </button>
      {hasWarning && <span title="Exceeds BOM plan" style={{ marginLeft: '6px' }}>⚠️</span>}

      {open && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }} onClick={() => setOpen(false)}>
          <div style={{ background: 'white', borderRadius: '10px', width: '600px', maxWidth: '90%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <h3 style={{ margin: 0, color: '#0d1b4b', fontWeight: '700' }}>{title || 'Materials'}</h3>
                {subtitle && <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>{subtitle}</p>}
              </div>
              <button onClick={() => setOpen(false)} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                ✕ Close
              </button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f5f6fa' }}>
                    <th style={th}>Material</th>
                    <th style={th}>Quantity</th>
                    <th style={th}>Unit</th>
                    {showPrice && <th style={th}>Unit Price (LKR)</th>}
                  </tr>
                </thead>
                <tbody>
                  {list.length === 0 ? (
                    <tr>
                      <td colSpan={colCount} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No materials listed.</td>
                    </tr>
                  ) : (
                    list.map((m, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ ...td, fontWeight: '600', color: '#0d1b4b' }}>
                          {m.materialName}
                          {m.exceedsBom && (
                            <div>
                              <span style={{ background: '#ffedd5', color: '#c2410c', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', fontSize: '10px', display: 'inline-block', marginTop: '2px' }}>
                                ⚠️ Exceeds BOM plan by {m.exceedAmount} {m.unit}
                              </span>
                            </div>
                          )}
                        </td>
                        <td style={td}>{m.quantity}</td>
                        <td style={td}>{m.unit || defaultUnit}</td>
                        {showPrice && <td style={td}>{m.unitPrice != null ? Number(m.unitPrice).toLocaleString() : '-'}</td>}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MaterialsViewButton;
