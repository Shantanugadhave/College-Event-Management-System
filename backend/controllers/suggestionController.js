const Suggestion = require('../models/Suggestion');

// @desc    Get suggestions (Admin: all, User: own)
// @route   GET /api/suggestions
// @access  Private
const getSuggestions = async (req, res, next) => {
  try {
    const { status, type } = req.query;
    const query = {};

    if (req.user.role !== 'admin') {
      query.user = req.user._id;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (type && type !== 'all') {
      query.type = type;
    }

    const suggestions = await Suggestion.find(query)
      .populate('user', 'name email role')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Suggestions retrieved',
      data: suggestions,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit platform suggestion or bug report
// @route   POST /api/suggestions
// @access  Private
const createSuggestion = async (req, res, next) => {
  try {
    const { title, description, type } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Title and description are required',
      });
    }

    const suggestion = await Suggestion.create({
      user: req.user._id,
      title: title.trim(),
      description: description.trim(),
      type: type || 'feature',
      status: 'submitted',
    });

    res.status(201).json({
      success: true,
      message: 'Suggestion submitted successfully! Thank you for helping us improve.',
      data: suggestion,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update suggestion status / notes (Admin)
// @route   PUT /api/suggestions/:id
// @access  Private (Admin)
const updateSuggestionStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const suggestion = await Suggestion.findById(id);
    if (!suggestion) {
      return res.status(404).json({
        success: false,
        message: 'Suggestion not found',
      });
    }

    if (status) suggestion.status = status;
    if (adminNotes !== undefined) suggestion.adminNotes = adminNotes.trim();

    await suggestion.save();

    res.status(200).json({
      success: true,
      message: 'Suggestion updated',
      data: suggestion,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete suggestion
// @route   DELETE /api/suggestions/:id
// @access  Private (Admin or Author)
const deleteSuggestion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const suggestion = await Suggestion.findById(id);

    if (!suggestion) {
      return res.status(404).json({
        success: false,
        message: 'Suggestion not found',
      });
    }

    if (req.user.role !== 'admin' && suggestion.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this suggestion',
      });
    }

    await Suggestion.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Suggestion removed',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSuggestions,
  createSuggestion,
  updateSuggestionStatus,
  deleteSuggestion,
};
