import Permission from '../models/Permission.js';

// @desc    Get all permissions
// @route   GET /api/permissions
// @access  Private (Admin Only)
export const getPermissions = async (req, res, next) => {
  try {
    const permissions = await Permission.find({});
    res.status(200).json({ success: true, count: permissions.length, data: permissions });
  } catch (error) {
    next(error);
  }
};

// @desc    Edit a single permission
// @route   POST /api/permissions/edit
// @access  Private (Admin Only)
export const editPermission = async (req, res, next) => {
  try {
    const { role, module, permissionLevel } = req.body;

    if (!role || !module || !permissionLevel) {
      res.status(400);
      throw new Error('Role, module, and permission level are required');
    }

    const permission = await Permission.findOneAndUpdate(
      { role, module },
      { permissionLevel },
      { new: true, upsert: true }
    );

    res.status(200).json({ success: true, data: permission });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk edit permissions
// @route   POST /api/permissions/bulk-edit
// @access  Private (Admin Only)
export const bulkEditPermissions = async (req, res, next) => {
  try {
    const { role, modules, permissionLevel } = req.body;

    if (!role || !modules || !Array.isArray(modules) || !permissionLevel) {
      res.status(400);
      throw new Error('Role, modules (array), and permission level are required');
    }

    const updatedPermissions = [];
    for (const mod of modules) {
      const perm = await Permission.findOneAndUpdate(
        { role, module: mod },
        { permissionLevel },
        { new: true, upsert: true }
      );
      updatedPermissions.push(perm);
    }

    res.status(200).json({ success: true, count: updatedPermissions.length, data: updatedPermissions });
  } catch (error) {
    next(error);
  }
};
