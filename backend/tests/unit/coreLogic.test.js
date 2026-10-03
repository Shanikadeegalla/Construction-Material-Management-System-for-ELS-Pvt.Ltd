import 'dotenv/config';
import { jest, describe, test, expect, beforeAll } from '@jest/globals';
import { isStrongPassword } from '../../controllers/authController.js';
import { encryptDB, decryptDB, encryptTransit, decryptTransit } from '../../utils/cryptoUtils.js';
import { recordMovement } from '../../utils/stockService.js';

describe('CMMS Core Business Logic Unit Tests', () => {
  // Set up required environment variables before tests run
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'mysecretkeymustbe32byteslong12345';
  });

  describe('1. Password Validation Helper', () => {
    test('should approve a strong password matching security policy', () => {
      expect(isStrongPassword('SecureP@ss2026')).toBe(true);
      expect(isStrongPassword('Complex#Password99')).toBe(true);
    });

    test('should reject weak passwords lacking required complexity', () => {
      expect(isStrongPassword('short1!')).toBe(false); // under 8 chars
      expect(isStrongPassword('nopassword123')).toBe(false); // missing upper/special
      expect(isStrongPassword('NOSPACENUMBERS!')).toBe(false); // missing lower/numbers
      expect(isStrongPassword('Password2026')).toBe(false); // missing special char
      expect(isStrongPassword('')).toBe(false);
    });
  });

  describe('2. Encryption & Decryption Roundtrips', () => {
    test('should complete deterministic DB encryption roundtrip', () => {
      const originalText = 'Portland Cement OPC 50kg';
      const encrypted = encryptDB(originalText);
      expect(encrypted).not.toBe(originalText);
      expect(typeof encrypted).toBe('string');

      const decrypted = decryptDB(encrypted);
      expect(decrypted).toBe(originalText);
    });

    test('should complete transit encryption roundtrip', () => {
      const payload = 'Confidential Material Details';
      const encryptedTransit = encryptTransit(payload);
      expect(encryptedTransit).toContain(':');

      const decryptedTransit = decryptTransit(encryptedTransit);
      expect(decryptedTransit).toBe(payload);
    });
  });

  describe('3. BOM Version Bump Calculation Logic', () => {
    const bumpBOMVersion = (currentVersion) => {
      const numeric = parseFloat(currentVersion || '1.0');
      return (numeric + 0.1).toFixed(1);
    };

    test('should bump BOM version 1.0 to 1.1 correctly', () => {
      expect(bumpBOMVersion('1.0')).toBe('1.1');
      expect(bumpBOMVersion('1.1')).toBe('1.2');
      expect(bumpBOMVersion('2.5')).toBe('2.6');
    });
  });

  describe('4. Negative Stock Assertion in Stock Service', () => {
    test('should throw an error when stock change causes negative inventory', async () => {
      const mockMaterialDoc = {
        _id: 'mat_123',
        name: 'Steel Rebar 12mm',
        unit: 'ton',
        location: 'MainStore',
        quantity: 5,
        save: jest.fn().mockResolvedValue(true)
      };

      await expect(
        recordMovement({
          materialDoc: mockMaterialDoc,
          type: 'MIN Issue',
          quantityChange: -10, // Available is 5, requesting -10
          reference: 'MIN-001'
        })
      ).rejects.toThrow(/Insufficient stock/);
    });
  });

  describe('5. Supplier Bank Account Number Validation', () => {
    const validateBankAccountNumber = (acc) => {
      if (!acc || typeof acc !== 'string') return true;
      const trimmed = acc.trim();
      if (trimmed === '') return true;
      return /^\d{6,20}$/.test(trimmed);
    };

    test('should accept valid bank account numbers and empty optional values', () => {
      expect(validateBankAccountNumber('')).toBe(true);
      expect(validateBankAccountNumber('  ')).toBe(true);
      expect(validateBankAccountNumber('8001234567')).toBe(true); // 10 digits
      expect(validateBankAccountNumber('123456789012')).toBe(true); // 12 digits
      expect(validateBankAccountNumber('123456')).toBe(true); // 6 digits min boundary
      expect(validateBankAccountNumber('12345678901234567890')).toBe(true); // 20 digits max boundary
    });

    test('should reject invalid bank account numbers with letters, symbols, or incorrect length', () => {
      expect(validateBankAccountNumber('ABC12345')).toBe(false);
      expect(validateBankAccountNumber('800-123-456')).toBe(false);
      expect(validateBankAccountNumber('800 123 456')).toBe(false);
      expect(validateBankAccountNumber('12345')).toBe(false); // under 6 digits
      expect(validateBankAccountNumber('123456789012345678901')).toBe(false); // over 20 digits
    });
  });

  describe('6. Payment Recording & Validation Rules', () => {
    test('should enforce 6-digit numeric cheque numbers', () => {
      const isValidChequeNo = (num) => /^\d{6}$/.test((num || '').trim());
      expect(isValidChequeNo('004512')).toBe(true);
      expect(isValidChequeNo('123456')).toBe(true);
      expect(isValidChequeNo('12345')).toBe(false); // 5 digits
      expect(isValidChequeNo('1234567')).toBe(false); // 7 digits
      expect(isValidChequeNo('ABC123')).toBe(false); // non-digits
    });

    test('should enforce cash voucher receipt format and 50 char limit', () => {
      const isValidCashRef = (ref) => {
        const trimmed = (ref || '').trim();
        if (!trimmed) return true;
        return trimmed.length <= 50 && /^[a-zA-Z0-9\-_/]+$/.test(trimmed);
      };
      expect(isValidCashRef('VCH-2026_01/A')).toBe(true);
      expect(isValidCashRef('')).toBe(true);
      expect(isValidCashRef('VCH@123')).toBe(false); // invalid symbol @
      expect(isValidCashRef('A'.repeat(51))).toBe(false); // over 50 chars
    });

    test('should validate payment dates against future dates and invoice dates', () => {
      const isPaymentDateValid = (paidAtStr, invoiceDateStr) => {
        if (!paidAtStr) return false;
        const paidDate = new Date(paidAtStr);
        if (Number.isNaN(paidDate.getTime())) return false;
        
        const todayStr = new Date().toISOString().substring(0, 10);
        if (paidAtStr > todayStr) return false;

        if (invoiceDateStr) {
          const invStr = new Date(invoiceDateStr).toISOString().substring(0, 10);
          if (paidAtStr < invStr) return false;
        }
        return true;
      };

      const today = new Date().toISOString().substring(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().substring(0, 10);
      const tomorrow = new Date(Date.now() + 86400000).toISOString().substring(0, 10);

      expect(isPaymentDateValid(today, yesterday)).toBe(true);
      expect(isPaymentDateValid(tomorrow, yesterday)).toBe(false); // future date rejected
      expect(isPaymentDateValid(yesterday, today)).toBe(false); // earlier than invoice date rejected
    });

    test('should sanitize notes HTML tags to prevent XSS attacks', () => {
      const sanitizeNotes = (input) => {
        const raw = (input || '').trim();
        if (raw.length > 500) return null;
        return raw
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      };

      const xssInput = '<script>alert("XSS")</script> & "test"';
      const sanitized = sanitizeNotes(xssInput);
      expect(sanitized).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt; &amp; &quot;test&quot;');
      expect(sanitized).not.toContain('<script>');
    });
  });

  describe('7. Server-Side Pagination & Response Formatting Rules', () => {
    const paginateSlice = (items, pageParam, limitParam) => {
      if (!pageParam && !limitParam) {
        return items; // Legacy response: plain array
      }
      const page = Math.max(1, parseInt(pageParam, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(limitParam, 10) || 10));
      const skip = (page - 1) * limit;
      const total = items.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const slice = items.slice(skip, skip + limit);

      return {
        success: true,
        count: slice.length,
        total,
        page,
        limit,
        totalPages,
        data: slice
      };
    };

    const dataset = Array.from({ length: 45 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));

    test('should slice page 2 correctly with limit 10', () => {
      const result = paginateSlice(dataset, '2', '10');
      expect(result.success).toBe(true);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.total).toBe(45);
      expect(result.totalPages).toBe(5);
      expect(result.data.length).toBe(10);
      expect(result.data[0].id).toBe(11);
      expect(result.data[9].id).toBe(20);
    });

    test('should enforce max limit cap of 100', () => {
      const result = paginateSlice(dataset, '1', '500');
      expect(result.limit).toBe(100);
    });

    test('should handle invalid page or limit parameters safely', () => {
      const result = paginateSlice(dataset, '-5', 'abc');
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    test('should return un-wrapped array when page and limit parameters are omitted (legacy fallback)', () => {
      const result = paginateSlice(dataset, null, null);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(45);
    });
  });
});
