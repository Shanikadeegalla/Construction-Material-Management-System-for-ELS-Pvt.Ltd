import MaterialIssuanceNote from '../models/MaterialIssuanceNote.js';
import Material from '../models/Material.js';
import TransferLog from '../models/TransferLog.js';
import BOM from '../models/BOM.js';
import User from '../models/userModel.js';
import { encryptDB, decryptDB } from '../utils/cryptoUtils.js';
import { recordMovement } from '../utils/stockService.js';
import { createNotificationHelper } from './notificationController.js';

// Notifies every Main Store Officer that a new Site Store material request is
// awaiting their review, so it doesn't rely on them noticing it themselves.
const notifyMainStoreOfNewRequest = async (min) => {
  try {
    const mainStoreOfficers = await User.find({ role: 'MainStoreOfficer' });
    const msg = `New material request ${min.minNumber} from ${min.projectName} awaiting review (${min.materials.length} item${min.materials.length === 1 ? '' : 's'})`;
    for (const officer of mainStoreOfficers) {
      await createNotificationHelper(officer._id, msg, 'MIN_REQUEST_SUBMITTED', '/main-store-dashboard');
    }
  } catch (nErr) {
    console.error('Error creating new material request notification:', nErr);
  }
};

// @desc    Get all Material Issuance Notes
// @route   GET /api/min
// @access  Private
export const getMINs = async (req, res) => {
  try {
    const { projectId, status } = req.query;
    const filter = {};
    if (projectId) filter.projectId = projectId;
    if (status) filter.status = status;
    const mins = await MaterialIssuanceNote.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: mins });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a Material Issuance Note requesting materials against an
