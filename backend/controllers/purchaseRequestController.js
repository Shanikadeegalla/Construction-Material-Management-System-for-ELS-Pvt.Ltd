import PurchaseRequest from '../models/PurchaseRequest.js';
import BOM from '../models/BOM.js';
import Project from '../models/Project.js';

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
      approvedBy: pr.approvedBy || '',
      rejectionReason: pr.rejectionReason || '',
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
    const { project, projectName, materials, notes, urgency } = req.body;
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
        reason: m.reason || ''
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

    res.status(201).json({ success: true, message: 'Purchase request submitted successfully!', data: pr });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Approve a purchase request
// @route   PUT /api/purchase-requests/:id/approve
// @access  Private
export const approvePurchaseRequest = async (req, res) => {
  try {
    const approvedBy = req.user ? req.user.name : 'Project Manager';
    
    const pr = await PurchaseRequest.findByIdAndUpdate(
      req.params.id,
      { status: 'Approved', approvedBy },
      { new: true }
    );

    if (!pr) {
      return res.status(404).json({ success: false, message: 'Purchase request not found.' });
    }

    res.status(200).json({ success: true, message: 'Purchase request approved successfully!', data: pr });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Reject a purchase request
// @route   PUT /api/purchase-requests/:id/reject
// @access  Private
export const rejectPurchaseRequest = async (req, res) => {
  try {
    const approvedBy = req.user ? req.user.name : 'Project Manager';
    const { rejectionReason } = req.body;

    const pr = await PurchaseRequest.findByIdAndUpdate(
      req.params.id,
      { status: 'Rejected', approvedBy, rejectionReason: rejectionReason || 'No reason provided' },
      { new: true }
    );

    if (!pr) {
      return res.status(404).json({ success: false, message: 'Purchase request not found.' });
    }

    res.status(200).json({ success: true, message: 'Purchase request rejected successfully!', data: pr });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
