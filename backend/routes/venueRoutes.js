const express = require('express');
const router = express.Router();
const {
  getVenues,
  getVenueById,
  createVenue,
  updateVenue,
  deleteVenue,
} = require('../controllers/venueController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

// Public endpoints
router.get('/', getVenues);
router.get('/:id', getVenueById);

// Admin only management
router.post('/', authMiddleware, adminMiddleware, createVenue);
router.put('/:id', authMiddleware, adminMiddleware, updateVenue);
router.delete('/:id', authMiddleware, adminMiddleware, deleteVenue);

module.exports = router;
