import mongoose from 'mongoose';
import BOM from '../models/BOM.js';
import Project from '../models/Project.js';
import User from '../models/userModel.js';
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

    const mappedMaterials = materials.map(m => {
      const qty = Number(m.plannedQty) || Number(m.quantity) || 0;
      const cost = Number(m.estimatedUnitCost) || 0;
      return {
        name: m.name || m.materialName || 'Unnamed Material',
        unit: m.unit || 'bag',
        plannedQty: qty,
        category: m.category || 'Other',
        estimatedUnitCost: cost,
        totalCost: qty * cost,
        supplierRef: m.supplierRef || '',
        remarks: m.remarks || ''
      };
    });

    const isSubmitted = status === 'Submitted';

    // Find if a draft BOM exists for this project by this user
    let draftBom = await BOM.findOne({ projectId, status: 'Draft', createdBy: creatorId });

    if (draftBom) {
      // PM is editing/updating an existing draft BOM
      draftBom.materials = mappedMaterials;
      draftBom.projectName = projectName;
      
      if (isSubmitted) {
        // Submit the draft: change status and calculate proper version
        draftBom.status = 'Submitted';
        draftBom.version = await getNextVersion(projectId);
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
          for (const d of directors) {
            await createNotificationHelper(d._id, msg, 'BOM_SUBMITTED', '/director-dashboard');
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

      const bom = new BOM({
        projectId,
        projectName,
        version: finalVersion,
        createdBy: creatorId,
        materials: mappedMaterials,
        status: status || 'Draft'
      });

      await bom.save();

      if (isSubmitted) {
        try {
          const pmName = req.user ? req.user.name : 'Project Manager';
          const directors = await User.find({ role: 'Director' });
          const msg = `New BOM ${bom.version} submitted for ${projectName} by ${pmName} - awaiting approval`;
          for (const d of directors) {
            await createNotificationHelper(d._id, msg, 'BOM_SUBMITTED', '/director-dashboard');
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

    const bom = await BOM.findByIdAndUpdate(
      req.params.id,
      { status: 'Approved', approvedBy, rejectionReason: note || '' },
      { new: true }
    ).populate('projectId');

    if (!bom) {
      return res.status(404).json({ success: false, message: 'BOM not found.' });
    }

    const projectName = bom.projectName || (bom.projectId ? (bom.projectId.projectName || bom.projectId.name) : 'Project');
    const msg = `BOM ${bom.version} for ${projectName} Approved by Director${note ? `: ${note}` : ''}`;
    await createNotificationHelper(bom.createdBy, msg, 'BOM_approved', '/bom');

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
    ).populate('projectId');

    if (!bom) {
      return res.status(404).json({ success: false, message: 'BOM not found.' });
    }

    const projectName = bom.projectName || (bom.projectId ? (bom.projectId.projectName || bom.projectId.name) : 'Project');
    const msg = `BOM ${bom.version} for ${projectName} Rejected: ${rejectionReason}`;
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
    const bom = await BOM.findOne({ projectId, status: 'Approved' })
      .populate('projectId', 'projectName projectId name clientName location');

    if (!bom) {
      return res.status(404).json({ success: false, message: 'No approved BOM found for this project.' });
    }

    res.status(200).json({ success: true, data: bom });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
