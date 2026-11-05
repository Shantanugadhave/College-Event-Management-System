const QRCode = require('qrcode');
const os = require('os');
const dgram = require('dgram');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const { createNotification } = require('../services/notificationService');

// Helper to detect which network interface routes default outbound traffic using OS routing table
const getActiveRoutedIp = () => {
  try {
    const s = dgram.createSocket('udp4');
    s.connect(80, '8.8.8.8');
    const addr = s.address()?.address;
    s.close();
    if (addr && addr !== '0.0.0.0' && addr !== '127.0.0.1' && !addr.startsWith('169.254.')) {
      return addr;
    }
  } catch (e) {}
  return null;
};

// Helper to reliably discover active non-internal IPv4 for local network devices (e.g. mobile phones on same Wi-Fi)
const getLocalIp = () => {
  // 1. Explicit override from environment if provided
  if (process.env.HOST_IP) return process.env.HOST_IP.trim();
  if (process.env.SERVER_IP) return process.env.SERVER_IP.trim();

  // 2. Query OS kernel routing table (most accurate for active Wi-Fi/Ethernet)
  const routedIp = getActiveRoutedIp();
  if (routedIp) return routedIp;

  // 3. Intelligent interface scan with ranking
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(interfaces)) {
    const isVirtual = /vethernet|virtual|vmware|vbox|wsl|hyper-v|loopback|docker|pseudo|tunnel|tap|tun/i.test(name);
    const isPreferredName = /wi-?fi|wlan|wireless|ethernet|eth\d|en\d/i.test(name);

    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const addr = iface.address;
        if (!addr || addr === '0.0.0.0' || addr === '127.0.0.1' || addr.startsWith('169.254.')) {
          continue;
        }

        let score = 0;
        if (isPreferredName) score += 50;
        if (isVirtual) score -= 100;

        // Score based on IP subnets
        if (addr.startsWith('10.')) {
          score += 30;
        } else if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(addr)) {
          score += 25;
        } else if (addr.startsWith('192.168.')) {
          // Windows mobile hotspot / ICS defaults to 192.168.137.1
          if (addr === '192.168.137.1') score += 5;
          else score += 20;
        } else {
          score += 10;
        }

        candidates.push({ address: addr, score, name });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.length > 0 ? candidates[0].address : '127.0.0.1';
};

// Helper to determine reachable base URL for tickets and QR codes
const getBaseAppUrl = (req) => {
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL.replace(/\/$/, '');
  }

  const port = process.env.PORT || 5000;
  const ip = getLocalIp();

  // If request arrived from an external host header that is not loopback/unspecified, use it
  const host = req?.headers?.host;
  if (
    host &&
    !host.includes('localhost') &&
    !host.includes('127.0.0.1') &&
    !host.includes('0.0.0.0') &&
    !host.includes('::1')
  ) {
    const protocol = req.protocol || 'http';
    return `${protocol}://${host}`;
  }

  // Fallback for requests made locally (e.g. localhost browser): always use reachable LAN IP
  return `http://${ip}:${port}`;
};

