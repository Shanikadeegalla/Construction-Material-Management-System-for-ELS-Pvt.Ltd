import Material from '../models/Material.js';
import MaterialUsage from '../models/MaterialUsage.js';
import Project from '../models/Project.js';
import BOM from '../models/BOM.js';
import { decryptDB } from '../utils/cryptoUtils.js';
import { recordMovement, getDecryptedQuantity } from '../utils/stockService.js';
import { getLatestApprovedBOM } from './bomController.js';
import { createNotificationHelper, notifyRoles } from './notificationController.js';

// Helper to decrypt a string
const decryptIfNeeded = (val) => {
  return decryptDB(val);
};

// @desc    Fetch Site Store inventory. The Site Store holds one shared stock
//          for every project - it is not split per project, so nothing is
//          filtered by the user's or the selected project.
// @route   GET /api/site/inventory
// @access  Private
export const getSiteInventory = async (req, res) => {
  try {
    const materials = await Material.find({ location: 'SiteStore' });

    const decrypted = materials.map(m => {
      const doc = m.toObject();
      doc.name = decryptDB(doc.name);
      doc.quantity = Number(decryptDB(doc.quantity)) || 0;
      return doc;
    });

    // Return array directly to match SiteStoreDashboard.js expectations
    res.status(200).json(decrypted);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Admin & Director projects overview
// @route   GET /api/admin/projects-overview
// @access  Private (Admin / Director)
export const getProjectsOverview = async (req, res) => {
  try {
    if (req.user.role !== 'Admin' && req.user.role !== 'Director' && req.user.role !== 'ProjectManager') {
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

// @desc    Site Store's combined "Material Issue & Usage" transaction: takes
//          materials already sitting in Site Store inventory and issues them
//          to a project's construction activity in one step. Validates the
//          project/material/quantity, decreases Site Store stock through the
//          shared recordMovement helper (the only sanctioned way to mutate
//          Material.quantity, which also writes the StockMovement audit
//          trail), and records the same quantity as actual project material
//          usage - a single submission, a single stock deduction.
// @route   POST /api/site/material-usage
// @access  Private (SiteStoreOfficer - "Log Material Usage" permission)
export const issueMaterialToProject = async (req, res) => {
  try {
    const { projectId, materialId, quantity, quantity_used, activity, purpose, notes, date } = req.body;
    const qty = Number(quantity || quantity_used);

    if (!projectId) {
      return res.status(400).json({ success: false, message: 'Please select a project.' });
    }
    if (!materialId) {
      return res.status(400).json({ success: false, message: 'Please select a material.' });
    }
    if (!qty || Number.isNaN(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid quantity greater than 0.' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    // Site Store stock is shared, so any site material can be issued to any
    // project - the project only decides whose usage/BOM it counts against.
    const siteMaterial = await Material.findOne({ _id: materialId, location: 'SiteStore' });
    if (!siteMaterial) {
      return res.status(404).json({ success: false, message: 'Material not found in Site Store inventory.' });
    }

    const decryptedName = decryptDB(siteMaterial.name);
    const availableQty = getDecryptedQuantity(siteMaterial);

    if (qty > availableQty) {
      // Shortage check against Main Store
      const mainMaterial = await Material.findOne({
        name: decryptedName,
        location: 'MainStore'
      });

      const mainQty = mainMaterial ? mainMaterial.quantity : 0;
      const errorMsg = mainQty > 0
        ? `Insufficient stock at the site (Available: ${availableQty} ${siteMaterial.unit}). Main Store currently has ${mainQty} units.`
        : `Insufficient stock at site (Available: ${availableQty} ${siteMaterial.unit}). No stock in Main Store.`;

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

    const issuedBy = req.user ? req.user.name : 'Site Store Officer';
    const projectName = project.projectName || project.name;
    const actStr = String(activity || purpose || 'General Usage').trim();

    const priorCount = await MaterialUsage.countDocuments({ minNumber: { $exists: true, $ne: '' } });
    const minNumber = `MIN-${new Date().getFullYear()}-${String(priorCount + 1).padStart(3, '0')}`;

    // Planned quantity comes from the project's approved BOM currently in
    // force. Variance is cumulative: everything issued to this project for
    // this material so far (including this issue) against the BOM plan - a
    // single issue compared to the whole plan would always look "under".
    let plannedQty = 0;
    let inBom = false;
    const approvedBOM = await getLatestApprovedBOM(projectId);
    if (approvedBOM) {
      const match = approvedBOM.materials.find(m => m.name.trim().toLowerCase() === decryptedName.trim().toLowerCase());
      if (match) {
        plannedQty = Number(match.plannedQty) || 0;
        inBom = true;
      }
    }

    const priorUsages = await MaterialUsage.find({ projectId });
    const previouslyUsed = priorUsages.reduce((sum, u) => {
      const name = String(decryptDB(u.materialName) || '').trim().toLowerCase();
      if (name !== decryptedName.trim().toLowerCase()) return sum;
      return sum + (Number(decryptDB(u.actualQty)) || 0);
    }, 0);
    const cumulativeActual = previouslyUsed + qty;
    const cumulativeVariance = cumulativeActual - plannedQty;

    // Audited inventory deduction
    await recordMovement({
      materialDoc: siteMaterial,
      type: 'Usage',
      quantityChange: -qty,
      reference: minNumber,
      performedBy: issuedBy,
      reason: actStr,
      notes: notes || ''
    });

    let usage;
    try {
      usage = await MaterialUsage.create({
        minNumber,
        projectId,
        project_id: projectId,
        materialId: siteMaterial._id,
        projectName,
        materialName: decryptedName,
        unit: siteMaterial.unit,
        plannedQty,
        actualQty: qty,
        variance: cumulativeVariance,
        activity: actStr,
        purpose: actStr,
        notes: notes || '',
        recordedBy: issuedBy,
        usageDate: date || new Date()
      });
    } catch (usageErr) {
      await recordMovement({
        materialDoc: siteMaterial,
        type: 'Adjustment',
        quantityChange: qty,
        reference: minNumber,
        performedBy: issuedBy,
        reason: 'Rollback: Material Issue & Usage record failed to save'
      });
      throw usageErr;
    }

    // Flag overuse the moment the project's cumulative consumption passes the
    // BOM plan (or the material was never planned at all), so wastage is
    // caught when it happens rather than only in a later report.
    const overuseQty = Math.max(cumulativeVariance, 0);
    const crossedPlan = overuseQty > 0 && previouslyUsed <= plannedQty;
    let warning = '';
    if (overuseQty > 0) {
      warning = inBom
        ? `${decryptedName} usage on ${projectName} is now ${cumulativeActual} ${siteMaterial.unit} against a BOM plan of ${plannedQty} ${siteMaterial.unit} (over by ${overuseQty} ${siteMaterial.unit}).`
        : `${decryptedName} is not in the approved BOM for ${projectName} - ${cumulativeActual} ${siteMaterial.unit} used with no planned quantity.`;
    }
    if (crossedPlan) {
      const msg = `Material overuse: ${warning}`;
      if (approvedBOM && approvedBOM.createdBy) {
        await createNotificationHelper(approvedBOM.createdBy, msg, 'USAGE_EXCEEDS_BOM', '/pm-dashboard');
      } else {
        await notifyRoles(['ProjectManager'], msg, 'USAGE_EXCEEDS_BOM', '/pm-dashboard');
      }
      await notifyRoles(['Director'], msg, 'USAGE_EXCEEDS_BOM', '/director-dashboard');
    }

    res.status(201).json({
      success: true,
      message: `Material issued and usage recorded successfully (${minNumber}).`,
      warning,
      summary: {
        plannedQty,
        previouslyUsed,
        cumulativeActual,
        variance: cumulativeVariance,
        remainingPlan: Math.max(plannedQty - cumulativeActual, 0),
        overuseQty,
        inBom
      },
      data: usage
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const logMaterialUsage = issueMaterialToProject;

// Note: issuing materials from Main Store to Site Store and confirming their
// receipt is handled separately by the Material Issuance Note flow (see
// controllers/materialIssuanceController.js, mounted at /api/min). That is a
// distinct business event (Site Store requesting/receiving replenishment
// stock from Main Store) from issueMaterialToProject above (Site Store
// issuing its own on-hand stock to a project's construction activity).
