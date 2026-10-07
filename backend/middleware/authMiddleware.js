import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';

export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        res.status(401);
        return next(new Error('Not authorized, user not found'));
      }

      if (req.user.status === false) {
        res.status(401);
        return next(new Error('Account is deactivated. Contact administrator.'));
      }

      if (req.user.passwordChangedAt && decoded.iat) {
        const changedTimestamp = parseInt(req.user.passwordChangedAt.getTime() / 1000, 10);
        if (decoded.iat < changedTimestamp) {
          res.status(401);
          return next(new Error('User recently changed password. Please log in again.'));
        }
      }

      return next();
    } catch (error) {
      console.error('Token verification failed:', error.message);
      res.status(401);
      return next(new Error('Not authorized, token failed'));
    }

    if (!req.user) {
      res.status(401);
      return next(new Error('Not authorized, user not found'));
    }

    if (req.user.status === false) {
      res.status(401);
      return next(new Error('Not authorized, account deactivated'));
    }

    return next();
  }

  if (!token) {
    res.status(401);
    return next(new Error('Not authorized, no token'));
  }
};

export const admin = (req, res, next) => {
  if (req.user && req.user.role === 'Admin') {
    next();
  } else {
    res.status(403);
    return next(new Error('Not authorized as an Admin'));
  }
};

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      res.status(403);
      return next(new Error(`Role Guest is not authorized`));
    }
    const userRole = req.user.role;
    const allowed = [...roles];
    if (!allowed.includes(userRole)) {
      res.status(403);
      return next(new Error(`Role ${userRole} is not authorized`));
    }
    next();
  };
};
