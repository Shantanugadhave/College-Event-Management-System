const express = require('express');
const router = express.Router();
const {
  getSuggestions,
  createSuggestion,
  updateSuggestionStatus,
  deleteSuggestion,
} = require('../controllers/suggestionController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', getSuggestions);
router.post('/', createSuggestion);
router.put('/:id', adminMiddleware, updateSuggestionStatus);
router.delete('/:id', deleteSuggestion);

module.exports = router;
