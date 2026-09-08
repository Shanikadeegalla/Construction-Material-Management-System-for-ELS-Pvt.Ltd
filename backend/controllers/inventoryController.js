import Material from '../models/Material.js';
import GRN from '../models/GRN.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import TransferLog from '../models/TransferLog.js';
import MaterialUsage from '../models/MaterialUsage.js';
import Supplier from '../models/Supplier.js';
import StockMovement from '../models/StockMovement.js';
import mongoose from 'mongoose';
import { encryptDB, decryptDB } from '../utils/cryptoUtils.js';
import { recordMovement, getDecryptedQuantity } from '../utils/stockService.js';

// @desc    Get all materials (optionally filter by location)
// @route   GET /api/inventory
// @access  Private
export const getMaterials = async (req, res) => {
  try {
    const { location } = req.query;
    const query = {};
    if (location) {
      query.location = location;
    }
    const materials = await Material.find(query).sort({ updatedAt: -1 });
    
    // Decrypt SiteStore materials
    const decrypted = materials.map(m => {
      const doc = m.toObject();
      if (doc.location === 'SiteStore') {
        doc.name = decryptDB(doc.name);
        doc.quantity = Number(decryptDB(doc.quantity)) || 0;
      }
      return doc;
    });
    
    res.json(decrypted);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add a new material (default location: MainStore)
// @route   POST /api/inventory/add
// @access  Private
export const addMaterial = async (req, res) => {
  try {
    const materialData = {
      ...req.body,
      location: req.body.location || 'MainStore'
    };
    if (materialData.location === 'SiteStore') {
      materialData.name = encryptDB(materialData.name);
      materialData.quantity = encryptDB(String(materialData.quantity || 0));
    }
    const material = new Material(materialData);
    await material.save();
    
    const doc = material.toObject();
    if (doc.location === 'SiteStore') {
      doc.name = decryptDB(doc.name);
      doc.quantity = Number(decryptDB(doc.quantity)) || 0;
    }
    res.status(201).json({ message: 'Material added successfully!', material: doc });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update a material
// @route   PUT /api/inventory/:id
// @access  Private
export const updateMaterial = async (req, res) => {
  try {
    const existing = await Material.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Material not found' });
    }
    const updateData = { ...req.body };
    // Current stock is always calculated from system transactions (GRN,
    // MIN, Usage, Stock Adjustment) — this endpoint may never overwrite it.
    delete updateData.quantity;
    const loc = updateData.location || existing.location;
    if (loc === 'SiteStore') {
      if (updateData.name) updateData.name = encryptDB(updateData.name);
      if (updateData.quantity !== undefined) updateData.quantity = encryptDB(String(updateData.quantity));
    }
    const material = await Material.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    const doc = material.toObject();
    if (doc.location === 'SiteStore') {
      doc.name = decryptDB(doc.name);
      doc.quantity = Number(decryptDB(doc.quantity)) || 0;
    }
    res.json({ message: 'Material updated successfully!', material: doc });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete a material
// @route   DELETE /api/inventory/:id
// @access  Private
export const deleteMaterial = async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) {
      return res.status(404).json({ message: 'Material not found' });
    }
    await Material.findByIdAndDelete(req.params.id);
    res.json({ message: 'Material deleted successfully!' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get low stock items
// @route   GET /api/inventory/low-stock
// @access  Private
export const getLowStock = async (req, res) => {
  try {
    const { location } = req.query;
    const query = {};
    if (location) {
      query.location = location;
    }
    const materials = await Material.find(query);
    
    const lowStock = [];
    for (const m of materials) {
      const doc = m.toObject();
      if (doc.location === 'SiteStore') {
        doc.name = decryptDB(doc.name);
        doc.quantity = Number(decryptDB(doc.quantity)) || 0;
      }
      if (doc.quantity <= doc.minimumStock) {
        lowStock.push(doc);
      }
    }
    res.json(lowStock);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a Goods Received Note (GRN) and update inventory
// @route   POST /api/inventory/grn
// @access  Private
export const createGRN = async (req, res) => {
  const { poReference, supplier, supplierId: bodySupplierId, receivedBy, receivedDate, items, notes } = req.body;

  if (!supplier || !receivedBy || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Missing required GRN information' });
  }

  try {
    let grnStatus = 'Completed';
    let poId = null;
    let supplierId = null;

    // 1. Validate against PO if poReference provided
    if (poReference) {
      const po = await PurchaseOrder.findOne({ poNumber: poReference });
      if (!po) {
        return res.status(400).json({ message: `Purchase Order '${poReference}' not found.` });
      }
      poId = po._id;
      if (po.supplier) {
        supplierId = po.supplier;
      }

      // Compare received items against PO ordered items
      let quantitiesMatch = true;
      let allItemsReceived = true;

      for (const poItem of po.items) {
        // Find matching item in incoming items
        const incomingItem = items.find(item => {
          const nameToCompare = item.materialName || item.name || '';
          return nameToCompare.toLowerCase() === poItem.materialName.toLowerCase();
        });

        if (!incomingItem) {
          quantitiesMatch = false;
          allItemsReceived = false;
        } else {
          const receivedQty = Number(incomingItem.receivedQty) || 0;
          if (receivedQty !== poItem.quantity) {
            quantitiesMatch = false;
          }
          if (receivedQty < poItem.quantity) {
            allItemsReceived = false;
          }
        }
      }

      // Check if GRN has extra items not in PO
      for (const grnItem of items) {
        const nameToCompare = grnItem.materialName || grnItem.name || '';
        if (nameToCompare) {
          const poItem = po.items.find(item => item.materialName.toLowerCase() === nameToCompare.toLowerCase());
          if (!poItem) {
            quantitiesMatch = false;
          }
        }
      }

      grnStatus = quantitiesMatch ? 'Verified' : 'Partial';

      if (allItemsReceived) {
        po.status = 'Delivered';
        await po.save();
      }
    }

    // 1b. Resolve supplierId: prefer an explicit id from the frontend, then the
    // linked PO's supplier, then a case-insensitive name match against Supplier records.
    if (bodySupplierId && mongoose.Types.ObjectId.isValid(bodySupplierId)) {
      supplierId = bodySupplierId;
    } else if (!supplierId) {
      const matchedSupplier = await Supplier.findOne({ name: new RegExp(`^${supplier}$`, 'i') });
      if (matchedSupplier) {
        supplierId = matchedSupplier._id;
      }
    }

    // 2. Auto-generate grnNumber (GRN-YYYY-XXX), based on the highest existing
    // serial for the current year rather than a raw count, so a deleted GRN
    // can't cause the next number to collide with one still in use.
    const year = new Date().getFullYear();
    const prefix = `GRN-${year}-`;
    const yearGrns = await GRN.find({ grnNumber: new RegExp(`^${prefix}`) }).select('grnNumber').lean();
    const maxSerial = yearGrns.reduce((max, g) => {
      const n = parseInt(g.grnNumber.slice(prefix.length), 10);
      return !isNaN(n) && n > max ? n : max;
    }, 0);
    const grnNumber = `${prefix}${String(maxSerial + 1).padStart(3, '0')}`;

    // 3. Resolve items.
    const resolvedItems = [];
    for (const item of items) {
      let materialId = item.material;
      let materialName = item.materialName || '';

      if (!materialId || !mongoose.Types.ObjectId.isValid(materialId)) {
        const searchName = materialName || item.name || materialId;
        let mat = await Material.findOne({ name: searchName, location: 'MainStore' });
        if (!mat) {
          mat = new Material({
            name: searchName,
            category: item.category || 'Other',
            unit: item.unit || 'bag',
            quantity: 0,
            minimumStock: 10,
            location: 'MainStore'
          });
          await mat.save();
        }
        materialId = mat._id;
        materialName = mat.name;
      } else {
        const mat = await Material.findById(materialId);
        if (mat) {
          materialName = mat.name;
        }
      }

      const condition = item.condition === 'Damaged' ? 'Damaged' : 'Good';
      resolvedItems.push({
        material: materialId,
        expectedQty: Number(item.expectedQty) || 0,
        receivedQty: Number(item.receivedQty) || 0,
        condition,
        damagedQty: condition === 'Damaged' ? (Number(item.damagedQty) || 0) : 0
      });
    }

    // 4. Save the GRN
    const grn = new GRN({
      grnNumber,
      poReference: poReference || 'N/A',
      poId,
      supplier,
      supplierId,
      receivedBy,
      receivedDate: receivedDate || new Date(),
      items: resolvedItems,
      status: grnStatus,
      notes
    });

    await grn.save();

    // 5. Increment quantities of received items in MainStore, logging each
    // as a Stock Movement so the ledger stays complete.
    for (const item of resolvedItems) {
      if (item.receivedQty > 0) {
        const mat = await Material.findById(item.material);
        if (mat) {
          await recordMovement({
            materialDoc: mat,
            type: 'GRN Receipt',
            quantityChange: item.receivedQty,
            reference: grnNumber,
            performedBy: receivedBy
          });
        }
      }
    }

    // Fetch updated inventory to return
    const updatedInventory = await Material.find();

    res.status(201).json({
      success: true,
      message: `GRN recorded successfully! Auto-generated Number: ${grnNumber}`,
      grn,
      inventory: updatedInventory
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Note: issuing materials from Main Store to Site Store now always goes
// through the Material Issuance Note flow (controllers/materialIssuanceController.js,
// mounted at /api/min), which validates against an approved BOM before any
// stock moves. This file keeps getTransfers below as a read-only ledger of
// the TransferLog rows that flow creates.

// @desc    Get all Goods Received Notes (GRN)
// @route   GET /api/inventory/grn
// @access  Private
export const getGRNs = async (req, res) => {
  try {
    const grns = await GRN.find().populate('items.material').sort({ createdAt: -1 });
    const decryptedGrns = grns.map(g => {
      const doc = g.toObject();
      if (doc.items && Array.isArray(doc.items)) {
        doc.items = doc.items.map(item => {
          if (item.material && item.material.location === 'SiteStore') {
            item.material.name = decryptDB(item.material.name);
            item.material.quantity = Number(decryptDB(item.material.quantity)) || 0;
          }
          return item;
        });
      }
      return doc;
    });
    res.json(decryptedGrns);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all transfer logs
// @route   GET /api/inventory/transfers
// @access  Private
export const getTransfers = async (req, res) => {
  try {
    const transfers = await TransferLog.find().sort({ date: -1 });
    const decrypted = transfers.map(t => {
      const doc = t.toObject();
      if (doc.to === 'SiteStore') {
        doc.materialName = decryptDB(doc.materialName);
        doc.quantity = Number(decryptDB(doc.quantity)) || 0;
      }
      return doc;
    });
    res.json(decrypted);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Log material usage at site
// @route   POST /api/inventory/usage
// @access  Private
export const createMaterialUsage = async (req, res) => {
  try {
    const { projectName, materialId, quantityUsed, activityDescription, usageDate, siteLocation } = req.body;
    if (!projectName || !materialId || !quantityUsed || !activityDescription) {
      return res.status(400).json({ success: false, message: 'Missing required usage fields.' });
    }

    const material = await Material.findById(materialId);
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }

    const isSite = material.location === 'SiteStore';
    const decName = isSite ? decryptDB(material.name) : material.name;
    const decQty = isSite ? Number(decryptDB(material.quantity)) || 0 : material.quantity;

    if (decQty < Number(quantityUsed)) {
      return res.status(400).json({ success: false, message: `Insufficient quantity available. Current: ${decQty}` });
    }

    // Save MaterialUsage
    const usage = new MaterialUsage({
      projectName,
      materialName: isSite ? encryptDB(decName) : decName,
      unit: material.unit,
      plannedQty: 0,
      actualQty: isSite ? encryptDB(String(quantityUsed)) : Number(quantityUsed),
      variance: isSite ? encryptDB(String(quantityUsed)) : Number(quantityUsed),
      recordedBy: req.user ? req.user.name : 'Store Officer',
      usageDate: usageDate || new Date()
    });

    await usage.save();

    // Decrement from inventory and log the movement.
    await recordMovement({
      materialDoc: material,
      type: 'Usage',
      quantityChange: -Number(quantityUsed),
      reference: activityDescription,
      performedBy: usage.recordedBy
    });

    // Fetch updated inventory to return
    const updatedInventory = await Material.find();
    const decryptedInv = updatedInventory.map(m => {
      const doc = m.toObject();
      if (doc.location === 'SiteStore') {
        doc.name = decryptDB(doc.name);
        doc.quantity = Number(decryptDB(doc.quantity)) || 0;
      }
      return doc;
    });

    const decUsage = usage.toObject();
    if (isSite) {
      decUsage.materialName = decryptDB(decUsage.materialName);
      decUsage.actualQty = Number(decryptDB(decUsage.actualQty)) || 0;
      decUsage.plannedQty = Number(decryptDB(decUsage.plannedQty)) || 0;
      decUsage.variance = Number(decryptDB(decUsage.variance)) || 0;
    }

    res.status(201).json({
      success: true,
      message: 'Material usage logged successfully!',
      data: decUsage,
      inventory: decryptedInv
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get material usage logs
// @route   GET /api/inventory/usage
// @access  Private
export const getMaterialUsage = async (req, res) => {
  try {
    const filter = {};
    if (req.query.projectName) {
      filter.projectName = req.query.projectName;
    }

    const usages = await MaterialUsage.find(filter).sort({ usageDate: -1 });

    const decrypted = usages.map(u => {
      const doc = u.toObject();
      // Safe decryption (decryptDB handles both encrypted and clear text)
      doc.materialName = decryptDB(doc.materialName);
      doc.actualQty = Number(decryptDB(doc.actualQty)) || doc.actualQty;
      doc.plannedQty = Number(decryptDB(doc.plannedQty)) || doc.plannedQty;
      doc.variance = Number(decryptDB(doc.variance)) || doc.variance;
      return doc;
    });

    res.status(200).json({ success: true, count: decrypted.length, data: decrypted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get low stock notifications
// @route   GET /api/inventory/notifications
// @access  Private
export const getNotifications = async (req, res) => {
  try {
    const materials = await Material.find({});

    const lowStock = [];
    for (const m of materials) {
      const doc = m.toObject();
      if (doc.location === 'SiteStore') {
        doc.name = decryptDB(doc.name);
        doc.quantity = Number(decryptDB(doc.quantity)) || 0;
      }
      if (doc.quantity <= doc.minimumStock) {
        lowStock.push(doc);
      }
    }

    const formatted = lowStock.map(m => {
      const alertLevel = m.quantity === 0 ? 'Critical' : 'Low';
      return {
        materialName: m.name,
        currentQty: m.quantity,
        minimumStock: m.minimumStock,
        location: m.location,
        alertLevel
      };
    });

    res.status(200).json({ success: true, count: formatted.length, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get the full stock movement ledger (every GRN receipt, MIN
//          issue/receipt, usage deduction and stock adjustment), with a
//          running balance per material, read from the persisted
//          StockMovement collection.
// @route   GET /api/inventory/stock-ledger
// @access  Private
export const getStockLedger = async (req, res) => {
  try {
    const { material, materialId, type, from, to } = req.query;

    const query = {};
    if (materialId && mongoose.Types.ObjectId.isValid(materialId)) {
      query.material = materialId;
    }
    if (type) {
      query.type = type;
    }
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    const movements = await StockMovement.find(query).sort({ createdAt: -1 });

    let entries = movements.map(m => ({
      date: m.createdAt,
      materialId: String(m.material),
      materialName: m.materialName,
      unit: m.unit,
      type: m.type,
      reference: m.reference,
      inQty: m.quantityChange > 0 ? m.quantityChange : 0,
      outQty: m.quantityChange < 0 ? Math.abs(m.quantityChange) : 0,
      balance: m.balanceAfter,
      performedBy: m.performedBy,
      remarks: m.reason ? `${m.reason}${m.notes ? ' — ' + m.notes : ''}` : (m.notes || '')
    }));

    if (material) {
      const q = String(material).toLowerCase();
      entries = entries.filter(e => e.materialName.toLowerCase().includes(q));
    }

    res.status(200).json({ success: true, count: entries.length, data: entries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Record an authorized Stock Adjustment (e.g. after a physical
//          count). The officer enters the counted quantity; the system
//          computes the +/- delta, applies it and logs the reason.
// @route   POST /api/inventory/adjustments
// @access  Private (Stock Adjustments permission)
export const createStockAdjustment = async (req, res) => {
  try {
    const { materialId, physicalCount, reason, notes } = req.body;

    if (!materialId || !mongoose.Types.ObjectId.isValid(materialId)) {
      return res.status(400).json({ success: false, message: 'A valid material is required.' });
    }
    if (physicalCount === undefined || physicalCount === null || isNaN(Number(physicalCount)) || Number(physicalCount) < 0) {
      return res.status(400).json({ success: false, message: 'Physical count must be a non-negative number.' });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, message: 'A reason is required for every stock adjustment.' });
    }

    const material = await Material.findById(materialId);
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }

    const currentQty = getDecryptedQuantity(material);
    const delta = Number(physicalCount) - currentQty;

    const count = await StockMovement.countDocuments({ type: 'Adjustment' });
    const reference = `ADJ-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
    const performedBy = req.user ? req.user.name : 'Main Store Officer';

    const { material: updated, movement } = await recordMovement({
      materialDoc: material,
      type: 'Adjustment',
      quantityChange: delta,
      reference,
      performedBy,
      reason: String(reason).trim(),
      notes: notes || ''
    });

    const doc = updated.toObject();
    if (doc.location === 'SiteStore') {
      doc.name = decryptDB(doc.name);
      doc.quantity = Number(decryptDB(doc.quantity)) || 0;
    }

    res.status(201).json({ success: true, message: 'Stock adjustment recorded successfully!', material: doc, movement });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get count of low stock notifications
// @route   GET /api/notifications/count
// @access  Private
export const getNotificationCount = async (req, res) => {
  try {
    const materials = await Material.find({});

    let count = 0;
    for (const m of materials) {
      const doc = m.toObject();
      if (doc.location === 'SiteStore') {
        doc.name = decryptDB(doc.name);
        doc.quantity = Number(decryptDB(doc.quantity)) || 0;
      }
      if (doc.quantity <= doc.minimumStock) {
        count++;
      }
    }

    res.status(200).json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
