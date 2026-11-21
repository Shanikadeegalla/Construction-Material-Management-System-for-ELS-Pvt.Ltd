// Regression tests for the defects found in system testing (D-01 to D-06).
import 'dotenv/config';
import { jest, describe, test, expect, afterEach } from '@jest/globals';
import mongoose from 'mongoose';
import { validateStockLevels, duplicateMaterialMessage } from '../../utils/itemMasterValidation.js';
import { createItemMaster, updateItemMaster } from '../../controllers/itemMasterController.js';
import { createPurchaseRequest, createPurchaseRequestFromBOM } from '../../controllers/purchaseRequestController.js';
import ItemMaster from '../../models/ItemMaster.js';
import Supplier from '../../models/Supplier.js';

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const validMaterial = {
  materialCode: 'MAT9001', materialName: 'Test Cement', category: 'Cement & Concrete', unit: 'Bag',
  estimatedUnitCost: 2500, minimumStock: 50, reorderLevel: 100, maximumStock: 500
};

afterEach(() => jest.restoreAllMocks());

describe('D-06: Item Master stock level validation', () => {
  test('accepts minimum ≤ pre-order ≤ maximum', () => {
    expect(validateStockLevels({ minimumStock: 50, reorderLevel: 100, maximumStock: 500 })).toBeNull();
    expect(validateStockLevels({ minimumStock: 50, reorderLevel: 0, maximumStock: 500 })).toBeNull();
  });

  test('rejects minimum greater than maximum', () => {
    expect(validateStockLevels({ minimumStock: 600, reorderLevel: 0, maximumStock: 500 }))
      .toBe('Minimum stock cannot exceed maximum stock.');
  });

  test('rejects pre-order level outside the minimum–maximum range', () => {
    expect(validateStockLevels({ minimumStock: 50, reorderLevel: 20, maximumStock: 500 })).toMatch(/Pre-order/);
    expect(validateStockLevels({ minimumStock: 50, reorderLevel: 900, maximumStock: 500 })).toMatch(/Pre-order/);
  });

  test('rejects negative and non-numeric values', () => {
    expect(validateStockLevels({ minimumStock: -1, reorderLevel: 0, maximumStock: 500 })).toMatch(/negative/);
    expect(validateStockLevels({ minimumStock: 'abc', reorderLevel: 0, maximumStock: 500 })).toMatch(/numbers/);
  });

  test('create API returns 400 and saves nothing when minimum exceeds maximum', async () => {
    const save = jest.spyOn(ItemMaster.prototype, 'save');
    const res = mockRes();
    await createItemMaster({ body: { ...validMaterial, minimumStock: 600, maximumStock: 500, reorderLevel: 0 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toBe('Minimum stock cannot exceed maximum stock.');
    expect(save).not.toHaveBeenCalled();
  });

  test('update API returns 400 when the new minimum exceeds the stored maximum', async () => {
    const stored = { minimumStock: 50, maximumStock: 500, reorderLevel: 100, save: jest.fn() };
    jest.spyOn(ItemMaster, 'findById').mockResolvedValue(stored);
    const res = mockRes();
    await updateItemMaster({ params: { id: 'x' }, body: { minimumStock: 700 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(stored.save).not.toHaveBeenCalled();
  });
});

describe('D-05: duplicate material code message', () => {
  test('maps duplicate-key errors to clear messages', () => {
    expect(duplicateMaterialMessage({ code: 11000, keyPattern: { materialCode: 1 } })).toMatch(/Material code already exists/);
    expect(duplicateMaterialMessage({ code: 11000, keyPattern: { materialName: 1 } })).toMatch(/name already exists/);
    expect(duplicateMaterialMessage(new Error('other'))).toBeNull();
  });

  test('create API returns 409 with a clear message instead of the raw database error', async () => {
    const dup = Object.assign(new Error('E11000 duplicate key error collection: itemmasters index: materialCode_1'),
      { code: 11000, keyPattern: { materialCode: 1 } });
    jest.spyOn(ItemMaster.prototype, 'save').mockRejectedValue(dup);
    const res = mockRes();
    await createItemMaster({ body: validMaterial }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    const { message } = res.json.mock.calls[0][0];
    expect(message).toBe('Material code already exists. Please use a different code.');
    expect(message).not.toMatch(/E11000/);
  });
});

describe('D-04: purchase request without materials', () => {
  test('BOM-based PR with no materials is rejected', async () => {
    const res = mockRes();
    await createPurchaseRequestFromBOM({ body: { bomId: new mongoose.Types.ObjectId().toString(), materials: [] }, user: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/at least one/);
  });

  test('manual PR with no materials is rejected', async () => {
    const res = mockRes();
    await createPurchaseRequest({ body: { projectName: 'PRJ-1', materials: [] }, user: { name: 'Store' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('D-01: supplier bank account number', () => {
  test('letters and symbols are rejected by the Supplier model', () => {
    const s = new Supplier({ supplierId: 'SUP-T1', name: 'Test', phone: '0712345678', accountNumber: 'ABC@123' });
    const err = s.validateSync();
    expect(err && err.errors.accountNumber).toBeDefined();
  });

  test('a numeric account number passes', () => {
    const s = new Supplier({ supplierId: 'SUP-T2', name: 'Test', phone: '0712345678', accountNumber: '0012345678' });
    const err = s.validateSync();
    expect(err ? err.errors.accountNumber : undefined).toBeUndefined();
  });
});
