require('dotenv').config();
const { app, startServer } = require('./server');
const seedData = require('./seeds/seed');
const http = require('http');

let baseUrl = 'http://localhost:5000';
let adminToken = '';
let organizerToken = '';
let studentToken = '';

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

const runAllTests = async () => {
  console.log('🚀 Starting Comprehensive Full-Stack CRUD & Permission Verification Test Suite...');

  let server;
  try {
    server = await startServer();
    await seedData(false);
  } catch (e) {
    console.error('Server startup error:', e);
  }

  // Allow server a moment to settle
  await new Promise((r) => setTimeout(r, 500));

  let passed = 0;
  let failed = 0;

  const assert = (condition, title) => {
    if (condition) {
      console.log(`  ✅ [PASS] ${title}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${title}`);
      failed++;
    }
  };

  try {
    // 1. Healthcheck
    console.log('\n--- 1. API Health Check ---');
    const health = await request('GET', '/api/health');
    assert(health.status === 200 && health.data.success, 'GET /api/health returns 200 healthy');

    // 2. Auth Tests: Login for Admin, Organizer, Student
    console.log('\n--- 2. Authentication & JWT ---');
    const adminLogin = await request('POST', '/api/auth/login', {
      email: 'admin@college.com',
      password: 'Admin@123',
    });
    assert(adminLogin.status === 200 && adminLogin.data.data.token, 'Admin Login successful');
    adminToken = adminLogin.data.data.token;

    const orgLogin = await request('POST', '/api/auth/login', {
      email: 'organizer@college.com',
      password: 'Organizer@123',
    });
    assert(orgLogin.status === 200 && orgLogin.data.data.token, 'Organizer Login successful');
    organizerToken = orgLogin.data.data.token;

    const studLogin = await request('POST', '/api/auth/login', {
      email: 'student@college.com',
      password: 'Student@123',
    });
    assert(studLogin.status === 200 && studLogin.data.data.token, 'Student Login successful');
    studentToken = studLogin.data.data.token;

    // Verify /api/auth/me
    const meRes = await request('GET', '/api/auth/me', null, studentToken);
    assert(meRes.status === 200 && meRes.data.data.role === 'student', 'GET /api/auth/me returns student profile');

    // 3. User CRUD
    console.log('\n--- 3. User CRUD ---');
    const uniqueEmail = `test.user.${Date.now()}@college.com`;
    const createUserRes = await request(
      'POST',
      '/api/users',
      {
        name: 'Automated Test User',
        email: uniqueEmail,
        password: 'Password@123',
        phone: '+14155559999',
        role: 'student',
        interests: ['Workshop', 'Academic'],
      },
      adminToken
    );
    assert(createUserRes.status === 201 && createUserRes.data.success, 'User Create (POST /api/users)');
    const createdUserId = createUserRes.data.data._id;

    const getUserRes = await request('GET', `/api/users/${createdUserId}`, null, adminToken);
    assert(getUserRes.status === 200 && getUserRes.data.data.name === 'Automated Test User', 'User Read (GET /api/users/:id)');

    const updateUserRes = await request(
      'PUT',
      `/api/users/${createdUserId}`,
      { name: 'Automated Test User Updated', phone: '+14155558888' },
      adminToken
    );
    assert(updateUserRes.status === 200 && updateUserRes.data.data.name === 'Automated Test User Updated', 'User Update (PUT /api/users/:id)');

    const deactUserRes = await request('DELETE', `/api/users/${createdUserId}`, null, adminToken);
    assert(deactUserRes.status === 200 && deactUserRes.data.data.isActive === false, 'User Deactivate (DELETE /api/users/:id)');

    // 4. Venue CRUD
    console.log('\n--- 4. Venue CRUD ---');
    const venueName = `Test Concourse ${Date.now()}`;
    const createVenueRes = await request(
      'POST',
      '/api/venues',
      {
        name: venueName,
        location: 'Engineering Quad, Wing C',
        capacity: 250,
        amenities: ['Laser Projector', 'Stage Lighting', 'Audio PA'],
        description: 'New testing auditorium',
      },
      adminToken
    );
    assert(createVenueRes.status === 201 && createVenueRes.data.success, 'Venue Create (POST /api/venues)');
    const testVenueId = createVenueRes.data.data._id;

    const getVenueRes = await request('GET', `/api/venues/${testVenueId}`);
    assert(getVenueRes.status === 200 && getVenueRes.data.data.name === venueName, 'Venue Read (GET /api/venues/:id)');

    const updateVenueRes = await request(
      'PUT',
      `/api/venues/${testVenueId}`,
      { capacity: 300, availability: 'available' },
      adminToken
    );
    assert(updateVenueRes.status === 200 && updateVenueRes.data.data.capacity === 300, 'Venue Update (PUT /api/venues/:id)');

    // 5. Event CRUD & Approval
    console.log('\n--- 5. Event CRUD & Approval ---');
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    const dateStr = futureDate.toISOString().split('T')[0];

    const createEventRes = await request(
      'POST',
      '/api/events',
      {
        title: `Autonomous Rover Hackathon ${Date.now()}`,
        description: 'An intensive competitive collegiate robotics and embedded systems hackathon lasting 6 full hours. Build, program, and pilot micro-rovers across obstacle terrain.',
        category: 'Workshop',
        startDate: dateStr,
        endDate: dateStr,
        startTime: '10:00',
        endTime: '16:00',
        venue: testVenueId,
        capacity: 50,
        budget: 1500,
      },
      organizerToken
    );
    assert(createEventRes.status === 201 && createEventRes.data.success, 'Event Create (POST /api/events)');
    const testEventId = createEventRes.data.data._id;

    const getEventRes = await request('GET', `/api/events/${testEventId}`);
    assert(getEventRes.status === 200 && getEventRes.data.data.title, 'Event Read (GET /api/events/:id)');

    // Admin approve event
    const approveEventRes = await request(
      'PUT',
      `/api/events/${testEventId}/status`,
      { status: 'published' },
      adminToken
    );
    assert(approveEventRes.status === 200 && approveEventRes.data.data.status === 'published', 'Event Approval (PUT /api/events/:id/status)');

    // Update / Reschedule Event
    const updateEventRes = await request(
      'PUT',
      `/api/events/${testEventId}`,
      {
        startTime: '11:00',
        rescheduleReason: 'Speaker delay accommodation',
      },
      organizerToken
    );
    assert(updateEventRes.status === 200 && updateEventRes.data.data.startTime === '11:00', 'Event Update / Reschedule (PUT /api/events/:id)');

    // 6. Registration & QR Check-in CRUD
    console.log('\n--- 6. Registration, QR Code & Check-in CRUD ---');
    const regRes = await request(
      'POST',
      '/api/registrations',
      { eventId: testEventId },
      studentToken
    );
    assert(regRes.status === 201 && regRes.data.data.qrCode, 'Registration Create with QR (POST /api/registrations)');
    const testRegId = regRes.data.data._id;
    const testQrCode = regRes.data.data.qrCode;

    const getRegRes = await request('GET', `/api/registrations/${testRegId}`, null, studentToken);
    assert(getRegRes.status === 200 && getRegRes.data.data.status === 'registered', 'Registration Read (GET /api/registrations/:id)');

    // Rapid QR check-in by QR code token
    const checkInRes = await request(
      'POST',
      '/api/registrations/check-in',
      { qrCode: testQrCode },
      organizerToken
    );
    assert(checkInRes.status === 200 && checkInRes.data.data.status === 'checked-in', 'Rapid QR Check-in (POST /api/registrations/check-in)');

    // 7. Feedback CRUD & Organizer Response
    console.log('\n--- 7. Feedback CRUD ---');
    const feedbackRes = await request(
      'POST',
      '/api/feedback',
      {
        eventId: testEventId,
        rating: 5,
        qualityRating: 5,
        organizationRating: 4,
        venueRating: 5,
        contentRelevanceRating: 5,
        overallValueRating: 5,
        comment: 'Outstanding robotics hackathon! Hands-on labs were engaging and mentors were supportive.',
      },
      studentToken
    );
    assert(feedbackRes.status === 201 && feedbackRes.data.success, 'Feedback Create (POST /api/feedback)');
    const testFeedbackId = feedbackRes.data.data._id;

    const getFeedbackRes = await request('GET', `/api/feedback?event=${testEventId}`);
    assert(getFeedbackRes.status === 200 && getFeedbackRes.data.data.feedbacks.length > 0, 'Feedback Read (GET /api/feedback)');

    // Organizer response to feedback
    const respondFeedbackRes = await request(
      'PUT',
      `/api/feedback/${testFeedbackId}/respond`,
      { organizerResponse: 'Thank you for your review! We look forward to seeing you at our next coding sprint.' },
      organizerToken
    );
    assert(respondFeedbackRes.status === 200 && respondFeedbackRes.data.data.organizerResponse, 'Feedback Organizer Response (PUT /api/feedback/:id/respond)');

    // 8. Notifications CRUD
    console.log('\n--- 8. Notifications CRUD ---');
    const getNotifRes = await request('GET', '/api/notifications', null, studentToken);
    assert(getNotifRes.status === 200 && getNotifRes.data.success, 'Notification Read (GET /api/notifications)');

    const markAllReadRes = await request('PUT', '/api/notifications/read-all', {}, studentToken);
    assert(markAllReadRes.status === 200, 'Notification Mark Read (PUT /api/notifications/read-all)');

    // 9. Platform Suggestions
    console.log('\n--- 9. Platform Suggestions ---');
    const createSugRes = await request(
      'POST',
      '/api/suggestions',
      {
        title: 'Add ICS Calendar Download Button',
        description: 'Provide a direct .ics file download for all confirmed registrations.',
        type: 'feature',
      },
      studentToken
    );
    assert(createSugRes.status === 201 && createSugRes.data.success, 'Suggestion Create (POST /api/suggestions)');
    const testSugId = createSugRes.data.data._id;

    const updateSugRes = await request(
      'PUT',
      `/api/suggestions/${testSugId}`,
      { status: 'planned', adminNotes: 'Approved for Q3 roadmap.' },
      adminToken
    );
    assert(updateSugRes.status === 200 && updateSugRes.data.data.status === 'planned', 'Suggestion Admin Status Update (PUT /api/suggestions/:id)');

    // 10. Role Security Enforcement
    console.log('\n--- 10. Role Security & Authorization Verification ---');
    // Student trying to access Admin API
    const studentBlockedFromAdmin = await request('GET', '/api/reports/admin-overview', null, studentToken);
    assert(studentBlockedFromAdmin.status === 403, 'Security: Student forbidden from Admin API (403)');

    // Student trying to create an event
    const studentBlockedFromCreateEvent = await request('POST', '/api/events', { title: 'Unauthorized Event' }, studentToken);
    assert(studentBlockedFromCreateEvent.status === 403, 'Security: Student forbidden from Event Creation (403)');

    // Clean up soft-delete / cancel event
    const archiveEventRes = await request('DELETE', `/api/events/${testEventId}`, null, organizerToken);
    assert(archiveEventRes.status === 200 && (archiveEventRes.data.data.status === 'cancelled' || archiveEventRes.data.data.status === 'archived'), 'Event Soft Delete / Cancel (DELETE /api/events/:id)');

    console.log('\n====================================================');
    console.log(`🎯 TEST SUITE COMPLETE: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution exception:', err);
    process.exit(1);
  }
};

runAllTests();
