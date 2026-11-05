const User = require('../models/User');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Venue = require('../models/Venue');
const Feedback = require('../models/Feedback');

// @desc    Get system-wide analytics for Admin Dashboard
// @route   GET /api/reports/admin-overview
// @access  Private (Admin)
const getAdminOverview = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalOrganizers = await User.countDocuments({ role: 'organizer' });
    const unverifiedOrganizers = await User.countDocuments({ role: 'organizer', isVerified: false });

    const totalEvents = await Event.countDocuments();
    const activeEvents = await Event.countDocuments({ status: { $in: ['approved', 'published'] } });
    const pendingEvents = await Event.countDocuments({ status: 'pending' });
    const cancelledEvents = await Event.countDocuments({ status: 'cancelled' });
    const totalVenues = await Venue.countDocuments({ status: { $ne: 'archived' } });

    const totalRegistrations = await Registration.countDocuments();
    const checkedInCount = await Registration.countDocuments({ status: 'checked-in' });
    const noShowCount = await Registration.countDocuments({ status: 'no-show' });

    const attendanceRate =
      totalRegistrations > 0 ? ((checkedInCount / totalRegistrations) * 100).toFixed(1) : 0;
    const noShowRate =
      totalRegistrations > 0 ? ((noShowCount / totalRegistrations) * 100).toFixed(1) : 0;

    // Feedback average
    const allFeedbacks = await Feedback.find();
    const totalFeedbackScore = allFeedbacks.reduce((sum, f) => sum + f.rating, 0);
    const avgRating =
      allFeedbacks.length > 0 ? (totalFeedbackScore / allFeedbacks.length).toFixed(1) : 0;

    // Events by Category aggregation
    const categoryStats = await Event.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Monthly registrations aggregation (last 6 months)
    const monthlyRegistrations = await Registration.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$registeredAt' },
            month: { $month: '$registeredAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 6 },
    ]);

    // Top venues by event count
    const venueUsage = await Event.aggregate([
      { $group: { _id: '$venue', eventCount: { $sum: 1 } } },
      { $sort: { eventCount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'venues',
          localField: '_id',
          foreignField: '_id',
          as: 'venueInfo',
        },
      },
      { $unwind: '$venueInfo' },
      {
        $project: {
          venueName: '$venueInfo.name',
          capacity: '$venueInfo.capacity',
          eventCount: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      message: 'Admin metrics retrieved',
      data: {
        stats: {
          totalUsers,
          totalStudents,
          totalOrganizers,
          unverifiedOrganizers,
          totalEvents,
          activeEvents,
          pendingEvents,
          cancelledEvents,
          totalVenues,
          totalRegistrations,
          checkedInCount,
          noShowCount,
          attendanceRate: Number(attendanceRate),
          noShowRate: Number(noShowRate),
          averageRating: Number(avgRating),
          feedbackCount: allFeedbacks.length,
        },
        categoryStats,
        monthlyRegistrations,
        venueUsage,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get organizer performance & events summary
// @route   GET /api/reports/organizer-overview
// @access  Private (Organizer)
const getOrganizerOverview = async (req, res, next) => {
  try {
    const organizerId = req.user._id;

    const myEvents = await Event.find({ organizer: organizerId });
    const eventIds = myEvents.map((e) => e._id);

    const totalEvents = myEvents.length;
    const upcomingEvents = myEvents.filter(
      (e) => new Date(e.startDate) >= new Date() && ['published', 'approved'].includes(e.status)
    ).length;

    const registrations = await Registration.find({ event: { $in: eventIds } });
    const totalRegistrations = registrations.length;
    const checkedInCount = registrations.filter((r) => r.status === 'checked-in').length;
    const noShowCount = registrations.filter((r) => r.status === 'no-show').length;

    const attendanceRate =
      totalRegistrations > 0 ? ((checkedInCount / totalRegistrations) * 100).toFixed(1) : 0;

    const feedbacks = await Feedback.find({ event: { $in: eventIds } });
    const avgRating =
      feedbacks.length > 0
        ? (feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length).toFixed(1)
        : 0;

    res.status(200).json({
      success: true,
      message: 'Organizer metrics retrieved',
      data: {
        totalEvents,
        upcomingEvents,
        totalRegistrations,
        totalAttendees: checkedInCount,
        noShowCount,
        attendanceRate: Number(attendanceRate),
        averageRating: Number(avgRating),
        feedbackCount: feedbacks.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get student personalized stats & recommendations
// @route   GET /api/reports/student-overview
// @access  Private (Student)
const getStudentOverview = async (req, res, next) => {
  try {
    const studentId = req.user._id;

    const registrations = await Registration.find({ student: studentId }).populate({
      path: 'event',
      populate: { path: 'venue', select: 'name location' },
    });

    const registeredCount = registrations.filter((r) => r.status === 'registered').length;
    const attendedCount = registrations.filter((r) => r.status === 'checked-in').length;
    const cancelledCount = registrations.filter((r) => r.status === 'cancelled').length;

    const feedbacksGiven = await Feedback.countDocuments({ student: studentId });

    // Recommendation logic: Find upcoming published events matching student's interests
    const userInterests = req.user.interests || [];
    let recommendations = [];

    const registeredEventIds = registrations.map((r) => r.event?._id).filter(Boolean);

    const recQuery = {
      _id: { $nin: registeredEventIds },
      status: { $in: ['published', 'approved'] },
      startDate: { $gte: new Date() },
    };

    if (userInterests.length > 0) {
      recQuery.category = { $in: userInterests };
    }

    recommendations = await Event.find(recQuery)
      .populate('venue', 'name location')
      .populate('organizer', 'name')
      .sort({ startDate: 1 })
      .limit(6);

    res.status(200).json({
      success: true,
      message: 'Student metrics retrieved',
      data: {
        stats: {
          registeredCount,
          attendedCount,
          cancelledCount,
          feedbacksGiven,
        },
        recommendations,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export Events or Registrations report as CSV
// @route   GET /api/reports/export-csv
// @access  Private (Admin, Organizer)
const exportCsvReport = async (req, res, next) => {
  try {
    const { type, eventId } = req.query;

    if (type === 'events') {
      const query = req.user.role === 'admin' ? {} : { organizer: req.user._id };
      const events = await Event.find(query).populate('venue').populate('organizer', 'name email');

      let csv = 'Title,Category,Start Date,Start Time,Venue,Capacity,Registered,Attended,Budget,Status\n';
      events.forEach((ev) => {
        csv += `"${ev.title.replace(/"/g, '""')}","${ev.category}","${new Date(ev.startDate).toLocaleDateString()}","${ev.startTime}","${ev.venue?.name || ''}",${ev.capacity},${ev.registeredCount},${ev.attendedCount},${ev.budget},"${ev.status}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="events-report.csv"');
      return res.status(200).send(csv);
    }

    if (type === 'attendees') {
      const query = {};
      if (eventId) query.event = eventId;
      if (req.user.role === 'organizer') {
        const myEvents = await Event.find({ organizer: req.user._id }).select('_id');
        query.event = { $in: myEvents.map((e) => e._id) };
      }

      const attendees = await Registration.find(query)
        .populate('student', 'name email phone')
        .populate('event', 'title category startDate');

      let csv = 'Student Name,Email,Phone,Event Title,Category,Registration Status,Registered At,Checked In At\n';
      attendees.forEach((a) => {
        csv += `"${a.student?.name || ''}","${a.student?.email || ''}","${a.student?.phone || ''}","${a.event?.title || ''}","${a.event?.category || ''}","${a.status}","${new Date(a.registeredAt).toLocaleString()}","${a.checkedInAt ? new Date(a.checkedInAt).toLocaleString() : 'N/A'}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="attendees-report.csv"');
      return res.status(200).send(csv);
    }

    res.status(400).json({
      success: false,
      message: 'Invalid export type. Must be "events" or "attendees".',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminOverview,
  getOrganizerOverview,
  getStudentOverview,
  exportCsvReport,
};
