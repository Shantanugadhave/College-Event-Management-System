require('dotenv').config();
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const { connectDB } = require('../config/db');

const User = require('../models/User');
const Venue = require('../models/Venue');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Feedback = require('../models/Feedback');
const Notification = require('../models/Notification');
const Suggestion = require('../models/Suggestion');

const seedData = async (shouldExit = true) => {
  try {
    console.log('🌱 Starting College Event Management System database seeding...');
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }

    // Clear existing collections
    await User.deleteMany();
    await Venue.deleteMany();
    await Event.deleteMany();
    await Registration.deleteMany();
    await Feedback.deleteMany();
    await Notification.deleteMany();
    await Suggestion.deleteMany();
    console.log('🧹 Purged existing collections.');

    // 1. Create Users
    console.log('👤 Creating users...');
    const admin = await User.create({
      name: 'System Administrator',
      email: 'admin@college.com',
      password: 'Admin@123',
      phone: '+14155550100',
      role: 'admin',
      isVerified: true,
      isActive: true,
      interests: ['Academic', 'Workshop', 'Cultural'],
    });

    const verifiedOrganizer = await User.create({
      name: 'Campus Event Council',
      email: 'organizer@college.com',
      password: 'Organizer@123',
      phone: '+14155550101',
      role: 'organizer',
      organizationNumber: 'CEC-2026-REG-882',
      isVerified: true,
      isActive: true,
      interests: ['Cultural', 'Sports', 'Social'],
    });

    const techOrganizer = await User.create({
      name: 'Computer Science Society',
      email: 'tech.club@college.com',
      password: 'Organizer@123',
      phone: '+14155550102',
      role: 'organizer',
      organizationNumber: 'CSS-TECH-2026-004',
      isVerified: true,
      isActive: true,
      interests: ['Academic', 'Workshop', 'Seminar'],
    });

    const pendingOrganizer = await User.create({
      name: 'Design & Arts Guild',
      email: 'arts.society@college.com',
      password: 'Organizer@123',
      phone: '+14155550103',
      role: 'organizer',
      organizationNumber: 'DAG-PENDING-99',
      isVerified: false, // Testing unverified flow
      isActive: true,
      interests: ['Cultural', 'Workshop'],
    });

    const student1 = await User.create({
      name: 'Manoj Student',
      email: 'student@college.com',
      password: 'Student@123',
      phone: '+14155550104',
      role: 'student',
      isVerified: true,
      isActive: true,
      interests: ['Workshop', 'Academic', 'Sports'],
    });

    const student2 = await User.create({
      name: 'Alex Rivera',
      email: 'alex.rivera@college.com',
      password: 'Student@123',
      phone: '+14155550105',
      role: 'student',
      isVerified: true,
      isActive: true,
      interests: ['Cultural', 'Social', 'Seminar'],
    });

    const student3 = await User.create({
      name: 'Priya Sharma',
      email: 'priya.sharma@college.com',
      password: 'Student@123',
      phone: '+14155550106',
      role: 'student',
      isVerified: true,
      isActive: true,
      interests: ['Academic', 'Seminar'],
    });

    console.log('✅ Users created.');

    // 2. Create Venues
    console.log('🏛️ Creating venues...');
    const auditorium = await Venue.create({
      name: 'Grand University Auditorium',
      location: 'Academic Quadrangle, Building A, Ground Floor',
      capacity: 800,
      amenities: ['Dolby Sound System', '4K Laser Projector', 'Stage Lighting', 'Air Conditioning', 'VIP Green Rooms', 'High-Speed WiFi'],
      images: ['https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80'],
      description: 'Main flagship auditorium designed for keynote sessions, cultural celebrations, convocation, and large academic symposiums.',
      availability: 'available',
      status: 'active',
    });

    const techHall = await Venue.create({
      name: 'Science & Technology Concourse',
      location: 'Engineering Tower, East Wing, Level 2',
      capacity: 300,
      amenities: ['Smart Whiteboards', 'High-Speed Ethernet', 'Podium Mics', 'Lecture Capture System', 'Wheelchair Accessible'],
      images: ['https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80'],
      description: 'State-of-the-art technological arena perfect for hackathons, technical demonstrations, and computer science seminars.',
      availability: 'available',
      status: 'active',
    });

    const amphitheatre = await Venue.create({
      name: 'Central Campus Amphitheatre',
      location: 'Open Garden Grounds, Central Campus',
      capacity: 600,
      amenities: ['Outdoor PA System', 'Open-Air Seating', 'Stage Truss Rigging', 'Acoustic Canopy', 'Perimeter Lighting'],
      images: ['https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80'],
      description: 'Lush open-air amphitheatre with terraced seating for music festivals, theatrical plays, and cultural evenings.',
      availability: 'available',
      status: 'active',
    });

    const seminarHall = await Venue.create({
      name: 'Executive Seminar Hall B',
      location: 'Management & Humanities Block, 3rd Floor',
      capacity: 120,
      amenities: ['Tiered Executive Seating', 'Video Conferencing Suite', 'Individual Desk Microphones', 'Central AC'],
      images: ['https://images.unsplash.com/photo-1431540015161-0bf868a2d407?auto=format&fit=crop&w=1200&q=80'],
      description: 'Intimate, premium seminar hall optimized for research presentations, panel debates, and guest executive lectures.',
      availability: 'available',
      status: 'active',
    });

    const sportsComplex = await Venue.create({
      name: 'Varsity Sports & Athletic Complex',
      location: 'Sports Pavilion, North Campus',
      capacity: 1200,
      amenities: ['Indoor Hardwood Court', 'Spectator Bleachers', 'Electronic Scoreboard', 'Locker Facilities', 'First Aid Station'],
      images: ['https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80'],
      description: 'Comprehensive indoor sporting facility accommodating basketball championships, badminton tournaments, and fitness galas.',
      availability: 'available',
      status: 'active',
    });

    console.log('✅ Venues created.');

    // 3. Create Events
    console.log('📅 Creating events across all categories...');
    const now = new Date();
    
    // Future dates
    const date1 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const date2 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const date3 = new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000);
    const date4 = new Date(now.getTime() + 18 * 24 * 60 * 60 * 1000);
    const date5 = new Date(now.getTime() + 24 * 24 * 60 * 60 * 1000);
    const date6 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const eventWorkshop = await Event.create({
      title: 'Full-Stack Modern Web Engineering & Cloud Workshop',
      description: 'Join industry veterans for an intensive hands-on deep dive into building production-grade web systems. Learn architecture, RESTful APIs, modern databases, and containerization. Hands-on coding exercises and live deployments included.',
      category: 'Workshop',
      startDate: date1,
      endDate: date1,
      startTime: '10:00',
      endTime: '16:00',
      venue: techHall._id,
      capacity: 80,
      registeredCount: 2,
      attendedCount: 1,
      posterImage: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80',
      organizer: techOrganizer._id,
      budget: 1200,
      status: 'published',
    });

    const eventCultural = await Event.create({
      title: 'Annual Spring Cultural Fest & Musical Showcase',
      description: 'The premier campus cultural extravaganza returns! Featuring competitive dance, battle of the collegiate bands, live musical performances, fine arts exhibits, and food stalls from across the country. Open to all students and faculty.',
      category: 'Cultural',
      startDate: date2,
      endDate: date2,
      startTime: '16:00',
      endTime: '22:00',
      venue: amphitheatre._id,
      capacity: 500,
      registeredCount: 2,
      attendedCount: 0,
      posterImage: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80',
      organizer: verifiedOrganizer._id,
      budget: 5000,
      status: 'published',
    });

    const eventAcademic = await Event.create({
      title: 'Annual Research Symposium on Artificial Intelligence',
      description: 'A distinguished academic congregation bringing together researchers, graduate scholars, and undergraduate pioneers. Keynote presentations on neural architectures, ethical AI governance, and quantum-assisted algorithmic optimization.',
      category: 'Academic',
      startDate: date3,
      endDate: date3,
      startTime: '09:00',
      endTime: '17:00',
      venue: auditorium._id,
      capacity: 400,
      registeredCount: 1,
      attendedCount: 0,
      posterImage: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
      organizer: techOrganizer._id,
      budget: 3200,
      status: 'published',
    });

    const eventSports = await Event.create({
      title: 'Inter-Departmental Basketball Championship 2026',
      description: 'The ultimate athletic clash on campus! Teams representing Engineering, Sciences, Arts, and Management compete for the university championship trophy. Come cheer for your departmental athletes in this high-energy tournament.',
      category: 'Sports',
      startDate: date4,
      endDate: date4,
      startTime: '14:00',
      endTime: '19:00',
      venue: sportsComplex._id,
      capacity: 600,
      registeredCount: 1,
      attendedCount: 0,
      posterImage: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80',
      organizer: verifiedOrganizer._id,
      budget: 1500,
      status: 'published',
    });

    const eventSeminar = await Event.create({
      title: 'Sustainable Clean Energy & Green Campus Policy Seminar',
      description: 'A comprehensive policy and technological exploration into reducing collegiate carbon footprints, utilizing photovoltaic microgrids, and driving community climate action through cross-disciplinary student leadership.',
      category: 'Seminar',
      startDate: date5,
      endDate: date5,
      startTime: '11:00',
      endTime: '14:00',
      venue: seminarHall._id,
      capacity: 100,
      registeredCount: 1,
      attendedCount: 0,
      posterImage: 'https://images.unsplash.com/photo-1431540015161-0bf868a2d407?auto=format&fit=crop&w=1200&q=80',
      organizer: techOrganizer._id,
      budget: 600,
      status: 'published',
    });

    const eventSocial = await Event.create({
      title: 'Campus Community Wellness Day & Charity Fair',
      description: 'A dedicated wellness gathering focused on mental fitness, mindful meditation, community bonding, pet therapy corners, and student-run charity donation booths supporting local shelters and educational initiatives.',
      category: 'Social',
      startDate: date6,
      endDate: date6,
      startTime: '10:00',
      endTime: '15:00',
      venue: amphitheatre._id,
      capacity: 350,
      registeredCount: 1,
      attendedCount: 0,
      posterImage: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80',
      organizer: verifiedOrganizer._id,
      budget: 800,
      status: 'published',
    });

    // Pending event awaiting Admin approval
    const pendingEvent = await Event.create({
      title: 'Campus Hackathon 2026: 24-Hour Code Sprint',
      description: 'An overnight collegiate hackathon where multidisciplinary teams prototype transformative software solutions. Features mentoring from top alumni engineers, hardware toolkits, and prize pools for standout innovations.',
      category: 'Workshop',
      startDate: new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 36 * 24 * 60 * 60 * 1000),
      startTime: '12:00',
      endTime: '12:00',
      venue: techHall._id,
      capacity: 150,
      posterImage: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80',
      organizer: techOrganizer._id,
      budget: 2500,
      status: 'pending', // Awaiting Admin Approval
    });

    console.log('✅ Events created.');

    // 4. Create Registrations with QR Codes
    console.log('🎟️ Creating registrations with QR code tickets...');
    const { getBaseAppUrl } = require('../controllers/registrationController');
    const baseAppUrl = getBaseAppUrl();
    const generateQr = async (ticket) => {
      const qrUrl = `${baseAppUrl}/verify-ticket.html?ticket=${encodeURIComponent(ticket)}`;
      return await QRCode.toDataURL(qrUrl, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 320,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
    };

    const reg1Ticket = `REG-${eventWorkshop._id.toString().slice(-6)}-${student1._id.toString().slice(-6)}-101`;
    const reg1Qr = await generateQr(reg1Ticket, eventWorkshop.title, student1.name);

    await Registration.create({
      student: student1._id,
      event: eventWorkshop._id,
      status: 'checked-in',
      qrCode: reg1Ticket,
      qrCodeDataUrl: reg1Qr,
      registeredAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      checkedInAt: new Date(),
    });

    const reg2Ticket = `REG-${eventCultural._id.toString().slice(-6)}-${student1._id.toString().slice(-6)}-102`;
    const reg2Qr = await generateQr(reg2Ticket, eventCultural.title, student1.name);

    await Registration.create({
      student: student1._id,
      event: eventCultural._id,
      status: 'registered',
      qrCode: reg2Ticket,
      qrCodeDataUrl: reg2Qr,
      registeredAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
    });

    const reg3Ticket = `REG-${eventWorkshop._id.toString().slice(-6)}-${student2._id.toString().slice(-6)}-103`;
    const reg3Qr = await generateQr(reg3Ticket, eventWorkshop.title, student2.name);

    await Registration.create({
      student: student2._id,
      event: eventWorkshop._id,
      status: 'registered',
      qrCode: reg3Ticket,
      qrCodeDataUrl: reg3Qr,
      registeredAt: new Date(),
    });

    const reg4Ticket = `REG-${eventAcademic._id.toString().slice(-6)}-${student3._id.toString().slice(-6)}-104`;
    const reg4Qr = await generateQr(reg4Ticket, eventAcademic.title, student3.name);

    await Registration.create({
      student: student3._id,
      event: eventAcademic._id,
      status: 'registered',
      qrCode: reg4Ticket,
      qrCodeDataUrl: reg4Qr,
      registeredAt: new Date(),
    });

    console.log('✅ Registrations created.');

    // 5. Create Feedback
    console.log('⭐ Creating ratings and feedback...');
    await Feedback.create({
      student: student1._id,
      event: eventWorkshop._id,
      rating: 5,
      comment: 'Exceptional hands-on learning experience! The practical coding walkthroughs and real-time guidance helped clarify complex full-stack concepts effortlessly.',
      qualityRating: 5,
      organizationRating: 5,
      venueRating: 5,
      contentRelevanceRating: 5,
      overallValueRating: 5,
      sentiment: 'Positive',
      organizerResponse: 'Thank you Manoj! We are thrilled you enjoyed the workshop and look forward to seeing your project submissions!',
      respondedAt: new Date(),
    });

    console.log('✅ Feedback created.');

    // 6. Create Notifications
    console.log('🔔 Creating notifications...');
    await Notification.create({
      user: student1._id,
      title: 'Registration Confirmed: Web Engineering Workshop',
      message: 'Your registration is confirmed! Tap here to view your digital QR ticket for entry.',
      type: 'registration',
      event: eventWorkshop._id,
      isRead: false,
    });

    await Notification.create({
      user: student1._id,
      title: 'Check-in Verified!',
      message: 'Welcome to Full-Stack Modern Web Engineering & Cloud Workshop! Your attendance has been officially recorded.',
      type: 'event-update',
      event: eventWorkshop._id,
      isRead: true,
    });

    await Notification.create({
      user: verifiedOrganizer._id,
      title: 'Event Approved: Spring Cultural Fest',
      message: 'Your event has been reviewed and approved by the college administrator. It is now publicly listed.',
      type: 'approval',
      event: eventCultural._id,
      isRead: false,
    });

    await Notification.create({
      user: admin._id,
      title: 'Event Awaiting Review: Campus Hackathon 2026',
      message: 'Organizer "Computer Science Society" submitted a new event for review: "Campus Hackathon 2026: 24-Hour Code Sprint".',
      type: 'approval',
      event: pendingEvent._id,
      isRead: false,
    });

    console.log('✅ Notifications created.');

    // 7. Create Platform Suggestions & Bug Reports
    console.log('💡 Creating platform suggestions & bug reports...');
    await Suggestion.create({
      user: student1._id,
      title: 'Add Google Calendar & iCal Export Buttons',
      description: 'It would be super helpful if students could click a single button to add registered events directly into their personal Google or Apple Calendar.',
      type: 'feature',
      status: 'in-review',
      adminNotes: 'Great idea, researching calendar ICS generator.',
    });

    await Suggestion.create({
      user: verifiedOrganizer._id,
      title: 'Batch Attendance CSV Upload for Offline Check-in',
      description: 'Allow organizers to upload a CSV of student IDs for fast batch attendance marking after outdoor sports events.',
      type: 'improvement',
      status: 'planned',
      adminNotes: 'Slated for implementation.',
    });

    console.log('✅ Suggestions created.');

    console.log('\n====================================================');
    console.log('🎉 SEEDING COMPLETED SUCCESSFULLY!');
    console.log('====================================================');
    console.log('🔑 TEST ACCOUNTS:');
    console.log('1. Admin:     admin@college.com      / Admin@123');
    console.log('2. Organizer: organizer@college.com  / Organizer@123 (Verified)');
    console.log('3. Organizer: tech.club@college.com  / Organizer@123 (Verified)');
    console.log('4. Organizer: arts.society@college.com / Organizer@123 (Unverified)');
    console.log('5. Student:   student@college.com    / Student@123');
    console.log('6. Student:   alex.rivera@college.com / Student@123');
    console.log('====================================================\n');

    if (shouldExit) {
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Seeding Error:', error);
    if (shouldExit) {
      process.exit(1);
    }
    throw error;
  }
};

if (require.main === module) {
  seedData(true);
}

module.exports = seedData;
