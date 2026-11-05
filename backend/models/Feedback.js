const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student is required'],
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event is required'],
    },
    rating: {
      type: Number,
      required: [true, 'Overall rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    comment: {
      type: String,
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
      trim: true,
      default: '',
    },
    qualityRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },
    organizationRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },
    venueRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },
    contentRelevanceRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },
    overallValueRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },
    organizerResponse: {
      type: String,
      maxlength: [1000, 'Organizer response cannot exceed 1000 characters'],
      default: '',
    },
    respondedAt: {
      type: Date,
    },
    sentiment: {
      type: String,
      enum: ['Positive', 'Neutral', 'Constructive'],
      default: 'Positive',
    },
  },
  {
    timestamps: true,
  }
);

feedbackSchema.index({ event: 1, student: 1 }, { unique: true });
feedbackSchema.index({ event: 1, rating: -1 });

const Feedback = mongoose.model('Feedback', feedbackSchema);
module.exports = Feedback;
