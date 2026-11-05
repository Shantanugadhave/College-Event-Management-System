const express = require('express');
const router = express.Router();
const {
  createRegistration,
  getRegistrations,
  getRegistrationById,
  updateRegistration,
  cancelRegistration,
  checkInAttendee,
  verifyRegistration,
  getEventRegistrations,
  getUserRegistrations,
} = require('../controllers/registrationController');
const {
  authMiddleware,
  organizerMiddleware,
} = require('../middleware/authMiddleware');

// Public ticket verification (accessible without login on any phone/camera scanning the QR)
router.get('/verify', verifyRegistration);
router.get('/verify/:ticketCode', verifyRegistration);

// Protected routes require authentication
router.use(authMiddleware);

// Check-in endpoints (Organizer or Admin)
router.post('/check-in', organizerMiddleware, checkInAttendee);
router.post('/:id/check-in', organizerMiddleware, checkInAttendee);

// Registration queries and actions
router.post('/', createRegistration);
router.get('/', getRegistrations);
router.get('/:id', getRegistrationById);
router.put('/:id', updateRegistration);
router.delete('/:id', cancelRegistration);

module.exports = router;
