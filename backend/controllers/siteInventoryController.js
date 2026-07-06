import Material from '../models/Material.js';
import TransferLog from '../models/TransferLog.js';
import MaterialUsage from '../models/MaterialUsage.js';
import Project from '../models/Project.js';
import { decryptDB, encryptDB } from '../utils/cryptoUtils.js';

// Helper to decrypt a string
const decryptIfNeeded = (val) => {
  return decryptDB(val);
};

// @desc    Fetch site inventory rows matching user project session context
// @route   GET /api/site/inventory
// @access  Private
export const getSiteInventory = async (req, res) => {
  try {
    const userProjectId = req.user.project_id || req.user.projectId;
    if (!userProjectId) {
      return res.status(400).json({ success: false, message: 'User is not assigned to a project.' });
    }

    // Find materials in SiteStore location matching project
    const materials = await Material.find({
      location: 'SiteStore',
      $or: [{ project_id: userProjectId }, { projectId: userProjectId }]
    });

    const decrypted = materials.map(m => {
      const doc = m.toObject();
      doc.name = decryptDB(doc.name);
      doc.quantity = Number(decryptDB(doc.quantity)) || 0;
      return doc;
    });

    res.status(200).json({ success: true, data: decrypted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Admin & Director projects overview
// @route   GET /api/admin/projects-overview
// @access  Private (Admin / Director)
export const getProjectsOverview = async (req, res) => {
  try {
    if (req.user.role !== 'Admin' && req.user.role !== 'Director') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const materials = await Material.find({ location: 'SiteStore' })
      .populate('project_id', 'projectName projectId name location')
      .populate('projectId', 'projectName projectId name location');

    const decrypted = materials.map(m => {
      const doc = m.toObject();
      doc.name = decryptDB(doc.name);
      doc.quantity = Number(decryptDB(doc.quantity)) || 0;
      return doc;
    });

    res.status(200).json({ success: true, data: decrypted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Log material usage for a project
// @route   POST /api/site/material-usage
// @access  Private (SiteStoreOfficer)
export const logMaterialUsage = async (req, res) => {
  try {
    const { materialId, quantity_used, date, purpose } = req.body;
    const userProjectId = req.user.project_id || req.user.projectId;

    if (!materialId || !quantity_used || Number(quantity_used) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid material and quantity are required.' });
    }

    const siteMaterial = await Material.findById(materialId);
    if (!siteMaterial) {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }

    let localQty = siteMaterial.quantity;
    let decryptedName = siteMaterial.name;
    if (siteMaterial.location === 'SiteStore') {
      decryptedName = decryptDB(siteMaterial.name);
      localQty = Number(decryptDB(siteMaterial.quantity)) || 0;
    }

    if (localQty < Number(quantity_used)) {
      // Shortage triggers read-only central stock lookup
      const mainMaterial = await Material.findOne({
        name: decryptedName,
        location: 'MainStore'
      });

      const mainQty = mainMaterial ? mainMaterial.quantity : 0;
      const errorMsg = mainQty > 0
        ? `Insufficient stock at the site. However, the Main Store currently has ${mainQty} units.`
        : 'Insufficient stock at both the Site Store and Main Store.';

      return res.status(400).json({
        success: false,
        insufficient: true,
        message: errorMsg,
        mainStoreStock: {
          name: decryptedName,
          quantity: mainQty,
          updatedAt: mainMaterial ? mainMaterial.updatedAt : new Date()
        }
      });
    }

    // Deduct and save
    const remainingQty = localQty - Number(quantity_used);
    if (siteMaterial.location === 'SiteStore') {
      siteMaterial.quantity = encryptDB(String(remainingQty));
    } else {
      siteMaterial.quantity = remainingQty;
    }
    await siteMaterial.save();

    // Save consumption log
    const projectDoc = await Project.findById(userProjectId);
    const projName = projectDoc ? (projectDoc.projectName || projectDoc.name) : 'N/A';

    const usage = new MaterialUsage({
      projectId: userProjectId,
      project_id: userProjectId,
      projectName: projName,
      materialName: decryptedName,
      actualQty: Number(quantity_used),
      recordedBy: req.user.name,
      usageDate: date || new Date(),
      purpose: purpose || 'N/A'
    });
    await usage.save();

    res.status(201).json({
      success: true,
      message: 'Usage successfully logged.',
      data: usage
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Issue material from Main Store to Site Store
// @route   POST /api/main-store/issue-to-site
// @access  Private (MainStoreOfficer)
export const issueToSite = async (req, res) => {
  try {
    const { materialName, quantity, target_project_id } = req.body;

    if (!materialName || !quantity || Number(quantity) <= 0 || !target_project_id) {
      return res.status(400).json({ success: false, message: 'Missing issue fields.' });
    }

    // Deduct from central Main Store stock
    const mainMat = await Material.findOne({ name: materialName, location: 'MainStore' });
    if (!mainMat || mainMat.quantity < Number(quantity)) {
      return res.status(400).json({ success: false, message: 'Transfer quantity exceeds available stock.' });
    }

    // Start MongoDB Session Transaction
    const mongoose = (await import('mongoose')).default;
    const session = await mongoose.startSession();
    let log;

    try {
      session.startTransaction();

      mainMat.quantity -= Number(quantity);
      await mainMat.save({ session });

      // In-Transit Transfer Log
      log = new TransferLog({
        materialId: mainMat._id,
        materialName: encryptDB(materialName),
        quantity: encryptDB(String(quantity)),
        from: 'MainStore',
        to: 'SiteStore',
        projectId: target_project_id,
        project_id: target_project_id,
        status: 'In-Transit',
        issuedBy: req.user ? req.user.name : 'Store Officer'
      });
      await log.save({ session });

      await session.commitTransaction();
      session.endSession();
    } catch (txError) {
      await session.abortTransaction();
      session.endSession();

      // Standalone Fallback
      mainMat.quantity -= Number(quantity);
      await mainMat.save();

      log = new TransferLog({
        materialId: mainMat._id,
        materialName: encryptDB(materialName),
        quantity: encryptDB(String(quantity)),
        from: 'MainStore',
        to: 'SiteStore',
        projectId: target_project_id,
        project_id: target_project_id,
        status: 'In-Transit',
        issuedBy: req.user ? req.user.name : 'Store Officer'
      });
      await log.save();
    }

    const decLog = log.toObject();
    decLog.materialName = decryptDB(decLog.materialName);
    decLog.quantity = Number(decryptDB(decLog.quantity)) || 0;

    res.status(201).json({
      success: true,
      message: 'Stock successfully issued (Shipment is In-Transit).',
      transferLog: decLog
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Confirm delivery receipt of in-transit material transfer
// @route   POST /api/site/confirm-transfer/:transferLogId
// @access  Private (SiteStoreOfficer)
export const confirmTransferReceipt = async (req, res) => {
  try {
    const { transferLogId } = req.params;
    const transferLog = await TransferLog.findById(transferLogId);
    if (!transferLog) {
      return res.status(404).json({ success: false, message: 'Transfer log not found.' });
    }

    if (transferLog.status === 'Received') {
      return res.status(400).json({ success: false, message: 'This transfer has already been received.' });
    }

    const userProjectId = req.user.project_id || req.user.projectId;
    if (transferLog.projectId && String(transferLog.projectId) !== String(userProjectId)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to confirm receipt for this project.' });
    }

    const mongoose = (await import('mongoose')).default;
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const mainMat = await Material.findById(transferLog.materialId);
      const matName = decryptDB(transferLog.materialName);
      const qtyToReceive = Number(decryptDB(transferLog.quantity)) || 0;

      const siteMats = await Material.find({
        location: 'SiteStore',
        $or: [{ project_id: userProjectId }, { projectId: userProjectId }]
      }).session(session);

      let siteMat = siteMats.find(m => decryptDB(m.name) === matName);

      if (siteMat) {
        const currentQty = Number(decryptDB(siteMat.quantity)) || 0;
        const newQty = currentQty + qtyToReceive;
        siteMat.quantity = encryptDB(String(newQty));
        await siteMat.save({ session });
      } else {
        siteMat = new Material({
          name: encryptDB(matName),
          category: mainMat ? mainMat.category : 'Other',
          unit: mainMat ? mainMat.unit : 'bag',
          quantity: encryptDB(String(qtyToReceive)),
          minimumStock: mainMat ? mainMat.minimumStock : 10,
          location: 'SiteStore',
          unitPrice: mainMat ? mainMat.unitPrice : 0,
          project_id: userProjectId,
          projectId: userProjectId
        });
        await siteMat.save({ session });
      }

      transferLog.status = 'Received';
      await transferLog.save({ session });

      await session.commitTransaction();
      session.endSession();
    } catch (txError) {
      await session.abortTransaction();
      session.endSession();

      // Standalone Fallback
      const mainMat = await Material.findById(transferLog.materialId);
      const matName = decryptDB(transferLog.materialName);
      const qtyToReceive = Number(decryptDB(transferLog.quantity)) || 0;

      const siteMats = await Material.find({
        location: 'SiteStore',
        $or: [{ project_id: userProjectId }, { projectId: userProjectId }]
      });

      let siteMat = siteMats.find(m => decryptDB(m.name) === matName);

      if (siteMat) {
        const currentQty = Number(decryptDB(siteMat.quantity)) || 0;
        const newQty = currentQty + qtyToReceive;
        siteMat.quantity = encryptDB(String(newQty));
        await siteMat.save();
      } else {
        siteMat = new Material({
          name: encryptDB(matName),
          category: mainMat ? mainMat.category : 'Other',
          unit: mainMat ? mainMat.unit : 'bag',
          quantity: encryptDB(String(qtyToReceive)),
          minimumStock: mainMat ? mainMat.minimumStock : 10,
          location: 'SiteStore',
          unitPrice: mainMat ? mainMat.unitPrice : 0,
          project_id: userProjectId,
          projectId: userProjectId
        });
        await siteMat.save();
      }

      transferLog.status = 'Received';
      await transferLog.save();
    }

    res.status(200).json({ success: true, message: 'Transfer received and inventory updated.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
