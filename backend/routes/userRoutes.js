const express = require('express');
const router = express.Router();
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  verifyOrganizer,
} = require('../controllers/userController');
const { getUserRegistrations } = require('../controllers/registrationController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Admin only routes
router.get('/', adminMiddleware, getUsers);
router.post('/', adminMiddleware, createUser);
router.put('/:id/verify', adminMiddleware, verifyOrganizer);

// Self or Admin routes
router.get('/:id', getUserById);
router.get('/:id/registrations', getUserRegistrations);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;
