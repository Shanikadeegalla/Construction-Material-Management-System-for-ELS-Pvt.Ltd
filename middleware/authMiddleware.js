const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      next();
    } catch (error) {
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: 'Role is not authorized' });
    }
    
    const userRole = req.user.role.toLowerCase();
    const allowedRoles = roles.map(r => r.toLowerCase());
    
    // Map capitalized roles to lowercase checks
    const mapRole = (role) => {
      if (role === 'projectmanager') return 'pm';
      if (role === 'mainstoreofficer') return 'store';
      if (role === 'sitestoreofficer') return 'sitestore';
      if (role === 'purchasemanager' || role === 'purchaseofficer') return 'purchase';
      return role;
    };

    const mappedUserRole = mapRole(userRole);

    if (!allowedRoles.includes(userRole) && !allowedRoles.includes(mappedUserRole)) {
      return res.status(403).json({ 
        message: `Role ${req.user.role} is not authorized` 
      });
    }
    next();
  };
};

module.exports = { protect, authorizeRoles };