// Helper to generate visual QR Code data URL dynamically with current base URL
const generateTicketQrDataUrl = async (ticketCode, req) => {
  const baseAppUrl = getBaseAppUrl(req);
  const qrUrl = `${baseAppUrl}/verify-ticket.html?ticket=${encodeURIComponent(ticketCode)}`;
  return await QRCode.toDataURL(qrUrl, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
};

// @desc    Register student for an event (with RSVP & QR code)
// @route   POST /api/registrations
// @access  Private (Student)
const createRegistration = async (req, res, next) => {
  try {
    const eventId = req.body.eventId || req.body.event;
    const studentId = req.user._id;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: 'Event ID is required',
        errors: ['eventId is missing'],
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Check if event is cancelled
    if (event.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'This event has been cancelled.',
        errors: ['This event has been cancelled.'],
      });
    }

    // Only approved/published events can be registered for
    if (!['published', 'approved'].includes(event.status)) {
      return res.status(400).json({
        success: false,
        message: 'Registrations are only open for approved events',
        errors: [`Event is currently ${event.status}`],
      });
    }

    // Check if event is in the past
    if (new Date(event.endDate || event.startDate) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'This event has already ended',
        errors: ['Event has concluded'],
      });
    }

    // Check for existing active registration to prevent duplicate registration
    const existingReg = await Registration.findOne({
      student: studentId,
      event: eventId,
      status: { $in: ['registered', 'waitlisted', 'checked-in'] },
    });

    if (existingReg) {
      return res.status(409).json({
        success: false,
        message: `You are already registered for this event`,
        errors: ['Duplicate registration not permitted'],
        data: existingReg,
      });
    }

    // Check capacity: if full, do not create registration and return clear "Event is full" message
    if (event.registeredCount >= event.capacity) {
      return res.status(400).json({
        success: false,
        message: 'Event is full',
        errors: ['Event capacity reached. Registrations are closed.'],
      });
    }

    // Atomically increment Event.registeredCount and decrement availableSeats if still under capacity
    const updatedEvent = await Event.findOneAndUpdate(
      {
        _id: eventId,
        status: { $in: ['approved', 'published'] },
        $expr: { $lt: ['$registeredCount', '$capacity'] },
      },
      {
        $inc: { registeredCount: 1, availableSeats: -1 },
      },
      { new: true }
    );

    if (!updatedEvent) {
      const current = await Event.findById(eventId);
      if (current && current.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: 'This event has been cancelled.',
          errors: ['This event has been cancelled.'],
        });
      }
      if (current && current.registeredCount >= current.capacity) {
        return res.status(400).json({
          success: false,
          message: 'Event is full',
          errors: ['Event capacity reached. Registrations are closed.'],
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Registrations are not open for this event',
        errors: [`Event is currently ${current ? current.status : 'unavailable'}`],
      });
    }

    // Generate unique QR code payload and visual QR code data URL pointing to reachable verification URL
    const uniqueQrCode = `EVENT-${event._id.toString().slice(-6)}-STUDENT-${studentId.toString().slice(-6)}-${Date.now()}`;
    let qrDataUrl = '';
    try {
      qrDataUrl = await generateTicketQrDataUrl(uniqueQrCode, req);
    } catch (qrErr) {
      console.warn('QR Code generation fallback:', qrErr.message);
      qrDataUrl = '';
    }

    let registration;
    try {
      registration = await Registration.create({
        student: studentId,
        event: eventId,
        status: 'registered',
        qrCode: uniqueQrCode,
        qrCodeDataUrl: qrDataUrl,
        registeredAt: new Date(),
      });
    } catch (createErr) {
      // Rollback atomic count increment if registration document creation failed
      await Event.findByIdAndUpdate(eventId, { $inc: { registeredCount: -1, availableSeats: 1 } });

      // Handle duplicate key race conditions gracefully
      if (createErr.code === 11000) {
        const existing = await Registration.findOne({
          student: studentId,
          event: eventId,
          status: { $in: ['registered', 'waitlisted', 'checked-in'] },
        });
        return res.status(409).json({
          success: false,
          message: 'You are already registered for this event',
          errors: ['Duplicate registration not permitted'],
          data: existing,
        });
      }
      throw createErr;
    }

    // Create student notification
    await createNotification({
      userId: studentId,
      title: 'Registration Confirmed!',
      message: `You have successfully registered for "${event.title}". View your digital QR ticket in My Events.`,
      type: 'registration',
      eventId: event._id,
    });

    res.status(201).json({
      success: true,
      message: 'Registration Successful',
      data: registration,
      event: {
        _id: updatedEvent._id,
        title: updatedEvent.title,
        registeredCount: updatedEvent.registeredCount,
        availableSeats: updatedEvent.availableSeats,
        capacity: updatedEvent.capacity,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all registrations (Admin: all, Organizer: for their events, Student: own)
// @route   GET /api/registrations
// @access  Private
const getRegistrations = async (req, res, next) => {
  try {
    const { event, student, status, page = 1, limit = 20 } = req.query;
    const query = {};

    if (req.user.role === 'student') {
      query.student = req.user._id;
      if (event) query.event = event;
    } else if (req.user.role === 'organizer') {
      // Find organizer's event IDs
      const myEvents = await Event.find({ organizer: req.user._id }).select('_id');
      const myEventIds = myEvents.map((e) => e._id);
      query.event = { $in: myEventIds };
      if (event) query.event = event;
    } else if (req.user.role === 'admin') {
      if (student) query.student = student;
      if (event) query.event = event;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Registration.countDocuments(query);

    const registrations = await Registration.find(query)
      .populate({
        path: 'event',
        select: 'title category startDate endDate startTime endTime venue capacity posterImage status organizer',
        populate: { path: 'venue', select: 'name location' },
      })
      .populate('student', 'name email phone profileImage')
      .sort({ registeredAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Ensure all registrations carry fresh QR code pointing to current reachable base URL
    const enrichedRegistrations = await Promise.all(
      registrations.map(async (reg) => {
        const doc = reg.toObject();
        try {
          doc.qrCodeDataUrl = await generateTicketQrDataUrl(reg.qrCode, req);
        } catch (e) {
          doc.qrCodeDataUrl = reg.qrCodeDataUrl || '';
        }
        return doc;
      })
    );

    res.status(200).json({
      success: true,
      message: 'Registrations retrieved',
      data: {
        registrations: enrichedRegistrations,
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single registration by ID
// @route   GET /api/registrations/:id
// @access  Private
const getRegistrationById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const registration = await Registration.findById(id)
      .populate({
        path: 'event',
        populate: [
          { path: 'venue', select: 'name location capacity' },
          { path: 'organizer', select: 'name email phone' },
        ],
      })
      .populate('student', 'name email phone profileImage');

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration record not found',
      });
    }

    // Permission check
    const isOwner = req.user._id.toString() === registration.student._id.toString();
    const isAdmin = req.user.role === 'admin';
    const isEventOrganizer =
      registration.event &&
      registration.event.organizer &&
      registration.event.organizer._id.toString() === req.user._id.toString();

    if (!isOwner && !isAdmin && !isEventOrganizer) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this registration',
      });
    }

    const doc = registration.toObject();
    try {
      doc.qrCodeDataUrl = await generateTicketQrDataUrl(registration.qrCode, req);
    } catch (e) {
      doc.qrCodeDataUrl = registration.qrCodeDataUrl || '';
    }

    res.status(200).json({
      success: true,
      message: 'Registration retrieved',
      data: doc,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update registration status
// @route   PUT /api/registrations/:id
// @access  Private (Organizer, Admin)
const updateRegistration = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const registration = await Registration.findById(id).populate('event');
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found',
      });
    }

    // Authorization
    const isAdmin = req.user.role === 'admin';
    const isEventOrganizer =
      registration.event &&
      registration.event.organizer.toString() === req.user._id.toString();

    if (!isAdmin && !isEventOrganizer) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify registration status',
      });
    }

    if (status) {
      registration.status = status;
      if (status === 'checked-in' && !registration.checkedInAt) {
        registration.checkedInAt = new Date();
      }
    }
    if (notes !== undefined) {
      registration.notes = notes;
    }

    await registration.save();

    res.status(200).json({
      success: true,
      message: `Registration status updated to ${registration.status}`,
      data: registration,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel registration (by Student, Organizer, or Admin)
// @route   DELETE /api/registrations/:id
// @access  Private
const cancelRegistration = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const registration = await Registration.findById(id).populate('event');
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found',
      });
    }

    const isOwner = req.user._id.toString() === registration.student.toString();
    const isAdmin = req.user.role === 'admin';
    const isEventOrganizer =
      registration.event &&
      registration.event.organizer.toString() === req.user._id.toString();

    if (!isOwner && !isAdmin && !isEventOrganizer) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this registration',
      });
    }

    const wasRegistered = registration.status === 'registered';

    registration.status = 'cancelled';
    registration.cancelledAt = new Date();
    registration.cancellationReason = reason || 'Cancelled by user';
    await registration.save();

    // If active registration was cancelled, decrement event registered count & promote waitlist
    if (wasRegistered && registration.event) {
      const event = await Event.findById(registration.event._id);
      if (event) {
        event.registeredCount = Math.max(0, (event.registeredCount || 1) - 1);
        event.availableSeats = Math.max(0, event.capacity - event.registeredCount);

        // Find next waitlisted student to promote
        const nextWaitlisted = await Registration.findOne({
          event: event._id,
          status: 'waitlisted',
        }).sort({ registeredAt: 1 });

        if (nextWaitlisted) {
          nextWaitlisted.status = 'registered';
          await nextWaitlisted.save();

          event.registeredCount += 1;
          event.availableSeats = Math.max(0, event.capacity - event.registeredCount);

          await createNotification({
            userId: nextWaitlisted.student,
            title: 'Spot Available! Registration Confirmed',
            message: `A spot opened up for "${event.title}"! Your waitlist status has been automatically upgraded to confirmed registration.`,
            type: 'registration',
            eventId: event._id,
          });
        }

        await event.save();
      }
    }

    await createNotification({
      userId: registration.student,
      title: 'Registration Cancelled',
      message: `Your registration for "${registration.event?.title || 'event'}" has been cancelled.`,
      type: 'cancellation',
      eventId: registration.event?._id,
    });

    res.status(200).json({
      success: true,
      message: 'Registration successfully cancelled',
      data: registration,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check-in attendee by ID or QR code token
// @route   POST /api/registrations/:id/check-in  OR  POST /api/registrations/check-in
// @access  Private (Organizer of this event, or Admin)
const checkInAttendee = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { qrCode } = req.body;

    let targetCode = (qrCode || id || '').trim();

    // Parse ticket code if camera/scanner submitted the full verification URL
    if (targetCode.includes('ticket=')) {
      try {
        const parsed = new URL(targetCode, 'http://dummy.local');
        targetCode = parsed.searchParams.get('ticket') || targetCode;
      } catch (e) {
        const match = targetCode.match(/[?&]ticket=([^&]+)/);
        if (match) targetCode = decodeURIComponent(match[1]);
      }
    } else if (targetCode.includes('/registration/')) {
      const parts = targetCode.split('/registration/');
      if (parts[1]) targetCode = parts[1].split(/[?#]/)[0];
    }

    let query = {};
    if (id && id !== 'check-in') {
      if (/^[0-9a-fA-F]{24}$/.test(id)) {
        query = { $or: [{ _id: id }, { qrCode: id }] };
      } else {
        query = { qrCode: id };
      }
    } else if (targetCode) {
      if (/^[0-9a-fA-F]{24}$/.test(targetCode)) {
        query = { $or: [{ _id: targetCode }, { qrCode: targetCode }] };
      } else {
        query = { qrCode: targetCode };
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Registration ID or QR code is required for check-in',
      });
    }

    const registration = await Registration.findOne(query)
      .populate('event')
      .populate('student', 'name email');

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'No registration found matching the provided code or ID',
      });
    }

    // Role check: Admin or the organizer who owns this event
    const isAdmin = req.user.role === 'admin';
    const isOrganizer =
      registration.event &&
      registration.event.organizer &&
      registration.event.organizer.toString() === req.user._id.toString();

    if (!isAdmin && !isOrganizer) {
      return res.status(403).json({
        success: false,
        message: 'Only event organizers or administrators can perform check-in',
      });
    }

    if (registration.event && registration.event.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot check-in: This event has been cancelled.',
      });
    }

    if (registration.status === 'checked-in') {
      return res.status(200).json({
        success: true,
        message: `Attendee ${registration.student?.name || ''} was already checked in at ${new Date(registration.checkedInAt).toLocaleTimeString()}`,
        data: registration,
      });
    }

    if (registration.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot check-in: this registration was cancelled',
      });
    }

    registration.status = 'checked-in';
    registration.checkedInAt = new Date();
    await registration.save();

    // Increment attendedCount on event
    if (registration.event) {
      await Event.findByIdAndUpdate(registration.event._id, { $inc: { attendedCount: 1 } });
    }

    // Notify student
    await createNotification({
      userId: registration.student._id,
      title: 'Check-in Verified!',
      message: `Welcome to "${registration.event.title}"! Your attendance has been marked.`,
      type: 'event-update',
      eventId: registration.event._id,
    });

    res.status(200).json({
      success: true,
      message: `Check-in successful! Verified attendee: ${registration.student?.name}`,
      data: registration,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify registration by ticket code or ID (Public verification for scanned QR)
// @route   GET /api/registrations/verify/:ticketCode  OR  GET /api/registrations/verify
// @access  Public
const verifyRegistration = async (req, res, next) => {
  try {
    const rawCode = req.params.ticketCode || req.query.ticket || req.query.id;
    if (!rawCode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or unavailable registration.',
      });
    }

    let cleanCode = rawCode.trim();

    // Extract ticket code if a full URL was passed in
    if (cleanCode.includes('ticket=')) {
      try {
        const parsed = new URL(cleanCode, 'http://dummy.local');
        cleanCode = parsed.searchParams.get('ticket') || cleanCode;
      } catch (e) {
        const match = cleanCode.match(/[?&]ticket=([^&]+)/);
        if (match) cleanCode = decodeURIComponent(match[1]);
      }
    } else if (cleanCode.includes('/registration/')) {
      const parts = cleanCode.split('/registration/');
      if (parts[1]) cleanCode = parts[1].split(/[?#]/)[0];
    }

    let query = {};
    if (/^[0-9a-fA-F]{24}$/.test(cleanCode)) {
      query = { $or: [{ _id: cleanCode }, { qrCode: cleanCode }] };
    } else {
      query = { qrCode: cleanCode };
    }

    const registration = await Registration.findOne(query)
      .populate({
        path: 'event',
        select: 'title description category startDate endDate startTime endTime venue location posterImage status organizer capacity registeredCount availableSeats cancellationReason',
        populate: [
          { path: 'venue', select: 'name location' },
          { path: 'organizer', select: 'name email department' },
        ],
      })
      .populate('student', 'name email department rollNumber phone');

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or unavailable registration.',
      });
    }

    const isCheckedIn = registration.status === 'checked-in' || !!registration.checkedInAt;

    // Secure sanitized attendee & event payload (no password, JWT, or database internal metadata)
    const sanitizedData = {
      ticketId: registration.qrCode,
      registrationId: registration._id,
      studentName: registration.student?.name || 'Student Attendee',
      studentEmail: registration.student?.email || 'N/A',
      studentDepartment: registration.student?.department || 'N/A',
      eventTitle: registration.event?.title || 'Campus Event',
      eventDescription: registration.event?.description || '',
      category: registration.event?.category || 'General',
      startDate: registration.event?.startDate || null,
      endDate: registration.event?.endDate || null,
      startTime: registration.event?.startTime || '',
      endTime: registration.event?.endTime || '',
      venue: registration.event?.venue?.name || registration.event?.location || 'Campus Venue',
      venueLocation: registration.event?.venue?.location || '',
      organizerName: registration.event?.organizer?.name || 'Event Management Team',
      organizerEmail: registration.event?.organizer?.email || '',
      status: registration.status,
      checkedIn: isCheckedIn,
      checkedInAt: registration.checkedInAt || null,
      registeredAt: registration.registeredAt,
      eventId: registration.event?._id || null,
      organizerId: registration.event?.organizer?._id || registration.event?.organizer || null,
      eventStatus: registration.event?.status || 'approved',
      eventCancelled: registration.event?.status === 'cancelled',
      cancellationReason: registration.event?.cancellationReason || '',
    };

    res.status(200).json({
      success: true,
      message: 'Registration verified successfully',
      data: sanitizedData,
    });
  } catch (error) {
    // Return friendly generic error without leaking database internals
    console.error('Verification error:', error.message);
    res.status(400).json({
      success: false,
      message: 'Invalid or unavailable registration.',
    });
  }
};

