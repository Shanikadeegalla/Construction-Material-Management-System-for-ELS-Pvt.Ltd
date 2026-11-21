// Frontend unit tests (run with: npm test -- --watchAll=false)
// They need no extra packages: only the form helpers used across the dashboards are tested.
import { formatPhoneInput, isValidPhone } from './phoneUtils';
import { formatBankAccountInput } from './bankUtils';
import { calculateDueDate } from './invoiceUtils';
import { isValidJwtFormat } from './authUtils';

describe('phone number helpers', () => {
  test('formats a Sri Lankan number as 071 234 5678', () => {
    expect(formatPhoneInput('0712345678')).toBe('071 234 5678');
    expect(formatPhoneInput('071-234-5678999')).toBe('071 234 5678');
  });
  test('accepts 10 digits starting with 0 only', () => {
    expect(isValidPhone('071 234 5678')).toBe(true);
    expect(isValidPhone('71234567')).toBe(false);
    expect(isValidPhone('7712345678')).toBe(false);
  });
});

describe('bank account helper', () => {
  test('keeps digits only, at most 20', () => {
    expect(formatBankAccountInput('AB-8001 2345')).toBe('80012345');
    expect(formatBankAccountInput('1'.repeat(25))).toHaveLength(20);
  });
});

describe('invoice due date', () => {
  const iso = (d) => d.toISOString().slice(0, 10);
  test('follows the payment terms of the purchase order', () => {
    expect(iso(calculateDueDate('2026-11-01', '30 Days Credit'))).toBe('2026-12-01');
    expect(iso(calculateDueDate('2026-11-01', 'Cash on Delivery'))).toBe('2026-11-01');
    expect(iso(calculateDueDate('2026-11-01', ''))).toBe('2026-12-01');
  });
});

describe('login token format', () => {
  test('recognises a three-part JWT', () => {
    expect(isValidJwtFormat('aaa.bbb.ccc')).toBe(true);
    expect(isValidJwtFormat('not-a-token')).toBe(false);
  });
});
