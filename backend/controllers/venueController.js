const Venue = require('../models/Venue');
const Event = require('../models/Event');
const { validateVenueInput } = require('../validators/validators');

// @desc    Get all venues
// @route   GET /api/venues
// @access  Public
const getVenues = async (req, res, next) => {
  try {
    const { status, search, minCapacity } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    } else if (!req.user || req.user.role !== 'admin') {
      // By default show active venues for non-admins
      query.status = { $ne: 'archived' };
    }

    if (minCapacity) {
      query.capacity = { $gte: Number(minCapacity) };
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
      ];
    }

    const venues = await Venue.find(query).sort({ name: 1 });

    res.status(200).json({
      success: true,
      message: 'Venues retrieved successfully',
      data: venues,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single venue by ID (with upcoming bookings)
// @route   GET /api/venues/:id
// @access  Public
const getVenueById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const venue = await Venue.findById(id);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found',
      });
    }

    // Fetch current and upcoming bookings for this venue
    const now = new Date();
    const bookings = await Event.find({
      venue: id,
      endDate: { $gte: now },
      status: { $in: ['approved', 'published'] },
    })
      .select('title startDate endDate startTime endTime organizer status')
      .populate('organizer', 'name email')
      .sort({ startDate: 1 });

    res.status(200).json({
      success: true,
      message: 'Venue details retrieved',
      data: {
        ...venue.toObject(),
        currentBookings: bookings,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new venue
// @route   POST /api/venues
// @access  Private (Admin)
const createVenue = async (req, res, next) => {
  try {
    const validation = validateVenueInput(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors,
      });
    }

    const { name, location, capacity, amenities, images, description, status } = req.body;

    const existingVenue = await Venue.findOne({ name: name.trim() });
    if (existingVenue) {
      return res.status(409).json({
        success: false,
        message: 'A venue with this name already exists',
        errors: ['Venue name must be unique'],
      });
    }

    const venue = await Venue.create({
      name: name.trim(),
      location: location.trim(),
      capacity: Number(capacity),
      amenities: Array.isArray(amenities)
        ? amenities
        : typeof amenities === 'string'
        ? amenities.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      images: Array.isArray(images) ? images : [],
      description: description ? description.trim() : '',
      status: status || 'active',
      availability: 'available',
    });

    res.status(201).json({
      success: true,
      message: 'Venue created successfully',
      data: venue,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update venue
// @route   PUT /api/venues/:id
// @access  Private (Admin)
const updateVenue = async (req, res, next) => {
  try {
    const { id } = req.params;

    const validation = validateVenueInput(req.body, true);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors,
      });
    }

    const venue = await Venue.findById(id);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found',
      });
    }

    const { name, location, capacity, amenities, images, availability, description, status } = req.body;

    if (name) venue.name = name.trim();
    if (location) venue.location = location.trim();
    if (capacity !== undefined) venue.capacity = Number(capacity);
    if (amenities !== undefined) {
      venue.amenities = Array.isArray(amenities)
        ? amenities
        : typeof amenities === 'string'
        ? amenities.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
    }
    if (images !== undefined) venue.images = Array.isArray(images) ? images : [];
    if (availability) venue.availability = availability;
    if (description !== undefined) venue.description = description.trim();
    if (status) venue.status = status;

    await venue.save();

    res.status(200).json({
      success: true,
      message: 'Venue updated successfully',
      data: venue,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete / Archive venue
// @route   DELETE /api/venues/:id
// @access  Private (Admin)
const deleteVenue = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { hardDelete } = req.query;

    const venue = await Venue.findById(id);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found',
      });
    }

    // Check if upcoming active events are booked in this venue
    const activeEvents = await Event.countDocuments({
      venue: id,
      endDate: { $gte: new Date() },
      status: { $in: ['approved', 'published'] },
    });

    if (activeEvents > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete/archive this venue: There are ${activeEvents} upcoming active events scheduled here.`,
      });
    }

    if (hardDelete === 'true') {
      await Venue.findByIdAndDelete(id);
      return res.status(200).json({
        success: true,
        message: 'Venue permanently deleted',
      });
    }

    // Soft archive
    venue.status = 'archived';
    await venue.save();

    res.status(200).json({
      success: true,
      message: 'Venue archived successfully',
      data: venue,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getVenues,
  getVenueById,
  createVenue,
  updateVenue,
  deleteVenue,
};
