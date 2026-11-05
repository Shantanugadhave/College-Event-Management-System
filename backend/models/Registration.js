const mongoose = require('mongoose');

const registrationStatuses = ['registered', 'waitlisted', 'checked-in', 'cancelled', 'no-show'];

const registrationSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student reference is required'],
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event reference is required'],
    },
    status: {
      type: String,
      enum: registrationStatuses,
      default: 'registered',
    },
    qrCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    qrCodeDataUrl: {
      type: String,
      default: '',
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
    checkedInAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to quickly find student registration per event
registrationSchema.index({ student: 1, event: 1 });
registrationSchema.index({ event: 1, status: 1 });

const Registration = mongoose.model('Registration', registrationSchema);
module.exports = Registration;
