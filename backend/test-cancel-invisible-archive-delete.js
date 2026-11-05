/**
 * Automated Test Suite: Cancel (Soft Delete & Invisible) vs Archive (Permanent Delete)
 *
 * Verifies:
 * 1. When an event is cancelled:
 *    - Status is changed to "cancelled"
 *    - Kept in MongoDB with cancellation fields (soft delete)
 *    - It is NOT visible on public / student events lists
 *    - It is NOT visible in event search
 *    - It is NOT visible in upcoming events
 *    - It is NOT visible on default organizer / catalog listings
 * 2. When an event is archived:
 *    - It gets DELETED from MongoDB (findByIdAndDelete)
 *    - Document no longer exists in MongoDB
 *    - Associated registrations are deleted
 *    - Querying the event ID returns 404 Not Found
 */

const http = require('http');
const mongoose = require('mongoose');
const User = require('./models/User');
const Event = require('./models/Event');
const Venue = require('./models/Venue');
const Registration = require('./models/Registration');
const { startServer } = require('./server');

const BASE_URL = 'http://localhost:5000';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      url,
      { method, headers },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

async function runTests() {
  console.log('🧪 Starting Cancel (Invisible) vs Archive (Delete) Test Suite...\n');

  try {
    await startServer();
    await new Promise((r) => setTimeout(r, 600));

    const ts = Date.now();

    // 1. Authenticate users
    console.log('--- Step 1: Authentication ---');
    const adminLogin = await request('POST', '/api/auth/login', {
      email: 'admin@college.com',
      password: 'Admin@123',
    });
    const adminToken = adminLogin.data.data.token;
    assert(adminLogin.status === 200, 'Admin authenticated');

    const orgLogin = await request('POST', '/api/auth/login', {
      email: 'organizer@college.com',
      password: 'Organizer@123',
    });
    const orgToken = orgLogin.data.data.token;
    const orgId = orgLogin.data.data.user._id;
    assert(orgLogin.status === 200, 'Organizer authenticated');

    const studentLogin = await request('POST', '/api/auth/login', {
      email: 'student@college.com',
      password: 'Student@123',
    });
    const studentToken = studentLogin.data.data.token;
    assert(studentLogin.status === 200, 'Student authenticated');

    const venue = await Venue.findOne({ status: 'active' });
    assert(!!venue, 'Active campus venue found');

    // 2. Create Event 1 (To Test Cancellation & Invisibility)
    console.log('\n--- Step 2: Create Test Event 1 (For Cancellation & Invisibility) ---');
    const event1Title = `Special Robotics Symposium ${ts}`;
    const event1Res = await request(
      'POST',
      '/api/events',
      {
        title: event1Title,
        description:
          'Deep dive into modern autonomous robotics, computer vision, kinematics, sensor fusion, and micro-controller design.',
        category: 'Workshop',
        startDate: new Date(Date.now() + 86400000 * 20).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 21).toISOString(),
        startTime: '10:00',
        endTime: '12:00',
        venue: venue._id.toString(),
        capacity: 100,
        budget: 500,
      },
      orgToken
    );
    assert(event1Res.status === 201, 'Test Event 1 created (status: pending)');
    const event1Id = event1Res.data.data._id;

    // Approve Event 1
    const approveRes = await request('PUT', `/api/events/${event1Id}/status`, { status: 'approved' }, adminToken);
    assert(approveRes.status === 200, 'Event 1 approved and published');

    // Register student for Event 1
    const regRes = await request('POST', '/api/registrations', { eventId: event1Id }, studentToken);
    assert(regRes.status === 201, 'Student registered for Event 1');

    // 3. Cancel Event 1 (Soft Delete)
    console.log('\n--- Step 3: Cancel Event 1 (Must be soft deleted & kept in DB) ---');
    const cancelRes = await request(
      'DELETE',
      `/api/events/${event1Id}?action=cancel&reason=Lab+renovation+work`,
      null,
      orgToken
    );
    assert(cancelRes.status === 200, 'Cancel request returned 200');
    assert(cancelRes.data.message.includes('cancelled'), 'Response confirms event cancellation');

    // Check DB document persistence
    const doc1 = await Event.findById(event1Id);
    assert(!!doc1, 'Event 1 still exists in MongoDB (NOT deleted)');
    assert(doc1.status === 'cancelled', 'Event 1 status is "cancelled"');
    assert(!!doc1.cancelledAt, 'Event 1 has cancelledAt date');
    assert(doc1.cancellationReason === 'Lab renovation work', 'Event 1 has cancellationReason stored');
    assert(doc1.registeredCount === 1, 'Event 1 registeredCount preserved (1)');
    assert(doc1.availableSeats === 99, 'Event 1 availableSeats preserved (99)');

    const reg1Doc = await Registration.findOne({ event: event1Id });
    assert(!!reg1Doc, 'Student registration kept in MongoDB');

    // 4. Invisibility Verification for Cancelled Event
    console.log('\n--- Step 4: Invisibility Checks for Cancelled Event ---');
    // A. Public catalog
    const publicCatalogRes = await request('GET', '/api/events');
    const catalogEventIds = (publicCatalogRes.data.data?.events || []).map((e) => e._id);
    assert(!catalogEventIds.includes(event1Id), 'Cancelled event is NOT visible in public GET /api/events');

    // B. Search
    const searchRes = await request('GET', `/api/events/search?q=${encodeURIComponent(event1Title)}`);
    const searchEventIds = (searchRes.data.data || []).map((e) => e._id);
    assert(!searchEventIds.includes(event1Id), 'Cancelled event is NOT visible in GET /api/events/search');

    // C. Upcoming
    const upcomingRes = await request('GET', '/api/events/upcoming');
    const upcomingEventIds = (upcomingRes.data.data || []).map((e) => e._id);
    assert(!upcomingEventIds.includes(event1Id), 'Cancelled event is NOT visible in GET /api/events/upcoming');

    // D. Default catalog view when organizer queries
    const orgCatalogRes = await request('GET', '/api/events', null, orgToken);
    const orgCatalogIds = (orgCatalogRes.data.data?.events || []).map((e) => e._id);
    assert(!orgCatalogIds.includes(event1Id), 'Cancelled event is NOT visible to organizer browsing general catalog');

    // 5. Create Event 2 (To Test Archive -> Permanent Delete)
    console.log('\n--- Step 5: Create Test Event 2 (For Archive & Permanent Deletion) ---');
    const event2Title = `Temporary Hackathon Showcase ${ts}`;
    const event2Res = await request(
      'POST',
      '/api/events',
      {
        title: event2Title,
        description:
          'A short prototype demonstration hackathon showcase focusing on rapid web tooling, generative AI, and real-time sockets.',
        category: 'Workshop',
        startDate: new Date(Date.now() + 86400000 * 25).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 26).toISOString(),
        startTime: '13:00',
        endTime: '15:00',
        venue: venue._id.toString(),
        capacity: 50,
        budget: 200,
      },
      orgToken
    );
    assert(event2Res.status === 201, 'Test Event 2 created');
    const event2Id = event2Res.data.data._id;

    // Approve Event 2
    await request('PUT', `/api/events/${event2Id}/status`, { status: 'approved' }, adminToken);

    // Register student for Event 2
    const reg2Res = await request('POST', '/api/registrations', { eventId: event2Id }, studentToken);
    assert(reg2Res.status === 201, 'Student registered for Event 2');

    // Verify Event 2 exists in MongoDB before archive
    const doc2Before = await Event.findById(event2Id);
    assert(!!doc2Before, 'Event 2 exists in MongoDB before archive');

    // 6. Archive Event 2 via DELETE with action=archive
    console.log('\n--- Step 6: Archive Event 2 (Must be PERMANENTLY DELETED from MongoDB) ---');
    const archiveRes = await request(
      'DELETE',
      `/api/events/${event2Id}?action=archive`,
      null,
      orgToken
    );
    assert(archiveRes.status === 200, 'Archive request returned 200 OK');
    assert(archiveRes.data.message.includes('archived and deleted'), 'Response confirms event was archived and deleted');

    // Verify Event 2 is completely removed from MongoDB
    const doc2After = await Event.findById(event2Id);
    assert(doc2After === null, 'CRITICAL: Event 2 document DELETED from MongoDB (Event.findById is null)');

    // Verify associated registrations deleted
    const reg2After = await Registration.find({ event: event2Id });
    assert(reg2After.length === 0, 'Associated registrations for Event 2 deleted from MongoDB');

    // Verify GET /api/events/:id returns 404
    const getDeletedRes = await request('GET', `/api/events/${event2Id}`);
    assert(getDeletedRes.status === 404, 'GET /api/events/:id on archived event returns 404 Not Found');

    // 7. Create Event 3 and Test Admin Archive Status Update
    console.log('\n--- Step 7: Test Admin Status Update to "archived" (Must Delete from MongoDB) ---');
    const event3Title = `Quantum Computing Overview Seminar ${ts}`;
    const event3Res = await request(
      'POST',
      '/api/events',
      {
        title: event3Title,
        description:
          'Exploration of qubit state representation, quantum gates, superposition, and Shor algorithm principles for undergraduates.',
        category: 'Seminar',
        startDate: new Date(Date.now() + 86400000 * 30).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 31).toISOString(),
        startTime: '16:00',
        endTime: '18:00',
        venue: venue._id.toString(),
        capacity: 40,
        budget: 100,
      },
      orgToken
    );
    assert(event3Res.status === 201, 'Test Event 3 created');
    const event3Id = event3Res.data.data._id;

    // Admin sets status to 'archived'
    const adminArchiveRes = await request(
      'PUT',
      `/api/events/${event3Id}/status`,
      { status: 'archived' },
      adminToken
    );
    assert(adminArchiveRes.status === 200, 'Admin status update to "archived" returns 200');
    assert(adminArchiveRes.data.message.includes('archived and deleted'), 'Response confirms archived and deleted');

    // Verify Event 3 is completely removed from MongoDB
    const doc3After = await Event.findById(event3Id);
    assert(doc3After === null, 'CRITICAL: Event 3 document DELETED from MongoDB via status: "archived"');

    // 8. Clean up Event 1 via Archive (Delete)
    console.log('\n--- Step 8: Clean up Cancelled Event 1 by Archiving It ---');
    const cleanArchiveRes = await request(
      'DELETE',
      `/api/events/${event1Id}?action=archive`,
      null,
      adminToken
    );
    assert(cleanArchiveRes.status === 200, 'Archiving cancelled Event 1 returns 200');
    const doc1Final = await Event.findById(event1Id);
    assert(doc1Final === null, 'Cancelled Event 1 successfully deleted from MongoDB upon archiving');

    console.log('\n====================================================');
    console.log(`🎯 CANCEL & ARCHIVE TEST SUITE: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================');

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Test execution error:', error);
    process.exit(1);
  }
}

runTests();
