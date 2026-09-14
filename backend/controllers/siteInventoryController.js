import Material from '../models/Material.js';
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
    const userProjectId = req.query.projectId || (req.user ? (req.user.project_id || req.user.projectId) : null);
    
    const filter = { location: 'SiteStore' };
    if (userProjectId) {
      filter.$or = [{ project_id: userProjectId }, { projectId: userProjectId }];
    }

    // Find materials in SiteStore location
    const materials = await Material.find(filter);

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

export const logMaterialUsage = async (req, res) => {
  try {
    const { materialId, quantity_used, date, purpose } = req.body;

    if (!materialId || !quantity_used || Number(quantity_used) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid material and quantity are required.' });
    }

    const siteMaterial = await Material.findById(materialId);
    if (!siteMaterial) {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }

    const userProjectId = (req.user ? (req.user.project_id || req.user.projectId) : null) || siteMaterial.project_id || siteMaterial.projectId;

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
    const projectDoc = userProjectId ? await Project.findById(userProjectId) : null;
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

// Note: issuing materials from Main Store to Site Store and confirming their
// receipt is now handled end-to-end by the Material Issuance Note flow
// (see controllers/materialIssuanceController.js, mounted at /api/min),
// which ties every issuance back to an approved BOM instead of being raised
// ad hoc.
