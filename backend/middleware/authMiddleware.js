const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Authentication token missing.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'college_event_management_super_secure_jwt_secret_key_2026');
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This account has been deactivated. Please contact an administrator.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.',
      error: error.message,
    });
  }
};

const adminMiddleware = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access restricted to administrators only.',
    });
  }
  next();
};

const organizerMiddleware = (req, res, next) => {
  if (!req.user || (req.user.role !== 'organizer' && req.user.role !== 'admin')) {
    return res.status(403).json({
      success: false,
      message: 'Access restricted to event organizers and administrators.',
    });
  }
  next();
};

const studentMiddleware = (req, res, next) => {
  if (!req.user || (req.user.role !== 'student' && req.user.role !== 'admin')) {
    return res.status(403).json({
      success: false,
      message: 'Access restricted to students and administrators.',
    });
  }
  next();
};

const verifiedOrganizerMiddleware = (req, res, next) => {
  if (req.user.role === 'admin') {
    return next();
  }
  if (req.user.role !== 'organizer') {
    return res.status(403).json({
      success: false,
      message: 'Access restricted to event organizers.',
    });
  }
  if (!req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message: 'Your organizer account has not been verified by an administrator yet. You cannot publish events until verified.',
    });
  }
  next();
};

module.exports = {
  authMiddleware,
  adminMiddleware,
  organizerMiddleware,
  studentMiddleware,
  verifiedOrganizerMiddleware,
};
