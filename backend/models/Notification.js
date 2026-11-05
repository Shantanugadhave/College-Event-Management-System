const mongoose = require('mongoose');

const notificationTypes = [
  'event-update',
  'event-reminder',
  'registration',
  'cancellation',
  'approval',
  'rejection',
  'announcement',
];

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: notificationTypes,
      default: 'announcement',
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
