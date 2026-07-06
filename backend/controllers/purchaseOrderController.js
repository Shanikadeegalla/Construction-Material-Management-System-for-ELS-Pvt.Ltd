import PurchaseOrder from '../models/PurchaseOrder.js';
import Material from '../models/Material.js';
import Supplier from '../models/Supplier.js';
import PurchaseRequest from '../models/PurchaseRequest.js';
import mongoose from 'mongoose';

// Helper to resolve material name to an ObjectId, creating a Material if it doesn't exist
const resolveMaterial = async (materialName, unit) => {
  let material = await Material.findOne({ name: materialName, location: 'MainStore' });
  if (!material) {
    // Determine category based on name keywords
    let category = 'Other';
    const lowerName = materialName.toLowerCase();
    if (lowerName.includes('cement')) category = 'Cement';
    else if (lowerName.includes('steel') || lowerName.includes('iron')) category = 'Steel';
    else if (lowerName.includes('brick')) category = 'Bricks';
    else if (lowerName.includes('sand')) category = 'Sand';
    else if (lowerName.includes('gravel')) category = 'Gravel';
    else if (lowerName.includes('wood') || lowerName.includes('timber')) category = 'Wood';
    else if (lowerName.includes('paint')) category = 'Paint';

    // Map units to supported schema enums
    let mappedUnit = 'piece';
    const cleanedUnit = unit ? unit.toLowerCase() : '';
    if (['kg', 'ton', 'litre', 'piece', 'bag', 'm3'].includes(cleanedUnit)) {
      mappedUnit = cleanedUnit;
    } else if (cleanedUnit === 'bags') {
      mappedUnit = 'bag';
    }

    material = new Material({
      name: materialName,
      category,
      unit: mappedUnit,
      quantity: 0,
      minimumStock: 10,
      location: 'MainStore'
    });
    await material.save();
  }
  return material;
};

