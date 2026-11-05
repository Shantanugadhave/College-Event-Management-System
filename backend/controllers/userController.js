const User = require('../models/User');
const { validateRegistrationInput } = require('../validators/validators');
const { createNotification } = require('../services/notificationService');

// @desc    Get all users (with optional filtering by role, status, search)
// @route   GET /api/users
// @access  Private/Admin
const getUsers = async (req, res, next) => {
  try {
    const { role, status, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (role) {
      query.role = role;
    }

    if (status !== undefined) {
      if (status === 'active') query.isActive = true;
      if (status === 'deactivated') query.isActive = false;
      if (status === 'unverified') query.isVerified = false;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: {
        users,
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single user by ID
// @route   GET /api/users/:id
// @access  Private (Admin or Self)
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if user is requesting own profile or is admin
    if (req.user.role !== 'admin' && req.user._id.toString() !== id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this user profile',
      });
    }

    const user = await User.findById(id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'User details retrieved',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new user (by Admin)
// @route   POST /api/users
// @access  Private/Admin
const createUser = async (req, res, next) => {
  try {
    const { name, email, password, phone, role, organizationNumber, interests, isVerified } = req.body;

    const validation = validateRegistrationInput(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors,
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      phone: phone.trim(),
      role: role || 'student',
      organizationNumber: organizationNumber || '',
      interests: Array.isArray(interests) ? interests : [],
      isVerified: isVerified !== undefined ? isVerified : role === 'student',
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Admin or Self)
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'admin' && req.user._id.toString() !== id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this user account',
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const { name, phone, interests, preferences, profileImage, organizationNumber } = req.body;

    if (name) user.name = name.trim();
    if (phone) user.phone = phone.trim();
    if (interests && Array.isArray(interests)) user.interests = interests;
    if (preferences) user.preferences = { ...user.preferences, ...preferences };
    if (profileImage !== undefined) user.profileImage = profileImage;
    if (organizationNumber !== undefined) user.organizationNumber = organizationNumber;

    // Only Admin can change role, verification, or active state directly
    if (req.user.role === 'admin') {
      if (req.body.role) user.role = req.body.role;
      if (req.body.isVerified !== undefined) user.isVerified = Boolean(req.body.isVerified);
      if (req.body.isActive !== undefined) user.isActive = Boolean(req.body.isActive);
    }

    // If password provided, update and re-hash via pre-save
    if (req.body.password && req.body.password.length >= 6) {
      user.password = req.body.password;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        interests: user.interests,
        preferences: user.preferences,
        profileImage: user.profileImage,
        isVerified: user.isVerified,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Deactivate / Delete user account (soft delete / toggle active)
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'admin' && req.user._id.toString() !== id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to perform this operation',
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Toggle active status or deactivate
    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: user.isActive ? 'User account reactivated' : 'User account successfully deactivated',
      data: {
        _id: user._id,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify or reject organizer account
// @route   PUT /api/users/:id/verify
// @access  Private/Admin
const verifyOrganizer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isVerified } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.isVerified = isVerified !== undefined ? Boolean(isVerified) : true;
    await user.save();

    await createNotification({
      userId: user._id,
      title: user.isVerified ? 'Organizer Verification Approved!' : 'Organizer Verification Status Updated',
      message: user.isVerified
        ? 'Congratulations! Your organizer credentials have been verified by the college administration. You can now publish events to the campus community.'
        : 'Your organizer account verification status was updated.',
      type: user.isVerified ? 'approval' : 'announcement',
    });

    res.status(200).json({
      success: true,
      message: `Organizer ${user.isVerified ? 'verified' : 'unverified'} successfully`,
      data: {
        _id: user._id,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  verifyOrganizer,
};
