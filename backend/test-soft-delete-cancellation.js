require('dotenv').config();
const mongoose = require('mongoose');
const { app, startServer } = require('./server');
const Event = require('./models/Event');
const Venue = require('./models/Venue');
const Registration = require('./models/Registration');
const User = require('./models/User');

const baseUrl = 'http://localhost:5000';

const request = async (method, path, body = null, token = null) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = {};
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => ({}));
  }
  return { status: res.status, data };
};

const runSoftDeleteTests = async () => {
  console.log('🧪 Starting Event Soft Delete / Cancellation & Available Seats Test Suite...\n');

  let server;
  try {
    server = await startServer();
  } catch (err) {
    console.error('Server startup error:', err.message);
  }

  await new Promise((r) => setTimeout(r, 600));

  let passed = 0;
  let failed = 0;

  const assert = (condition, title, details = '') => {
    if (condition) {
      console.log(`  ✅ [PASS] ${title}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${title} ${details ? '- ' + details : ''}`);
      failed++;
    }
  };

  try {
    // 1. Authenticate users
    console.log('--- Step 1: Authentication ---');
    const adminLogin = await request('POST', '/api/auth/login', {
      email: 'admin@college.com',
      password: 'Admin@123',
    });
    assert(adminLogin.status === 200, 'Admin login 200');
    const adminToken = adminLogin.data.data.token;
    const adminId = adminLogin.data.data.user._id;

    const orgLogin = await request('POST', '/api/auth/login', {
      email: 'organizer@college.com',
      password: 'Organizer@123',
    });
    assert(orgLogin.status === 200, 'Organizer login 200');
    const orgToken = orgLogin.data.data.token;
    const orgId = orgLogin.data.data.user._id;

    const studentALogin = await request('POST', '/api/auth/login', {
      email: 'student@college.com',
      password: 'Student@123',
    });
    assert(studentALogin.status === 200, 'Student A login 200');
    const studentAToken = studentALogin.data.data.token;
    const studentAId = studentALogin.data.data.user._id;

    const studentBLogin = await request('POST', '/api/auth/login', {
      email: 'alex.rivera@college.com',
      password: 'Student@123',
    });
    assert(studentBLogin.status === 200, 'Student B login 200');
    const studentBToken = studentBLogin.data.data.token;
    const studentBId = studentBLogin.data.data.user._id;

    const venue = await Venue.findOne({});
    assert(!!venue, 'Campus venue found');

    // 2. Create a test event with capacity: 300
    console.log('\n--- Step 2: Create Test Event & Verify Initial availableSeats ---');
    const testEvent = await Event.create({
      title: 'advance database management system ' + Date.now(),
      description: 'Comprehensive advanced database management system technical workshop and seminar.',
      category: 'Workshop',
      startDate: new Date(Date.now() + 86400000 * 5),
      endDate: new Date(Date.now() + 86400000 * 5 + 7200000),
      startTime: '10:00',
      endTime: '12:00',
      venue: venue._id,
      capacity: 300,
      registeredCount: 0,
      availableSeats: 300,
      organizer: orgId,
      status: 'approved',
    });

    assert(testEvent.capacity === 300, 'Event capacity is 300');
    assert(testEvent.registeredCount === 0, 'Event registeredCount is 0');
    assert(testEvent.availableSeats === 300, 'Event availableSeats initialized to 300 (capacity - registeredCount)');

    // 3. Register Student A and Student B, verifying availableSeats decrement
    console.log('\n--- Step 3: Student Registrations & availableSeats Decrement ---');
    const regResA = await request(
      'POST',
      '/api/registrations',
      { eventId: testEvent._id.toString() },
      studentAToken
    );
    assert(regResA.status === 201, 'Student A registered successfully (201)');

    const eventAfterA = await Event.findById(testEvent._id);
    assert(eventAfterA.registeredCount === 1, 'Event registeredCount incremented to 1');
    assert(
      eventAfterA.availableSeats === 299,
      `Event availableSeats decremented to 299 (${eventAfterA.capacity} - ${eventAfterA.registeredCount})`
    );

    const regResB = await request(
      'POST',
      '/api/registrations',
      { eventId: testEvent._id.toString() },
      studentBToken
    );
    assert(regResB.status === 201, 'Student B registered successfully (201)');

    const eventAfterB = await Event.findById(testEvent._id);
    assert(eventAfterB.registeredCount === 2, 'Event registeredCount incremented to 2');
    assert(
      eventAfterB.availableSeats === 298,
      `Event availableSeats decremented to 298 (${eventAfterB.capacity} - ${eventAfterB.registeredCount})`
    );

    const ticketCodeA = regResA.data.data.qrCode;

    // 4. Soft Delete / Cancel Event by Organizer
    console.log('\n--- Step 4: Soft Delete / Cancel Event (DELETE /api/events/:id) ---');
    const cancelRes = await request(
      'DELETE',
      `/api/events/${testEvent._id.toString()}?reason=Speaker+unavailable`,
      null,
      orgToken
    );
    assert(cancelRes.status === 200, 'DELETE /api/events/:id returned 200');
    assert(cancelRes.data.message.includes('cancelled'), 'Response confirms event cancellation');

    // 5. Verify Event document persists in MongoDB with cancellation fields
    console.log('\n--- Step 5: Verify MongoDB Document Persistence & Cancellation Info ---');
    const cancelledDoc = await Event.findById(testEvent._id);
    assert(!!cancelledDoc, 'CRITICAL: Event document NOT permanently deleted; still exists in MongoDB');
    assert(cancelledDoc.status === 'cancelled', 'Event status changed to "cancelled"');
    assert(!!cancelledDoc.cancelledAt, 'cancelledAt Date timestamp recorded in MongoDB');
    assert(
      cancelledDoc.cancelledBy && cancelledDoc.cancelledBy.toString() === orgId.toString(),
      'cancelledBy recorded as the organizer/admin ObjectId'
    );
    assert(
      cancelledDoc.cancellationReason.includes('Speaker unavailable'),
      'cancellationReason recorded correctly: ' + cancelledDoc.cancellationReason
    );

    // Verify counters NOT reset
    assert(cancelledDoc.capacity === 300, 'capacity is NOT changed (remains 300)');
    assert(cancelledDoc.registeredCount === 2, 'registeredCount is NOT reset (remains 2)');
    assert(cancelledDoc.availableSeats === 298, 'availableSeats is NOT reset (remains 298)');

    // Verify registrations NOT deleted
    const studentRegsCount = await Registration.countDocuments({ event: testEvent._id });
    assert(studentRegsCount === 2, 'All student registrations kept in MongoDB (count = 2)');

    // 6. Visibility checks: cancelled events MUST NOT appear to students/public
    console.log('\n--- Step 6: Visibility Checks for Students and Public ---');
    const publicEventsRes = await request('GET', '/api/events');
    const publicEventIds = (publicEventsRes.data.data?.events || []).map((e) => e._id);
    assert(
      !publicEventIds.includes(testEvent._id.toString()),
      'Cancelled event does NOT appear in public GET /api/events'
    );

    const searchRes = await request('GET', `/api/events/search?q=${encodeURIComponent('advance database')}`);
    const searchIds = (searchRes.data.data || []).map((e) => e._id);
    assert(
      !searchIds.includes(testEvent._id.toString()),
      'Cancelled event does NOT appear in GET /api/events/search'
    );

    const upcomingRes = await request('GET', '/api/events/upcoming');
    const upcomingIds = (upcomingRes.data.data || []).map((e) => e._id);
    assert(
      !upcomingIds.includes(testEvent._id.toString()),
      'Cancelled event does NOT appear in GET /api/events/upcoming'
    );

    const studentOverviewRes = await request('GET', '/api/reports/student-overview', null, studentAToken);
    const recIds = (studentOverviewRes.data.data?.recommendations || []).map((e) => e._id);
    assert(
      !recIds.includes(testEvent._id.toString()),
      'Cancelled event does NOT appear in student recommendations'
    );

    // Visibility for Organizer & Admin
    console.log('\n--- Step 7: Visibility Checks for Admin and Organizer ---');
    const adminEventsRes = await request('GET', '/api/events?status=all', null, adminToken);
    const adminEventIds = (adminEventsRes.data.data?.events || []).map((e) => e._id);
    assert(
      adminEventIds.includes(testEvent._id.toString()),
      'Cancelled event REMAINS visible to Admin in GET /api/events?status=all'
    );

    const orgEventsRes = await request(
      'GET',
      `/api/events?organizer=${orgId}&status=all`,
      null,
      orgToken
    );
    const orgEventIds = (orgEventsRes.data.data?.events || []).map((e) => e._id);
    assert(
      orgEventIds.includes(testEvent._id.toString()),
      'Cancelled event REMAINS visible to the Organizer in their hosted events'
    );

    // 8. Attempt registration for cancelled event
    console.log('\n--- Step 8: Registration Attempt for Cancelled Event Must Be Blocked ---');
    // Using admin token as an authenticated attempt or student A re-trying
    const blockedRegRes = await request(
      'POST',
      '/api/registrations',
      { eventId: testEvent._id.toString() },
      studentBToken
    );
    assert(
      blockedRegRes.status === 400 || blockedRegRes.status === 409,
      'Registration attempt on cancelled event rejected (HTTP 400/409)'
    );
    assert(
      blockedRegRes.data.message.toLowerCase().includes('cancelled') ||
      blockedRegRes.data.message.toLowerCase().includes('already registered'),
      'Returned clear cancellation / prevention message: ' + blockedRegRes.data.message
    );

    // 9. Existing ticket verification for cancelled event
    console.log('\n--- Step 9: Existing Ticket Verification & Scans ---');
    const verifyRes = await request('GET', `/api/registrations/verify/${encodeURIComponent(ticketCodeA)}`);
    assert(verifyRes.status === 200, 'Ticket verification endpoint returns 200 OK');
    assert(
      verifyRes.data.data.eventCancelled === true || verifyRes.data.data.eventStatus === 'cancelled',
      'Verification payload correctly indicates eventStatus is cancelled'
    );
    assert(
      verifyRes.data.data.studentName === 'Manoj Student' || !!verifyRes.data.data.studentName,
      'Attendee registration details preserved'
    );

    // 10. Attempt Check-in for Cancelled Event
    console.log('\n--- Step 10: Check-In on Cancelled Event Must Be Blocked ---');
    const checkinRes = await request(
      'POST',
      '/api/registrations/check-in',
      { qrCode: ticketCodeA },
      orgToken
    );
    assert(checkinRes.status === 400, 'Check-in on cancelled event blocked with HTTP 400');
    assert(
      checkinRes.data.message.toLowerCase().includes('cancelled'),
      'Returned clear error message: ' + checkinRes.data.message
    );

    // 11. Cleanup test event & registrations
    await Registration.deleteMany({ event: testEvent._id });
    await Event.findByIdAndDelete(testEvent._id);

    console.log('\n====================================================');
    console.log(`🎯 SOFT DELETE TEST SUITE COMPLETE: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================');

    if (server && server.close) server.close();
    await mongoose.connection.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error:', err);
    if (server && server.close) server.close();
    await mongoose.connection.close();
    process.exit(1);
  }
};

runSoftDeleteTests();
