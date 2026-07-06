import User from '../models/userModel.js';
import AuditLog from '../models/AuditLog.js';
import generateToken from '../utils/generateToken.js';

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (role === 'Admin') {
      res.status(400);
      throw new Error('Admin accounts cannot be created through this form.');
    }

    if (!name || !email || !password) {
      res.status(400);
      throw new Error('Please enter all required fields');
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
      res.status(400);
      throw new Error('User already exists');
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'MainStoreOfficer',
      status: true
    });

    if (user) {
      res.status(201).json({
        success: true,
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          token: generateToken(user._id),
        },
      });
    } else {
      res.status(400);
      throw new Error('Invalid user data');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400);
      throw new Error('Please enter email and password');
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (user && (await user.matchPassword(password))) {
      // Check if user is active
      if (user.status === false) {
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        await AuditLog.create({
          userId: null,
          userName: email,
          action: 'Failed Login',
          module: 'Authentication',
          ipAddress,
          timestamp: new Date(),
          status: 'Failed'
        });
        res.status(401);
        throw new Error('User account is deactivated. Contact administrator.');
      }

      // Save Audit Log
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
      await AuditLog.create({
        userId: user._id,
        userName: user.name,
        action: 'User Login',
        module: 'Authentication',
        ipAddress,
        timestamp: new Date(),
        status: 'Success'
      });

      res.json({
        success: true,
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          token: generateToken(user._id),
        },
      });
    } else {
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
      await AuditLog.create({
        userId: null,
        userName: email,
        action: 'Failed Login',
        module: 'Authentication',
        ipAddress,
        timestamp: new Date(),
        status: 'Failed'
      });
      res.status(401);
      throw new Error('Invalid email or password');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get user profile
// @route   GET /api/auth/me
// @access  Private
export const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      res.json({
        success: true,
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      });
    } else {
      res.status(404);
      throw new Error('User not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get all users
// @route   GET /api/auth/users
// @access  Private (Admin Only)
export const getUsers = async (req, res, next) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a user
// @route   PUT /api/auth/users/:id
// @access  Private (Admin Only)
export const updateUser = async (req, res, next) => {
  try {
    const { name, email, role, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    // Authorization check: Admin can update anyone, regular users can only update themselves
    if (req.user.role !== 'Admin' && req.user._id.toString() !== req.params.id) {
      res.status(403);
      throw new Error('Not authorized to update this user');
    }

    // If regular user is updating, prevent them from changing their own role
    if (req.user.role !== 'Admin' && role && role !== user.role) {
      res.status(403);
      throw new Error('Not authorized to change your own role');
    }

    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        res.status(400);
        throw new Error('Email already exists for another user');
      }
    }

    // Password change logic
    if (newPassword) {
      if (req.user.role !== 'Admin') {
        // Regular user must provide correct current password
        if (!currentPassword) {
          res.status(400);
          throw new Error('Current password is required to change password');
        }
        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
          res.status(400);
          throw new Error('Incorrect current password');
        }
      }
      user.password = newPassword;
    }

    user.name = name || user.name;
    user.email = email || user.email;
    if (req.user.role === 'Admin') {
      user.role = role || user.role;
    }

    const updatedUser = await user.save();
    res.status(200).json({
      success: true,
      message: 'User updated successfully!',
      data: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        status: updatedUser.status
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Deactivate user
// @route   PUT /api/auth/users/:id/deactivate
// @access  Private (Admin Only)
export const deactivateUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { status: false }, { new: true });
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }
    res.status(200).json({ success: true, message: 'User deactivated successfully!', data: user });
  } catch (error) {
    next(error);
  }
};

// @desc    Activate user
// @route   PUT /api/auth/users/:id/activate
// @access  Private (Admin Only)
export const activateUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { status: true }, { new: true });
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }
    res.status(200).json({ success: true, message: 'User activated successfully!', data: user });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all audit logs
// @route   GET /api/auth/audit-logs
// @access  Private
export const getAuditLogs = async (req, res, next) => {
  try {
    const logs = await AuditLog.find({}).populate('userId', 'name email').sort({ timestamp: -1 });
    res.status(200).json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset user password (Admin Only)
// @route   PUT /api/auth/users/:id/reset-password
// @access  Private (Admin Only)
export const resetUserPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || password.trim().length < 6) {
      res.status(400);
      throw new Error('Password must be at least 6 characters long');
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    user.password = password;
    await user.save();

    // Log the audit event
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    await AuditLog.create({
      userId: req.user ? req.user._id : null,
      userName: req.user ? req.user.name : 'System Admin',
      action: `Reset Password for User: ${user.name}`,
      module: 'User Management',
      ipAddress,
      timestamp: new Date(),
      status: 'Success'
    });

    res.status(200).json({
      success: true,
      message: `Password reset successfully for user "${user.name}"`
    });
  } catch (error) {
    next(error);
  }
};
