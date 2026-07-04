import Supplier from '../models/Supplier.js';

// Get all suppliers
// GET /api/suppliers
export const getSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find().sort({ name: 1 });

    // Handle frontend discrepancy:
    // PurchaseOrderPage.js expects: { success: true, data: [...] }
    // SupplierManagement.js expects: [...] (raw array)
    if (req.headers.authorization) {
      return res.status(200).json({ success: true, count: suppliers.length, data: suppliers });
    } else {
      return res.status(200).json(suppliers);
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
export const createSupplier = async (req, res) => {
  try {
    const supplier = new Supplier(req.body);
    await supplier.save();
    
    // Support both formats if needed
    if (req.headers.authorization) {
      res.status(201).json({ success: true, message: 'Supplier added successfully!', data: supplier });
    } else {
      res.status(201).json({ message: 'Supplier added successfully!', supplier });
    }
  } catch (error) {
    if (req.headers.authorization) {
      res.status(400).json({ success: false, message: error.message });
    } else {
      res.status(400).json({ message: error.message });
    }
  }
};

// Update supplier
// PUT /api/suppliers/:id
export const updateSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!supplier) {
      if (req.headers.authorization) {
        return res.status(404).json({ success: false, message: 'Supplier not found' });
      } else {
        return res.status(404).json({ message: 'Supplier not found' });
      }
    }

    if (req.headers.authorization) {
      res.status(200).json({ success: true, message: 'Supplier updated successfully!', data: supplier });
    } else {
      res.status(200).json({ message: 'Supplier updated successfully!', supplier });
    }
  } catch (error) {
    if (req.headers.authorization) {
      res.status(400).json({ success: false, message: error.message });
    } else {
      res.status(400).json({ message: error.message });
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

    if (req.headers.authorization) {
      res.status(200).json({ success: true, message: 'Supplier deactivated successfully!', data: supplier });
    } else {
      res.status(200).json({ message: 'Supplier deactivated successfully!', supplier });
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
