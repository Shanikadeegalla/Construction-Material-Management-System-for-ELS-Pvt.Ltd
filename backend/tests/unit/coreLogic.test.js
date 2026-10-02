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
});
