import MaterialRequest from '../models/MaterialRequest.js';
import Material from '../models/Material.js';
import ItemMaster from '../models/ItemMaster.js';
import Project from '../models/Project.js';
import User from '../models/userModel.js';
import { decryptDB } from '../utils/cryptoUtils.js';
import { createNotificationHelper } from './notificationController.js';

const notifyMainStoreOfNewRequest = async (request) => {
  try {
    const mainStoreOfficers = await User.find({ role: 'MainStoreOfficer' });
    const msg = `New material request ${request.requestNo} from ${request.siteStoreName} awaiting review (${request.materials.length} item${request.materials.length === 1 ? '' : 's'})`;
    for (const officer of mainStoreOfficers) {
      await createNotificationHelper(officer._id, msg, 'SSR_SUBMITTED', '/main-store-dashboard');
    }
  } catch (nErr) {
    console.error('Error creating new Site Store request notification:', nErr);
  }
};

// @desc    Site Store submits a material request to Main Store
// @route   POST /api/material-requests
// @access  Private (SiteStoreOfficer)
export const createMaterialRequest = async (req, res) => {
  try {
    if (!['SiteStoreOfficer', 'Admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only Site Store Officers can request materials.' });
    }

    const { requiredDate, materials, notes, siteStoreId } = req.body;

    if (!requiredDate || !materials || !Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide a required date and at least one material.' });
    }

    if (!siteStoreId) {
      return res.status(400).json({ success: false, message: 'Please select which Site Store this request is for.' });
    }
    const project = await Project.findById(siteStoreId);
    if (!project) {
      return res.status(400).json({ success: false, message: 'Selected Site Store was not found.' });
    }
    // A Site Store Officer is not tied to a single project - they choose which
    // site they're acting for on each screen (mirroring how Main Store already
    // picks a destination project for an ad hoc transfer), so the site is
    // taken from the request body rather than the user's account.
    const siteStore = {
      siteStoreId: project._id,
      siteStoreName: `${project.projectName} Site Store`
    };

    // Reject duplicate material rows in the same request.
    const seenNames = new Set();
    for (const m of materials) {
      if (!m.materialName) {
        return res.status(400).json({ success: false, message: 'Every row must have a material selected.' });
      }
      const key = m.materialName.trim().toLowerCase();
      if (seenNames.has(key)) {
        return res.status(400).json({ success: false, message: `Duplicate material in request: ${m.materialName}.` });
      }
      seenNames.add(key);

      const qty = Number(m.quantity);
      if (!qty || qty <= 0) {
        return res.status(400).json({ success: false, message: `Invalid request quantity for ${m.materialName}.` });
      }
    }

    // Every material must exist in the material master catalog.
    const master = await ItemMaster.find({
      materialName: { $in: materials.map(m => m.materialName) }
    });
    const masterByName = new Map(master.map(mm => [mm.materialName, mm]));
    for (const m of materials) {
      if (!masterByName.has(m.materialName)) {
        return res.status(400).json({ success: false, message: `"${m.materialName}" is not a recognized material. Please select it from the list.` });
      }
    }

    const siteMaterials = await Material.find({
      location: 'SiteStore',
      $or: [{ project_id: siteStore.siteStoreId }, { projectId: siteStore.siteStoreId }]
    });
    const decryptedSiteMats = siteMaterials.map(m => ({
      name: decryptDB(m.name),
      quantity: Number(decryptDB(m.quantity)) || 0
    }));

    const preparedMaterials = materials.map(m => {
      const mm = masterByName.get(m.materialName);
      const siteMat = decryptedSiteMats.find(sm => sm.name === m.materialName);
      return {
        materialName: m.materialName,
        category: mm.category || 'Other',
        unit: mm.unit,
        quantity: Number(m.quantity),
        availableAtSite: siteMat ? siteMat.quantity : 0
      };
    });

    const count = await MaterialRequest.countDocuments({});
    const requestNo = `SSR-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    const request = new MaterialRequest({
      requestNo,
      siteStoreId: siteStore.siteStoreId,
      siteStoreName: siteStore.siteStoreName,
      requestedBy: req.user.name,
      requestedByUserId: req.user._id,
      materials: preparedMaterials,
      requiredDate,
      notes: notes || '',
      status: 'Pending'
    });

    await request.save();
    await notifyMainStoreOfNewRequest(request);

    res.status(201).json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Site Store views its own request history
// @route   GET /api/material-requests/my-requests
// @access  Private (SiteStoreOfficer)
export const getMyRequests = async (req, res) => {
  try {
    // A Site Store Officer can submit requests for any project's site, so
    // "my requests" means everything this user personally submitted, not
    // everything tied to one fixed project.
    const requests = await MaterialRequest.find({ requestedByUserId: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Main Store views requests awaiting review (all, or filtered by status)
// @route   GET /api/material-requests
// @access  Private (MainStoreOfficer)
export const getMaterialRequests = async (req, res) => {
  try {
    if (!['MainStoreOfficer', 'Admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const requests = await MaterialRequest.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get a single request's details
// @route   GET /api/material-requests/:id
// @access  Private
export const getMaterialRequestById = async (req, res) => {
  try {
    const request = await MaterialRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Material request not found.' });
    }
    res.status(200).json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Main Store rejects a pending request
// @route   PUT /api/material-requests/:id/reject
// @access  Private (MainStoreOfficer)
export const rejectMaterialRequest = async (req, res) => {
  try {
    if (!['MainStoreOfficer', 'Admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    const request = await MaterialRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Material request not found.' });
    }
    if (request.status !== 'Pending') {
      return res.status(400).json({ success: false, message: 'Only Pending requests can be rejected.' });
    }
    request.status = 'Rejected';
    request.rejectionReason = req.body.reason || 'Rejected by Main Store';
    await request.save();

    if (request.requestedByUserId) {
      await createNotificationHelper(
        request.requestedByUserId,
        `Your material request ${request.requestNo} was rejected: ${request.rejectionReason}`,
        'SSR_REJECTED',
        '/site-store-dashboard'
      );
    }

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Site Store cancels its own pending request
// @route   PUT /api/material-requests/:id/cancel
// @access  Private (SiteStoreOfficer)
export const cancelMaterialRequest = async (req, res) => {
  try {
    const request = await MaterialRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Material request not found.' });
    }
    // Ownership is by requester, not by project - a Site Store Officer isn't
    // tied to one project, so "your request" means one you personally submitted.
    if (req.user.role !== 'Admin' && String(request.requestedByUserId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You can only cancel your own material requests.' });
    }
    if (request.status !== 'Pending') {
      return res.status(400).json({ success: false, message: 'Only Pending requests can be cancelled.' });
    }
    request.status = 'Cancelled';
    await request.save();
    res.status(200).json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
