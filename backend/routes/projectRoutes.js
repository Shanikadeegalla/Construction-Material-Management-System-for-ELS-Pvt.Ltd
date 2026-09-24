import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Project from '../models/Project.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

// Ensure upload folders exist
const drawingsDir = './uploads/drawings';
const specificationsDir = './uploads/specifications';
[drawingsDir, specificationsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Multer Config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, file.fieldname === 'specifications' ? specificationsDir : drawingsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|pdf|doc|docx|xls|xlsx/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images (jpg/jpeg/png), PDFs, and Word/Excel documents are allowed!'));
    }
  }
});

// Accepts multiple construction drawings and multiple specification/other documents
const uploadProjectFiles = upload.fields([
  { name: 'drawings', maxCount: 20 },
  { name: 'specifications', maxCount: 20 }
]);

// Computes the next available PRJ-YYYY-XXX code for a given start-date year
// without reserving it (used both as a form preview and at actual creation time).
async function computeNextProjectId(startDate) {
  const dateObj = new Date(startDate);
  const year = isNaN(dateObj.getTime()) ? new Date().getFullYear() : dateObj.getFullYear();

  const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
  const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`);

  const count = await Project.countDocuments({
    startDate: { $gte: startOfYear, $lte: endOfYear }
  });

  let projectId = '';
  let suffixNum = count + 1;
  let exists = true;
  while (exists) {
    const suffix = String(suffixNum).padStart(3, '0');
    projectId = `PRJ-${year}-${suffix}`;
    const existingProject = await Project.findOne({ projectId });
    if (!existingProject) {
      exists = false;
    } else {
      suffixNum++;
    }
  }

  return { projectId, year };
}

// @desc    Preview the project ID that will be auto-generated on creation
// @route   GET /api/projects/next-id
// @access  Private (Project Manager)
router.get('/next-id', protect, checkPermission('Create Project'), async (req, res) => {
  try {
    const { startDate } = req.query;
    const { projectId } = await computeNextProjectId(startDate || Date.now());
    res.status(200).json({ success: true, projectId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Create a new project
// @route   POST /api/projects
// @access  Private (Project Manager)
router.post('/', protect, checkPermission('Create Project'), uploadProjectFiles, async (req, res) => {
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

    if (new Date(expectedEndDate) < new Date(startDate)) {
      return res.status(400).json({ success: false, message: 'Expected End Date cannot be earlier than Start Date.' });
    }

    if (Number(budget) <= 0 || isNaN(Number(budget))) {
      return res.status(400).json({ success: false, message: 'Budget must be a positive number greater than zero.' });
    }

    // Auto-generate project code (PRJ-YYYY-XXX)
    const dateObj = new Date(startDate);
    const { projectId } = await computeNextProjectId(startDate);

    // Build uploaded document lists
    const drawings = (req.files?.drawings || []).map((f) => ({
      fileName: f.originalname,
      filePath: `/uploads/drawings/${f.filename}`
    }));
    const specifications = (req.files?.specifications || []).map((f) => ({
      fileName: f.originalname,
      filePath: `/uploads/specifications/${f.filename}`
    }));

    const project = new Project({
      projectId,
      projectName,
      clientName,
      location,
      startDate: dateObj,
      expectedEndDate: new Date(expectedEndDate),
      budget: Number(budget),
      description,
      drawings,
      specifications,
      status: status || 'Planning',
      createdBy: req.user._id
    });

    await project.save();
    await project.populate('createdBy', 'name email');

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
router.get('/', protect, checkPermission('View Projects'), async (req, res) => {
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
router.put('/:id', protect, uploadProjectFiles, async (req, res) => {
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

    const effectiveStartDate = startDate ? new Date(startDate) : project.startDate;
    const effectiveEndDate = expectedEndDate ? new Date(expectedEndDate) : project.expectedEndDate;

    if (effectiveStartDate && effectiveEndDate && new Date(effectiveEndDate) < new Date(effectiveStartDate)) {
      return res.status(400).json({ success: false, message: 'Expected End Date cannot be earlier than Start Date.' });
    }

    if (budget !== undefined && (Number(budget) <= 0 || isNaN(Number(budget)))) {
      return res.status(400).json({ success: false, message: 'Budget must be a positive number greater than zero.' });
    }

    if (projectName) project.projectName = projectName;
    if (clientName) project.clientName = clientName;
    if (location) project.location = location;
    if (startDate) project.startDate = new Date(startDate);
    if (expectedEndDate) project.expectedEndDate = new Date(expectedEndDate);
    if (budget) project.budget = Number(budget);
    if (description !== undefined) project.description = description;
    if (status) project.status = status;

    if (req.files?.drawings?.length) {
      const newDrawings = req.files.drawings.map((f) => ({
        fileName: f.originalname,
        filePath: `/uploads/drawings/${f.filename}`
      }));
      project.drawings = [...(project.drawings || []), ...newDrawings];
    }
    if (req.files?.specifications?.length) {
      const newSpecifications = req.files.specifications.map((f) => ({
        fileName: f.originalname,
        filePath: `/uploads/specifications/${f.filename}`
      }));
      project.specifications = [...(project.specifications || []), ...newSpecifications];
    }

    await project.save();
    await project.populate('createdBy', 'name email');

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
