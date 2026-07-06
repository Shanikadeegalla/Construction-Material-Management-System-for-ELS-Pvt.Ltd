import User from '../models/userModel.js';

// @desc    Get all users
// @route   GET /api/users
// @access  Public
export const getUsers = async (req, res, next) => {
  try {
    const users = await User.find({}).select('-password');
    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new user
// @route   POST /api/users
// @access  Public
export const createUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      res.status(400);
      throw new Error('User already exists');
    }

    const user = await User.create({
      name,
      email,
      password, // Note: In production, hash this password (e.g., using bcrypt)
    });

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user email address
// @route   PUT /api/users/:id/email
// @access  Private (Admin Only)
export const updateUserEmail = async (req, res, next) => {
  try {
    const { newEmail } = req.body;

    if (!newEmail) {
      res.status(400);
      throw new Error('Please enter new email');
    }

    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(newEmail)) {
      res.status(400);
      throw new Error('Please enter a valid email address');
    }

    const cleanEmail = newEmail.trim().toLowerCase();

    // Check if newEmail is already used by another user
    const userExists = await User.findOne({ email: cleanEmail });
    if (userExists && userExists._id.toString() !== req.params.id) {
      res.status(400);
      throw new Error('Email already in use');
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    user.email = cleanEmail;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Email updated successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    next(error);
  }
};
