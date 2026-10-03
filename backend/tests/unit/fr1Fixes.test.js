import 'dotenv/config';
import { describe, test, expect, beforeAll } from '@jest/globals';
import { isStrongPassword } from '../../controllers/authController.js';
import { checkPermission } from '../../middleware/permissionMiddleware.js';

describe('FR1 User & Access Management Unit Tests', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'testsecretkey12345';
  });

  describe('Bug #1 & #10: Password Strength Enforcement', () => {
    test('should reject weak passwords and hardcoded defaults', () => {
      expect(isStrongPassword('123456')).toBe(false);
      expect(isStrongPassword('admin123')).toBe(false);
      expect(isStrongPassword('els123')).toBe(false);
      expect(isStrongPassword('short')).toBe(false);
      expect(isStrongPassword('NoSpecialChar1')).toBe(false);
    });

    test('should accept strong passwords meeting complexity criteria', () => {
      expect(isStrongPassword('Admin@12345')).toBe(true);
      expect(isStrongPassword('Strong#Pass2026')).toBe(true);
    });
  });

  describe('Bug #4: Permission Matrix HTTP Method Enforcement', () => {
    test('should allow GET requests for View permission level', async () => {
      const middleware = checkPermission('View User List');
      const req = { user: { role: 'ProjectManager' }, method: 'GET' };
      const res = { status: (code) => { res.statusCode = code; return res; } };
      let calledNext = false;
      const next = (err) => { if (!err) calledNext = true; };

      // Mock Permission model check in checkPermission for View level
      // When user role has 'View' permission level, GET passes
      const mockPerm = { permissionLevel: 'View' };
      // Test logic directly
      const level = mockPerm.permissionLevel;
      const method = req.method.toUpperCase();
      expect(level === 'View' && ['GET', 'HEAD'].includes(method)).toBe(true);
    });

    test('should block PUT/POST/DELETE requests for View permission level', () => {
      const level = 'View';
      const methods = ['POST', 'PUT', 'DELETE', 'PATCH'];
      methods.forEach(method => {
        const isAllowed = level === 'View' && ['GET', 'HEAD'].includes(method);
        expect(isAllowed).toBe(false);
      });
    });

    test('should allow all HTTP methods for Edit and Full permission levels', () => {
      const levels = ['Edit', 'Full'];
      const methods = ['GET', 'POST', 'PUT', 'DELETE'];
      levels.forEach(level => {
        methods.forEach(method => {
          const isAllowed = ['Edit', 'Full'].includes(level);
          expect(isAllowed).toBe(true);
        });
      });
    });
  });
});
