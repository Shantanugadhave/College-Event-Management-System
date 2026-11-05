const Feedback = require('../models/Feedback');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const { validateFeedbackInput } = require('../validators/validators');

// Simple sentiment analysis helper
const detectSentiment = (rating, comment = '') => {
  const lower = comment.toLowerCase();
  const negativeWords = ['terrible', 'bad', 'horrible', 'poor', 'worst', 'disorganized', 'waste', 'noisy', 'late', 'boring'];
  const positiveWords = ['great', 'excellent', 'amazing', 'awesome', 'inspiring', 'wonderful', 'helpful', 'informative', 'best', 'loved'];

  let posCount = positiveWords.filter((w) => lower.includes(w)).length;
  let negCount = negativeWords.filter((w) => lower.includes(w)).length;

  if (rating >= 4 || posCount > negCount) return 'Positive';
  if (rating <= 2 || negCount > posCount) return 'Constructive';
  return 'Neutral';
};

// @desc    Submit event feedback
// @route   POST /api/feedback
// @access  Private (Student)
const createFeedback = async (req, res, next) => {
  try {
    const {
      eventId,
      rating,
      comment,
      qualityRating,
      organizationRating,
      venueRating,
      contentRelevanceRating,
      overallValueRating,
    } = req.body;

    const validation = validateFeedbackInput(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors,
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Verify student attended or was registered for the event
    const registration = await Registration.findOne({
      student: req.user._id,
      event: eventId,
      status: { $in: ['checked-in', 'registered'] },
    });

    if (!registration && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You can only submit feedback for events you registered for and attended.',
      });
    }

    // Check if feedback already submitted
    const existingFeedback = await Feedback.findOne({
      student: req.user._id,
      event: eventId,
    });

    if (existingFeedback) {
      return res.status(409).json({
        success: false,
        message: 'You have already submitted feedback for this event. You can edit your existing feedback.',
        data: existingFeedback,
      });
    }

    const sentiment = detectSentiment(Number(rating), comment);

    const feedback = await Feedback.create({
      student: req.user._id,
      event: eventId,
      rating: Number(rating),
      comment: comment ? comment.trim() : '',
      qualityRating: Number(qualityRating) || Number(rating),
      organizationRating: Number(organizationRating) || Number(rating),
      venueRating: Number(venueRating) || Number(rating),
      contentRelevanceRating: Number(contentRelevanceRating) || Number(rating),
      overallValueRating: Number(overallValueRating) || Number(rating),
      sentiment,
    });

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully! Thank you for rating this event.',
      data: feedback,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get feedback list (with event, sentiment, and stats)
// @route   GET /api/feedback
// @access  Public / Private
const getFeedback = async (req, res, next) => {
  try {
    const { event, student, sentiment, page = 1, limit = 20 } = req.query;
    const query = {};

    if (event) query.event = event;
    if (student) query.student = student;
    if (sentiment) query.sentiment = sentiment;

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Feedback.countDocuments(query);

    const feedbacks = await Feedback.find(query)
      .populate('student', 'name profileImage')
      .populate('event', 'title category organizer startDate')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Calculate summary statistics if event is specified
    let stats = null;
    if (event) {
      const allForEvent = await Feedback.find({ event });
      const count = allForEvent.length;
      if (count > 0) {
        const avg = (allForEvent.reduce((acc, f) => acc + f.rating, 0) / count).toFixed(1);
        const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        const sentimentSummary = { Positive: 0, Neutral: 0, Constructive: 0 };

        allForEvent.forEach((f) => {
          distribution[f.rating] = (distribution[f.rating] || 0) + 1;
          sentimentSummary[f.sentiment] = (sentimentSummary[f.sentiment] || 0) + 1;
        });

        stats = {
          totalReviews: count,
          averageRating: Number(avg),
          distribution,
          sentimentSummary,
        };
      }
    }

    res.status(200).json({
      success: true,
      message: 'Feedback records retrieved',
      data: {
        feedbacks,
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
        stats,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single feedback by ID
// @route   GET /api/feedback/:id
// @access  Public
const getFeedbackById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const feedback = await Feedback.findById(id)
      .populate('student', 'name email profileImage')
      .populate('event', 'title category organizer');

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Feedback details retrieved',
      data: feedback,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update feedback
// @route   PUT /api/feedback/:id
// @access  Private (Owner student, or Admin)
const updateFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    const feedback = await Feedback.findById(id);

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found',
      });
    }

    if (req.user.role !== 'admin' && feedback.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this feedback',
      });
    }

    const {
      rating,
      comment,
      qualityRating,
      organizationRating,
      venueRating,
      contentRelevanceRating,
      overallValueRating,
    } = req.body;

    if (rating !== undefined) {
      feedback.rating = Number(rating);
      feedback.sentiment = detectSentiment(Number(rating), comment !== undefined ? comment : feedback.comment);
    }
    if (comment !== undefined) {
      feedback.comment = comment.trim();
      feedback.sentiment = detectSentiment(feedback.rating, comment.trim());
    }
    if (qualityRating !== undefined) feedback.qualityRating = Number(qualityRating);
    if (organizationRating !== undefined) feedback.organizationRating = Number(organizationRating);
    if (venueRating !== undefined) feedback.venueRating = Number(venueRating);
    if (contentRelevanceRating !== undefined) feedback.contentRelevanceRating = Number(contentRelevanceRating);
    if (overallValueRating !== undefined) feedback.overallValueRating = Number(overallValueRating);

    await feedback.save();

    res.status(200).json({
      success: true,
      message: 'Feedback updated successfully',
      data: feedback,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Organizer response to feedback
// @route   PUT /api/feedback/:id/respond
// @access  Private (Organizer of this event, or Admin)
const respondToFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { organizerResponse } = req.body;

    if (!organizerResponse || !organizerResponse.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Response text is required',
      });
    }

    const feedback = await Feedback.findById(id).populate('event');
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found',
      });
    }

    const isOrganizer =
      feedback.event && feedback.event.organizer.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only the event organizer or an admin can respond to this feedback',
      });
    }

    feedback.organizerResponse = organizerResponse.trim();
    feedback.respondedAt = new Date();
    await feedback.save();

    res.status(200).json({
      success: true,
      message: 'Response saved successfully',
      data: feedback,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete feedback
// @route   DELETE /api/feedback/:id
// @access  Private (Owner, Event Organizer, or Admin)
const deleteFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    const feedback = await Feedback.findById(id).populate('event');

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found',
      });
    }

    const isOwner = feedback.student.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    const isOrganizer =
      feedback.event && feedback.event.organizer.toString() === req.user._id.toString();

    if (!isOwner && !isAdmin && !isOrganizer) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to remove this feedback',
      });
    }

    await Feedback.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Feedback removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createFeedback,
  getFeedback,
  getFeedbackById,
  updateFeedback,
  respondToFeedback,
  deleteFeedback,
};
