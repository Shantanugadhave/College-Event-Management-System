const Event = require('../models/Event');
const Venue = require('../models/Venue');
const Registration = require('../models/Registration');
const Feedback = require('../models/Feedback');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { validateEventInput } = require('../validators/validators');
const { createNotification, notifyMultipleUsers } = require('../services/notificationService');

// @desc    Create new event
// @route   POST /api/events
// @access  Private (Organizer, Admin)
const createEvent = async (req, res, next) => {
  try {
    const validation = validateEventInput(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors,
      });
    }

    const {
      title,
      description,
      category,
      startDate,
      endDate,
      startTime,
      endTime,
      venue: venueId,
      capacity,
      posterImage,
      budget,
      status,
    } = req.body;

    // Check organizer verification (Admins are always allowed)
    if (req.user.role === 'organizer' && !req.user.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Your organizer account must be verified by an administrator before you can create events.',
      });
    }

    // Check venue exists & capacity
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Selected venue not found',
        errors: ['Invalid venue ID'],
      });
    }

    if (Number(capacity) > venue.capacity) {
      return res.status(400).json({
        success: false,
        message: `Event capacity (${capacity}) cannot exceed venue maximum capacity (${venue.capacity})`,
        errors: ['Capacity exceeds venue capacity'],
      });
    }

    // Check unique title per organizer per date
    const startOfDay = new Date(startDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startDate);
    endOfDay.setHours(23, 59, 59, 999);

    const duplicateTitle = await Event.findOne({
      organizer: req.user._id,
      title: title.trim(),
      startDate: { $gte: startOfDay, $lte: endOfDay },
    });

    if (duplicateTitle) {
      return res.status(409).json({
        success: false,
        message: 'You already have an event with this title on the specified date',
        errors: ['Duplicate event title for this organizer and date'],
      });
    }

    // Prevent double booking at venue for the same date and overlapping time
    const venueBookingConflict = await Event.findOne({
      venue: venueId,
      startDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['approved', 'published'] },
      $or: [
        { startTime: { $lte: endTime }, endTime: { $gte: startTime } },
      ],
    });

    if (venueBookingConflict) {
      return res.status(409).json({
        success: false,
        message: 'The selected venue is already booked for another event during this time window',
        errors: ['Venue scheduling conflict'],
      });
    }

    // Determine initial status:
    // If admin creates, it can be published or approved directly.
    // If organizer creates, if status requested is draft, set draft; otherwise set 'pending' for admin review.
    let initialStatus = 'pending';
    if (req.user.role === 'admin') {
      initialStatus = status || 'published';
    } else if (status === 'draft') {
      initialStatus = 'draft';
    }

    const event = await Event.create({
      title: title.trim(),
      description: description.trim(),
      category,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      startTime,
      endTime,
      venue: venueId,
      capacity: Number(capacity),
      availableSeats: Number(capacity),
      posterImage: posterImage || '',
      organizer: req.user._id,
      budget: budget !== undefined ? Number(budget) : 0,
      status: initialStatus,
    });

    // Notify admins of new pending event
    if (initialStatus === 'pending') {
      const admins = await User.find({ role: 'admin' });
      const adminIds = admins.map((a) => a._id);
      await notifyMultipleUsers(adminIds, {
        title: 'New Event Awaiting Approval',
        message: `Organizer "${req.user.name}" submitted a new event: "${event.title}". Please review and approve.`,
        type: 'approval',
        eventId: event._id,
      });
    }

    res.status(201).json({
      success: true,
      message:
        initialStatus === 'pending'
          ? 'Event submitted successfully! Awaiting administrator approval.'
          : 'Event created and published successfully.',
      data: event,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all events with filters, search, pagination
// @route   GET /api/events
// @access  Public
const getEvents = async (req, res, next) => {
  try {
    const {
      search,
      category,
      date,
      venue,
      organizer,
      status,
      availability,
      page = 1,
      limit = 12,
      sortBy = 'startDate',
      sortOrder = 'asc',
    } = req.query;

    const query = {};

    // Check if caller is authenticated (optional token check for public endpoint)
    let authUser = req.user || null;
    if (!authUser && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || 'college_event_management_super_secure_jwt_secret_key_2026'
        );
        authUser = await User.findById(decoded.id).select('role _id');
      } catch (e) {
        // Token invalid or expired, continue as unauthenticated
      }
    }

    // Role-aware status filtering:
    // - Students & unauthenticated public are strictly restricted to published and approved events
    // - Default catalog browsing (without specific organizer parameter) shows only published and approved events
    // - Admin and Organizer:
    //     - If status === 'cancelled': query.status = 'cancelled'
    //     - If status === 'all' or 'all_with_cancelled' or includeCancelled === 'true': allows all (unless hideCancelled is requested)
    //     - If specific status specified: match that status
    //     - Default (no status specified or catalog view): exclude cancelled and archived events
    if (authUser && authUser.role === 'admin') {
      if (status === 'cancelled') {
        query.status = 'cancelled';
      } else if (status === 'all' || status === 'all_with_cancelled' || req.query.includeCancelled === 'true') {
        if (req.query.hideCancelled === 'true') {
          query.status = { $nin: ['cancelled', 'archived'] };
        }
      } else if (status) {
        query.status = status;
      } else {
        query.status = { $nin: ['cancelled', 'archived'] };
      }
    } else if (
      authUser &&
      authUser.role === 'organizer' &&
      organizer &&
      organizer.toString() === authUser._id.toString()
    ) {
      if (status === 'cancelled') {
        query.status = 'cancelled';
      } else if (status === 'all' || status === 'all_with_cancelled' || req.query.includeCancelled === 'true') {
        if (req.query.hideCancelled === 'true') {
          query.status = { $nin: ['cancelled', 'archived'] };
        }
      } else if (status) {
        query.status = status;
      } else {
        query.status = { $nin: ['cancelled', 'archived'] };
      }
    } else {
      query.status = { $in: ['published', 'approved'] };
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (venue && venue !== 'all') {
      query.venue = venue;
    }

    if (organizer) {
      query.organizer = organizer;
    }

    // Date filtering options: 'today', 'upcoming', 'this-week', 'this-month', or exact ISO date
    if (date) {
      const now = new Date();
      if (date === 'today') {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        query.startDate = { $gte: start, $lte: end };
      } else if (date === 'upcoming') {
        query.startDate = { $gte: now };
      } else if (date === 'this-week') {
        const start = new Date(now);
        const end = new Date(now);
        end.setDate(end.getDate() + 7);
        query.startDate = { $gte: start, $lte: end };
      } else if (date === 'this-month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        query.startDate = { $gte: start, $lte: end };
      } else {
        const targetDate = new Date(date);
        if (!isNaN(targetDate.getTime())) {
          const start = new Date(targetDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(targetDate);
          end.setHours(23, 59, 59, 999);
          query.startDate = { $gte: start, $lte: end };
        }
      }
    }

    if (search && search.trim()) {
      query.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    // Availability filter: only events with open spots
    if (availability === 'available') {
      query.$expr = { $lt: ['$registeredCount', '$capacity'] };
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Event.countDocuments(query);

    const events = await Event.find(query)
      .populate('venue', 'name location capacity amenities')
      .populate('organizer', 'name email phone organizationNumber profileImage')
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      message: 'Events retrieved successfully',
      data: {
        events,
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single event by ID (with view count increment)
// @route   GET /api/events/:id
// @access  Public
const getEventById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const event = await Event.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true }
    )
      .populate('venue', 'name location capacity amenities images availability')
      .populate('organizer', 'name email phone organizationNumber profileImage isVerified');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Fetch average rating and feedback count
    const feedbacks = await Feedback.find({ event: id });
    const totalRating = feedbacks.reduce((acc, f) => acc + f.rating, 0);
    const avgRating = feedbacks.length > 0 ? (totalRating / feedbacks.length).toFixed(1) : 0;

    res.status(200).json({
      success: true,
      message: 'Event details retrieved',
      data: {
        ...event.toObject(),
        averageRating: Number(avgRating),
        feedbackCount: feedbacks.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update event / Reschedule
// @route   PUT /api/events/:id
// @access  Private (Organizer of this event, or Admin)
const updateEvent = async (req, res, next) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Role check: Only organizer who owns it or Admin can edit
    if (req.user.role !== 'admin' && event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to edit this event',
      });
    }

    const validation = validateEventInput(req.body, true);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors,
      });
    }

    const {
      title,
      description,
      category,
      startDate,
      endDate,
      startTime,
      endTime,
      venue: venueId,
      capacity,
      posterImage,
      budget,
      status,
      rescheduleReason,
    } = req.body;

    // Check venue capacity if capacity or venue changes
    if (venueId || capacity) {
      const targetVenueId = venueId || event.venue;
      const targetCapacity = capacity ? Number(capacity) : event.capacity;
      const venue = await Venue.findById(targetVenueId);
      if (venue && targetCapacity > venue.capacity) {
        return res.status(400).json({
          success: false,
          message: `Event capacity (${targetCapacity}) cannot exceed venue maximum capacity (${venue.capacity})`,
        });
      }
      if (targetCapacity < event.registeredCount) {
        return res.status(400).json({
          success: false,
          message: `Cannot reduce capacity below current registered attendee count (${event.registeredCount})`,
        });
      }
    }

    // Detect rescheduling
    const isRescheduled =
      (startDate && new Date(startDate).toISOString() !== event.startDate.toISOString()) ||
      (startTime && startTime !== event.startTime);

    if (isRescheduled) {
      event.rescheduleHistory.push({
        oldStartDate: event.startDate,
        oldEndDate: event.endDate,
        oldStartTime: event.startTime,
        oldEndTime: event.endTime,
        reason: rescheduleReason || 'Schedule updated by organizer',
        rescheduledAt: new Date(),
      });

      // Notify registered students about rescheduling
      const registrations = await Registration.find({
        event: event._id,
        status: { $in: ['registered', 'waitlisted'] },
      });
      const studentIds = registrations.map((r) => r.student);
      if (studentIds.length > 0) {
        await notifyMultipleUsers(studentIds, {
          title: `Event Rescheduled: ${event.title}`,
          message: `The event "${event.title}" has been rescheduled to ${new Date(startDate || event.startDate).toLocaleDateString()} at ${startTime || event.startTime}. ${rescheduleReason ? `Reason: ${rescheduleReason}` : ''}`,
          type: 'event-update',
          eventId: event._id,
        });
      }
    }

    if (title) event.title = title.trim();
    if (description) event.description = description.trim();
    if (category) event.category = category;
    if (startDate) event.startDate = new Date(startDate);
    if (endDate) event.endDate = new Date(endDate);
    if (startTime) event.startTime = startTime;
    if (endTime) event.endTime = endTime;
    if (venueId) event.venue = venueId;
    if (capacity) event.capacity = Number(capacity);
    if (posterImage !== undefined) event.posterImage = posterImage;
    if (budget !== undefined) event.budget = Number(budget);

    // Status transitions
    if (status) {
      // If organizer sets to published, check if they are verified
      if (status === 'published' && req.user.role === 'organizer' && !req.user.isVerified) {
        return res.status(403).json({
          success: false,
          message: 'Organizer account must be verified before publishing events',
        });
      }
      event.status = status;
    }

    await event.save();

    res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      data: event,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Soft Delete / Cancel event OR Permanent Delete / Archive event
// @route   DELETE /api/events/:id
// @access  Private (Organizer of this event, or Admin)
const deleteEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, cancellationReason, action } = req.body || {};
    const queryAction = req.query.action || (req.query.archive === 'true' ? 'archive' : null);

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    if (req.user.role !== 'admin' && event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete, cancel or archive this event',
      });
    }

    const isArchive =
      action === 'archive' ||
      queryAction === 'archive' ||
      req.query.archive === 'true' ||
      req.body?.status === 'archived';

    if (isArchive) {
      // ARCHIVE: Permanently delete event document from MongoDB
      await Event.findByIdAndDelete(id);
      await Registration.deleteMany({ event: id });

      return res.status(200).json({
        success: true,
        message: 'Event archived and deleted successfully from MongoDB',
        data: { _id: id, status: 'archived', deleted: true },
      });
    }

    // CANCEL: Soft delete / cancellation
    // 1. DO NOT permanently remove from MongoDB
    // 2. Keep the complete event document in MongoDB
    // 3. Change status to 'cancelled'
    // 4. Record cancellation details (cancelledAt, cancelledBy, cancellationReason)
    // 5. Do NOT change capacity, registeredCount, or availableSeats
    // 6. Event will not be visible in active listings
    event.status = 'cancelled';
    event.cancelledAt = new Date();
    event.cancelledBy = req.user._id;
    event.cancellationReason = (
      cancellationReason ||
      reason ||
      req.query.reason ||
      req.query.cancellationReason ||
      'Event cancelled by administration or organizer'
    ).trim();

    await event.save();

    // Notify registered attendees about cancellation
    const registrations = await Registration.find({
      event: event._id,
      status: { $in: ['registered', 'waitlisted', 'checked-in'] },
    });
    const studentIds = registrations.map((r) => r.student);
    if (studentIds.length > 0) {
      await notifyMultipleUsers(studentIds, {
        title: `Event Cancelled: ${event.title}`,
        message: `The event "${event.title}" has been cancelled. Reason: ${event.cancellationReason}`,
        type: 'cancellation',
        eventId: event._id,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Event successfully cancelled',
      data: event,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Archive event (Permanently delete from MongoDB)
// @route   POST /api/events/:id/archive
const archiveEvent = async (req, res, next) => {
  req.query.action = 'archive';
  return deleteEvent(req, res, next);
};

// @desc    Cancel event (Soft delete in MongoDB, hidden from active listings)
// @route   POST /api/events/:id/cancel
const cancelEvent = async (req, res, next) => {
  req.query.action = 'cancel';
  return deleteEvent(req, res, next);
};

// @desc    Admin approve or reject event
// @route   PUT /api/events/:id/status
// @access  Private (Admin)
const updateEventStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason, cancellationReason } = req.body;

    const allowedStatuses = ['approved', 'published', 'rejected', 'pending', 'cancelled', 'archived'];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Valid status is required (${allowedStatuses.join(', ')})`,
      });
    }

    const event = await Event.findById(id).populate('organizer');
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    if (status === 'archived') {
      // Archiving permanently deletes the event from MongoDB
      await Event.findByIdAndDelete(id);
      await Registration.deleteMany({ event: id });

      return res.status(200).json({
        success: true,
        message: 'Event archived and deleted successfully from MongoDB',
        data: { _id: id, status: 'archived', deleted: true },
      });
    }

    event.status = status;
    if (status === 'rejected') {
      event.rejectionReason = rejectionReason || 'Event proposal rejected by administrator.';
    } else if (status === 'cancelled') {
      event.cancelledAt = new Date();
      event.cancelledBy = req.user._id;
      event.cancellationReason = (cancellationReason || rejectionReason || req.body.reason || 'Event cancelled by administrator.').trim();
    }
    await event.save();

    if (status === 'approved' || status === 'published') {
      // 1. Notify organizer
      await createNotification({
        userId: event.organizer._id,
        title: `Event Approved: ${event.title}`,
        message: `Your event "${event.title}" has been approved by admin and is now live!`,
        type: 'approval',
        eventId: event._id,
      });

      // 2. Notify all active students
      const students = await User.find({ role: 'student', isActive: { $ne: false } }).select('_id');
      const studentIds = students.map((s) => s._id);
      if (studentIds.length > 0) {
        await notifyMultipleUsers(studentIds, {
          title: `New Event Approved: ${event.title}`,
          message: `A new event "${event.title}" has been approved and is now open for registration!`,
          type: 'announcement',
          eventId: event._id,
        });
      }
    } else if (status === 'rejected') {
      // Notify organizer with rejection reason
      await createNotification({
        userId: event.organizer._id,
        title: `Event Rejected: ${event.title}`,
        message: `Your event "${event.title}" has been rejected by administrator.${event.rejectionReason ? ` Reason: ${event.rejectionReason}` : ''}`,
        type: 'rejection',
        eventId: event._id,
      });
    } else {
      // Other status transitions
      await createNotification({
        userId: event.organizer._id,
        title: `Event Status Update: ${event.title}`,
        message: `Your event "${event.title}" status is now ${status}.`,
        type: 'event-update',
        eventId: event._id,
      });
    }

    res.status(200).json({
      success: true,
      message: `Event status updated to ${status}`,
      data: event,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Search events
// @route   GET /api/events/search
// @access  Public
const searchEvents = async (req, res, next) => {
  try {
    const { q, category, venue } = req.query;
    const query = { status: { $in: ['published', 'approved'] } };

    if (q) {
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ];
    }
    if (category && category !== 'all') {
      query.category = category;
    }
    if (venue && venue !== 'all') {
      query.venue = venue;
    }

    const events = await Event.find(query)
      .populate('venue', 'name location')
      .populate('organizer', 'name email')
      .sort({ startDate: 1 })
      .limit(20);

    res.status(200).json({
      success: true,
      message: 'Search completed',
      data: events,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get upcoming events
// @route   GET /api/events/upcoming
// @access  Public
const getUpcomingEvents = async (req, res, next) => {
  try {
    const events = await Event.find({
      status: { $in: ['published', 'approved'] },
      startDate: { $gte: new Date() },
    })
      .populate('venue', 'name location capacity')
      .populate('organizer', 'name email profileImage')
      .sort({ startDate: 1 })
      .limit(8);

    res.status(200).json({
      success: true,
      message: 'Upcoming events retrieved',
      data: events,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get events by category
// @route   GET /api/events/category/:category
// @access  Public
const getEventsByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const events = await Event.find({
      category,
      status: { $in: ['published', 'approved'] },
    })
      .populate('venue', 'name location')
      .populate('organizer', 'name email')
      .sort({ startDate: 1 });

    res.status(200).json({
      success: true,
      message: `Events for category ${category}`,
      data: events,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get attendee list for an event
// @route   GET /api/events/:id/attendees
// @access  Private (Organizer of this event, or Admin)
const getEventAttendees = async (req, res, next) => {
  try {
    const { id } = req.params;
    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    if (req.user.role !== 'admin' && event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view attendee list for this event',
      });
    }

    const attendees = await Registration.find({ event: id })
      .populate('student', 'name email phone profileImage')
      .sort({ registeredAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Attendee list retrieved',
      data: attendees,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get event analytics
// @route   GET /api/events/:id/analytics
// @access  Private (Organizer of this event, or Admin)
const getEventAnalytics = async (req, res, next) => {
  try {
    const { id } = req.params;
    const event = await Event.findById(id).populate('venue');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    if (req.user.role !== 'admin' && event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view analytics for this event',
      });
    }

    const registrations = await Registration.find({ event: id });
    const registeredCount = registrations.filter((r) => r.status === 'registered').length;
    const checkedInCount = registrations.filter((r) => r.status === 'checked-in').length;
    const waitlistedCount = registrations.filter((r) => r.status === 'waitlisted').length;
    const cancelledCount = registrations.filter((r) => r.status === 'cancelled').length;
    const noShowCount = registrations.filter((r) => r.status === 'no-show').length;

    const totalActive = registeredCount + checkedInCount;
    const attendanceRate = totalActive > 0 ? ((checkedInCount / totalActive) * 100).toFixed(1) : 0;
    const noShowRate = totalActive > 0 ? ((noShowCount / totalActive) * 100).toFixed(1) : 0;

    const feedbacks = await Feedback.find({ event: id }).populate('student', 'name');
    const avgRating =
      feedbacks.length > 0
        ? (feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length).toFixed(1)
        : 0;

    res.status(200).json({
      success: true,
      message: 'Event analytics retrieved',
      data: {
        event: {
          _id: event._id,
          title: event.title,
          capacity: event.capacity,
          venue: event.venue,
          views: event.views,
        },
        counts: {
          totalRegistrations: registrations.length,
          registered: registeredCount,
          checkedIn: checkedInCount,
          waitlisted: waitlistedCount,
          cancelled: cancelledCount,
          noShow: noShowCount,
        },
        rates: {
          attendanceRate: Number(attendanceRate),
          noShowRate: Number(noShowRate),
          utilizationRate: Number(((totalActive / event.capacity) * 100).toFixed(1)),
        },
        feedbackSummary: {
          count: feedbacks.length,
          averageRating: Number(avgRating),
          recentComments: feedbacks.slice(-5).map((f) => ({
            studentName: f.student?.name || 'Anonymous',
            rating: f.rating,
            comment: f.comment,
            sentiment: f.sentiment,
          })),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  archiveEvent,
  cancelEvent,
  updateEventStatus,
  searchEvents,
  getUpcomingEvents,
  getEventsByCategory,
  getEventAttendees,
  getEventAnalytics,
};
