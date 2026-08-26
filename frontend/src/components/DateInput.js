import React, { useState, useEffect, useRef } from 'react';

// Displays/accepts dd/mm/yyyy regardless of browser locale, while the value
// passed to onChange (and expected via the value prop) stays the same
// yyyy-mm-dd ISO string a native <input type="date"> would use - so callers
// and backend submissions are unaffected.

const isoToDisplay = (iso) => {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('T')[0].split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
};

const displayToIso = (display) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!match) return '';
  const [, d, m, y] = match;
  const day = Number(d), month = Number(m), year = Number(y);
  if (month < 1 || month > 12) return '';
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return '';
  return `${y}-${m}-${d}`;
};

const formatTyping = (raw) => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join('/');
};

const DateInput = ({ value, onChange, required, disabled, style, placeholder = 'dd/mm/yyyy', name }) => {
  const [display, setDisplay] = useState(isoToDisplay(value));
  const pickerRef = useRef(null);

  useEffect(() => {
    setDisplay(isoToDisplay(value));
  }, [value]);

  const isInvalid = display.length === 10 && displayToIso(display) === '';

  const handleChange = (e) => {
    const formatted = formatTyping(e.target.value);
    setDisplay(formatted);
    onChange(displayToIso(formatted));
  };

  const handlePickerChange = (e) => {
    onChange(e.target.value);
  };

  const openPicker = () => {
    if (disabled) return;
    const el = pickerRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch (err) {
        // fall through to focus-based fallback
      }
    }
    el.focus();
  };

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          inputMode="numeric"
          name={name}
          placeholder={placeholder}
          maxLength={10}
          value={display}
          onChange={handleChange}
          required={required}
          disabled={disabled}
          style={{ ...(isInvalid ? { ...style, borderColor: '#ef4444' } : style), paddingRight: '34px' }}
          title="dd/mm/yyyy"
          aria-invalid={isInvalid}
        />
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          aria-label="Choose date from calendar"
          tabIndex={-1}
          style={{
            position: 'absolute',
            right: '6px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            cursor: disabled ? 'default' : 'pointer',
            color: '#64748b',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </button>
        <input
          ref={pickerRef}
          type="date"
          tabIndex={-1}
          value={value ? String(value).split('T')[0] : ''}
          onChange={handlePickerChange}
          disabled={disabled}
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            right: '6px',
            width: '1px',
            height: '1px',
            opacity: 0,
            border: 'none',
            padding: 0,
            pointerEvents: 'none',
          }}
        />
      </div>
      {isInvalid && (
        <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
          Invalid date, please check the day/month.
        </div>
      )}
    </div>
  );
};

export default DateInput;
