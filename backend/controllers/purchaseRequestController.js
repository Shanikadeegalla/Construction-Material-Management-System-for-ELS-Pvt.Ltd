import PurchaseRequest from '../models/PurchaseRequest.js';
import BOM from '../models/BOM.js';
import Project from '../models/Project.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Supplier from '../models/Supplier.js';
import User from '../models/userModel.js';
import { createNotificationHelper } from './notificationController.js';

// @desc    Get all purchase requests
// @route   GET /api/purchase-requests
// @access  Private
export const getPurchaseRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) {
      query.status = status;
    }

    const prs = await PurchaseRequest.find(query).sort({ createdAt: -1 });

    // Format for frontend
    const formattedPrs = prs.map(pr => ({
      _id: pr._id,
      project: pr.project,
      projectName: pr.projectName || pr.project,
      requestedBy: pr.requestedBy,
      urgency: pr.urgency || 'Normal',
      status: pr.status,
      notes: pr.notes || '',
      createdAt: pr.createdAt,
      updatedAt: pr.updatedAt,
      materials: pr.materials || []
    }));

    res.status(200).json({ success: true, count: formattedPrs.length, data: formattedPrs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a new purchase request
// @route   POST /api/purchase-requests
// @access  Private
export const createPurchaseRequest = async (req, res) => {
  try {
    const { project, projectName, materials, notes, urgency, source, status } = req.body;
    if (source === 'Site') {
      return res.status(400).json({ success: false, message: 'Purchase requests originating from Site are not permitted.' });
    }
    const finalProjectName = projectName || project;
    const requestedBy = req.user ? req.user.name : (req.body.requestedBy || 'Store Officer');

    if (!finalProjectName || !materials || !Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({ success: false, message: 'Missing required PR fields.' });
    }

    // 1. Look up the project document
    const projectDoc = await Project.findOne({ 
      $or: [
        { projectName: finalProjectName },
        { name: finalProjectName }
      ]
    });
    if (!projectDoc) {
      return res.status(400).json({ success: false, message: `Project "${finalProjectName}" not found.` });
    }

    // 2. Find the approved BOM for this project
    const approvedBom = await BOM.findOne({ projectId: projectDoc._id, status: 'Approved' });
    if (!approvedBom) {
      return res.status(400).json({ success: false, message: 'No approved BOM is available for this project.' });
    }

    const mappedMaterials = [];
    for (const m of materials) {
      const matName = m.materialName || m.name || '';
      const qty = Number(m.quantity) || 0;
      const unit = m.unit || 'bag';

      // Find matching item in approved BOM
      const bomItem = approvedBom.materials.find(
        bi => bi.name.trim().toLowerCase() === matName.trim().toLowerCase()
      );

      if (!bomItem) {
        return res.status(400).json({ 
          success: false, 
          message: `Material "${matName}" is not included in the approved BOM for this project.` 
        });
      }

      if (qty > bomItem.plannedQty) {
        return res.status(400).json({ 
          success: false, 
          message: `Requested quantity for "${matName}" (${qty}) exceeds the approved BOM quantity (${bomItem.plannedQty}).` 
        });
      }

      mappedMaterials.push({
        materialName: bomItem.name, // normalize to exact spelling in BOM
        quantity: qty,
        unit: unit,
        reason: m.reason || '',
        estimatedUnitCost: bomItem.estimatedUnitCost || 0
      });
    }

    const pr = new PurchaseRequest({
      project: finalProjectName,
      projectName: finalProjectName,
      materials: mappedMaterials,
      requestedBy,
      notes: notes || '',
      urgency: urgency || 'Normal',
      status: 'Pending'
    });

    await pr.save();

    // Notify Purchase Managers so they can convert the PR into a PO
    try {
      const purchaseManagers = await User.find({ role: 'PurchaseManager' });
      const msg = `New Purchase Request from Main Store for ${finalProjectName} (${mappedMaterials.length} item${mappedMaterials.length === 1 ? '' : 's'}) awaiting PO conversion`;
      for (const pmUser of purchaseManagers) {
        await createNotificationHelper(pmUser._id, msg, 'PR_SUBMITTED', '/purchase-orders');
      }
    } catch (nErr) {
      console.error('Error creating PR submission notifications:', nErr);
    }

    res.status(201).json({ success: true, message: 'Purchase request submitted successfully!', data: pr });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update a purchase request's status (decline only)
// @route   PUT /api/purchase-requests/:id/status
// @access  Private
export const updatePurchaseRequestStatus = async (req, res) => {
  try {
    const { status, reason } = req.body;

    const pr = await PurchaseRequest.findById(req.params.id);
    if (!pr) {
      return res.status(404).json({ success: false, message: 'Purchase request not found.' });
    }

    if (status !== 'Declined') {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    if (pr.status === 'PO Created') {
      return res.status(400).json({ success: false, message: 'Cannot decline a Purchase Request that has already been converted to a PO.' });
    }

    pr.status = 'Declined';
    pr.declineReason = reason || '';
    await pr.save();

    try {
      const requester = await User.findOne({ name: new RegExp(`^${pr.requestedBy}$`, 'i') });
      if (requester) {
        const msg = `Your Purchase Request for ${pr.projectName} was declined by the Purchase Manager${reason ? ': ' + reason : '.'}`;
        await createNotificationHelper(requester._id, msg, 'PR_DECLINED', '/purchase-requests');
      }
    } catch (nErr) {
      console.error('Error creating PR decline notification:', nErr);
    }

    res.status(200).json({ success: true, message: 'Purchase request declined.', data: pr });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
