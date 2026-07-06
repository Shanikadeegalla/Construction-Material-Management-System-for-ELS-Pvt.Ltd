import express from 'express';
import {
  getSiteInventory,
  getProjectsOverview,
  logMaterialUsage,
  issueToSite,
  confirmTransferReceipt
} from '../controllers/siteInventoryController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/site/inventory', protect, getSiteInventory);
router.get('/admin/projects-overview', protect, authorizeRoles('Admin', 'Director'), getProjectsOverview);
router.post('/site/material-usage', protect, authorizeRoles('SiteStoreOfficer', 'Admin'), logMaterialUsage);
router.post('/main-store/issue-to-site', protect, authorizeRoles('MainStoreOfficer', 'Admin'), issueToSite);
router.post('/site/confirm-transfer/:transferLogId', protect, authorizeRoles('SiteStoreOfficer', 'Admin'), confirmTransferReceipt);

export default router;
