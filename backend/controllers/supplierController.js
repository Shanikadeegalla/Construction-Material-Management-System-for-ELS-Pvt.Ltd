import Supplier from '../models/Supplier.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Quotation from '../models/Quotation.js';
import Invoice from '../models/Invoice.js';
import GRN from '../models/GRN.js';

// Generate the next unique sequential Supplier ID (e.g. SUP-0001)
const generateNextSupplierId = async () => {
  let next = (await Supplier.countDocuments()) + 1;
  let candidate;
  do {
    candidate = `SUP-${String(next).padStart(4, '0')}`;
    next++;
  } while (await Supplier.findOne({ supplierId: candidate }));
  return candidate;
};

// Get the next available Supplier ID (for pre-filling the registration form)
// GET /api/suppliers/next-id
export const getNextSupplierId = async (req, res) => {
  try {
    const supplierId = await generateNextSupplierId();
    res.status(200).json({ success: true, supplierId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Format supplier to ensure supplierId is never undefined or empty
const formatSupplierDoc = (s) => {
  if (!s) return s;
  const obj = s.toObject ? s.toObject() : { ...s };
  if (!obj.supplierId || String(obj.supplierId).trim() === '') {
    const idStr = String(obj._id || '');
    obj.supplierId = `SUP-${idStr.length >= 4 ? idStr.slice(-4).toUpperCase() : '0001'}`;
  }
  obj.category = obj.categories?.[0] || obj.category || '';
  return obj;
};

// Get all suppliers
// GET /api/suppliers
export const getSuppliers = async (req, res) => {
  try {
    const { page, limit, search, status } = req.query;
    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { supplierId: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { phone: new RegExp(search, 'i') }
      ];
    }

    if (page || limit) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
      const skip = (pageNum - 1) * limitNum;

      const total = await Supplier.countDocuments(query);
      const totalPages = Math.ceil(total / limitNum) || 1;

      const suppliers = await Supplier.find(query).sort({ name: 1 }).skip(skip).limit(limitNum);
      const formatted = suppliers.map(formatSupplierDoc);

      return res.status(200).json({
        success: true,
        count: formatted.length,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        data: formatted
      });
    }

    const suppliers = await Supplier.find(query).sort({ name: 1 });
    const formatted = suppliers.map(formatSupplierDoc);

    // Handle frontend discrepancy:
    // PurchaseOrderPage.js expects: { success: true, data: [...] }
    // SupplierManagement.js expects: [...] (raw array)
    if (req.headers.authorization) {
      return res.status(200).json({ success: true, count: formatted.length, data: formatted });
    } else {
      return res.status(200).json(formatted);
    }
  } catch (error) {
    if (req.headers.authorization) {
      res.status(500).json({ success: false, message: error.message });
    } else {
      res.status(500).json({ message: error.message });
    }
  }
};

// Add a new supplier
// POST /api/suppliers
const normalizeCategories = (body) => {
  if (Array.isArray(body.categories) && body.categories.length > 0) return body.categories;
  if (body.category) return [body.category];
  return body.categories;
};

const duplicateKeyMessage = (error) => {
  if (error.code !== 11000) return error.message;
  if (error.keyPattern?.email) return 'This email address is already used by another supplier.';
  if (error.keyPattern?.supplierId) return 'Supplier ID already exists. Please choose a different one.';
  return 'Duplicate value. Please choose a different one.';
};

const validateBankAccountNumber = (acc) => {
  if (!acc || typeof acc !== 'string') return true;
  const trimmed = acc.trim();
  if (trimmed === '') return true;
  return /^\d{6,20}$/.test(trimmed);
};

export const createSupplier = async (req, res) => {
  try {
    if (req.body.accountNumber && !validateBankAccountNumber(req.body.accountNumber)) {
      const msg = 'Bank account number must contain only numeric digits (between 6 and 20 digits).';
      if (req.headers.authorization) {
        return res.status(400).json({ success: false, message: msg });
      } else {
        return res.status(400).json({ message: msg });
      }
    }
    const supplierId = req.body.supplierId?.trim() || (await generateNextSupplierId());
    const supplier = new Supplier({
      ...req.body,
      accountNumber: req.body.accountNumber ? req.body.accountNumber.trim() : '',
      supplierId,
      name: req.body.name?.trim() || supplierId,
      categories: normalizeCategories(req.body)
    });
    await supplier.save();

    const formatted = formatSupplierDoc(supplier);

    if (req.headers.authorization) {
      res.status(201).json({ success: true, message: 'Supplier added successfully!', data: formatted });
    } else {
      res.status(201).json({ message: 'Supplier added successfully!', supplier: formatted });
    }
  } catch (error) {
    const message = duplicateKeyMessage(error);
    if (req.headers.authorization) {
      res.status(400).json({ success: false, message });
    } else {
      res.status(400).json({ message });
    }
  }
};

export const addSupplier = createSupplier;

// Update supplier
// PUT /api/suppliers/:id
export const updateSupplier = async (req, res) => {
  try {
    if (req.body.accountNumber !== undefined && !validateBankAccountNumber(req.body.accountNumber)) {
      const msg = 'Bank account number must contain only numeric digits (between 6 and 20 digits).';
      if (req.headers.authorization) {
        return res.status(400).json({ success: false, message: msg });
      } else {
        return res.status(400).json({ message: msg });
      }
    }
    const updatePayload = { ...req.body };
    if (updatePayload.accountNumber !== undefined) {
      updatePayload.accountNumber = updatePayload.accountNumber ? updatePayload.accountNumber.trim() : '';
    }
    if (updatePayload.categories || updatePayload.category) {
      updatePayload.categories = normalizeCategories(updatePayload);
    }
    delete updatePayload.category;

    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true, runValidators: true }
    );
    if (!supplier) {
      if (req.headers.authorization) {
        return res.status(404).json({ success: false, message: 'Supplier not found' });
      } else {
        return res.status(404).json({ message: 'Supplier not found' });
      }
    }

    const formatted = formatSupplierDoc(supplier);

    if (req.headers.authorization) {
      res.status(200).json({ success: true, message: 'Supplier updated successfully!', data: formatted });
    } else {
      res.status(200).json({ message: 'Supplier updated successfully!', supplier: formatted });
    }
  } catch (error) {
    const message = duplicateKeyMessage(error);
    if (req.headers.authorization) {
      res.status(400).json({ success: false, message });
    } else {
      res.status(400).json({ message });
    }
  }
};