// @desc    Get all purchase orders
// @route   GET /api/purchase-orders
// @access  Private
export const getPurchaseOrders = async (req, res) => {
  try {
    const pos = await PurchaseOrder.find()
      .populate('prId')
      .sort({ createdAt: -1 });

    const suppliers = await Supplier.find().lean();
    const supplierMap = {};
    suppliers.forEach(s => {
      supplierMap[s._id.toString()] = s.name;
    });

    const formattedPOs = pos.map(po => {
      let supplierName = 'Unknown';
      if (po.supplier) {
        const supStr = po.supplier.toString();
        if (supplierMap[supStr]) {
          supplierName = supplierMap[supStr];
        } else {
          supplierName = po.supplier;
        }
      }
      return {
        _id: po._id,
        poNumber: po.poNumber,
        prId: po.prId ? po.prId._id : null,
        supplier: supplierName,
        totalAmount: po.totalAmount,
        status: po.status,
        notes: po.notes || '',
        createdBy: po.createdBy,
        createdAt: po.createdAt,
        updatedAt: po.updatedAt,
        expectedDeliveryDate: po.expectedDeliveryDate,
        actualDeliveryDate: po.actualDeliveryDate,
        receivedQty: po.receivedQty,
        deliveryCondition: po.deliveryCondition,
        paymentTerms: po.paymentTerms,
        deliveryAddress: po.deliveryAddress,
        sentAt: po.sentAt,
        items: po.items.map(item => ({
          material: item.material,
          materialName: item.materialName,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice
        }))
      };
    });

    res.status(200).json({ success: true, count: formattedPOs.length, data: formattedPOs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a new purchase order
// @route   POST /api/purchase-orders
// @access  Private
export const createPurchaseOrder = async (req, res) => {
  try {
    const { prId, supplier, items, totalAmount, notes, expectedDeliveryDate, paymentTerms, deliveryAddress } = req.body;
    const createdBy = req.user ? req.user.name : (req.body.createdBy || 'Purchase Officer');

    if (!supplier || !items || !Array.isArray(items) || items.length === 0 || !totalAmount) {
      return res.status(400).json({ success: false, message: 'Missing required PO fields.' });
    }

    // 1. Auto-generate poNumber (PO-YYYY-XXX)
    const count = await PurchaseOrder.countDocuments();
    const year = new Date().getFullYear();
    const serial = String(count + 1).padStart(3, '0');
    const poNumber = `PO-${year}-${serial}`;

    // 2. Resolve items and their material ObjectIds
    const resolvedItems = [];
    for (const item of items) {
      const materialDoc = await resolveMaterial(item.materialName, item.unit);
      resolvedItems.push({
        material: materialDoc._id,
        materialName: item.materialName,
        quantity: Number(item.quantity) || 0,
        unit: item.unit || 'bag',
        unitPrice: Number(item.unitPrice) || 0
      });
    }

    // Resolve supplier to ObjectId
    let supplierId = null;
    if (mongoose.Types.ObjectId.isValid(supplier)) {
      supplierId = supplier;
    } else {
      const foundSupplier = await Supplier.findOne({ name: supplier });
      if (foundSupplier) {
        supplierId = foundSupplier._id;
      } else {
        const newSupplier = new Supplier({
          name: supplier,
          phone: 'N/A',
          category: 'Other'
        });
        await newSupplier.save();
        supplierId = newSupplier._id;
      }
    }

    // 3. Construct PO
    const poData = {
      poNumber,
      supplier: supplierId,
      items: resolvedItems,
      totalAmount: Number(totalAmount),
      notes: notes || '',
      createdBy,
      status: 'Pending',
      expectedDeliveryDate,
      paymentTerms,
      deliveryAddress
    };

    if (prId && mongoose.Types.ObjectId.isValid(prId)) {
      poData.prId = prId;
    }

    const po = new PurchaseOrder(poData);
    await po.save();

    // 4. Update PR status to "PO Created"
    if (prId && mongoose.Types.ObjectId.isValid(prId)) {
      await PurchaseRequest.findByIdAndUpdate(prId, { status: 'PO Created' });
    }

    res.status(201).json({ success: true, message: 'Purchase Order created successfully!', data: po });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get purchase order by ID
// @route   GET /api/purchase-orders/:id
// @access  Private
export const getPurchaseOrderById = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id)
      .populate('prId')
      .lean();

    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase order not found.' });
    }

    let supplierData = null;
    if (po.supplier) {
      if (mongoose.Types.ObjectId.isValid(po.supplier)) {
        supplierData = await Supplier.findById(po.supplier).lean();
      }
      if (!supplierData) {
        supplierData = { name: po.supplier.toString() };
      }
    }

    const formattedPo = {
      ...po,
      supplier: supplierData ? supplierData.name : 'Unknown'
    };

    res.status(200).json({ success: true, data: formattedPo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update PO status
// @route   PUT /api/purchase-orders/:id/status
// @access  Private
export const updatePurchaseOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !['Pending', 'Sent', 'Delivered', 'Closed', 'Cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid PO status.' });
    }

    const po = await PurchaseOrder.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('prId');

    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase order not found.' });
    }

    res.status(200).json({ success: true, message: `Purchase Order status updated to ${status}!`, data: po });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Send PO to supplier
// @route   PUT /api/purchase-orders/:id/send
// @access  Private
export const sendPurchaseOrder = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase order not found.' });
    }

    let supplierName = 'Supplier';
    if (po.supplier) {
      if (mongoose.Types.ObjectId.isValid(po.supplier)) {
        const found = await Supplier.findById(po.supplier);
        if (found) supplierName = found.name;
      } else {
        supplierName = po.supplier.toString();
      }
    }

    po.status = 'Sent';
    po.sentAt = new Date();

    await po.save();

    res.status(200).json({
      success: true,
      message: `${po.poNumber} sent to ${supplierName} successfully!`,
      data: po
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Rate PO delivery
// @route   PUT /api/purchase-orders/:id/rate-delivery
// @access  Private
export const ratePurchaseOrderDelivery = async (req, res) => {
  try {
    const { actualDeliveryDate, receivedQty, deliveryCondition } = req.body;

    if (!actualDeliveryDate || receivedQty === undefined || !deliveryCondition) {
      return res.status(400).json({ success: false, message: 'Missing delivery rating fields.' });
    }

    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase order not found.' });
    }

    po.actualDeliveryDate = new Date(actualDeliveryDate);
    po.receivedQty = Number(receivedQty);
    po.deliveryCondition = deliveryCondition;
    po.status = 'Delivered';

    await po.save();

    res.status(200).json({ success: true, message: 'Purchase Order delivery rated successfully!', data: po });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get supplier performance metrics
// @route   GET /api/purchase-orders/supplier-performance
// @access  Private
export const getSupplierPerformance = async (req, res) => {
  try {
    const pos = await PurchaseOrder.find().lean();
    const suppliers = await Supplier.find().lean();

    const supplierMap = {};
    suppliers.forEach(s => {
      supplierMap[s._id.toString()] = s.name;
    });

    const performanceData = {};

    // Initialize map with all suppliers
    suppliers.forEach(s => {
      performanceData[s.name] = {
        supplierName: s.name,
        totalOrders: 0,
        deliveredCount: 0,
        onTimeCount: 0,
        totalOrderedQty: 0,
        totalReceivedQty: 0
      };
    });

    pos.forEach(po => {
      let supplierName = 'Unknown';
      if (po.supplier) {
        const supStr = po.supplier.toString();
        if (supplierMap[supStr]) {
          supplierName = supplierMap[supStr];
        } else {
          supplierName = po.supplier;
        }
      }

      if (supplierName === 'Unknown') return;

      if (!performanceData[supplierName]) {
        performanceData[supplierName] = {
          supplierName,
          totalOrders: 0,
          deliveredCount: 0,
          onTimeCount: 0,
          totalOrderedQty: 0,
          totalReceivedQty: 0
        };
      }

      const metrics = performanceData[supplierName];
      metrics.totalOrders += 1;

      if (po.status === 'Delivered') {
        metrics.deliveredCount += 1;

        // Check if on-time
        if (po.actualDeliveryDate && po.expectedDeliveryDate) {
          const actual = new Date(po.actualDeliveryDate);
          const expected = new Date(po.expectedDeliveryDate);
          if (actual <= expected) {
            metrics.onTimeCount += 1;
          }
        } else {
          metrics.onTimeCount += 1; // Default to on-time if dates not recorded
        }

        // Qty accuracy
        const ordered = po.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
        metrics.totalOrderedQty += ordered;
        metrics.totalReceivedQty += (po.receivedQty || 0);
      }
    });

    const result = Object.values(performanceData).map(metrics => {
      let accuracyPercent = 100;
      let onTimePercent = 100;

      if (metrics.deliveredCount > 0) {
        if (metrics.totalOrderedQty > 0) {
          accuracyPercent = (metrics.totalReceivedQty / metrics.totalOrderedQty) * 100;
        }
        onTimePercent = (metrics.onTimeCount / metrics.deliveredCount) * 100;
      }

      accuracyPercent = Math.round(accuracyPercent * 10) / 10;
      onTimePercent = Math.round(onTimePercent * 10) / 10;

      // Rating rules:
      // Green "Excellent" (>95% accuracy)
      // Blue "Good" (>85% accuracy)
      // Yellow "Average" (>70% accuracy)
      // Red "Poor" (below 70%)
      let performanceRating = 'Poor';
      if (metrics.deliveredCount === 0) {
        performanceRating = 'N/A';
      } else if (accuracyPercent > 95) {
        performanceRating = 'Excellent';
      } else if (accuracyPercent > 85) {
        performanceRating = 'Good';
      } else if (accuracyPercent > 70) {
        performanceRating = 'Average';
      }

      return {
        supplierName: metrics.supplierName,
        totalOrders: metrics.totalOrders,
        onTimeDeliveries: metrics.onTimeCount,
        onTimePercent,
        deliveryAccuracy: accuracyPercent,
        performanceRating
      };
    });

    res.status(200).json({ success: true, count: result.length, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
