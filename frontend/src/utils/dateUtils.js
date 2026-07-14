// Centralized date/time display formatting - always day/month/year, regardless of browser locale.

const pad = (n) => String(n).padStart(2, '0');

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// 13/07/2026
export const formatDate = (date) => {
  const d = new Date(date);
  if (isNaN(d)) return '';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

// 13/07/2026, 02:30 PM
export const formatDateTime = (date) => {
  const d = new Date(date);
  if (isNaN(d)) return '';
  let hours = d.getHours();
  const minutes = pad(d.getMinutes());
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${formatDate(d)}, ${pad(hours)}:${minutes} ${ampm}`;
};

// Monday, 13 July 2026
export const formatDateLong = (date) => {
  const d = new Date(date);
  if (isNaN(d)) return '';
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

// Mon, 13 Jul
export const formatDateWeekdayShort = (date) => {
  const d = new Date(date);
  if (isNaN(d)) return '';
  return `${WEEKDAYS[d.getDay()].slice(0, 3)}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
};

// 13 Jul 2026
export const formatDateMedium = (date) => {
  const d = new Date(date);
  if (isNaN(d)) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
};

// 13 Jul
export const formatDayMonth = (date) => {
  const d = new Date(date);
  if (isNaN(d)) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
};
