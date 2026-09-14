import express from 'express';
import {
  getSiteInventory,
  getProjectsOverview,
  issueMaterialToProject
} from '../controllers/siteInventoryController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.get('/site/inventory', protect, getSiteInventory);
router.get('/admin/projects-overview', protect, checkPermission('View Reports'), getProjectsOverview);
router.post('/site/material-usage', protect, checkPermission('Log Material Usage'), issueMaterialToProject);

export default router;
