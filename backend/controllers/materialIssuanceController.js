import MaterialIssuanceNote from '../models/MaterialIssuanceNote.js';
import Material from '../models/Material.js';
import TransferLog from '../models/TransferLog.js';
import BOM from '../models/BOM.js';
import { encryptDB, decryptDB } from '../utils/cryptoUtils.js';
import { recordMovement } from '../utils/stockService.js';

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

      if (alreadyRequested + Number(m.quantity) > bomMat.plannedQty) {
        return res.status(400).json({
          success: false,
          message: `Requested quantity for "${m.materialName}" exceeds the approved BOM limit. Planned: ${bomMat.plannedQty}, already requested: ${alreadyRequested}.`
        });
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
    res.status(201).json({ success: true, data: min });
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
