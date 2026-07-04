const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// @route   POST /api/inventory
// @access  Store, Admin
router.post('/', protect, authorizeRoles('admin', 'store'), async (req, res) => {
  try {
    const { material, project, location, currentQty, minThreshold, maxThreshold } = req.body;

    const inventory = await Inventory.create({
      material,
      project,
      location,
      currentQty,
      minThreshold,
      maxThreshold
    });

    res.status(201).json(inventory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/inventory
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const inventory = await Inventory.find()
      .populate('material', 'name category unit')
      .populate('project', 'name');
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/inventory/alerts
// @access  Private
router.get('/alerts', protect, async (req, res) => {
  try {
    const alerts = await Inventory.find({
      $expr: { $lte: ['$currentQty', '$minThreshold'] }
    })
      .populate('material', 'name category unit')
      .populate('project', 'name');
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/inventory/:id
// @access  Store, Admin
router.put('/:id', protect, authorizeRoles('admin', 'store'), async (req, res) => {
  try {
    const inventory = await Inventory.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!inventory) {
      return res.status(404).json({ message: 'Inventory not found' });
    }
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;