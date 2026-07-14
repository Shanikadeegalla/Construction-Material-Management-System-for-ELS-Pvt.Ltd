import React, { useState, useEffect } from 'react';

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

  useEffect(() => {
    setDisplay(isoToDisplay(value));
  }, [value]);

  const handleChange = (e) => {
    const formatted = formatTyping(e.target.value);
    setDisplay(formatted);
    onChange(displayToIso(formatted));
  };

  return (
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
      style={style}
      title="dd/mm/yyyy"
    />
  );
};

export default DateInput;
