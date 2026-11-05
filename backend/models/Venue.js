const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Venue name is required'],
      unique: true,
      trim: true,
      minlength: [2, 'Venue name must be at least 2 characters'],
      maxlength: [100, 'Venue name cannot exceed 100 characters'],
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
    },
    capacity: {
      type: Number,
      required: [true, 'Capacity is required'],
      min: [1, 'Venue capacity must be a positive integer greater than 0'],
    },
    amenities: {
      type: [String],
      default: [],
    },
    images: {
      type: [String],
      default: [],
    },
    availability: {
      type: String,
      enum: ['available', 'reserved', 'maintenance'],
      default: 'available',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'maintenance', 'archived'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

venueSchema.index({ status: 1 });

const Venue = mongoose.model('Venue', venueSchema);
module.exports = Venue;
