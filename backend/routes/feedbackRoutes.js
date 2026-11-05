const express = require('express');
const router = express.Router();
const {
  createFeedback,
  getFeedback,
  getFeedbackById,
  updateFeedback,
  respondToFeedback,
  deleteFeedback,
} = require('../controllers/feedbackController');
const { authMiddleware, organizerMiddleware } = require('../middleware/authMiddleware');

// Public or filtered feedback
router.get('/', getFeedback);
router.get('/:id', getFeedbackById);

// Protected routes
router.post('/', authMiddleware, createFeedback);
router.put('/:id', authMiddleware, updateFeedback);
router.put('/:id/respond', authMiddleware, organizerMiddleware, respondToFeedback);
router.delete('/:id', authMiddleware, deleteFeedback);

module.exports = router;
