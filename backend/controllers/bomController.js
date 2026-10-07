import mongoose from 'mongoose';
import BOM from '../models/BOM.js';
import Project from '../models/Project.js';
import User from '../models/userModel.js';
import ItemMaster from '../models/ItemMaster.js';
import Material from '../models/Material.js';
import PurchaseRequest from '../models/PurchaseRequest.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import { createNotificationHelper } from './notificationController.js';

// Helper to calculate the next version for a project
const getNextVersion = async (projectId) => {
  const nonDraftBoms = await BOM.find({
    projectId,
    status: { $ne: 'Draft' }
  }).sort({ createdAt: 1 });

  if (nonDraftBoms.length === 0) {
    return 'v1.0';
  }

  const latest = nonDraftBoms[nonDraftBoms.length - 1];
  const versionStr = latest.version || 'v1.0';
  const match = versionStr.match(/^v(\d+)\.(\d+)$/);

  let major = 1;
  let minor = 0;

  if (match) {
    major = parseInt(match[1], 10);
    minor = parseInt(match[2], 10);
  }

  if (latest.status === 'Rejected') {
    // Increment minor version on rejection resubmission (e.g. v1.0 -> v1.1)
    return `v${major}.${minor + 1}`;
  } else {
    // Increment major version if previous was Approved or Submitted (e.g. v1.1 -> v2.0)
    return `v${major + 1}.0`;
  }
};

// A BOM Number identifies the material requirement plan for a project and stays
// constant across versions/resubmissions (only the version string changes). It is
// derived from the project's own human-readable projectId (e.g. "PRJ-2026-004")
// so the BOM number is traceable back to its project at a glance, and unique
// because the project code it's built from is unique. The collision-guard
// suffix is a safety net for edge cases (e.g. two drafts opened for the same
// project by different users before one is finalized).
const getOrCreateBOMNumber = async (projectId) => {
  const existing = await BOM.findOne({ projectId, bomNumber: { $exists: true, $ne: null } }).sort({ createdAt: 1 });
  if (existing && existing.bomNumber) {
    return existing.bomNumber;
  }

  const project = await Project.findById(projectId);
  const projectCode = project?.projectId || String(projectId).slice(-6).toUpperCase();

  let bomNumber = `BOM-${projectCode}`;
  let suffix = 1;
  while (await BOM.exists({ bomNumber })) {
    suffix += 1;
    bomNumber = `BOM-${projectCode}-${suffix}`;
  }
  return bomNumber;
};

// Materials must always be sourced from the active Material Master catalog -
// the client may only supply materialId, plannedQty, supplierRef and remarks.
// Name/category/unit/estimatedUnitCost are looked up here so they can never
// be manually typed or tampered with via a direct API call.
const resolveMaterialsFromMaster = async (materials) => {
  const resolved = [];

  for (const m of materials) {
    if (!m.materialId) {
      throw new Error('Every BOM item must reference a material from the Master Material list.');
    }

    const master = await ItemMaster.findOne({ _id: m.materialId, status: 'Active' });
    if (!master) {
      throw new Error(`Material "${m.name || m.materialName || m.materialId}" is not an active Master Material.`);
    }

    const qty = Number(m.plannedQty) || Number(m.quantity) || 0;
    if (qty <= 0) {
      throw new Error(`Please provide a valid planned quantity for "${master.materialName}".`);
    }

    const cost = Number(master.estimatedUnitCost) || 0;

    resolved.push({
      materialId: master._id,
      name: master.materialName,
      unit: master.unit,
      plannedQty: qty,
      category: master.category,
      estimatedUnitCost: cost,
      totalCost: qty * cost,
      supplierRef: m.supplierRef || '',
      remarks: m.remarks || ''
    });
  }

  return resolved;
};

// @desc    Get all BOMs
// @route   GET /api/bom
// @access  Private
export const getBOMs = async (req, res) => {
  try {
    const boms = await BOM.find({})
      .populate('projectId', 'projectName projectId name clientName location startDate expectedEndDate')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: boms.length, data: boms });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all BOM versions for a project
// @route   GET /api/bom/versions/:projectId
// @access  Private
export const getBOMVersions = async (req, res) => {
  try {
    const { projectId } = req.params;
    const boms = await BOM.find({ projectId })
      .populate('projectId', 'projectName projectId name clientName location startDate expectedEndDate')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: boms.length, data: boms });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create or update a BOM
