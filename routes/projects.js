const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// @route   POST /api/projects
// @access  PM only
router.post('/', protect, authorizeRoles('pm'), async (req, res) => {
  try {
    const { name, description, startDate, endDate } = req.body;

    const project = await Project.create({
      name,
      description,
      startDate,
      endDate,
      createdBy: req.user._id
    });

    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/projects
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const projects = await Project.find().populate('createdBy', 'username email');
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/projects/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).populate('createdBy', 'username email');
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/projects/:id
// @access  PM only
router.put('/:id', protect, authorizeRoles('pm'), async (req, res) => {
  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/projects/:id
// @access  PM only
router.delete('/:id', protect, authorizeRoles('pm', 'admin'), async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;