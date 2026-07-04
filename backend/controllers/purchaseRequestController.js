import PurchaseRequest from '../models/PurchaseRequest.js';

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
    const { project, projectName, materials, notes } = req.body;
    const finalProjectName = projectName || project;
    const requestedBy = req.user ? req.user.name : (req.body.requestedBy || 'Store Officer');

    if (!finalProjectName || !materials || !Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({ success: false, message: 'Missing required PR fields.' });
    }

    const mappedMaterials = materials.map(m => ({
      materialName: m.materialName || m.name || 'Unnamed Material',
      quantity: Number(m.quantity) || 0,
      unit: m.unit || 'bag',
      reason: m.reason || ''
    }));

    const pr = new PurchaseRequest({
      project: finalProjectName,
      projectName: finalProjectName,
      materials: mappedMaterials,
      requestedBy,
      notes: notes || '',
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
