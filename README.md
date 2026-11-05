# College Event Management System (Full-Stack Web Application)

A complete, production-ready, full-stack **College Event Management System** built with Node.js, Express.js, MongoDB (Mongoose), HTML5, CSS3, Vanilla JavaScript, and Bootstrap 5.

---

## 1. Project Overview

The **College Event Management System** is a unified campus platform designed to modernize event discovery, reservations, organizational logistics, and administration across university departments and student clubs. It features:
- **Role-based portals** for Students, Organizers, and Administrators.
- **Dynamic event directory** with multi-parameter searching, category filtering, date sorting, and real-time seat availability tracking.
- **Instant RSVP with Digital QR Tickets** for paperless contactless check-in.
- **Rapid QR Scanner Terminal** for event organizers to check in attendees with sub-second response times.
- **Automatic Waitlist Management**: Automatically promotes waitlisted students if an active attendee cancels their reservation.
- **Multi-Criteria Feedback & Rating System** with sentiment tagging and official organizer replies.
- **Full Platform Idea & Bug Tracker** for student recommendations.
- **Analytics Dashboards & CSV Exports** with interactive Chart.js visualizations.
- **Zero-Config Resilient Database Runner**: Automatically connects to your local MongoDB or safely initializes an embedded database if local MongoDB service is inactive.

---

## 2. Features by User Role

### Admin
- Complete administrative supervision of events, venues, users, and reports.
- **Event Approval Queue**: 1-click Approve or Reject events submitted by club organizers.
- **Organizer Verification**: Inspect registration numbers and approve or revoke organizer credentials.
- **User Governance**: Deactivate or reactivate user accounts safely without breaking historical registration logs.
- **Venues Management**: Create, edit, and archive venues with double-booking prevention.
- **System-Wide Analytics**: Interactive Chart.js graphs detailing events by category and monthly registrations.
- **CSV Data Exports**: Download comprehensive CSV reports for events and attendees.
- **Platform Ideas Tracker**: Manage community suggestions and track implementation status.

### Organizer
- **Event Lifecycle Management**: Create, edit, reschedule, and archive events.
- **Real-Time Rescheduling**: Updating date/time automatically broadcasts notifications to all registered students.
- **Rapid QR Check-in Terminal**: Scan or type ticket codes for immediate attendee verification.
- **Attendee Management**: View full rosters, contacts, registration timestamps, and check-in statuses.
- **Capacity Guardrails**: Real-time validation preventing event capacity from exceeding venue capacity.
- **Feedback Interaction**: Review attendee ratings (1-5 stars) across 5 criteria and post official responses.
- **Export Roster**: Export event attendee lists to CSV with a single click.

### Student
- **Event Discovery**: Search by keywords, category, upcoming date range, venue, and available seats.
- **Instant RSVP**: Confirmed registrations receive a uniquely generated cryptographic ticket code with a visual QR pass.
- **Digital Passbook (My Events)**: View active QR passes, download tickets, or print admissions.
- **Automatic Waitlisting**: If an event reaches full capacity, students are queued on a waitlist and automatically promoted upon cancellations.
- **Attendance History & Feedback**: Rate attended events across 5 criteria (Quality, Organization, Venue, Content Relevance, Value).
- **Personalized Recommendations**: Dynamic feed curated based on the student's selected interests.
- **Notification Inbox**: Real-time alerts for RSVP confirmations, schedule updates, cancellations, and announcements.

---

## 3. Technology Stack

- **Frontend**:
  - HTML5 & CSS3
  - Vanilla JavaScript (ES6 Modules)
  - Bootstrap 5.3.3 & Bootstrap Icons
  - Chart.js 4.4.7 (Visual Analytics)
  - QRCode.js (Client and server-side ticket generation)
  - Fetch API with centralized `api.js` client and automatic JWT bearer attachment
- **Backend**:
  - Node.js & Express.js
  - RESTful APIs with consistent JSON formatting
  - JWT Authentication (`jsonwebtoken`)
  - Password Hashing (`bcryptjs`)
  - Multer for secure JPG/PNG image uploads (up to 5MB)
  - Helmet & CORS for security headers
  - Express Rate Limit for authentication endpoint protection
  - Centralized Error Handling Middleware
- **Database**:
  - MongoDB
  - Mongoose ODM with normalized schemas and ObjectId references
  - Compound indexes for unique title-per-organizer-date and anti-duplicate registrations

