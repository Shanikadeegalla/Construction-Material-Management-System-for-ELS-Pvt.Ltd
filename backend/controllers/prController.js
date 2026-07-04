import PurchaseRequest from '../models/PurchaseRequest.js';

// Get all purchase requests
export const getPRs = async (req, res) => {
  try {
    const prs = await PurchaseRequest.find()
      .populate('materials.material')
      .sort({ createdAt: -1 });
    res.json(prs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new purchase request
export const createPR = async (req, res) => {
  try {
    const { project, materials, requestedBy, notes } = req.body;
    if (!project || !materials || !Array.isArray(materials) || materials.length === 0 || !requestedBy) {
      return res.status(400).json({ message: 'Missing required PR fields.' });
    }

    const pr = new PurchaseRequest({
      project,
      materials,
      requestedBy,
      notes
    });

    await pr.save();
    res.status(201).json({ message: 'Purchase request submitted successfully!', pr });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Approve or reject PR (for ProjectManager role)
export const updatePRStatus = async (req, res) => {
  const { status, approvedBy } = req.body;
  if (!status || !['Approved', 'Rejected'].includes(status) || !approvedBy) {
    return res.status(400).json({ message: 'Invalid status update parameters.' });
  }

  try {
    const pr = await PurchaseRequest.findByIdAndUpdate(
      req.params.id,
      { status, approvedBy },
      { new: true }
    ).populate('materials.material');

    if (!pr) {
      return res.status(404).json({ message: 'Purchase request not found.' });
    }

    res.json({ message: `Purchase request status updated to ${status}!`, pr });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