// Deactivate supplier (Sets status to Inactive)
// DELETE /api/suppliers/:id
export const deactivateSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { status: 'Inactive' },
      { new: true }
    );
    if (!supplier) {
      if (req.headers.authorization) {
        return res.status(404).json({ success: false, message: 'Supplier not found' });
      } else {
        return res.status(404).json({ message: 'Supplier not found' });
      }
    }

    const formatted = formatSupplierDoc(supplier);

    if (req.headers.authorization) {
      res.status(200).json({ success: true, message: 'Supplier deactivated successfully!', data: formatted });
    } else {
      res.status(200).json({ message: 'Supplier deactivated successfully!', supplier: formatted });
    }
  } catch (error) {
    if (req.headers.authorization) {
      res.status(500).json({ success: false, message: error.message });
    } else {
      res.status(500).json({ message: error.message });
    }
  }
};
// Activate supplier (Sets status to Active)
// PUT /api/suppliers/:id/activate
export const activateSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { status: 'Active' },
      { new: true }
    );
    if (!supplier) {
      if (req.headers.authorization) {
        return res.status(404).json({ success: false, message: 'Supplier not found' });
      } else {
        return res.status(404).json({ message: 'Supplier not found' });
      }
    }

    const formatted = formatSupplierDoc(supplier);

    if (req.headers.authorization) {
      res.status(200).json({ success: true, message: 'Supplier activated successfully!', data: formatted });
    } else {
      res.status(200).json({ message: 'Supplier activated successfully!', supplier: formatted });
    }
  } catch (error) {
    if (req.headers.authorization) {
      res.status(500).json({ success: false, message: error.message });
    } else {
      res.status(500).json({ message: error.message });
    }
  }
};

export const deleteSupplier = deactivateSupplier; // Alias for compatibility with other imports if any

// Get a single supplier by ID
// GET /api/suppliers/:id
export const getSupplierById = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }
    res.status(200).json({ success: true, data: formatSupplierDoc(supplier) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get a supplier's full profile: info + purchase history + quotations + invoices/payments + GRNs + performance
// GET /api/suppliers/:id/profile
export const getSupplierProfile = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const formattedSupplier = formatSupplierDoc(supplier);

    const [purchaseOrders, quotations, invoices] = await Promise.all([
      PurchaseOrder.find({ supplier: supplier._id }).populate('prId', 'project projectName').sort({ createdAt: -1 }),
      Quotation.find({ supplier: supplier._id }).sort({ createdAt: -1 }),
      Invoice.find({ supplier: supplier._id }).populate('po', 'poNumber').populate('grn', 'grnNumber').sort({ createdAt: -1 })
    ]);

    // GRNs aren't reliably linked by ObjectId for older records, so fall back to a
    // case-insensitive name match against this supplier's name.
    const grns = await GRN.find({
      $or: [
        { supplierId: supplier._id },
        { supplier: new RegExp(`^${supplier.name || ''}$`, 'i') }
      ]
    }).sort({ createdAt: -1 });

    // Performance summary scoped to this supplier's own purchase orders
    let deliveredCount = 0;
    let onTimeCount = 0;
    let totalOrderedQty = 0;
    let totalReceivedQty = 0;

    purchaseOrders.forEach(po => {
      if (po.status === 'Delivered') {
        deliveredCount += 1;
        if (po.actualDeliveryDate && po.expectedDeliveryDate) {
          if (new Date(po.actualDeliveryDate) <= new Date(po.expectedDeliveryDate)) {
            onTimeCount += 1;
          }
        } else {
          onTimeCount += 1;
        }
        totalOrderedQty += po.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
        totalReceivedQty += (po.receivedQty || 0);
      }
    });

    let accuracyPercent = 100;
    let onTimePercent = 100;
    if (deliveredCount > 0) {
      if (totalOrderedQty > 0) {
        accuracyPercent = (totalReceivedQty / totalOrderedQty) * 100;
      }
      onTimePercent = (onTimeCount / deliveredCount) * 100;
    }
    accuracyPercent = Math.round(accuracyPercent * 10) / 10;
    onTimePercent = Math.round(onTimePercent * 10) / 10;

    let performanceRating = 'Poor';
    if (deliveredCount === 0) {
      performanceRating = 'N/A';
    } else if (accuracyPercent > 95) {
      performanceRating = 'Excellent';
    } else if (accuracyPercent > 85) {
      performanceRating = 'Good';
    } else if (accuracyPercent > 70) {
      performanceRating = 'Average';
    }

    res.status(200).json({
      success: true,
      data: {
        supplier: formattedSupplier,
        purchaseOrders,
        quotations,
        invoices,
        grns,
        performance: {
          totalOrders: purchaseOrders.length,
          deliveredCount,
          onTimeDeliveries: onTimeCount,
          onTimePercent,
          deliveryAccuracy: accuracyPercent,
          performanceRating
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

