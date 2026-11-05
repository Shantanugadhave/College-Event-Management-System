const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validateRegistrationInput } = require('../validators/validators');
const { createNotification } = require('../services/notificationService');

const generateToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET || 'college_event_management_super_secure_jwt_secret_key_2026',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const { name, email, password, phone, role, organizationNumber, interests } = req.body;

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
        message: 'An account with this email already exists',
        errors: ['Email is already registered'],
      });
    }

    const assignedRole = ['student', 'organizer', 'admin'].includes(role) ? role : 'student';
    const isVerified = assignedRole === 'organizer' ? false : true;

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      phone: phone.trim(),
      role: assignedRole,
      organizationNumber: organizationNumber ? organizationNumber.trim() : '',
      interests: Array.isArray(interests) ? interests : [],
      isVerified,
      isActive: true,
    });

    const token = generateToken(user._id, user.role);

    // Send welcome notification
    await createNotification({
      userId: user._id,
      title: 'Welcome to College Event Hub!',
      message:
        assignedRole === 'organizer'
          ? 'Your organizer account has been created. An administrator will verify your credentials shortly so you can publish events.'
          : 'Your account is ready! Explore upcoming campus events, RSVP, and engage with college activities.',
      type: 'announcement',
    });

    res.status(201).json({
      success: true,
      message:
        assignedRole === 'organizer'
          ? 'Registration successful! Your organizer account is pending administrator verification.'
          : 'Registration successful!',
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          interests: user.interests,
          organizationNumber: user.organizationNumber,
          isVerified: user.isVerified,
          isActive: user.isActive,
          profileImage: user.profileImage,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password',
        errors: ['Email and password are required'],
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        errors: ['Invalid credentials'],
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        errors: ['Invalid credentials'],
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated. Please reach out to college administration.',
        errors: ['Account deactivated'],
      });
    }

    const token = generateToken(user._id, user.role);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          interests: user.interests,
          organizationNumber: user.organizationNumber,
          isVerified: user.isVerified,
          isActive: user.isActive,
          profileImage: user.profileImage,
          preferences: user.preferences,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Public
const logout = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'User logged out successfully',
    data: {},
  });
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json({
      success: true,
      message: 'User profile retrieved',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe,
};