---

## 4. Folder Structure

```text
college-event-management/
│
├── frontend/
│   ├── index.html                 # Landing page & featured events
│   ├── login.html                 # Sign-in with 1-click test credentials
│   ├── register.html              # Registration with role toggle & RFC validations
│   ├── events.html                # Event catalog with search & multi-filter
│   ├── event-details.html         # Event profile, RSVP, QR pass modal, & reviews
│   ├── student-dashboard.html     # Student portal with recommendations & tickets
│   ├── organizer-dashboard.html   # Organizer desk with rapid QR check-in & metrics
│   ├── admin-dashboard.html       # Admin console, metrics, queues, & charts
│   ├── profile.html               # Account profile, interests, & password management
│   ├── my-events.html             # Active digital passes & attendance history
│   ├── create-event.html          # Event creation form with capacity validation
│   ├── edit-event.html            # Event editing & reschedule notification flow
│   ├── venues.html                # Campus venues inventory & booking schedules
│   ├── notifications.html         # User alert center with read/clear toggles
│   ├── feedback.html              # Event ratings & platform suggestion tracker
│   ├── reports.html               # Visual analytics reports & CSV exports
│   ├── css/
│   │   ├── style.css              # Main design system tokens, cards, badges
│   │   └── dashboard.css          # Sidebar navigation, stat cards, & table styles
│   └── js/
│       ├── api.js                 # Centralized fetch wrapper & JWT handler
│       ├── auth.js                # Auth state, session storage, & role guards
│       ├── navbar.js              # Dynamic role-based navigation & unread badge
│       └── utils.js               # Formatting, sanitization, & toasts
│
├── backend/
│   ├── server.js                  # Main Express application entrypoint
│   ├── config/
│   │   └── db.js                  # MongoDB connection with in-memory fallback
│   ├── models/
│   │   ├── User.js                # User model with bcrypt pre-save hashing
│   │   ├── Event.js               # Event model with category & venue refs
│   │   ├── Registration.js        # Registration model with QR codes & waitlists
│   │   ├── Venue.js               # Venue model with capacity & amenities
│   │   ├── Feedback.js            # Feedback model with multi-criteria ratings
│   │   ├── Notification.js        # Notification model with types & read states
│   │   └── Suggestion.js          # Platform improvement suggestion model
│   ├── controllers/               # Controller business logic
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── eventController.js
│   │   ├── registrationController.js
│   │   ├── venueController.js
│   │   ├── feedbackController.js
│   │   ├── notificationController.js
│   │   ├── suggestionController.js
│   │   └── reportController.js
│   ├── routes/                    # Express REST route definitions
│   ├── middleware/                # Auth, Role, Error & Multer middlewares
│   ├── validators/                # RFC 5322, phone, & dates validation rules
│   ├── services/                  # Notification broadcast services
│   ├── seeds/
│   │   └── seed.js                # Comprehensive database seed script
│   └── uploads/                   # Stored images & posters
│
├── .env                           # Environment configuration
├── .env.example
├── package.json
└── README.md
```

---

## 5. Installation & Setup

### Prerequisites
- **Node.js** (v18.x or newer)
- **npm** (v9.x or newer)
- **MongoDB** (Optional: local MongoDB service on port 27017. If not running, the application will automatically initialize an embedded in-memory database!)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Environment Configuration
Create or verify your `.env` file in the root directory:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/college_event_management
JWT_SECRET=college_event_management_super_secure_jwt_secret_key_2026
JWT_EXPIRES_IN=7d
UPLOAD_DIR=uploads
NODE_ENV=development
```

### Step 3: Seed Database
Populate the database with sample users, venues, events across all categories, registrations with QR passes, and notifications:
```bash
npm run seed
```

---

## 6. Running the Application

### Start the Server
```bash
npm start
```
*Or for development:*
```bash
npm run dev
```

### Open in Browser
Open your browser and navigate to:
```text
http://localhost:5000
```
*(The Express backend automatically serves the frontend static web application and uploads.)*

---

## 7. Demo Test Accounts

The login page (`/login.html`) provides **1-click autofill demo buttons** for all three roles:

| Role | Email | Password | Status / Note |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@college.com` | `Admin@123` | Full system administrator access |
| **Organizer** | `organizer@college.com` | `Organizer@123` | Campus Event Council (Verified) |
| **Organizer (Tech)** | `tech.club@college.com` | `Organizer@123` | Computer Science Society (Verified) |
| **Organizer (Unverified)** | `arts.society@college.com` | `Organizer@123` | Design & Arts Guild (Pending verification) |
| **Student** | `student@college.com` | `Student@123` | Manoj Student (Active tickets & passes) |
| **Student** | `alex.rivera@college.com` | `Student@123` | Alex Rivera |

