const express = require('express');
const router = express.Router();
const PORequest = require('../models/PORequest');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// @route   POST /api/po-requests
// @access  Site Store only
router.post('/', protect, authorizeRoles('sitestore'), async (req, res) => {
  try {
    const { project, items, notes } = req.body;

    const poRequest = await PORequest.create({
      project,
      requestedBy: req.user._id,
      items,
      notes
    });

    res.status(201).json(poRequest);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/po-requests
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const poRequests = await PORequest.find()
      .populate('project', 'name')
      .populate('requestedBy', 'username')
      .populate('approvedBy', 'username')
      .populate('items.material', 'name unit');
    res.json(poRequests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/po-requests/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const poRequest = await PORequest.findById(req.params.id)
      .populate('project', 'name')
      .populate('requestedBy', 'username')
      .populate('items.material', 'name unit');
    if (!poRequest) {
      return res.status(404).json({ message: 'PO Request not found' });
    }
    res.json(poRequest);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/po-requests/:id/approve
// @access  PM only
router.put('/:id/approve', protect, authorizeRoles('pm'), async (req, res) => {
  try {
    const poRequest = await PORequest.findByIdAndUpdate(
      req.params.id,
      {
        status: 'approved',
        approvedBy: req.user._id
      },
      { new: true }
    );
    if (!poRequest) {
      return res.status(404).json({ message: 'PO Request not found' });
    }
    res.json(poRequest);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/po-requests/:id/reject
// @access  PM only
router.put('/:id/reject', protect, authorizeRoles('pm'), async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    const poRequest = await PORequest.findByIdAndUpdate(
      req.params.id,
      {
        status: 'rejected',
        rejectionReason
      },
      { new: true }
    );
    if (!poRequest) {
      return res.status(404).json({ message: 'PO Request not found' });
    }
    res.json(poRequest);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;