import MaterialTransferNote from '../models/MaterialTransferNote.js';
import MaterialRequest from '../models/MaterialRequest.js';
import Material from '../models/Material.js';
import Project from '../models/Project.js';
import { recordMovement } from '../utils/stockService.js';
import { createNotificationHelper } from './notificationController.js';
import { encryptDB, decryptDB } from '../utils/cryptoUtils.js';

// SiteStore Material names/quantities are encrypted at rest, so matching an
// existing Site Store line for a plaintext material name requires decrypting
// each candidate's name to compare.
const findSiteMaterialByName = async (siteStoreId, materialName) => {
  const siteMats = await Material.find({
    location: 'SiteStore',
    $or: [{ project_id: siteStoreId }, { projectId: siteStoreId }]
  });
  return siteMats.find(sm => decryptDB(sm.name) === materialName) || null;
};

// Moves stock for every line in `materials` (each already validated to be
// <= current Main Store availability) from Main Store into the given Site
// Store, creates the MTN document, and - when this fulfils a MaterialRequest
// - updates that request's per-line fulfilledQty/status and notifies the
// requester. Shared by both the manual (exact-quantity) and auto-generate
// (capped-to-availability) transfer flows so they stay consistent.
const executeTransfer = async ({
  materials,
  mainMatsByName,
  siteStoreId,
  siteStoreName,
  sourceRequest,
  transferDate,
  reference,
  notes,
  createdBy
}) => {
  const count = await MaterialTransferNote.countDocuments({});
  const mtnNumber = `MTN-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

  // Move stock: decrease Main Store, then increase (or create) the Site
  // Store line for every material. Every step up to here was validated
  // above, so this loop should not fail under normal operation.
  const completedMoves = [];
  try {
    for (const m of materials) {
      const qty = Number(m.quantity);
      const mainMat = mainMatsByName[m.materialName];

      await recordMovement({
        materialDoc: mainMat,
        type: 'MTN Transfer Out',
        quantityChange: -qty,
        reference: mtnNumber,
        performedBy: createdBy
      });
      completedMoves.push({ materialDoc: mainMat, quantityChange: qty });

      let siteMat = await findSiteMaterialByName(siteStoreId, m.materialName);

      if (!siteMat) {
        siteMat = new Material({
          name: encryptDB(m.materialName),
          category: mainMat.category,
          unit: mainMat.unit,
          quantity: encryptDB('0'),
          minimumStock: mainMat.minimumStock,
          maximumStock: mainMat.maximumStock,
          reorderLevel: mainMat.reorderLevel,
          location: 'SiteStore',
          unitPrice: mainMat.unitPrice,
          project_id: siteStoreId,
          projectId: siteStoreId
        });
        await siteMat.save();
      }

      await recordMovement({
        materialDoc: siteMat,
        type: 'MTN Transfer In',
        quantityChange: qty,
        reference: mtnNumber,
        performedBy: createdBy
      });
    }
  } catch (moveErr) {
    // Best-effort compensation: this codebase has no DB-transaction
    // support (standalone MongoDB, no replica set), so revert whatever
    // Main Store deductions already completed before the failure.
    for (const move of completedMoves) {
      try {
        await recordMovement({
          materialDoc: move.materialDoc,
          type: 'MTN Transfer Out',
          quantityChange: move.quantityChange,
          reference: `${mtnNumber}-ROLLBACK`,
          performedBy: createdBy
        });
      } catch (rollbackErr) {
        console.error('Failed to roll back MTN stock movement:', rollbackErr);
      }
    }
    throw moveErr;
  }

  const mtn = new MaterialTransferNote({
    mtnNumber,
    sourceRequestId: sourceRequest ? sourceRequest._id : null,
    requestNo: sourceRequest ? sourceRequest.requestNo : '',
    siteStoreId,
    siteStoreName,
    transferDate,
    reference: reference || (sourceRequest ? sourceRequest.requestNo : ''),
    notes: notes || '',
    materials: materials.map(m => {
      const reqLine = sourceRequest ? sourceRequest.materials.find(x => x.materialName === m.materialName) : null;
      return {
        materialName: m.materialName,
        unit: m.unit || (reqLine ? reqLine.unit : 'unit'),
        requestedQty: reqLine ? reqLine.quantity : 0,
        transferQty: Number(m.quantity)
      };
    }),
    status: 'Transferred',
    createdBy
  });
  await mtn.save();

  let shortfallLines = [];
  if (sourceRequest) {
    for (const m of materials) {
      const line = sourceRequest.materials.find(x => x.materialName === m.materialName);
      if (line) line.fulfilledQty = Math.min(line.quantity, (line.fulfilledQty || 0) + Number(m.quantity));
    }
    shortfallLines = sourceRequest.materials
      .filter(m => (m.fulfilledQty || 0) < m.quantity)
      .map(m => ({ materialName: m.materialName, unit: m.unit, outstanding: m.quantity - (m.fulfilledQty || 0) }));

    sourceRequest.status = shortfallLines.length === 0 ? 'Transferred' : 'Partially Transferred';
    sourceRequest.transferNoteId = mtn._id;
    sourceRequest.mtnNumber = mtn.mtnNumber;
    await sourceRequest.save();

    if (sourceRequest.requestedByUserId) {
      const msg = shortfallLines.length === 0
        ? `Your material request ${sourceRequest.requestNo} has been fully transferred (${mtn.mtnNumber}).`
        : `Your material request ${sourceRequest.requestNo} was partially transferred (${mtn.mtnNumber}). Still short: ${shortfallLines.map(s => `${s.materialName} (${s.outstanding} ${s.unit})`).join(', ')}.`;
      await createNotificationHelper(
        sourceRequest.requestedByUserId,
        msg,
        'SSR_TRANSFERRED',
        '/site-store-dashboard'
      );
    }
  }

  return { mtn, shortfallLines };
};

// @desc    Main Store creates a Material Transfer Note, moving stock from
//          Main Store to a Site Store - either fulfilling a Pending
//          MaterialRequest (sourceRequestId given, materials pre-populated
//          from that request) or as an ad hoc Main Store-initiated push.
//          Main Store stock is validated for every line BEFORE any inventory
//          is mutated, so a shortage on one line never causes a partial
//          transfer of the others. When fulfilling a MaterialRequest, no
//          transfer happens at all unless every outstanding line on that
//          request is both included in full and covered by current Main
//          Store stock - Main Store cannot send part of a request.
// @route   POST /api/material-transfer-notes
// @access  Private (MainStoreOfficer - "Issue Materials" permission)
export const createTransferNote = async (req, res) => {
  try {
    const { sourceRequestId, siteStoreId: bodySiteStoreId, transferDate, reference, notes, materials } = req.body;
    const createdBy = req.user ? req.user.name : 'Main Store Officer';

    if (!transferDate || !materials || !Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide a transfer date and at least one material.' });
    }
    if (materials.some(m => !m.materialName || !m.quantity || Number(m.quantity) <= 0)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid material and transfer quantity for every row.' });
    }

    let sourceRequest = null;
    let siteStoreId = bodySiteStoreId;
    let siteStoreName;

    if (sourceRequestId) {
      sourceRequest = await MaterialRequest.findById(sourceRequestId);
      if (!sourceRequest) {
        return res.status(404).json({ success: false, message: 'Source material request not found.' });
      }
      if (!['Pending', 'Processing', 'Partially Transferred'].includes(sourceRequest.status)) {
        return res.status(400).json({ success: false, message: 'Only Pending or Partially Transferred requests can be transferred.' });
      }
      siteStoreId = sourceRequest.siteStoreId;
      siteStoreName = sourceRequest.siteStoreName;

      // Main Store may only transfer against a Site Store request once every
      // outstanding line on that request is covered in full - no partial
      // transfers. Reject up front (before touching stock) if the submitted
      // materials don't cover every outstanding line at its full outstanding
      // quantity.
      const outstandingLines = sourceRequest.materials
        .map(m => ({ materialName: m.materialName, unit: m.unit, outstanding: m.quantity - (m.fulfilledQty || 0) }))
        .filter(m => m.outstanding > 0);
      const submittedQtyByName = {};
      materials.forEach(m => { submittedQtyByName[m.materialName] = Number(m.quantity); });
      const incomplete = outstandingLines.filter(
        line => !submittedQtyByName[line.materialName] || submittedQtyByName[line.materialName] < line.outstanding
      );
      if (incomplete.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Materials can only be sent once every requested item is fully available. Still short: ${incomplete.map(m => `${m.materialName} (needs ${m.outstanding} ${m.unit})`).join(', ')}.`
        });
      }
    } else {
      if (!siteStoreId) {
        return res.status(400).json({ success: false, message: 'Please select a destination Site Store.' });
      }
      const project = await Project.findById(siteStoreId);
      if (!project) {
        return res.status(400).json({ success: false, message: 'Selected Site Store was not found.' });
      }
      siteStoreName = `${project.projectName} Site Store`;
    }

    // Validate Main Store stock for every requested line before mutating anything.
    const mainMatsByName = {};
    for (const m of materials) {
      const mainMat = await Material.findOne({ name: m.materialName, location: 'MainStore' });
      const available = mainMat ? mainMat.quantity : 0;
      if (!mainMat || available < Number(m.quantity)) {
        return res.status(400).json({
          success: false,
          message: `Insufficient Main Store stock for ${m.materialName}. Available: ${available}. Requested: ${m.quantity}.`
        });
      }
      mainMatsByName[m.materialName] = mainMat;
    }

    const { mtn } = await executeTransfer({
      materials,
      mainMatsByName,
      siteStoreId,
      siteStoreName,
      sourceRequest,
      transferDate,
      reference,
      notes,
      createdBy
    });

    res.status(201).json({ success: true, message: 'Material Transfer Note created and stock transferred.', data: mtn });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    List Material Transfer Notes (Main Store sees all, Site Store sees its own)
// @route   GET /api/material-transfer-notes
// @access  Private
export const getTransferNotes = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'SiteStoreOfficer') {
      const siteStoreId = req.user.projectId || req.user.project_id;
      filter.siteStoreId = siteStoreId;
    }
    const notes = await MaterialTransferNote.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: notes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get a single Material Transfer Note
// @route   GET /api/material-transfer-notes/:id
// @access  Private
export const getTransferNoteById = async (req, res) => {
  try {
    const mtn = await MaterialTransferNote.findById(req.params.id);
    if (!mtn) {
      return res.status(404).json({ success: false, message: 'Material Transfer Note not found.' });
    }
    res.status(200).json({ success: true, data: mtn });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
