import MaterialCategory from '../models/MaterialCategory.js';
import ItemMaster from '../models/ItemMaster.js';
import Material from '../models/Material.js';
import Supplier from '../models/Supplier.js';
import { MATERIAL_CATEGORIES, getAllCategories } from '../utils/materialCategories.js';

// @desc    Get every material category (built-in defaults + Admin-added)
// @route   GET /api/material-categories
// @access  Private
export const getMaterialCategories = async (req, res) => {
  try {
    const data = await getAllCategories();
    const custom = data.filter(c => !MATERIAL_CATEGORIES.includes(c));
    res.status(200).json({ success: true, data, custom });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add a new material category
// @route   POST /api/material-categories
// @access  Private (Manage Item Master)
export const createMaterialCategory = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim().replace(/\s+/g, ' ');
    if (!name) {
      return res.status(400).json({ success: false, message: 'Please enter a category name.' });
    }
    if (name.length > 40) {
      return res.status(400).json({ success: false, message: 'Category name must be 40 characters or fewer.' });
    }

    const existing = (await getAllCategories()).find(c => c.toLowerCase() === name.toLowerCase());
    if (existing) {
      return res.status(400).json({ success: false, message: `Category "${existing}" already exists.` });
    }

    await MaterialCategory.create({ name, createdBy: req.user ? req.user.name : '' });
    res.status(201).json({ success: true, name, data: await getAllCategories() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Remove an Admin-added category that nothing uses
// @route   DELETE /api/material-categories/:name
// @access  Private (Manage Item Master)
export const deleteMaterialCategory = async (req, res) => {
  try {
    const { name } = req.params;
    if (MATERIAL_CATEGORIES.includes(name)) {
      return res.status(400).json({ success: false, message: 'Built-in categories cannot be removed.' });
    }
    const category = await MaterialCategory.findOne({ name });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }

    // A category still in use can't be removed, so no record is left pointing at a missing category
    const [items, stockRows, suppliers] = await Promise.all([
      ItemMaster.countDocuments({ category: name }),
      Material.countDocuments({ category: name }),
      Supplier.countDocuments({ categories: name })
    ]);
    if (items || stockRows || suppliers) {
      return res.status(400).json({
        success: false,
        message: `"${name}" is still used by ${items} material(s), ${stockRows} stock row(s) and ${suppliers} supplier(s). Move them to another category first.`
      });
    }

    await category.deleteOne();
    res.status(200).json({ success: true, data: await getAllCategories() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
