/**
 * Utility functions for validating and formatting Bank Account Numbers
 */

// Strip any non-digit characters and restrict to 20 digits maximum
export const formatBankAccountInput = (raw) => {
  return (raw || '').replace(/\D/g, '').slice(0, 20);
};

// Bank Account Number validation:
// Optional field (empty is valid). If provided, must be between 6 and 20 numeric digits.
export const isValidBankAccount = (value) => {
  const val = (value || '').trim();
  if (!val) return true; // Optional field
  return /^\d{6,20}$/.test(val);
};

export const BANK_ACCOUNT_PLACEHOLDER = 'e.g. 8001234567';
