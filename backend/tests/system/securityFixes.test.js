import 'dotenv/config';
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import rateLimit from 'express-rate-limit';
import User from '../../models/userModel.js';
import Permission from '../../models/Permission.js';
import AuditLog from '../../models/AuditLog.js';
import { loginUser, deactivateUser, updateUser } from '../../controllers/authController.js';
import { protect } from '../../middleware/authMiddleware.js';
import generateToken from '../../utils/generateToken.js';
import { checkPermission } from '../../middleware/permissionMiddleware.js';

describe('System Security Fixes Tests', () => {
  beforeEach(() => {
    jest.spyOn(AuditLog, 'create').mockResolvedValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('(a) login with admin/password123 returns 401', async () => {
    jest.spyOn(User, 'findOne').mockResolvedValue(null);
    jest.spyOn(User, 'find').mockResolvedValue([]);
    const req = {
      body: { email: 'admin', password: 'password123' },
      ip: '127.0.0.1',
      headers: {},
      socket: {}
    };
    let statusCode = 200;
    const res = {
      status(code) { statusCode = code; return this; },
      json() { return this; }
    };
    let error;
    try {
      await loginUser(req, res, (err) => { error = err; });
    } catch (err) {
      error = err;
    }
    expect(statusCode).toBe(401);
    expect(error?.message).toBe('Invalid credentials');
  });

  test('(b) deactivated user gets 403 and stays deactivated after login', async () => {
    const mockUser = {
      name: 'Deactivated User',
      email: 'deactivated@els.com',
      status: false,
      matchPassword: jest.fn().mockResolvedValue(true),
      save: jest.fn().mockResolvedValue(true)
    };
    jest.spyOn(User, 'findOne').mockResolvedValue(mockUser);
    jest.spyOn(User, 'find').mockResolvedValue([]);

    const req = {
      body: { email: 'deactivated@els.com', password: 'Password@123!' },
      ip: '127.0.0.1',
      headers: {},
      socket: {}
    };
    let statusCode = 200;
    const res = {
      status(code) { statusCode = code; return this; },
      json() { return this; }
    };
    let error;
    try {
      await loginUser(req, res, (err) => { error = err; });
    } catch (err) {
      error = err;
    }
    expect(statusCode).toBe(403);
    expect(error?.message).toBe('Account is deactivated');
    expect(mockUser.status).toBe(false);
  });

  test('(c) normal user gets 403 on GRN approve', async () => {
    const middleware = checkPermission('Create GRN');
    const req = {
      user: { role: 'ProjectManager', name: 'Normal PM' },
      method: 'PUT',
      params: { id: 'grn-123' },
      body: { status: 'Approved' }
    };
    let statusCode = 200;
    const res = {
      status(code) { statusCode = code; return this; },
      json() { return this; }
    };
    let error;
    jest.spyOn(Permission, 'findOne').mockResolvedValue(null);

    try {
      await middleware(req, res, (err) => { error = err; });
    } catch (err) {
      error = err;
    }
    expect(statusCode).toBe(403);
    expect(error?.message).toContain('Your role does not have permission');
  });

  test('(d) 11th bad login returns 429', async () => {
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      skipSuccessfulRequests: true,
      statusCode: 429,
      message: { success: false, message: 'Too many login attempts, please try again after 15 minutes' },
      validate: { trustProxy: false }
    });

    const appMock = { get: (k) => (k === 'trust proxy' ? 1 : undefined) };
    let finalStatus = 200;
    for (let i = 1; i <= 11; i++) {
      let calledNext = false;
      const req = { ip: '198.51.100.99', headers: {}, app: appMock };
      const res = {
        status(c) { finalStatus = c; return this; },
        send() { return this; },
        setHeader() { return this; },
        getHeader() {},
        once(event, fn) { if (event === 'finish') fn(); return this; },
        on() { return this; },
        emit() { return true; }
      };
      await limiter(req, res, () => {
        calledNext = true;
        finalStatus = 401;
      });
      if (i <= 10) {
        expect(calledNext).toBe(true);
        expect(finalStatus).toBe(401);
      } else {
        expect(calledNext).toBe(false);
        expect(finalStatus).toBe(429);
      }
    }
    expect(finalStatus).toBe(429);
  });

  test('(e) deactivate user -> login returns 403 -> old token on a protected route returns 401/403', async () => {
    const userId = '60d0fe4f5311236168a109ca';
    const mockUser = {
      _id: userId,
      name: 'Deactivated Flow User',
      email: 'deact-flow@els.com',
      status: true,
      role: 'ProjectManager',
      matchPassword: jest.fn().mockResolvedValue(true),
      save: jest.fn().mockResolvedValue(true)
    };

    // 1. Deactivate user
    jest.spyOn(User, 'findById').mockReturnValue({
      ...mockUser,
      select: jest.fn().mockResolvedValue(mockUser),
      then: (resolve) => resolve(mockUser)
    });
    jest.spyOn(User, 'countDocuments').mockResolvedValue(2);

    const reqDeact = {
      params: { id: userId },
      user: { role: 'Admin', _id: 'admin-id' }
    };
    let deactStatus = 200;
    const resDeact = {
      status(code) { deactStatus = code; return this; },
      json() { return this; }
    };
    await deactivateUser(reqDeact, resDeact, () => {});
    expect(mockUser.status).toBe(false);

    // 2. Login returns 403
    jest.spyOn(User, 'findOne').mockResolvedValue(mockUser);
    jest.spyOn(User, 'find').mockResolvedValue([]);
    const reqLogin = {
      body: { email: 'deact-flow@els.com', password: 'Password@123!' },
      ip: '127.0.0.1',
      headers: {},
      socket: {}
    };
    let loginStatus = 200;
    let loginError = null;
    const resLogin = {
      status(code) { loginStatus = code; return this; },
      json() { return this; }
    };
    try {
      await loginUser(reqLogin, resLogin, (err) => { loginError = err; });
    } catch (err) {
      loginError = err;
    }
    expect(loginStatus).toBe(403);
    expect(loginError?.message).toBe('Account is deactivated');

    // 3. Old token on protected route returns 401/403
    const token = generateToken(userId);
    const reqProtect = {
      headers: { authorization: `Bearer ${token}` }
    };
    let protectStatus = 200;
    let protectError = null;
    const resProtect = {
      status(code) { protectStatus = code; return this; },
      json() { return this; }
    };
    await protect(reqProtect, resProtect, (err) => { protectError = err; });
    expect(protectStatus).toBe(401);
    expect(protectError?.message).toMatch(/deactivated/i);
  });

  test('(f) disable user via updateUser API with different field names (isActive/disabled/status:Inactive) -> DB status is false', async () => {
    const userId = '60d0fe4f5311236168a109cb';
    const mockUser = {
      _id: userId,
      name: 'Field Map User',
      email: 'fieldmap@els.com',
      status: true,
      role: 'ProjectManager',
      save: jest.fn().mockImplementation(function() { return Promise.resolve(this); })
    };

    jest.spyOn(User, 'findById').mockResolvedValue(mockUser);
    jest.spyOn(User, 'countDocuments').mockResolvedValue(2);

    // Test 1: isActive: false
    const req1 = {
      params: { id: userId },
      user: { role: 'Admin', _id: 'admin-id' },
      body: { isActive: false }
    };
    let resStatus1 = 200;
    let resData1 = null;
    const res1 = {
      status(c) { resStatus1 = c; return this; },
      json(d) { resData1 = d; return this; }
    };
    await updateUser(req1, res1, () => {});
    expect(mockUser.status).toBe(false);
    expect(resData1?.data?.status).toBe(false);

    // Test 2: status: 'Inactive' string
    mockUser.status = true;
    const req2 = {
      params: { id: userId },
      user: { role: 'Admin', _id: 'admin-id' },
      body: { status: 'Inactive' }
    };
    await updateUser(req2, res1, () => {});
    expect(mockUser.status).toBe(false);

    // Test 3: disabled: true
    mockUser.status = true;
    const req3 = {
      params: { id: userId },
      user: { role: 'Admin', _id: 'admin-id' },
      body: { disabled: true }
    };
    await updateUser(req3, res1, () => {});
    expect(mockUser.status).toBe(false);
  });
});
