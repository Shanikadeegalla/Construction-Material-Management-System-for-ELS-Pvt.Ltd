import PurchaseOrder from '../models/PurchaseOrder.js';
import Material from '../models/Material.js';
import Supplier from '../models/Supplier.js';
import PurchaseRequest from '../models/PurchaseRequest.js';
import User from '../models/userModel.js';
import mongoose from 'mongoose';
import { createNotificationHelper } from './notificationController.js';
import { sendMail, escapeHtml } from '../utils/mailer.js';

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
        prId: po.prId ? { _id: po.prId._id, project: po.prId.project, projectName: po.prId.projectName } : null,
        supplier: supplierName,
        supplierRefId: po.supplier ? po.supplier.toString() : null,
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
    const createdBy = req.user ? req.user.name : (req.body.createdBy || 'Purchase Manager');

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

    // 5. Notify Directors that a new PO is awaiting their approval
    try {
      const directors = await User.find({ role: 'Director' });
      const msg = `New Purchase Order ${po.poNumber} (${createdBy}) submitted - awaiting approval`;
      for (const d of directors) {
        await createNotificationHelper(d._id, msg, 'PO_SUBMITTED', '/director-dashboard');
      }
    } catch (nErr) {
      console.error('Error creating PO submission notifications:', nErr);
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
// Note: 'Approved'/'Rejected' are excluded here - those transitions are
// Director-gated and only reachable via approvePurchaseOrder/rejectPurchaseOrder.
export const updatePurchaseOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !['Draft', 'Pending', 'Sent', 'Delivered', 'Closed', 'Cancelled'].includes(status)) {
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

// @desc    Approve a purchase order (Director sign-off)
// @route   PUT /api/purchase-orders/:id/approve
// @access  Private
export const approvePurchaseOrder = async (req, res) => {
  try {
    const approvedBy = req.user ? req.user.name : 'Director';
    const { note } = req.body;

    const po = await PurchaseOrder.findByIdAndUpdate(
      req.params.id,
      { status: 'Approved', approvedBy, approvedAt: new Date(), rejectionReason: note || '' },
      { new: true }
    );

    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase order not found.' });
    }

    try {
      const purchaseManagers = await User.find({ role: 'PurchaseManager' });
      const msg = `Purchase Order ${po.poNumber} Approved by Director${approvedBy ? ` (${approvedBy})` : ''}${note ? `: ${note}` : ''}`;
      for (const pm of purchaseManagers) {
        await createNotificationHelper(pm._id, msg, 'PO_approved', '/purchase-orders');
      }
    } catch (nErr) {
      console.error('Error creating PO approval notifications:', nErr);
    }

    res.status(200).json({ success: true, message: 'Purchase Order approved successfully!', data: po });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Reject a purchase order with reason (Director sign-off)
// @route   PUT /api/purchase-orders/:id/reject
// @access  Private
export const rejectPurchaseOrder = async (req, res) => {
  try {
    const approvedBy = req.user ? req.user.name : 'Director';
    const { rejectionReason } = req.body;

    const po = await PurchaseOrder.findByIdAndUpdate(
      req.params.id,
      { status: 'Rejected', approvedBy, rejectionReason: rejectionReason || 'No reason provided' },
      { new: true }
    );

    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase order not found.' });
    }

    try {
      const purchaseManagers = await User.find({ role: 'PurchaseManager' });
      const msg = `Purchase Order ${po.poNumber} Rejected by Director${rejectionReason ? `: ${rejectionReason}` : ''}`;
      for (const pm of purchaseManagers) {
        await createNotificationHelper(pm._id, msg, 'PO_rejected', '/purchase-orders');
      }
    } catch (nErr) {
      console.error('Error creating PO rejection notifications:', nErr);
    }

    res.status(200).json({ success: true, message: 'Purchase Order rejected successfully!', data: po });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update PO supplier
// @route   PUT /api/purchase-orders/:id/supplier
// @access  Private
export const updatePurchaseOrderSupplier = async (req, res) => {
  try {
    const { supplier } = req.body;
    if (!supplier || !mongoose.Types.ObjectId.isValid(supplier)) {
      return res.status(400).json({ success: false, message: 'Invalid supplier ID.' });
    }

    const po = await PurchaseOrder.findByIdAndUpdate(
      req.params.id,
      { supplier },
      { new: true }
    );

    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase order not found.' });
    }

    res.status(200).json({ success: true, message: 'Supplier assigned successfully!', data: po });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Builds the HTML body of the PO email sent to a supplier
const buildPOEmailHtml = (po, supplierDoc) => {
  const itemRows = po.items.map(item => `
    <tr>
      <td style="padding:6px 10px;border:1px solid #ddd;">${escapeHtml(item.materialName)}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;">${item.quantity} ${escapeHtml(item.unit)}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;">${Number(item.unitPrice).toLocaleString()}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;">${(Number(item.quantity) * Number(item.unitPrice)).toLocaleString()}</td>
    </tr>`).join('');

  return `
    <div style="font-family:Arial,sans-serif;color:#0d1b4b;">
      <h2>Purchase Order ${escapeHtml(po.poNumber)}</h2>
      <p>Dear ${escapeHtml(supplierDoc.name)},</p>
      <p>Please find the details of a new Purchase Order below.</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0;">
        <thead>
          <tr style="background:#f5f6fa;">
            <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Material</th>
            <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Quantity</th>
            <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Unit Price (LKR)</th>
            <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Line Total (LKR)</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <p><strong>Total Amount:</strong> LKR ${Number(po.totalAmount).toLocaleString()}</p>
      ${po.expectedDeliveryDate ? `<p><strong>Expected Delivery Date:</strong> ${new Date(po.expectedDeliveryDate).toLocaleDateString()}</p>` : ''}
      ${po.paymentTerms ? `<p><strong>Payment Terms:</strong> ${escapeHtml(po.paymentTerms)}</p>` : ''}
      ${po.deliveryAddress ? `<p><strong>Delivery Address:</strong> ${escapeHtml(po.deliveryAddress)}</p>` : ''}
      ${po.notes ? `<p><strong>Notes:</strong> ${escapeHtml(po.notes)}</p>` : ''}
      <p>Regards,<br/>ELS Construction Procurement Team</p>
    </div>`;
};

// @desc    Send PO to supplier (emails the PO details to the supplier's registered email)
// @route   PUT /api/purchase-orders/:id/send
// @access  Private
export const sendPurchaseOrder = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase order not found.' });
    }

    if (po.status !== 'Approved') {
      return res.status(400).json({ success: false, message: 'Purchase order must be Approved by the Director before it can be sent to the supplier.' });
    }

    let supplierDoc = null;
    if (po.supplier && mongoose.Types.ObjectId.isValid(po.supplier)) {
      supplierDoc = await Supplier.findById(po.supplier);
    }
    const supplierName = supplierDoc ? supplierDoc.name : (po.supplier ? po.supplier.toString() : 'Supplier');

    if (!supplierDoc || !supplierDoc.email) {
      return res.status(400).json({
        success: false,
        message: `${supplierName} does not have an email address on file. Add one in Suppliers Registry before sending.`
      });
    }

    try {
      await sendMail({
        to: supplierDoc.email,
        subject: `Purchase Order ${po.poNumber} from ELS Construction`,
        html: buildPOEmailHtml(po, supplierDoc)
      });
    } catch (mailErr) {
      console.error('Error sending PO email:', mailErr);
      return res.status(500).json({ success: false, message: `Failed to email ${supplierName}: ${mailErr.message}` });
    }

    po.status = 'Sent';
    po.sentAt = new Date();

    await po.save();

    res.status(200).json({
      success: true,
      message: `${po.poNumber} sent to ${supplierName} (${supplierDoc.email}) successfully!`,
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
