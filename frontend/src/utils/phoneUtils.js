// Sri Lankan local phone numbers: 10 digits starting with 0, displayed as "071 234 5678".

export const formatPhoneInput = (raw) => {
  const digits = (raw || '').replace(/\D/g, '').slice(0, 10);
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean);
  return parts.join(' ');
};

export const isValidPhone = (value) => /^0\d{9}$/.test((value || '').replace(/\s/g, ''));

export const PHONE_PLACEHOLDER = '071 234 5678';