// @desc    Get registrations for a specific event
// @route   GET /api/events/:id/registrations
// @access  Private (Organizer, Admin)
const getEventRegistrations = async (req, res, next) => {
  try {
    const { id } = req.params;
    const registrations = await Registration.find({ event: id })
      .populate('student', 'name email phone profileImage')
      .sort({ registeredAt: -1 });

    const enriched = await Promise.all(
      registrations.map(async (reg) => {
        const doc = reg.toObject();
        try {
          doc.qrCodeDataUrl = await generateTicketQrDataUrl(reg.qrCode, req);
        } catch (e) {
          doc.qrCodeDataUrl = reg.qrCodeDataUrl || '';
        }
        return doc;
      })
    );

    res.status(200).json({
      success: true,
      message: 'Event registrations retrieved',
      data: enriched,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get registrations for a specific user
// @route   GET /api/users/:id/registrations
// @access  Private (Self or Admin)
const getUserRegistrations = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'admin' && req.user._id.toString() !== id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view these registrations',
      });
    }

    const registrations = await Registration.find({ student: id })
      .populate({
        path: 'event',
        populate: { path: 'venue', select: 'name location' },
      })
      .sort({ registeredAt: -1 });

    const enriched = await Promise.all(
      registrations.map(async (reg) => {
        const doc = reg.toObject();
        try {
          doc.qrCodeDataUrl = await generateTicketQrDataUrl(reg.qrCode, req);
        } catch (e) {
          doc.qrCodeDataUrl = reg.qrCodeDataUrl || '';
        }
        return doc;
      })
    );

    res.status(200).json({
      success: true,
      message: 'User registrations retrieved',
      data: enriched,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRegistration,
  getRegistrations,
  getRegistrationById,
  updateRegistration,
  cancelRegistration,
  checkInAttendee,
  verifyRegistration,
  getBaseAppUrl,
  getLocalIp,
  getEventRegistrations,
  getUserRegistrations,
};
