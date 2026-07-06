import express from 'express';
import Material from '../models/Material.js';
import { protect } from '../middleware/authMiddleware.js';
import { decryptDB } from '../utils/cryptoUtils.js';

const router = express.Router();

// @desc    Get main store quantity for a specific material by its site store ID
// @route   GET /api/materials/main-store/:materialId
// @access  Private
router.get('/main-store/:materialId', protect, async (req, res, next) => {
  try {
    const siteMaterial = await Material.findById(req.params.materialId);
    if (!siteMaterial) {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }

    let decryptedName = siteMaterial.name;
    if (siteMaterial.location === 'SiteStore') {
      decryptedName = decryptDB(siteMaterial.name);
    }

    const mainMaterial = await Material.findOne({
      name: decryptedName,
      location: 'MainStore'
    });

    res.status(200).json({
      success: true,
      data: {
        name: decryptedName,
        quantity: mainMaterial ? mainMaterial.quantity : 0,
        updatedAt: mainMaterial ? mainMaterial.updatedAt : new Date()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
