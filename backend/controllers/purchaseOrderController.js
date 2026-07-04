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

    const formattedPOs = pos.map(po => ({
      _id: po._id,
      poNumber: po.poNumber,
      prId: po.prId ? po.prId._id : null,
      supplier: po.supplier,
      totalAmount: po.totalAmount,
      status: po.status,
      notes: po.notes || '',
      createdBy: po.createdBy,
      createdAt: po.createdAt,
      updatedAt: po.updatedAt,
      items: po.items.map(item => ({
        material: item.material,
        materialName: item.materialName,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice
      }))
    }));

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
    const { prId, supplier, items, totalAmount, notes } = req.body;
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
      status: 'Pending'
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
      .populate('supplier');

    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase order not found.' });
    }

    res.status(200).json({ success: true, data: po });
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