---

## 8. REST API Documentation

### Authentication (`/api/auth`)
- `POST /api/auth/register`: Register new user with RFC 5322 validation.
- `POST /api/auth/login`: Authenticate and obtain JWT token.
- `POST /api/auth/logout`: Invalidate session.
- `GET  /api/auth/me`: Fetch current authenticated user.

### Users (`/api/users`)
- `GET    /api/users`: List users with search, role, and active status filters (Admin).
- `GET    /api/users/:id`: Get single user profile.
- `POST   /api/users`: Create user account (Admin).
- `PUT    /api/users/:id`: Update user profile, phone, interests, and preferences.
- `DELETE /api/users/:id`: Toggle account deactivation (soft delete).
- `PUT    /api/users/:id/verify`: Approve or revoke organizer verification (Admin).

### Events (`/api/events`)
- `GET    /api/events`: Query events with title search, category, date, venue, seats availability, and pagination.
- `GET    /api/events/:id`: Retrieve event details, view count increment, and rating metrics.
- `POST   /api/events`: Propose or publish event (Organizer/Admin).
- `PUT    /api/events/:id`: Update event or reschedule timing (broadcasts notifications).
- `DELETE /api/events/:id`: Archive event or delete permanently (`?hardDelete=true`).
- `PUT    /api/events/:id/status`: Approve or reject event with reason (Admin).
- `GET    /api/events/search`: Keyword search for published events.
- `GET    /api/events/upcoming`: Retrieve next upcoming published events.
- `GET    /api/events/category/:category`: Filter by event category.
- `GET    /api/events/:id/attendees`: Retrieve attendee list with check-in status.
- `GET    /api/events/:id/analytics`: Event-specific attendance rate, no-show rate, and feedback summary.

### Registrations (`/api/registrations`)
- `POST   /api/registrations`: Student RSVP registration (generates QR pass; auto-waitlists if full).
- `GET    /api/registrations`: List user or organizer event registrations.
- `GET    /api/registrations/:id`: Retrieve single ticket registration with QR data.
- `PUT    /api/registrations/:id`: Update registration status.
- `DELETE /api/registrations/:id`: Cancel registration (automatically promotes next waitlisted student).
- `POST   /api/registrations/:id/check-in`: Mark attendee attendance by ID.
- `POST   /api/registrations/check-in`: Fast optical check-in by QR ticket string code.

### Venues (`/api/venues`)
- `GET    /api/venues`: List venues with capacity, amenities, and status filters.
- `GET    /api/venues/:id`: Retrieve venue profile and upcoming bookings.
- `POST   /api/venues`: Create new campus venue (Admin).
- `PUT    /api/venues/:id`: Update venue parameters and capacity (Admin).
- `DELETE /api/venues/:id`: Archive or delete venue if no upcoming events conflict (Admin).

### Feedback (`/api/feedback`)
- `POST   /api/feedback`: Submit post-event feedback (1-5 stars across 5 criteria; attended students only).
- `GET    /api/feedback`: List feedback with sentiment analysis filters.
- `GET    /api/feedback/:id`: Single feedback review.
- `PUT    /api/feedback/:id`: Update submitted review.
- `PUT    /api/feedback/:id/respond`: Organizer official response to review.
- `DELETE /api/feedback/:id`: Remove review.

### Notifications (`/api/notifications`)
- `GET    /api/notifications`: Retrieve user notifications with live unread count.
- `POST   /api/notifications`: Broadcast announcement notification (Admin).
- `PUT    /api/notifications/:id/read`: Mark single notification as read.
- `PUT    /api/notifications/read-all`: Mark all notifications as read.
- `DELETE /api/notifications/:id`: Delete single notification.
- `DELETE /api/notifications/clear-all`: Clear all user notifications.

