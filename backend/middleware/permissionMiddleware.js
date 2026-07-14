import Permission from '../models/Permission.js';

// Gates a route by (role, action) using the persisted Permission matrix that
// Admins configure under Roles & Permissions. Admin always bypasses. Any level
// other than "None" grants access — the matrix doesn't distinguish "Full" vs
// "View" vs "Partial" at the enforcement layer, since each action already names
// a specific operation (e.g. "Create PR" vs "Approve PR") rather than a generic
// CRUD resource.
export const checkPermission = (action) => async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401);
      throw new Error('Not authorized');
    }
    if (req.user.role === 'Admin') {
      return next();
    }
    const permission = await Permission.findOne({ role: req.user.role, module: action });
    if (!permission || permission.permissionLevel === 'None') {
      res.status(403);
      throw new Error(`Your role does not have permission to perform "${action}".`);
    }
    next();
  } catch (error) {
    next(error);
  }
};