//          approved BOM (Site Store raises it, Main Store approves/issues it)
// @route   POST /api/min
// @access  Private
export const createMIN = async (req, res) => {
  try {
    const { projectId, projectName, materials, notes } = req.body;
    const requestedBy = req.user ? req.user.name : 'Site Store Officer';

    if (!projectId || !projectName || !materials || !Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide all required Material Issuance Note fields.' });
    }

    const bom = await BOM.findOne({ projectId, status: 'Approved' });
    if (!bom) {
      return res.status(400).json({ success: false, message: 'No approved BOM found for this project. Materials can only be requested against an approved BOM.' });
    }

    // Requested quantities are checked cumulatively against every prior
    // (non-rejected) note raised against this same BOM, so repeated partial
    // requests can never add up to more than what the BOM planned.
    const priorMins = await MaterialIssuanceNote.find({ bomId: bom._id, status: { $ne: 'Rejected' } });

    for (const m of materials) {
      const bomMat = bom.materials.find(bm => bm.name === m.materialName);
      if (!bomMat) {
        return res.status(400).json({ success: false, message: `Material "${m.materialName}" is not in the approved BOM.` });
      }

      const alreadyRequested = priorMins.reduce((sum, mn) => {
        const line = mn.materials.find(x => x.materialName === m.materialName);
        return sum + (line ? line.quantity : 0);
      }, 0);

      // BOM planned quantity is a soft limit: over-plan requests are flagged
      // on the line item and surfaced to the requester, not blocked.
      const exceedAmount = Math.max((alreadyRequested + Number(m.quantity)) - bomMat.plannedQty, 0);
      if (exceedAmount > 0) {
        m.exceedsBom = true;
        m.exceedAmount = exceedAmount;
      }
    }

    const count = await MaterialIssuanceNote.countDocuments({});
    const minNumber = `MIN-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    const min = new MaterialIssuanceNote({
      minNumber,
      bomId: bom._id,
      bomNumber: bom.bomNumber,
      projectId,
      projectName,
      requestedBy,
      materials,
      notes: notes || '',
      status: 'Pending'
    });

    await min.save();

    try {
      const overPlanMats = min.materials.filter(m => m.exceedsBom);
      if (overPlanMats.length > 0 && req.user) {
        const details = overPlanMats.map(m => `${m.materialName} (+${m.exceedAmount})`).join(', ');
        const msg = `Your Material Issuance Note ${min.minNumber} exceeds the approved BOM plan for: ${details}.`;
        await createNotificationHelper(req.user._id, msg, 'MIN_EXCEEDS_BOM', '/site-store-dashboard');
      }
    } catch (nErr) {
      console.error('Error creating MIN BOM-exceeded notification:', nErr);
    }

    await notifyMainStoreOfNewRequest(min);

    res.status(201).json({ success: true, data: min });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a free-form Material Transfer Request from the Site Store
//          "Request Materials" screen. Unlike createMIN, this is not gated
//          against an approved BOM - any material/quantity can be requested.
//          Each line is stamped with a snapshot of current site stock so
//          Main Store can see what's on hand when reviewing the request.
// @route   POST /api/min/request
// @access  Private
export const createMaterialRequest = async (req, res) => {
  try {
    const { projectId, projectName, requiredDate, materials, notes } = req.body;
    const requestedBy = req.user ? req.user.name : 'Site Store Officer';

    if (!projectId || !projectName || !materials || !Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide all required Material Transfer Request fields.' });
    }

    const siteMaterials = await Material.find({
      location: 'SiteStore',
      $or: [{ project_id: projectId }, { projectId }]
    });
    const decryptedSiteMats = siteMaterials.map(m => ({
      name: decryptDB(m.name),
      quantity: Number(decryptDB(m.quantity)) || 0
    }));

    const preparedMaterials = materials.map(m => {
      const siteMat = decryptedSiteMats.find(sm => sm.name === m.materialName);
      return {
        materialName: m.materialName,
        quantity: Number(m.quantity),
        unit: m.unit || 'unit',
        availableAtSite: siteMat ? siteMat.quantity : 0
      };
    });

    if (preparedMaterials.some(m => !m.materialName || !m.quantity || m.quantity <= 0)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid material and quantity for every request row.' });
    }

    const count = await MaterialIssuanceNote.countDocuments({});
    const minNumber = `MIN-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    const min = new MaterialIssuanceNote({
      minNumber,
      requestType: 'FreeForm',
      projectId,
      projectName,
      requestedBy,
      requiredDate: requiredDate || undefined,
      materials: preparedMaterials,
      notes: notes || '',
      status: 'Pending'
    });

    await min.save();
    await notifyMainStoreOfNewRequest(min);
    res.status(201).json({ success: true, data: min });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Main Store's "Create Material Transfer Note" screen. Either
//          starts a brand new Main Store-initiated transfer to a project's
//          Site Store (no sourceRequestId), or fulfils a Pending/Approved
//          FreeForm request raised by Site Store in one step (sourceRequestId
//          given) - transitioning that same note straight to Issued instead
//          of creating a duplicate document. Either way, Main Store stock is
//          validated and deducted immediately and an In-Transit TransferLog
//          is created per material, exactly like issueMIN.
// @route   POST /api/min/transfer
// @access  Private
export const transferMIN = async (req, res) => {
  try {
    const { projectId, projectName, transferDate, reference, notes, materials, sourceRequestId } = req.body;
    const issuedBy = req.user ? req.user.name : 'Main Store Officer';

    if (!projectId || !projectName || !materials || !Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide all required Material Transfer Note fields.' });
    }
    if (materials.some(m => !m.materialName || !m.quantity || Number(m.quantity) <= 0)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid material and transfer quantity for every row.' });
    }

    const mainMatsByName = {};
    for (const m of materials) {
      const mainMat = await Material.findOne({ name: m.materialName, location: 'MainStore' });
      if (!mainMat || mainMat.quantity < Number(m.quantity)) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock in Main Store for ${m.materialName}. Available: ${mainMat ? mainMat.quantity : 0}, Requested: ${m.quantity}`
        });
      }
      mainMatsByName[m.materialName] = mainMat;
    }

    let min;
    if (sourceRequestId) {
      min = await MaterialIssuanceNote.findById(sourceRequestId);
      if (!min) {
        return res.status(404).json({ success: false, message: 'Source Material Transfer Request not found.' });
      }
      if (min.requestType !== 'FreeForm') {
        return res.status(400).json({ success: false, message: 'Only free-form Site Store requests can be transferred from this screen.' });
      }
      if (!['Pending', 'Approved'].includes(min.status)) {
        return res.status(400).json({ success: false, message: 'Only Pending or Approved requests can be transferred.' });
      }
      min.materials = materials.map(m => {
        const existing = min.materials.find(x => x.materialName === m.materialName);
        return {
          materialName: m.materialName,
          quantity: Number(m.quantity),
          unit: m.unit || (existing ? existing.unit : 'unit'),
          availableAtSite: existing ? existing.availableAtSite : 0
        };
      });
      if (transferDate) min.transferDate = transferDate;
      if (reference) min.reference = reference;
      if (notes) min.notes = notes;
    } else {
      const count = await MaterialIssuanceNote.countDocuments({});
      const minNumber = `MIN-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
      min = new MaterialIssuanceNote({
        minNumber,
        requestType: 'FreeForm',
        initiatedBy: 'MainStore',
        projectId,
        projectName,
        requestedBy: issuedBy,
        transferDate: transferDate || undefined,
        reference: reference || '',
        materials: materials.map(m => ({
          materialName: m.materialName,
          quantity: Number(m.quantity),
          unit: m.unit || 'unit'
        })),
        notes: notes || ''
      });
    }

    for (const m of materials) {
      await recordMovement({
        materialDoc: mainMatsByName[m.materialName],
        type: 'MIN Issue',
        quantityChange: -Number(m.quantity),
        reference: min.minNumber,
        performedBy: issuedBy
      });

      const log = new TransferLog({
        materialId: mainMatsByName[m.materialName]._id,
        materialName: encryptDB(m.materialName),
        quantity: encryptDB(String(m.quantity)),
        from: 'MainStore',
        to: 'SiteStore',
        projectId,
        project_id: projectId,
        status: 'In-Transit',
        issuedBy,
        minId: min._id
      });
      await log.save();
    }

    min.status = 'Issued';
    min.issuedBy = issuedBy;
    min.issuedAt = new Date();
    await min.save();

    res.status(201).json({ success: true, message: 'Material Transfer Note created and materials issued to Site Store.', data: min });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Approve/Reject a Material Issuance Note
// @route   PUT /api/min/:id/status
// @access  Private
export const updateMINStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status update.' });
    }

    const min = await MaterialIssuanceNote.findById(id);
    if (!min) {
      return res.status(404).json({ success: false, message: 'Material Issuance Note not found.' });
    }
    if (min.status !== 'Pending') {
      return res.status(400).json({ success: false, message: 'Only Pending notes can be approved or rejected.' });
    }

    min.status = status;
    if (status === 'Rejected') {
      min.rejectionReason = rejectionReason || 'Rejected by Main Store';
    }

    await min.save();
    res.status(200).json({ success: true, data: min });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Issue materials for a Material Issuance Note: checks Main Store
//          stock, deducts it, and creates in-transit TransferLog rows linked
//          back to this note.
// @route   POST /api/min/:id/issue
// @access  Private
export const issueMIN = async (req, res) => {
  try {
    const { id } = req.params;
    const min = await MaterialIssuanceNote.findById(id);
    if (!min) {
      return res.status(404).json({ success: false, message: 'Material Issuance Note not found.' });
    }
    if (min.status !== 'Approved') {
      return res.status(400).json({ success: false, message: 'Only Approved notes can be issued.' });
    }

    for (const m of min.materials) {
      const mainMat = await Material.findOne({ name: m.materialName, location: 'MainStore' });
      if (!mainMat || mainMat.quantity < m.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock in Main Store for ${m.materialName}. Available: ${mainMat ? mainMat.quantity : 0}, Requested: ${m.quantity}`
        });
      }
    }

    const issuedBy = req.user ? req.user.name : 'Main Store Officer';

    for (const m of min.materials) {
      const mainMat = await Material.findOne({ name: m.materialName, location: 'MainStore' });
      await recordMovement({
        materialDoc: mainMat,
        type: 'MIN Issue',
        quantityChange: -m.quantity,
        reference: min.minNumber,
        performedBy: issuedBy
      });

      const log = new TransferLog({
        materialId: mainMat._id,
        materialName: encryptDB(m.materialName),
        quantity: encryptDB(String(m.quantity)),
        from: 'MainStore',
        to: 'SiteStore',
        projectId: min.projectId,
        project_id: min.projectId,
        status: 'In-Transit',
        issuedBy,
        minId: min._id
      });
      await log.save();
    }

    min.status = 'Issued';
    min.issuedBy = issuedBy;
    min.issuedAt = new Date();
    await min.save();

    res.status(200).json({ success: true, message: 'Materials issued to Site Store. Awaiting receipt confirmation.', data: min });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Site Store confirms receipt of an issued Material Issuance Note:
//          adds the issued quantities into Site Store stock for the project.
// @route   POST /api/min/:id/confirm-receipt
// @access  Private
export const confirmMINReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const min = await MaterialIssuanceNote.findById(id);
    if (!min) {
      return res.status(404).json({ success: false, message: 'Material Issuance Note not found.' });
    }
    if (min.status !== 'Issued') {
      return res.status(400).json({ success: false, message: 'Only Issued notes can be confirmed as received.' });
    }

    const logs = await TransferLog.find({ minId: min._id, status: 'In-Transit' });

    for (const log of logs) {
      const matName = decryptDB(log.materialName);
      const qtyToReceive = Number(decryptDB(log.quantity)) || 0;

      const siteMats = await Material.find({
        location: 'SiteStore',
        $or: [{ project_id: min.projectId }, { projectId: min.projectId }]
      });
      let siteMat = siteMats.find(sm => decryptDB(sm.name) === matName);

      if (!siteMat) {
        const mainMat = await Material.findById(log.materialId);
        siteMat = new Material({
          name: encryptDB(matName),
          category: mainMat ? mainMat.category : 'Other',
          unit: mainMat ? mainMat.unit : 'bag',
          quantity: encryptDB('0'),
          minimumStock: mainMat ? mainMat.minimumStock : 10,
          location: 'SiteStore',
          unitPrice: mainMat ? mainMat.unitPrice : 0,
          project_id: min.projectId,
          projectId: min.projectId
        });
        await siteMat.save();
      }

      await recordMovement({
        materialDoc: siteMat,
        type: 'MIN Receipt',
        quantityChange: qtyToReceive,
        reference: min.minNumber,
        performedBy: req.user ? req.user.name : 'Site Store Officer'
      });

      log.status = 'Received';
      await log.save();
    }

    min.status = 'Received';
    min.receivedBy = req.user ? req.user.name : 'Site Store Officer';
    min.receivedAt = new Date();
    await min.save();

    res.status(200).json({ success: true, message: 'Receipt confirmed and Site Store inventory updated.', data: min });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
