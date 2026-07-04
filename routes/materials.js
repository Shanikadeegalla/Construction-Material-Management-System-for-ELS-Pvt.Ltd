const express = require('express');
const router = express.Router();
const Material = require('../models/Material');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// @route   POST /api/materials
// @access  Admin, Store
router.post('/', protect, authorizeRoles('admin', 'store'), async (req, res) => {
  try {
    const { name, category, unit, unitPrice, description } = req.body;

    const material = await Material.create({
      name,
      category,
      unit,
      unitPrice,
      description
    });

    res.status(201).json(material);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/materials
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const materials = await Material.find();
    res.json(materials);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/materials/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) {
      return res.status(404).json({ message: 'Material not found' });
    }
    res.json(material);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/materials/:id
// @access  Admin, Store
router.put('/:id', protect, authorizeRoles('admin', 'store'), async (req, res) => {
  try {
    const material = await Material.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!material) {
      return res.status(404).json({ message: 'Material not found' });
    }
    res.json(material);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/materials/:id
// @access  Admin only
router.delete('/:id', protect, authorizeRoles('admin'), async (req, res) => {
  try {
    const material = await Material.findByIdAndDelete(req.params.id);
    if (!material) {
      return res.status(404).json({ message: 'Material not found' });
    }
    res.json({ message: 'Material deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;