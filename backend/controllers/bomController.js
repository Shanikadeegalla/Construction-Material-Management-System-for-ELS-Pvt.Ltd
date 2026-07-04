import BOM from '../models/BOM.js';

// @desc    Get all BOMs
// @route   GET /api/bom
// @access  Private
export const getBOMs = async (req, res) => {
  try {
    const boms = await BOM.find({}).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: boms.length, data: boms });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a new BOM
// @route   POST /api/bom
// @access  Private
export const createBOM = async (req, res) => {
  try {
    const { projectName, version, materials } = req.body;
    const createdBy = req.user ? req.user.name : 'Project Manager';

    if (!projectName || !version || !materials || !Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({ success: false, message: 'Missing required BOM fields.' });
    }

    const mappedMaterials = materials.map(m => ({
      name: m.name || m.materialName || 'Unnamed Material',
      unit: m.unit || 'bag',
      plannedQty: Number(m.plannedQty) || Number(m.quantity) || 0,
      category: m.category || 'Other'
    }));

    const bom = new BOM({
      projectName,
      version,
      createdBy,
      materials: mappedMaterials,
      status: 'Pending'
    });

    await bom.save();

    res.status(201).json({ success: true, message: 'BOM submitted to Director successfully!', data: bom });
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

    const bom = await BOM.findByIdAndUpdate(
      req.params.id,
      { status: 'Approved', approvedBy },
      { new: true }
    );

    if (!bom) {
      return res.status(404).json({ success: false, message: 'BOM not found.' });
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

    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
    }

    const bom = await BOM.findByIdAndUpdate(
      req.params.id,
      { status: 'Rejected', approvedBy, rejectionReason },
      { new: true }
    );

    if (!bom) {
      return res.status(404).json({ success: false, message: 'BOM not found.' });
    }

    res.status(200).json({ success: true, message: 'BOM rejected successfully!', data: bom });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
