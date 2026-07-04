import Material from '../models/Material.js';
import GRN from '../models/GRN.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import TransferLog from '../models/TransferLog.js';
import MaterialUsage from '../models/MaterialUsage.js';
import mongoose from 'mongoose';
import { encryptDB, decryptDB } from '../utils/cryptoUtils.js';

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
  const { poReference, supplier, receivedBy, receivedDate, items, notes } = req.body;

  if (!supplier || !receivedBy || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Missing required GRN information' });
  }

  try {
    let grnStatus = 'Completed';
    let poId = null;

    // 1. Validate against PO if poReference provided
    if (poReference) {
      const po = await PurchaseOrder.findOne({ poNumber: poReference });
      if (!po) {
        return res.status(400).json({ message: `Purchase Order '${poReference}' not found.` });
      }
      poId = po._id;

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

    // 2. Auto-generate grnNumber (GRN-YYYY-XXX)
    const count = await GRN.countDocuments();
    const year = new Date().getFullYear();
    const serial = String(count + 1).padStart(3, '0');
    const grnNumber = `GRN-${year}-${serial}`;

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

      resolvedItems.push({
        material: materialId,
        expectedQty: Number(item.expectedQty) || 0,
        receivedQty: Number(item.receivedQty) || 0,
        condition: item.condition || 'Good'
      });
    }

    // 4. Save the GRN
    const grn = new GRN({
      grnNumber,
      poReference: poReference || 'N/A',
      poId,
      supplier,
      receivedBy,
      receivedDate: receivedDate || new Date(),
      items: resolvedItems,
      status: grnStatus,
      notes
    });

    await grn.save();

    // 5. Increment quantities of received items in MainStore
    for (const item of resolvedItems) {
      if (item.receivedQty > 0) {
        await Material.findByIdAndUpdate(
          item.material,
          { $inc: { quantity: item.receivedQty } }
        );
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

// @desc    Issue materials to site store (transfer)
// @route   POST /api/inventory/issue
// @access  Private
export const issueMaterial = async (req, res) => {
  const { materialId, quantity, projectName } = req.body;
  const issuedBy = req.user ? req.user.name : 'Store Officer';

  if (!materialId || !quantity || quantity <= 0) {
    return res.status(400).json({ message: 'Invalid material ID or quantity' });
  }

  try {
    // 1. Find material in MainStore
    const mainStoreMaterial = await Material.findById(materialId);
    if (!mainStoreMaterial) {
      return res.status(404).json({ message: 'Material not found in Main Store' });
    }

    if (mainStoreMaterial.location !== 'MainStore') {
      return res.status(400).json({ message: 'Material can only be issued from Main Store' });
    }

    const qtyToIssue = Number(quantity);
    if (mainStoreMaterial.quantity < qtyToIssue) {
      return res.status(400).json({ message: 'Insufficient stock in Main Store' });
    }

    // 2. Decrement from Main Store
    mainStoreMaterial.quantity -= qtyToIssue;
    await mainStoreMaterial.save();

    // 3. Create or update in SiteStore (using deterministic encrypted name search)
    const encryptedName = encryptDB(mainStoreMaterial.name);
    let siteStoreMaterial = await Material.findOne({
      name: encryptedName,
      location: 'SiteStore'
    });

    if (siteStoreMaterial) {
      const currentQty = Number(decryptDB(siteStoreMaterial.quantity)) || 0;
      siteStoreMaterial.quantity = encryptDB(String(currentQty + qtyToIssue));
      await siteStoreMaterial.save();
    } else {
      siteStoreMaterial = new Material({
        name: encryptedName,
        category: mainStoreMaterial.category,
        unit: mainStoreMaterial.unit,
        quantity: encryptDB(String(qtyToIssue)),
        minimumStock: mainStoreMaterial.minimumStock,
        location: 'SiteStore',
        unitPrice: mainStoreMaterial.unitPrice,
        description: mainStoreMaterial.description
      });
      await siteStoreMaterial.save();
    }

    // 4. Save transfer log
    const transferLog = new TransferLog({
      materialId: mainStoreMaterial._id,
      materialName: encryptedName,
      quantity: encryptDB(String(qtyToIssue)),
      from: 'MainStore',
      to: 'SiteStore',
      issuedBy,
      date: new Date()
    });
    await transferLog.save();

    // Prepare decrypted response
    const decSiteStoreMaterial = siteStoreMaterial.toObject();
    decSiteStoreMaterial.name = decryptDB(decSiteStoreMaterial.name);
    decSiteStoreMaterial.quantity = Number(decryptDB(decSiteStoreMaterial.quantity)) || 0;

    const decTransferLog = transferLog.toObject();
    decTransferLog.materialName = decryptDB(decTransferLog.materialName);
    decTransferLog.quantity = Number(decryptDB(decTransferLog.quantity)) || 0;

    res.json({
      success: true,
      message: `Successfully transferred ${qtyToIssue} ${mainStoreMaterial.unit}(s) to Site Store for ${projectName || 'Site'}`,
      mainStoreMaterial,
      siteStoreMaterial: decSiteStoreMaterial,
      transferLog: decTransferLog
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

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

    // Decrement from inventory
    if (isSite) {
      material.quantity = encryptDB(String(decQty - Number(quantityUsed)));
    } else {
      material.quantity -= Number(quantityUsed);
    }
    await material.save();

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
