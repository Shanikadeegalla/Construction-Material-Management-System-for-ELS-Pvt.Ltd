import ItemMaster from '../models/ItemMaster.js';
import Material from '../models/Material.js';

// @desc    Get all master materials (optionally filtered by status)
// @route   GET /api/item-master
// @access  Private
export const getItemMasters = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    const items = await ItemMaster.find(filter).sort({ materialName: 1 });
    res.status(200).json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a new master material
// @route   POST /api/item-master
// @access  Private
export const createItemMaster = async (req, res) => {
  try {
    const {
      materialCode, materialName, category, unit, estimatedUnitCost,
      description, minimumStock, maximumStock, reorderLevel, status
    } = req.body;

    if (!materialCode || !materialName || !category || !unit) {
      return res.status(400).json({ success: false, message: 'Please provide material code, name, category, and unit.' });
    }

    const calculatedReorder = reorderLevel !== undefined ? Number(reorderLevel) : Math.round(Number(maximumStock || 100) * 0.5);

    const item = new ItemMaster({
      materialCode,
      materialName,
      category,
      unit,
      estimatedUnitCost: Number(estimatedUnitCost || 0),
      description: description || '',
      minimumStock: Number(minimumStock || 10),
      maximumStock: Number(maximumStock || 100),
      reorderLevel: calculatedReorder,
      status: status === 'Inactive' ? 'Inactive' : 'Active'
    });

    await item.save();

    // Propagate stock thresholds to existing Material records of the same name
    await Material.updateMany(
      { name: materialName },
      {
        materialCode,
        minimumStock: Number(minimumStock || 10),
        maximumStock: Number(maximumStock || 100),
        reorderLevel: calculatedReorder
      }
    );

    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a master material (including activate/deactivate via status)
// @route   PUT /api/item-master/:id
// @access  Private
export const updateItemMaster = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      materialCode, materialName, category, unit, estimatedUnitCost,
      description, minimumStock, maximumStock, reorderLevel, status
    } = req.body;

    const item = await ItemMaster.findById(id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Material master record not found.' });
    }

    const calculatedReorder = reorderLevel !== undefined ? Number(reorderLevel) : Math.round(Number(maximumStock || item.maximumStock) * 0.5);

    item.materialCode = materialCode || item.materialCode;
    item.materialName = materialName || item.materialName;
    item.category = category || item.category;
    item.unit = unit || item.unit;
    item.estimatedUnitCost = estimatedUnitCost !== undefined ? Number(estimatedUnitCost) : item.estimatedUnitCost;
    item.description = description !== undefined ? description : item.description;
    item.minimumStock = minimumStock !== undefined ? Number(minimumStock) : item.minimumStock;
    item.maximumStock = maximumStock !== undefined ? Number(maximumStock) : item.maximumStock;
    item.reorderLevel = calculatedReorder;
    item.status = status === 'Active' || status === 'Inactive' ? status : item.status;

    await item.save();

    // Propagate stock thresholds to existing Material records of the same name
    await Material.updateMany(
      { name: item.materialName },
      {
        materialCode: item.materialCode,
        minimumStock: item.minimumStock,
        maximumStock: item.maximumStock,
        reorderLevel: item.reorderLevel
      }
    );

    res.status(200).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a master material
// @route   DELETE /api/item-master/:id
// @access  Private
export const deleteItemMaster = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await ItemMaster.findByIdAndDelete(id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Material master record not found.' });
    }
    res.status(200).json({ success: true, message: 'Material master record deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
