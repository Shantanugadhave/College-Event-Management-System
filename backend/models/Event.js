const mongoose = require('mongoose');

const categories = ['Academic', 'Cultural', 'Sports', 'Social', 'Workshop', 'Seminar'];
const statuses = ['draft', 'pending', 'approved', 'rejected', 'published', 'cancelled', 'completed', 'archived'];

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      minlength: [2, 'Event title must be at least 2 characters'],
      maxlength: [200, 'Event title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Event description is required'],
      trim: true,
      minlength: [50, 'Event description must be at least 50 characters'],
    },
    category: {
      type: String,
      required: [true, 'Event category is required'],
      enum: {
        values: categories,
        message: '{VALUE} is not a valid category. Must be one of: ' + categories.join(', '),
      },
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required (e.g. 10:00)'],
      trim: true,
    },
    endTime: {
      type: String,
      required: [true, 'End time is required (e.g. 12:00)'],
      trim: true,
    },
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Venue',
      required: [true, 'Venue is required'],
    },
    capacity: {
      type: Number,
      required: [true, 'Capacity is required'],
      min: [1, 'Capacity must be at least 1'],
    },
    posterImage: {
      type: String,
      default: '',
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Organizer is required'],
    },
    status: {
      type: String,
      enum: statuses,
      default: 'pending',
    },
    budget: {
      type: Number,
      min: [0, 'Budget cannot be negative'],
      default: 0,
    },
    registeredCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    availableSeats: {
      type: Number,
      min: [0, 'Available seats cannot be negative'],
      default: function () {
        return Math.max(0, (this.capacity || 0) - (this.registeredCount || 0));
      },
    },
    attendedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    views: {
      type: Number,
      default: 0,
      min: 0,
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    cancellationReason: {
      type: String,
      default: '',
    },
    rescheduleHistory: [
      {
        oldStartDate: Date,
        oldEndDate: Date,
        oldStartTime: String,
        oldEndTime: String,
        rescheduledAt: { type: Date, default: Date.now },
        reason: String,
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Pre-save hook to ensure availableSeats is always synchronized: availableSeats = capacity - registeredCount
eventSchema.pre('save', function (next) {
  if (this.capacity !== undefined) {
    const regCount = this.registeredCount || 0;
    this.availableSeats = Math.max(0, this.capacity - regCount);
  }
  next();
});

// Virtual for available seats fallback
eventSchema.virtual('availableSeatsVirtual').get(function () {
  return Math.max(0, this.capacity - (this.registeredCount || 0));
});

// Indexes for fast searching and filtering
eventSchema.index({ title: 'text', description: 'text' });
eventSchema.index({ category: 1, status: 1 });
eventSchema.index({ startDate: 1 });
eventSchema.index({ organizer: 1 });
eventSchema.index({ venue: 1, startDate: 1 });

const Event = mongoose.model('Event', eventSchema);
module.exports = Event;
