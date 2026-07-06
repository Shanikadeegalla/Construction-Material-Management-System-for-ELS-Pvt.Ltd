import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Project from '../models/Project.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Ensure uploads/drawings folder exists
const uploadDir = './uploads/drawings';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|pdf/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images (jpg/jpeg/png) and PDFs are allowed!'));
    }
  }
});

// @desc    Create a new project
// @route   POST /api/projects
// @access  Private (Project Manager)
router.post('/', protect, upload.single('drawingFile'), async (req, res) => {
  try {
    const {
      projectName,
      clientName,
      location,
      startDate,
      expectedEndDate,
      budget,
      description,
      status
    } = req.body;

    if (!projectName || !clientName || !location || !startDate || !expectedEndDate || !budget) {
      return res.status(400).json({ success: false, message: 'All required fields must be provided.' });
    }

    // Auto-generate project code (PRJ-YYYY-XXX)
    const dateObj = new Date(startDate);
    const year = isNaN(dateObj.getTime()) ? new Date().getFullYear() : dateObj.getFullYear();

    const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`);

    const count = await Project.countDocuments({
      startDate: { $gte: startOfYear, $lte: endOfYear }
    });

    const suffix = String(count + 1).padStart(3, '0');
    const projectId = `PRJ-${year}-${suffix}`;

    // Get file path if file uploaded
    let drawingFilePath = '';
    if (req.file) {
      drawingFilePath = `/uploads/drawings/${req.file.filename}`;
    }

    const project = new Project({
      projectId,
      projectName,
      clientName,
      location,
      startDate: dateObj,
      expectedEndDate: new Date(expectedEndDate),
      budget: Number(budget),
      description,
      drawingFile: drawingFilePath,
      status: status || 'Planning',
      createdBy: req.user._id
    });

    await project.save();

    res.status(201).json({
      success: true,
      message: `Project created successfully with ID: ${projectId}`,
      data: project
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    List all projects (filtered by creator if role is PM)
// @route   GET /api/projects
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const query = req.user.role === 'ProjectManager' ? { createdBy: req.user._id } : {};
    const projects = await Project.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: projects.length, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Update a project
// @route   PUT /api/projects/:id
// @access  Private (Project Manager)
router.put('/:id', protect, upload.single('drawingFile'), async (req, res) => {
  try {
    const {
      projectName,
      clientName,
      location,
      startDate,
      expectedEndDate,
      budget,
      description,
      status
    } = req.body;

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    // Auth check
    if (project.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this project.' });
    }

    if (projectName) project.projectName = projectName;
    if (clientName) project.clientName = clientName;
    if (location) project.location = location;
    if (startDate) project.startDate = new Date(startDate);
    if (expectedEndDate) project.expectedEndDate = new Date(expectedEndDate);
    if (budget) project.budget = Number(budget);
    if (description !== undefined) project.description = description;
    if (status) project.status = status;

    if (req.file) {
      project.drawingFile = `/uploads/drawings/${req.file.filename}`;
    }

    await project.save();

    res.status(200).json({
      success: true,
      message: `Project updated successfully`,
      data: project
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
