const express = require('express');
const router = express.Router();
const {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  archiveEvent,
  cancelEvent,
  updateEventStatus,
  searchEvents,
  getUpcomingEvents,
  getEventsByCategory,
  getEventAttendees,
  getEventAnalytics,
} = require('../controllers/eventController');
const { getEventRegistrations } = require('../controllers/registrationController');
const {
  authMiddleware,
  organizerMiddleware,
  adminMiddleware,
  verifiedOrganizerMiddleware,
} = require('../middleware/authMiddleware');

// Public endpoints (with search, category, upcoming)
router.get('/search', searchEvents);
router.get('/upcoming', getUpcomingEvents);
router.get('/category/:category', getEventsByCategory);
router.get('/', getEvents);
router.get('/:id', getEventById);

// Protected endpoints
router.post('/', authMiddleware, verifiedOrganizerMiddleware, createEvent);
router.post('/:id/cancel', authMiddleware, organizerMiddleware, cancelEvent);
router.post('/:id/archive', authMiddleware, organizerMiddleware, archiveEvent);
router.put('/:id', authMiddleware, organizerMiddleware, updateEvent);
router.delete('/:id', authMiddleware, organizerMiddleware, deleteEvent);

// Admin status change (approve/reject/archive)
router.put('/:id/status', authMiddleware, adminMiddleware, updateEventStatus);

// Organizer & Admin attendee lists and analytics
router.get('/:id/attendees', authMiddleware, organizerMiddleware, getEventAttendees);
router.get('/:id/registrations', authMiddleware, organizerMiddleware, getEventRegistrations);
router.get('/:id/analytics', authMiddleware, organizerMiddleware, getEventAnalytics);

module.exports = router;