// @route   POST /api/bom
// @access  Private
export const createBOM = async (req, res) => {
  try {
    const { projectId, status, materials } = req.body;

    if (!projectId || !materials || !Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({ success: false, message: 'Missing required BOM fields.' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const projectName = project.projectName || project.name;

    // Resolve creator ID
    let creatorId = req.user ? req.user._id : null;
    if (!creatorId) {
      const pmUser = await User.findOne({ role: 'ProjectManager' });
      creatorId = pmUser ? pmUser._id : new mongoose.Types.ObjectId();
    }

    let mappedMaterials;
    try {
      mappedMaterials = await resolveMaterialsFromMaster(materials);
    } catch (validationErr) {
      return res.status(400).json({ success: false, message: validationErr.message });
    }

    const isSubmitted = status === 'Submitted';

    // Find if a draft BOM exists for this project by this user
    let draftBom = await BOM.findOne({ projectId, status: 'Draft', createdBy: creatorId });

    if (draftBom) {
      // PM is editing/updating an existing draft BOM
      draftBom.materials = mappedMaterials;
      draftBom.projectName = projectName;
      if (!draftBom.bomNumber) {
        draftBom.bomNumber = await getOrCreateBOMNumber(projectId);
      }

      if (isSubmitted) {
        // Submit the draft: change status and calculate proper version
        draftBom.status = 'Submitted';
        draftBom.version = await getNextVersion(projectId);
        draftBom.submittedAt = new Date();
      } else {
        // Save as draft again: keep draft status and calculate version if not set
        if (!draftBom.version) {
          draftBom.version = await getNextVersion(projectId);
        }
      }

      await draftBom.save();

      if (isSubmitted) {
        try {
          const pmName = req.user ? req.user.name : 'Project Manager';
          const directors = await User.find({ role: 'Director' });
          const msg = `New BOM ${draftBom.version} submitted for ${projectName} by ${pmName} - awaiting approval`;
          if (directors.length > 0) {
            for (const d of directors) {
              await createNotificationHelper(d._id, msg, 'BOM_SUBMITTED', '/director-dashboard', 'Director', 'Director');
            }
          } else {
            await createNotificationHelper(null, msg, 'BOM_SUBMITTED', '/director-dashboard', 'Director', 'Director');
          }
        } catch (nErr) {
          console.error('Error creating submission notifications:', nErr);
        }
      }

      return res.status(200).json({
        success: true,
        message: isSubmitted ? 'BOM submitted to Director successfully!' : 'BOM draft saved successfully!',
        data: draftBom
      });
    } else {
      // Create new document (since no draft exists or it is a new submission)
      const finalVersion = await getNextVersion(projectId);
      const bomNumber = await getOrCreateBOMNumber(projectId);

      const bom = new BOM({
        bomNumber,
        projectId,
        projectName,
        version: finalVersion,
        createdBy: creatorId,
        materials: mappedMaterials,
        // Never trust the client's status here - a BOM can only be created as
        // Draft or Submitted. Approval happens only through approveBOM.
        status: isSubmitted ? 'Submitted' : 'Draft',
        submittedAt: isSubmitted ? new Date() : undefined
      });

      await bom.save();

      if (isSubmitted) {
        try {
          const pmName = req.user ? req.user.name : 'Project Manager';
          const directors = await User.find({ role: 'Director' });
          const msg = `New BOM ${bom.version} submitted for ${projectName} by ${pmName} - awaiting approval`;
          if (directors.length > 0) {
            for (const d of directors) {
              await createNotificationHelper(d._id, msg, 'BOM_SUBMITTED', '/director-dashboard', 'Director', 'Director');
            }
          } else {
            await createNotificationHelper(null, msg, 'BOM_SUBMITTED', '/director-dashboard', 'Director', 'Director');
          }
        } catch (nErr) {
          console.error('Error creating submission notifications:', nErr);
        }
      }

      return res.status(201).json({
        success: true,
        message: isSubmitted ? 'BOM submitted to Director successfully!' : 'BOM draft saved successfully!',
        data: bom
      });
    }
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Approve a BOM
// @route   PUT /api/bom/:id/approve
// @access  Private
export const approveBOM = async (req, res) => {
  try {
    const approvedBy = req.user ? req.user.name : 'Director';
    const { note } = req.body;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid BOM ID.' });
    }

    // Only a BOM that is waiting for the Director can be approved - a Draft or
    // Rejected BOM must be (re)submitted by the Project Manager first.
    const bom = await BOM.findOneAndUpdate(
      { _id: req.params.id, status: { $in: ['Submitted', 'Pending'] } },
      { status: 'Approved', approvedBy, rejectionReason: note || '' },
      { new: true }
    ).populate('projectId');

    if (!bom) {
      const exists = await BOM.exists({ _id: req.params.id });
      if (!exists) {
        return res.status(404).json({ success: false, message: 'BOM not found.' });
      }
      return res.status(400).json({ success: false, message: 'Only a submitted BOM can be approved.' });
    }

    const projectName = bom.projectName || (bom.projectId ? (bom.projectId.projectName || bom.projectId.name) : 'Project');
    const msg = `BOM ${bom.version} for ${projectName} Approved by Director${note ? `: ${note}` : ''}`;
    await createNotificationHelper(bom.createdBy, msg, 'BOM_approved', '/bom');

    // Prompt Main Store to check the newly-approved plan against current stock.
    try {
      const mainStoreOfficers = await User.find({ role: 'MainStoreOfficer' });
      const stockCheckMsg = `BOM ${bom.version} for ${projectName} was approved - check Main Store stock against this plan.`;
      for (const officer of mainStoreOfficers) {
        await createNotificationHelper(officer._id, stockCheckMsg, 'BOM_STOCK_CHECK_REQUIRED', '/main-store-dashboard');
      }
    } catch (nErr) {
      console.error('Error creating BOM stock-check notification:', nErr);
    }

    res.status(200).json({ success: true, message: 'BOM approved successfully!', data: bom });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Reject a BOM with reason
// @route   PUT /api/bom/:id/reject
// @access  Private
export const rejectBOM = async (req, res) => {
  try {
    const approvedBy = req.user ? req.user.name : 'Director';
    const { rejectionReason } = req.body;

    const bom = await BOM.findByIdAndUpdate(
      req.params.id,
      { status: 'Rejected', approvedBy, rejectionReason: rejectionReason || '' },
      { new: true }
    ).populate('projectId');

    if (!bom) {
      return res.status(404).json({ success: false, message: 'BOM not found.' });
    }

    const projectName = bom.projectName || (bom.projectId ? (bom.projectId.projectName || bom.projectId.name) : 'Project');
    const msg = `BOM ${bom.version} for ${projectName} Rejected${rejectionReason ? `: ${rejectionReason}` : ''}`;
    await createNotificationHelper(bom.createdBy, msg, 'BOM_rejected', '/bom');

    res.status(200).json({ success: true, message: 'BOM rejected successfully!', data: bom });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get approved BOM for a project
// @route   GET /api/bom/approved/:projectId
// @access  Private
export const getApprovedBOM = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID.' });
    }

    const bom = await getLatestApprovedBOM(projectId);

    if (!bom) {
      return res.status(404).json({ success: false, message: 'No approved BOM found for this project.' });
    }

    await bom.populate('projectId', 'projectName projectId name clientName location');

    res.status(200).json({ success: true, data: bom });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// A project can have several approved BOM versions over time. The one in
// force is the most recently approved - approval is the last change made to
// an approved BOM, so that is the one with the newest updatedAt.
export const getLatestApprovedBOM = async (projectId) => {
  return BOM.findOne({ projectId, status: 'Approved' }).sort({ updatedAt: -1, createdAt: -1 });
};

// Compares every material on an approved BOM against Main Store stock.
// Shared by the stock-check endpoint and by PR creation, so the shortage the
// officer sees is exactly the shortage the PR is validated against.
//
// Matching is BOM material -> ItemMaster (materialId) -> Main Store Material
// by materialCode. The plain name is only a fallback for older rows that have
// no ItemMaster link/code.
//
// alreadyRequestedQty is what active Main Store PRs for this same BOM already
// cover, so the same shortage is not requested twice. This only reads data -
// it never changes stock.
export const computeBOMStockCheck = async (bom) => {
  const mainStoreMaterials = await Material.find({ location: 'MainStore' });

  const masterIds = bom.materials.map((item) => item.materialId).filter(Boolean);
  const masters = await ItemMaster.find({ _id: { $in: masterIds } });
  const codeByMasterId = {};
  for (const master of masters) {
    codeByMasterId[String(master._id)] = master.materialCode;
  }

  // A PR is still "active" while it is waiting for the Purchase Manager, or
  // while the PO made from it has not been delivered/closed/rejected yet.
  const bomPrs = await PurchaseRequest.find({
    bomId: bom._id,
    source: 'MainStore',
    status: { $in: ['Pending', 'PO Created'] }
  });
  const poCreatedPrIds = bomPrs.filter((pr) => pr.status === 'PO Created').map((pr) => pr._id);
  const openPos = await PurchaseOrder.find({
    prId: { $in: poCreatedPrIds },
    status: { $in: ['Draft', 'Pending', 'Approved', 'Sent'] }
  });
  const openPoPrIds = new Set(openPos.map((po) => String(po.prId)));
  const activePrs = bomPrs.filter((pr) => pr.status === 'Pending' || openPoPrIds.has(String(pr._id)));

  return bom.materials.map((item) => {
    const code = item.materialId ? codeByMasterId[String(item.materialId)] : null;
    const itemName = item.name.trim().toLowerCase();

    let stockRows = code ? mainStoreMaterials.filter((m) => m.materialCode === code) : [];
    if (stockRows.length === 0) {
      stockRows = mainStoreMaterials.filter((m) => String(m.name).trim().toLowerCase() === itemName);
    }
    const available = stockRows.reduce((sum, m) => sum + (Number(m.quantity) || 0), 0);

    const shortage = Math.max(item.plannedQty - available, 0);

    let alreadyRequestedQty = 0;
    for (const pr of activePrs) {
      for (const prItem of pr.materials) {
        const sameMaterial = (item.materialId && prItem.materialId)
          ? String(prItem.materialId) === String(item.materialId)
          : prItem.materialName.trim().toLowerCase() === itemName;
        if (sameMaterial) {
          alreadyRequestedQty += prItem.quantity;
        }
      }
    }

    return {
      materialId: item.materialId || null,
      name: item.name,
      category: item.category,
      unit: item.unit,
      estimatedUnitCost: item.estimatedUnitCost || 0,
      plannedQty: item.plannedQty,
      available,
      shortage,
      status: shortage > 0 ? 'Shortage' : 'Sufficient',
      alreadyRequestedQty,
      // What can still be put on a new PR without duplicating an active one.
      requestableQty: Math.max(shortage - alreadyRequestedQty, 0)
    };
  });
};

// @desc    Shortage summary for the approved BOM in force on every project,
//          so the Approved BOMs list can show which ones still need a PR
//          without opening each comparison.
// @route   GET /api/bom/stock-summary
// @access  Private
export const getBOMStockSummary = async (req, res) => {
  try {
    const allApproved = await BOM.find({ status: 'Approved' }).sort({ updatedAt: -1, createdAt: -1 });
    const seenProjects = new Set();
    const boms = allApproved.filter((b) => {
      const key = String(b.projectId);
      if (seenProjects.has(key)) return false;
      seenProjects.add(key);
      return true;
    });

    const data = {};
    await Promise.all(boms.map(async (bom) => {
      const rows = await computeBOMStockCheck(bom);
      data[String(bom._id)] = {
        shortageCount: rows.filter((r) => r.shortage > 0).length,
        // Shortage lines that no active PR covers yet.
        toRequestCount: rows.filter((r) => r.requestableQty > 0).length
      };
    }));

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Compare an approved BOM's planned materials against Main Store stock
// @route   GET /api/bom/:bomId/stock-check
// @access  Private
export const getBOMStockCheck = async (req, res) => {
  try {
    const { bomId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(bomId)) {
      return res.status(400).json({ success: false, message: 'Invalid BOM ID.' });
    }

    const bom = await BOM.findOne({ _id: bomId, status: 'Approved' });

    if (!bom) {
      return res.status(404).json({ success: false, message: 'Approved BOM not found.' });
    }

    const data = await computeBOMStockCheck(bom);

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
