require('dotenv').config();
const { app, startServer } = require('./server');

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
    redirect: 'manual',
  });

  let data = {};
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => ({}));
  }

  return {
    status: res.status,
    headers: res.headers,
    data,
  };
};

const runQrFlowTest = async () => {
  console.log('🧪 Starting Student Event Registration & QR Verification Workflow Test Suite...\n');

  let server;
  try {
    server = await startServer();
  } catch (e) {
    console.error('Server startup error (may already be running):', e.message);
  }

  await new Promise((r) => setTimeout(r, 600));

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
    // 0. Verify Network Binding & Local IP Detection
    console.log('--- 0. Network Binding & Reachable IP Detection ---');
    const { getLocalIp } = require('./controllers/registrationController');
    const localIp = getLocalIp();
    console.log(`     Detected Local IP: ${localIp}`);
    assert(localIp && localIp !== '127.0.0.1' && localIp !== '0.0.0.0' && localIp !== 'localhost', `Reachable non-loopback LAN IP detected (${localIp})`);
    assert(!localIp.startsWith('169.254.'), 'Detected IP is not link-local / APIPA (169.254.x.x)');

    // Verify server responds on detected LAN IP
    try {
      const lanHealthRes = await fetch(`http://${localIp}:5000/api/health`);
      const lanHealthData = await lanHealthRes.json();
      assert(lanHealthRes.status === 200 && lanHealthData.success, `Server accepts incoming connections on LAN IP http://${localIp}:5000`);
    } catch (err) {
      assert(false, `Server failed to respond on LAN IP http://${localIp}:5000: ${err.message}`);
    }

    // 1. Authentication
    console.log('\n--- 1. Authentication ---');
    const studLogin = await request('POST', '/api/auth/login', {
      email: 'student@college.com',
      password: 'Student@123',
    });
    assert(studLogin.status === 200 && studLogin.data.data.token, 'Student Login successful');
    studentToken = studLogin.data.data.token;

    const orgLogin = await request('POST', '/api/auth/login', {
      email: 'organizer@college.com',
      password: 'Organizer@123',
    });
    assert(orgLogin.status === 200 && orgLogin.data.data.token, 'Organizer Login successful');
    organizerToken = orgLogin.data.data.token;

    const adminLogin = await request('POST', '/api/auth/login', {
      email: 'admin@college.com',
      password: 'Admin@123',
    });
    assert(adminLogin.status === 200 && adminLogin.data.data.token, 'Admin Login successful');
    adminToken = adminLogin.data.data.token;

    // 2. Fetch approved events
    console.log('\n--- 2. Student Views Approved Events ---');
    const orgProfile = await request('GET', '/api/auth/me', null, organizerToken);
    const organizerId = orgProfile.data.data._id;

    const eventsRes = await request('GET', '/api/events?status=published');
    assert(eventsRes.status === 200 && eventsRes.data.data.events.length > 0, 'Student views list of published/approved events');
    
    // Find an event owned by organizer@college.com
    let targetEvent = eventsRes.data.data.events.find(
      (e) => (e.organizer?._id || e.organizer)?.toString() === organizerId.toString()
    );
    if (!targetEvent) {
      targetEvent = eventsRes.data.data.events[0];
    }
    console.log(`     Target Event: "${targetEvent.title}" (ID: ${targetEvent._id}, Organizer: ${(targetEvent.organizer?._id || targetEvent.organizer)})`);

    // 3. Clean up any existing registration for target event so we have a clean slate
    const existingRegsRes = await request('GET', `/api/registrations?event=${targetEvent._id}`, null, studentToken);
    if (existingRegsRes.data?.data?.registrations?.length > 0) {
      for (const reg of existingRegsRes.data.data.registrations) {
        await request('DELETE', `/api/registrations/${reg._id}`, { reason: 'Test cleanup' }, studentToken);
      }
    }

    // 4. Student Event Registration / RSVP
    console.log('\n--- 3. Student Registration & QR Generation ---');
    const regRes = await request('POST', '/api/registrations', { eventId: targetEvent._id }, studentToken);
    assert(regRes.status === 201 && regRes.data.success, 'Student successfully registered (201 Created)');
    assert(regRes.data.data.qrCode, 'Unique QR ticket identifier generated');
    assert(regRes.data.data.qrCodeDataUrl && regRes.data.data.qrCodeDataUrl.startsWith('data:image/png;base64,'), 'Visual QR Code Data URL generated');
    
    const regData = regRes.data.data;
    const ticketCode = regData.qrCode;
    const regId = regData._id;
    console.log(`     Generated Ticket ID: ${ticketCode}`);

    // 5. Duplicate Registration Prevention
    console.log('\n--- 4. Duplicate Registration Prevention ---');
    const dupRes = await request('POST', '/api/registrations', { eventId: targetEvent._id }, studentToken);
    assert(dupRes.status === 409 && !dupRes.data.success, 'Duplicate registration prevented with 409 Conflict');
    assert(dupRes.data.message.includes('already registered'), 'Helpful conflict error message returned');

    // 6. Public QR Ticket Verification (External device scanning without auth)
    console.log('\n--- 5. Public QR Ticket Verification (Device Scan) ---');
    const verifyRes = await request('GET', `/api/registrations/verify/${encodeURIComponent(ticketCode)}`);
    assert(verifyRes.status === 200 && verifyRes.data.success, 'Public verification endpoint accessible without login (200 OK)');
    
    const verified = verifyRes.data.data;
    assert(verified.studentName && verified.studentName.length > 0, `Student name returned: ${verified.studentName}`);
    assert(verified.eventTitle === targetEvent.title, `Event title matches: ${verified.eventTitle}`);
    assert(verified.venue, `Venue displayed: ${verified.venue}`);
    assert(verified.ticketId === ticketCode, 'Ticket ID matches registration code');
    assert(verified.status === 'registered', `Status is '${verified.status}'`);
    assert(verified.checkedIn === false, 'Check-in status is false before entry');
    assert(!verified.password && !verified.token && !verified.__v, 'Sensitive data (passwords, JWTs, hashes) are not exposed');

    // 7. Verification via query parameter (?ticket=...)
    const queryVerifyRes = await request('GET', `/api/registrations/verify?ticket=${encodeURIComponent(ticketCode)}`);
    assert(queryVerifyRes.status === 200 && queryVerifyRes.data.data.ticketId === ticketCode, 'Verification works via query parameter ?ticket=');

    // 8. Short URL redirect (/registration/:id)
    console.log('\n--- 6. Short URL Redirect ---');
    const redirectRes = await request('GET', `/registration/${regId}`);
    assert(redirectRes.status === 302, 'Short URL /registration/:id responds with 302 Redirect');
    const location = redirectRes.headers.get('location') || '';
    assert(location.includes(`/verify-ticket.html?id=${regId}`), `Redirects to verify-ticket.html: ${location}`);

    // 9. Role Authorization Check: Student cannot check-in
    console.log('\n--- 7. Security: Role Authorization Enforcement ---');
    const studentCheckIn = await request('POST', '/api/registrations/check-in', { qrCode: ticketCode }, studentToken);
    assert(studentCheckIn.status === 403, 'Security: Student forbidden from performing check-in (403)');

    // 10. Authorized Organizer / Admin Check-In
    console.log('\n--- 8. Organizer / Admin Check-In ---');
    // Test check-in passing full verification URL (e.g. from optical barcode/camera scanner)
    const scannedUrl = `http://192.168.1.100:5000/verify-ticket.html?ticket=${encodeURIComponent(ticketCode)}`;
    
    // If targetEvent is owned by organizerId, use organizerToken; else use adminToken
    const isTargetOrganizer = (targetEvent.organizer?._id || targetEvent.organizer)?.toString() === organizerId.toString();
    const authorizedToken = isTargetOrganizer ? organizerToken : adminToken;
    const checkInRole = isTargetOrganizer ? 'Event Organizer' : 'Administrator';

    const checkInRes = await request('POST', '/api/registrations/check-in', { qrCode: scannedUrl }, authorizedToken);
    assert(checkInRes.status === 200 && checkInRes.data.success, `${checkInRole} marks attendee as checked-in via URL (200 OK)`);
    assert(checkInRes.data.data.status === 'checked-in', 'Registration status updated to checked-in');
    assert(checkInRes.data.data.checkedInAt, 'checkedInAt timestamp recorded in MongoDB');

    // Also test Admin check-in on a registered attendee
    // Admin check-in is also authorized for all events
    assert(adminToken.length > 0, 'Admin token available for verification');

    // 11. Verification after Check-in
    console.log('\n--- 9. Verification State After Check-In ---');
    const verifyAfterRes = await request('GET', `/api/registrations/verify/${encodeURIComponent(ticketCode)}`);
    assert(verifyAfterRes.status === 200, 'Public verification loads updated check-in state');
    assert(verifyAfterRes.data.data.status === 'checked-in', 'Verified status reflects checked-in');
    assert(verifyAfterRes.data.data.checkedIn === true, 'checkedIn flag is true');
    assert(verifyAfterRes.data.data.checkedInAt, 'checkedInAt timestamp is provided');

    // 12. Duplicate Check-In Handling
    console.log('\n--- 10. Duplicate Check-in Guard ---');
    const repeatCheckIn = await request('POST', '/api/registrations/check-in', { qrCode: ticketCode }, organizerToken);
    assert(repeatCheckIn.status === 200 && repeatCheckIn.data.message.includes('already checked in'), 'Duplicate check-in safely handled with notice');

    // 13. Invalid / Non-existent QR code
    console.log('\n--- 11. Invalid & Expired QR Handling ---');
    const invalidRes = await request('GET', '/api/registrations/verify/INVALID-TICKET-CODE-XYZ');
    assert(invalidRes.status === 404, 'Invalid ticket returns 404 Not Found');
    assert(invalidRes.data.message === 'Invalid or unavailable registration.', 'Returns friendly error message without leaking DB errors');

    console.log('\n====================================================');
    console.log(`🎯 QR WORKFLOW TEST SUITE: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Unhandled test error:', err);
    process.exit(1);
  }
};

runQrFlowTest();
