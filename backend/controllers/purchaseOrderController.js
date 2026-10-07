import PurchaseOrder from '../models/PurchaseOrder.js';
import Material from '../models/Material.js';
import ItemMaster from '../models/ItemMaster.js';
import Supplier from '../models/Supplier.js';
import PurchaseRequest from '../models/PurchaseRequest.js';
import User from '../models/userModel.js';
import mongoose from 'mongoose';
import { createNotificationHelper, notifyRoles } from './notificationController.js';
import { sendMail, escapeHtml } from '../utils/mailer.js';

// Helper to resolve material name to an ObjectId, creating a Material if it doesn't exist
const resolveMaterial = async (materialName, unit) => {
  let material = await Material.findOne({ name: materialName, location: 'MainStore' });
  if (!material) {
    // Category comes from the Item Master; 'Other' only for a material that isn't catalogued
    const master = await ItemMaster.findOne({ materialName });
    const category = master ? master.category : 'Other';

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
    const { page, limit, status, supplier, search } = req.query;
    const query = {};
    if (status) query.status = status;
    if (supplier) query.supplier = supplier;
    if (search) {
      query.$or = [
        { poNumber: new RegExp(search, 'i') },
        { notes: new RegExp(search, 'i') },
        { createdBy: new RegExp(search, 'i') }
      ];
    }

    if (page || limit) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
      const skip = (pageNum - 1) * limitNum;

      const total = await PurchaseOrder.countDocuments(query);
      const totalPages = Math.ceil(total / limitNum) || 1;

      const pos = await PurchaseOrder.find(query)
        .populate('prId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

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

      return res.status(200).json({
        success: true,
        count: formattedPOs.length,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        data: formattedPOs
      });
    }

    const pos = await PurchaseOrder.find(query)
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

// Next free PO-YYYY-XXX number, skipping any already taken
const generateNextPoNumber = async () => {
  const year = new Date().getFullYear();
  let next = (await PurchaseOrder.countDocuments()) + 1;
  let candidate;
  do {
    candidate = `PO-${year}-${String(next).padStart(3, '0')}`;
    next++;
  } while (await PurchaseOrder.findOne({ poNumber: candidate }));
  return candidate;
};

// @desc    Create a new purchase order
// @route   POST /api/purchase-orders
// @access  Private
export const createPurchaseOrder = async (req, res) => {
  try {
    const { prId, supplier, items, totalAmount, notes, expectedDeliveryDate, paymentTerms, deliveryAddress } = req.body;
    const createdBy = req.user ? req.user.name : (req.body.createdBy || 'Purchase Manager');

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one item.' });
    }
    if (!supplier) {
      return res.status(400).json({ success: false, message: 'Please select a supplier.' });
    }

    // If PR is linked, validate PR existence and validate that selected items belong to the PR
    let prDoc = null;
    if (prId && mongoose.Types.ObjectId.isValid(prId)) {
      prDoc = await PurchaseRequest.findById(prId);
      if (!prDoc) {
        return res.status(404).json({ success: false, message: 'Referenced Purchase Request was not found.' });
      }
      const prMaterialNames = new Set((prDoc.materials || []).map(m => (m.materialName || m.name || '').toLowerCase().trim()));
      for (const item of items) {
        const nameLower = (item.materialName || '').toLowerCase().trim();
        if (prMaterialNames.size > 0 && !prMaterialNames.has(nameLower)) {
          return res.status(400).json({ success: false, message: `Selected item "${item.materialName}" is not part of Purchase Request ${prDoc.prNumber || prId}.` });
        }
      }
    }

    // 1. Auto-generate poNumber (PO-YYYY-XXX)
    const poNumber = await generateNextPoNumber();

    // 2. Resolve items, their material ObjectIds, and recalculate totalAmount
    const resolvedItems = [];
    let computedTotal = 0;
    for (const item of items) {
      const qty = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      computedTotal += (qty * unitPrice);

      const materialDoc = await resolveMaterial(item.materialName, item.unit);
      resolvedItems.push({
        material: materialDoc._id,
        materialName: item.materialName,
        quantity: qty,
        unit: item.unit || 'bag',
        unitPrice: unitPrice
      });
    }

    if (resolvedItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one item.' });
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
          categories: ['Other']
        });
        await newSupplier.save();
        supplierId = newSupplier._id;
      }
    }

    // 3. Construct PO with recalculated totalAmount
    const poData = {
      poNumber,
      supplier: supplierId,
      items: resolvedItems,
      totalAmount: computedTotal > 0 ? computedTotal : (Number(totalAmount) || 0),
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
      if (directors.length > 0) {
        for (const d of directors) {
          await createNotificationHelper(d._id, msg, 'PO_SUBMITTED', '/director-dashboard', 'Director', 'Director');
        }
      } else {
        await createNotificationHelper(null, msg, 'PO_SUBMITTED', '/director-dashboard', 'Director', 'Director');
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
// Note: Approved/Rejected are Director-gated (approvePurchaseOrder/rejectPurchaseOrder)
// and Delivered is only set by the GRN, so none of those can be set here.
export const updatePurchaseOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !['Sent', 'Closed', 'Cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid PO status.' });
    }

    const existing = await PurchaseOrder.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Purchase order not found.' });
    }

    // A PO can only go out to the supplier after Director approval, is closed once
    // its goods are in, and can only be cancelled before then.
    if (status === 'Sent' && !['Approved', 'Sent'].includes(existing.status)) {
      return res.status(400).json({ success: false, message: 'Purchase order must be Approved by the Director before it can be marked as Sent.' });
    }
    if (status === 'Closed' && existing.status !== 'Delivered') {
      return res.status(400).json({ success: false, message: 'Only a Delivered purchase order can be closed.' });
    }
    if (status === 'Cancelled' && !['Pending', 'Approved', 'Sent'].includes(existing.status)) {
      return res.status(400).json({ success: false, message: `A ${existing.status} purchase order cannot be cancelled.` });
    }

    const po = await PurchaseOrder.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('prId');

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

    // Only a PO still waiting on the Director can be approved - this stops a
    // Sent/Delivered/Rejected order being pushed back to Approved.
    const po = await PurchaseOrder.findOneAndUpdate(
      { _id: req.params.id, status: 'Pending' },
      { status: 'Approved', approvedBy, approvedAt: new Date(), rejectionReason: note || '' },
      { new: true }
    );

    if (!po) {
      const exists = await PurchaseOrder.exists({ _id: req.params.id });
      if (!exists) {
        return res.status(404).json({ success: false, message: 'Purchase order not found.' });
      }
      return res.status(400).json({ success: false, message: 'Only a pending Purchase Order can be approved.' });
    }

    // An approved order goes straight out to the supplier. When that is not
    // possible (no email on file, mail server unavailable) the PO simply stays
    // Approved and the Purchase Manager sends it with "Send to Supplier".
    let sendNote = '';
    try {
      const supplierDoc = po.supplier && mongoose.Types.ObjectId.isValid(po.supplier)
        ? await Supplier.findById(po.supplier)
        : null;
      if (supplierDoc && supplierDoc.email) {
        await sendMail({
          to: supplierDoc.email,
          subject: `Purchase Order ${po.poNumber} from ELS Construction`,
          html: buildPOEmailHtml(po, supplierDoc)
        });
        po.status = 'Sent';
        po.sentAt = new Date();
        await po.save();
        sendNote = ` and emailed to ${supplierDoc.name} (${supplierDoc.email})`;
      } else {
        sendNote = ` - not emailed: ${supplierDoc ? supplierDoc.name : 'the supplier'} has no email address on file, so it must be sent manually`;
      }
    } catch (mailErr) {
      console.error('Error auto-sending approved PO:', mailErr);
      sendNote = ' - the supplier email could not be sent, so it must be sent manually';
    }

    try {
      const purchaseManagers = await User.find({ role: 'PurchaseManager' });
      const msg = `Purchase Order ${po.poNumber} Approved by Director${approvedBy ? ` (${approvedBy})` : ''}${note ? `: ${note}` : ''}${sendNote}`;
      for (const pm of purchaseManagers) {
        await createNotificationHelper(pm._id, msg, 'PO_approved', '/purchase-orders');
      }
    } catch (nErr) {
      console.error('Error creating PO approval notifications:', nErr);
    }

    // Main Store receives the goods, so it is told which approved order to expect.
    await notifyRoles(
      ['MainStoreOfficer'],
      `Purchase Order ${po.poNumber} was approved - expect delivery and record the GRN when goods arrive.`,
      'PO_approved',
      '/main-store-dashboard'
    );

    res.status(200).json({ success: true, message: `Purchase Order ${po.poNumber} approved${sendNote}.`, data: po });
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

    const po = await PurchaseOrder.findOneAndUpdate(
      { _id: req.params.id, status: 'Pending' },
      { status: 'Rejected', approvedBy, rejectionReason: rejectionReason || 'No reason provided' },
      { new: true }
    );

    if (!po) {
      const exists = await PurchaseOrder.exists({ _id: req.params.id });
      if (!exists) {
        return res.status(404).json({ success: false, message: 'Purchase order not found.' });
      }
      return res.status(400).json({ success: false, message: 'Only a pending Purchase Order can be rejected.' });
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

    try {
      const directors = await User.find({ role: 'Director' });
      const msg = `Purchase Order ${po.poNumber} has been sent to ${supplierName}`;
      for (const d of directors) {
        await createNotificationHelper(d._id, msg, 'PO_SENT', '/purchase-orders');
      }
    } catch (nErr) {
      console.error('Error creating PO sent notifications:', nErr);
    }

    res.status(200).json({
      success: true,
      message: `${po.poNumber} sent to ${supplierName} (${supplierDoc.email}) successfully!`,
      data: po
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
