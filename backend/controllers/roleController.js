import Role from '../models/Role.js';
import User from '../models/userModel.js';
import Permission from '../models/Permission.js';

// @desc    Get all roles
// @route   GET /api/roles
// @access  Private (Admin Only)
export const getRoles = async (req, res, next) => {
  try {
    const roles = await Role.find({}).sort({ name: 1 });
    
    // Enrich roles with user count
    const enrichedRoles = await Promise.all(roles.map(async (role) => {
      const count = await User.countDocuments({ role: role.name });
      return {
        ...role.toObject(),
        userCount: count
      };
    }));

    res.status(200).json({ success: true, count: enrichedRoles.length, data: enrichedRoles });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a role
// @route   POST /api/roles
// @access  Private (Admin Only)
export const createRole = async (req, res, next) => {
  try {
    const { name, description, status } = req.body;

    if (!name) {
      res.status(400);
      throw new Error('Role name is required');
    }

    const cleanName = name.trim();
    const exists = await Role.findOne({ name: { $regex: new RegExp(`^${cleanName}$`, 'i') } });
    if (exists) {
      res.status(400);
      throw new Error('Role name must be unique');
    }

    const role = await Role.create({
      name: cleanName,
      description,
      status: status || 'Active'
    });

    // Also populate default permissions for this new role so it doesn't break the matrix
    const defaultModules = [
      "Create/Edit Users", "View User List", "Audit Logs",
      "Create Project", "View Projects", "BOM Creation", "BOM Approval",
      "Create PR", "Create PO", "Approve PO", "Supplier Management",
      "Create GRN", "View Stock", "Issue Materials", "Stock Adjustments",
      "View Reports", "Export PDF/Excel"
    ];

    for (const mod of defaultModules) {
      await Permission.create({
        role: cleanName,
        module: mod,
        permissionLevel: 'None'
      });
    }

    res.status(201).json({ success: true, data: role });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a role
// @route   PUT /api/roles/:id
// @access  Private (Admin Only)
export const updateRole = async (req, res, next) => {
  try {
    const { name, description, status } = req.body;
    const role = await Role.findById(req.params.id);

    if (!role) {
      res.status(404);
      throw new Error('Role not found');
    }

    // Check uniqueness if name changed
    if (name && name.trim().toLowerCase() !== role.name.toLowerCase()) {
      const cleanName = name.trim();
      const exists = await Role.findOne({ name: { $regex: new RegExp(`^${cleanName}$`, 'i') } });
      if (exists) {
        res.status(400);
        throw new Error('Role name must be unique');
      }
      
      // Update role references in permissions
      await Permission.updateMany({ role: role.name }, { role: cleanName });
      role.name = cleanName;
    }

    role.description = description !== undefined ? description : role.description;
    role.status = status || role.status;

    const updatedRole = await role.save();
    res.status(200).json({ success: true, data: updatedRole });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a role
// @route   DELETE /api/roles/:id
// @access  Private (Admin Only)
export const deleteRole = async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);

    if (!role) {
      res.status(404);
      throw new Error('Role not found');
    }

    // Check if any users are assigned to this role
    const count = await User.countDocuments({ role: role.name });

    if (count > 0) {
      res.status(400);
      throw new Error('Cannot delete role with assigned users');
    }

    // Remove permissions associated with the role
    await Permission.deleteMany({ role: role.name });
    
    // Use deleteOne instead of remove
    await Role.deleteOne({ _id: role._id });

    res.status(200).json({ success: true, message: 'Role deleted successfully!' });
  } catch (error) {
    next(error);
  }
};
