require('dotenv').config();
const mongoose = require('mongoose');
const { app, startServer } = require('./server');
const Event = require('./models/Event');
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

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

const runFlowTest = async () => {
  console.log('🧪 Starting Registered Count & QR Registration Flow Test Suite...\n');

  let server;
  try {
    server = await startServer();
  } catch (err) {
    console.error('Server startup error:', err);
  }

  await new Promise((r) => setTimeout(r, 800));

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
    const studentALogin = await request('POST', '/api/auth/login', {
      email: 'student@college.com',
      password: 'Student@123',
    });
    assert(studentALogin.status === 200 && studentALogin.data.data?.token, 'Student A authenticated successfully');
    const studentAToken = studentALogin.data.data.token;
    const studentAId = studentALogin.data.data.user._id;

    const studentBLogin = await request('POST', '/api/auth/login', {
      email: 'alex.rivera@college.com',
      password: 'Student@123',
    });
    assert(studentBLogin.status === 200 && studentBLogin.data.data?.token, 'Student B authenticated successfully');
    const studentBToken = studentBLogin.data.data.token;
    const studentBId = studentBLogin.data.data.user._id;

    const adminLogin = await request('POST', '/api/auth/login', {
      email: 'admin@college.com',
      password: 'Admin@123',
    });
    assert(adminLogin.status === 200 && adminLogin.data.data?.token, 'Admin authenticated successfully');
    const adminToken = adminLogin.data.data.token;

    // 2. Prepare an approved event with 0 registrations for clean testing
    console.log('\n--- Step 2: Prepare Approved Test Event ---');
    let testEvent = await Event.findOne({
      status: { $in: ['approved', 'published'] },
      capacity: { $gte: 10 },
    });

    if (!testEvent) {
      const organizer = await User.findOne({ role: 'organizer' });
      testEvent = await Event.create({
        title: 'Test Engineering Symposium ' + Date.now(),
        description: 'Testing registration count flow',
        category: 'Technical',
        organizer: organizer ? organizer._id : studentAId,
        startDate: new Date(Date.now() + 86400000 * 7),
        endDate: new Date(Date.now() + 86400000 * 7 + 3600000 * 4),
        capacity: 100,
        registeredCount: 0,
        attendedCount: 0,
        status: 'approved',
      });
    }

    // Clean any prior registrations for this event by these students
    await Registration.deleteMany({
      event: testEvent._id,
      student: { $in: [studentAId, studentBId] },
    });

    // Reset counts to clean state
    const currentActiveRegs = await Registration.countDocuments({
      event: testEvent._id,
      status: { $in: ['registered', 'checked-in'] },
    });
    await Event.findByIdAndUpdate(testEvent._id, {
      registeredCount: currentActiveRegs,
      attendedCount: 0,
    });

    testEvent = await Event.findById(testEvent._id);
    const initialRegisteredCount = testEvent.registeredCount;
    const initialAttendedCount = testEvent.attendedCount;
    console.log(`  Initial Event: "${testEvent.title}" (ID: ${testEvent._id})`);
    console.log(`  Initial registeredCount: ${initialRegisteredCount}, attendedCount: ${initialAttendedCount}`);

    // 3. Register Student A
    console.log('\n--- Step 3: Register Student A for Approved Event ---');
    const regResA = await request(
      'POST',
      '/api/registrations',
      { eventId: testEvent._id.toString() },
      studentAToken
    );
    assert(regResA.status === 201 && regResA.data.success, 'Registration request succeeded with 201 Created');
    assert(regResA.data.message === 'Registration Successful', 'Response message is "Registration Successful"');
    assert(!!regResA.data.data.qrCode, 'Ticket unique QR code generated', regResA.data.data.qrCode);
    assert(typeof regResA.data.data.qrCodeDataUrl === 'string' && regResA.data.data.qrCodeDataUrl.startsWith('data:image/png;base64,'), 'QR data URL is a valid image base64');

    // 4. Check MongoDB directly after Student A registration
    console.log('\n--- Step 4: Verify MongoDB state after Student A registration ---');
    const regDocA = await Registration.findOne({
      student: studentAId,
      event: testEvent._id,
    });
    assert(!!regDocA, 'Registration document for Student A exists in MongoDB');
    assert(regDocA.status === 'registered', 'Registration status in MongoDB is "registered"');
    assert(regDocA.qrCode === regResA.data.data.qrCode, 'Ticket code in DB matches API response');

    const eventAfterA = await Event.findById(testEvent._id);
    assert(
      eventAfterA.registeredCount === initialRegisteredCount + 1,
      `Event.registeredCount increased by exactly 1 (${initialRegisteredCount} -> ${eventAfterA.registeredCount})`
    );
    assert(
      eventAfterA.attendedCount === initialAttendedCount,
      `Event.attendedCount remained unchanged at ${initialAttendedCount}`
    );

    // 5. Duplicate Registration Check for Student A
    console.log('\n--- Step 5: Duplicate Registration Attempt by Student A ---');
    const dupResA = await request(
      'POST',
      '/api/registrations',
      { eventId: testEvent._id.toString() },
      studentAToken
    );
    assert(dupResA.status === 409 && !dupResA.data.success, 'Duplicate registration returns 409 Conflict');
    assert(
      dupResA.data.message.includes('already registered'),
      'Clear duplicate registration message returned',
      dupResA.data.message
    );

    const totalRegsForA = await Registration.countDocuments({
      student: studentAId,
      event: testEvent._id,
    });
    assert(totalRegsForA === 1, 'Still exactly 1 registration document in MongoDB for Student A');

    const eventAfterDup = await Event.findById(testEvent._id);
    assert(
      eventAfterDup.registeredCount === initialRegisteredCount + 1,
      `Event.registeredCount did NOT increase on duplicate attempt (remains ${eventAfterDup.registeredCount})`
    );

    // 6. Register Student B
    console.log('\n--- Step 6: Register Student B for Same Event ---');
    const regResB = await request(
      'POST',
      '/api/registrations',
      { eventId: testEvent._id.toString() },
      studentBToken
    );
    assert(regResB.status === 201 && regResB.data.success, 'Student B registration succeeded with 201');

    const regDocB = await Registration.findOne({
      student: studentBId,
      event: testEvent._id,
    });
    assert(!!regDocB, 'Registration document for Student B exists in MongoDB');

    const eventAfterB = await Event.findById(testEvent._id);
    assert(
      eventAfterB.registeredCount === initialRegisteredCount + 2,
      `Event.registeredCount increased to ${eventAfterB.registeredCount} (now registeredCount: 2)`
    );

    // 7. QR Verification Scans (Read-Only)
    console.log('\n--- Step 7: QR Code Verification / Scans must NOT alter registeredCount ---');
    const ticketCodeA = regResA.data.data.qrCode;
    const verifyValid = await request('GET', `/api/registrations/verify/${encodeURIComponent(ticketCodeA)}`);
    assert(verifyValid.status === 200 && verifyValid.data.success, 'Valid QR verification returns 200');
    assert(
      verifyValid.data.data.studentName === 'Manoj Student' || !!verifyValid.data.data.studentName,
      'Sanitized attendee name present: ' + verifyValid.data.data.studentName
    );

    const verifyInvalid = await request('GET', '/api/registrations/verify/INVALID-QR-CODE-123');
    assert(verifyInvalid.status === 404, 'Invalid QR verification returns 404');

    const eventAfterScans = await Event.findById(testEvent._id);
    assert(
      eventAfterScans.registeredCount === initialRegisteredCount + 2,
      `Event.registeredCount remained unchanged after QR scans (${eventAfterScans.registeredCount})`
    );

    // 8. Capacity Limit Enforcement
    console.log('\n--- Step 8: Capacity Limit Check ("Event is full") ---');
    const organizerUser = await User.findOne({ role: 'organizer' });
    const Venue = require('./models/Venue');
    const venueDoc = await Venue.findOne();
    const fullTestEvent = await Event.create({
      title: 'Full Capacity Workshop ' + Date.now(),
      description: 'A comprehensive hands-on workshop designed to test strictly enforced capacity limits.',
      category: 'Workshop',
      organizer: organizerUser ? organizerUser._id : studentAId,
      venue: venueDoc ? venueDoc._id : testEvent.venue,
      startTime: '10:00',
      endTime: '12:00',
      startDate: new Date(Date.now() + 86400000 * 5),
      endDate: new Date(Date.now() + 86400000 * 5 + 3600000 * 2),
      capacity: 1, // Only 1 seat
      registeredCount: 0,
      attendedCount: 0,
      status: 'approved',
    });

    // Student A registers for the 1 available seat
    const regSeat1 = await request(
      'POST',
      '/api/registrations',
      { eventId: fullTestEvent._id.toString() },
      studentAToken
    );
    assert(regSeat1.status === 201, 'Student A claimed the 1 seat');

    const eventFullDoc = await Event.findById(fullTestEvent._id);
    assert(eventFullDoc.registeredCount === 1, 'Event registeredCount is now 1 (at capacity 1)');

    // Student B tries to register when capacity reached
    const regSeat2 = await request(
      'POST',
      '/api/registrations',
      { eventId: fullTestEvent._id.toString() },
      studentBToken
    );
    assert(regSeat2.status === 400 && !regSeat2.data.success, 'Student B registration rejected with 400');
    assert(
      regSeat2.data.message.toLowerCase().includes('event is full') ||
      regSeat2.data.message.toLowerCase().includes('full'),
      'Returned clear "Event is full" message',
      regSeat2.data.message
    );

    const eventAfterFullAttempt = await Event.findById(fullTestEvent._id);
    assert(
      eventAfterFullAttempt.registeredCount === 1,
      'Event registeredCount remains strictly 1 after full capacity rejection'
    );
    const studentBFullReg = await Registration.findOne({
      student: studentBId,
      event: fullTestEvent._id,
    });
    assert(studentBFullReg === null, 'No registration document created for rejected registration');

    // Clean up temporary capacity test event
    await Registration.deleteMany({ event: fullTestEvent._id });
    await Event.findByIdAndDelete(fullTestEvent._id);

    // 9. Organizer / Admin Check-In verifies attendedCount increases, registeredCount unchanged
    console.log('\n--- Step 9: Check-in Increases attendedCount ONLY ---');
    const checkInRes = await request(
      'POST',
      '/api/registrations/check-in',
      { qrCode: ticketCodeA },
      adminToken
    );
    assert(checkInRes.status === 200 && checkInRes.data.success, 'Check-in succeeded with 200');

    const eventAfterCheckIn = await Event.findById(testEvent._id);
    assert(
      eventAfterCheckIn.attendedCount === initialAttendedCount + 1,
      `Event.attendedCount increased by 1 (${initialAttendedCount} -> ${eventAfterCheckIn.attendedCount})`
    );
    assert(
      eventAfterCheckIn.registeredCount === initialRegisteredCount + 2,
      `Event.registeredCount remains strictly unchanged at ${eventAfterCheckIn.registeredCount}`
    );

    console.log('\n========================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================');

    if (server && server.close) {
      server.close();
    }
    await mongoose.connection.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Fatal error during test execution:', error);
    if (server && server.close) server.close();
    await mongoose.connection.close();
    process.exit(1);
  }
};

runFlowTest();