### Suggestions (`/api/suggestions`)
- `GET    /api/suggestions`: List suggestions (Admin: all, User: own).
- `POST   /api/suggestions`: Submit feature request or bug report.
- `PUT    /api/suggestions/:id`: Admin updates status (Submitted, In-Review, Planned, Implemented).
- `DELETE /api/suggestions/:id`: Delete suggestion.

### Reports (`/api/reports`)
- `GET /api/reports/admin-overview`: Comprehensive system metrics, category statistics, and monthly trends.
- `GET /api/reports/organizer-overview`: Host metrics, attendance ratios, and average reviews.
- `GET /api/reports/student-overview`: Personalized engagement stats and interest recommendations.
- `GET /api/reports/export-csv?type=events|attendees`: Download official CSV spreadsheets.

### File Uploads (`/api/upload`)
- `POST /api/upload`: Multipart form data upload for JPG and PNG files up to 5MB.

---

## 9. CRUD Verification Checklist

- [x] **User Create**: Implemented via `/api/auth/register` and `/api/users`.
- [x] **User Read**: Implemented via `/api/users` and `/api/users/:id`.
- [x] **User Update**: Implemented via `/api/users/:id` (name, phone, interests, preferences).
- [x] **User Deactivate**: Implemented via `DELETE /api/users/:id` (toggles `isActive`).
- [x] **Event Create**: Implemented via `POST /api/events` with capacity and date validation.
- [x] **Event Read**: Implemented via `/api/events`, search, category, and upcoming endpoints.
- [x] **Event Update**: Implemented via `PUT /api/events/:id` (supports rescheduling notifications).
- [x] **Event Archive**: Implemented via `DELETE /api/events/:id` (soft archive or permanent delete).
- [x] **Venue Create**: Implemented via `POST /api/venues` (Admin).
- [x] **Venue Read**: Implemented via `GET /api/venues` and `/api/venues/:id` with current bookings.
- [x] **Venue Update**: Implemented via `PUT /api/venues/:id` (Admin).
- [x] **Venue Archive**: Implemented via `DELETE /api/venues/:id` with booking conflict checks.
- [x] **Registration Create**: Implemented via `POST /api/registrations` with QR code generation & auto-waitlisting.
- [x] **Registration Read**: Implemented via `GET /api/registrations` and `/api/registrations/:id`.
- [x] **Registration Update**: Implemented via `PUT /api/registrations/:id` and check-in endpoints.
- [x] **Registration Cancel**: Implemented via `DELETE /api/registrations/:id` (auto-promotes waitlisted student).
- [x] **Feedback Create**: Implemented via `POST /api/feedback` with 5 criteria and sentiment detection.
- [x] **Feedback Read**: Implemented via `GET /api/feedback` with rating distributions.
- [x] **Feedback Update**: Implemented via `PUT /api/feedback/:id` and `PUT /api/feedback/:id/respond`.
- [x] **Feedback Delete**: Implemented via `DELETE /api/feedback/:id`.
- [x] **Notification Create**: Implemented via `POST /api/notifications` and system triggers.
- [x] **Notification Read**: Implemented via `GET /api/notifications` with unread count.
- [x] **Notification Update**: Implemented via `PUT /api/notifications/:id/read` and `read-all`.
- [x] **Notification Delete**: Implemented via `DELETE /api/notifications/:id` and `clear-all`.

---

## 10. Role Permission Security Matrix

| Action | Student | Organizer | Admin |
| :--- | :---: | :---: | :---: |
| Browse & Search Events | Yes | Yes | Yes |
| RSVP / Register for Event | Yes | No | Yes |
| Display Digital QR Pass | Yes (Own) | No | Yes |
| Submit Event Review & Rating | Yes (Attended) | No | Yes |
| Submit Platform Suggestion / Bug | Yes | Yes | Yes |
| Propose / Draft Events | No | Yes (Own) | Yes (All) |
| Publish Events | No | Yes (If Verified) | Yes |
| Rapid QR Check-in Terminal | No | Yes (Own Events) | Yes (All) |
| Respond to Attendee Reviews | No | Yes (Own Events) | Yes (All) |
| Reschedule Events | No | Yes (Own Events) | Yes (All) |
| Approve / Reject Events | No | No | Yes |
| Verify Organizer Accounts | No | No | Yes |
| Deactivate User Accounts | No | No | Yes |
| Create / Archive Venues | No | No | Yes |
| System Analytics & Reports | No | Own Events | System-Wide |
