// Dynamic Navbar & Global Layout Renderer

document.addEventListener('DOMContentLoaded', () => {
  renderNavbar();
  renderFooter();
  setupNotificationsCounter();
});

function renderNavbar() {
  const navContainer = document.getElementById('navbar-container');
  if (!navContainer) return;

  const user = window.Auth ? window.Auth.getCurrentUser() : null;
  const currentPath = window.location.pathname;

  let roleLinks = '';
  let authActions = '';

  if (!user) {
    roleLinks = `
      <li class="nav-item">
        <a class="nav-link ${currentPath.endsWith('events.html') ? 'active' : ''}" href="/events.html">
          <i class="bi bi-calendar3 me-1"></i> Explore Events
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link ${currentPath.endsWith('venues.html') ? 'active' : ''}" href="/venues.html">
          <i class="bi bi-geo-alt me-1"></i> Venues
        </a>
      </li>
    `;

    authActions = `
      <div class="d-flex align-items-center gap-2">
        <a href="/login.html" class="btn btn-sm btn-outline-secondary px-3">Sign In</a>
        <a href="/register.html" class="btn btn-sm btn-primary px-3">Register</a>
      </div>
    `;
  } else {
    // Shared links
    let dashboardHref = '/student-dashboard.html';
    if (user.role === 'admin') dashboardHref = '/admin-dashboard.html';
    if (user.role === 'organizer') dashboardHref = '/organizer-dashboard.html';

    roleLinks = `
      <li class="nav-item">
        <a class="nav-link ${currentPath.endsWith('events.html') ? 'active' : ''}" href="/events.html">
          <i class="bi bi-calendar-event me-1"></i> Events
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link ${currentPath.endsWith('venues.html') ? 'active' : ''}" href="/venues.html">
          <i class="bi bi-building me-1"></i> Venues
        </a>
      </li>
    `;

    if (user.role === 'student') {
      roleLinks += `
        <li class="nav-item">
          <a class="nav-link ${currentPath.endsWith('my-events.html') ? 'active' : ''}" href="/my-events.html">
            <i class="bi bi-ticket-perforated me-1"></i> My Registrations
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link ${currentPath.endsWith('student-dashboard.html') ? 'active' : ''}" href="/student-dashboard.html">
            <i class="bi bi-grid-1x2 me-1"></i> Student Portal
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link ${currentPath.endsWith('feedback.html') ? 'active' : ''}" href="/feedback.html">
            <i class="bi bi-chat-heart me-1"></i> Feedback
          </a>
        </li>
      `;
    } else if (user.role === 'organizer') {
      roleLinks += `
        <li class="nav-item">
          <a class="nav-link ${currentPath.endsWith('my-events.html') ? 'active' : ''}" href="/my-events.html">
            <i class="bi bi-kanban me-1"></i> My Events
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link ${currentPath.endsWith('create-event.html') ? 'active' : ''}" href="/create-event.html">
            <i class="bi bi-plus-circle me-1"></i> Create Event
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link ${currentPath.endsWith('organizer-dashboard.html') ? 'active' : ''}" href="/organizer-dashboard.html">
            <i class="bi bi-speedometer2 me-1"></i> Dashboard
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link ${currentPath.endsWith('reports.html') ? 'active' : ''}" href="/reports.html">
            <i class="bi bi-graph-up me-1"></i> Reports
          </a>
        </li>
      `;
    } else if (user.role === 'admin') {
      roleLinks += `
        <li class="nav-item">
          <a class="nav-link ${currentPath.endsWith('admin-dashboard.html') ? 'active' : ''}" href="/admin-dashboard.html">
            <i class="bi bi-shield-check me-1"></i> Admin Console
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link ${currentPath.endsWith('reports.html') ? 'active' : ''}" href="/reports.html">
            <i class="bi bi-bar-chart-line me-1"></i> Analytics
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link ${currentPath.endsWith('feedback.html') ? 'active' : ''}" href="/feedback.html">
            <i class="bi bi-chat-square-quote me-1"></i> Feedback & Ideas
          </a>
        </li>
      `;
    }

    const roleBadgeClass =
      user.role === 'admin'
        ? 'bg-danger text-white'
        : user.role === 'organizer'
        ? 'bg-primary text-white'
        : 'bg-success text-white';

    authActions = `
      <div class="d-flex align-items-center gap-3">
        <!-- Notification Bell Icon with Badge -->
        <a href="/notifications.html" class="position-relative text-dark p-2 text-decoration-none" title="Notifications">
          <i class="bi bi-bell fs-5"></i>
          <span id="nav-unread-badge" class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger d-none" style="font-size:0.65rem;">
            0
          </span>
        </a>

        <!-- User Dropdown Menu -->
        <div class="dropdown">
          <button class="btn btn-sm btn-light border dropdown-toggle d-flex align-items-center gap-2 py-1 px-2" type="button" data-bs-toggle="dropdown" aria-expanded="false">
            <div class="user-nav-avatar bg-primary text-white d-flex align-items-center justify-content-center fw-bold" style="font-size: 0.85rem;">
              ${user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div class="text-start d-none d-md-block pe-1">
              <div class="fw-bold lh-1 text-dark small">${user.name ? user.name.split(' ')[0] : 'User'}</div>
              <span class="badge ${roleBadgeClass} mt-1" style="font-size: 0.65rem; text-transform: uppercase;">${user.role}</span>
            </div>
          </button>
          <ul class="dropdown-menu dropdown-menu-end shadow-sm border-0 mt-2">
            <li><h6 class="dropdown-header">${user.email}</h6></li>
            <li><a class="dropdown-item" href="${dashboardHref}"><i class="bi bi-grid me-2 text-primary"></i> My Dashboard</a></li>
            <li><a class="dropdown-item" href="/profile.html"><i class="bi bi-person-gear me-2 text-secondary"></i> Account Profile</a></li>
            <li><a class="dropdown-item" href="/notifications.html"><i class="bi bi-bell me-2 text-warning"></i> Notifications</a></li>
            <li><hr class="dropdown-divider"></li>
            <li><a class="dropdown-item text-danger" href="javascript:void(0)" onclick="Auth.logout()"><i class="bi bi-box-arrow-right me-2"></i> Sign Out</a></li>
          </ul>
        </div>
      </div>
    `;
  }

  navContainer.innerHTML = `
    <nav class="navbar navbar-expand-lg app-navbar">
      <div class="container-xl">
        <a class="navbar-brand" href="/">
          <div class="navbar-brand-icon">
            <i class="bi bi-calendar-week"></i>
          </div>
          <span class="brand-font">College<span class="text-primary">Events</span></span>
        </a>

        <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#navbarMainContent" aria-controls="navbarMainContent" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>

        <div class="collapse navbar-collapse" id="navbarMainContent">
          <ul class="navbar-nav me-auto mb-2 mb-lg-0 ms-lg-3">
            <li class="nav-item">
              <a class="nav-link ${currentPath === '/' || currentPath.endsWith('index.html') ? 'active' : ''}" href="/">Home</a>
            </li>
            ${roleLinks}
          </ul>
          ${authActions}
        </div>
      </div>
    </nav>
  `;
}

function renderFooter() {
  const footerContainer = document.getElementById('footer-container');
  if (!footerContainer) return;

  footerContainer.innerHTML = `
    <footer>
      <div class="container-xl">
        <div class="row g-4">
          <div class="col-lg-4 col-md-6">
            <div class="d-flex align-items-center gap-2 mb-3">
              <div class="navbar-brand-icon" style="width:32px; height:32px; font-size:1rem;">
                <i class="bi bi-calendar-week"></i>
              </div>
              <h5 class="text-white mb-0 brand-font">College<span class="text-primary">Events</span></h5>
            </div>
            <p class="small text-secondary mb-3">
              Enterprise-grade collegiate event management platform. Discover campus workshops, hackathons, guest lectures, sports, and cultural festivals with instant QR pass registration.
            </p>
            <div class="d-flex gap-2">
              <span class="badge bg-dark border border-secondary text-secondary">MongoDB</span>
              <span class="badge bg-dark border border-secondary text-secondary">Express.js</span>
              <span class="badge bg-dark border border-secondary text-secondary">REST API</span>
              <span class="badge bg-dark border border-secondary text-secondary">JWT Secure</span>
            </div>
          </div>

          <div class="col-lg-2 col-md-3 col-6">
            <h6 class="text-white fw-bold mb-3">Explore</h6>
            <ul class="list-unstyled small d-flex flex-column gap-2 mb-0">
              <li><a href="/events.html">All Events</a></li>
              <li><a href="/events.html?category=Workshop">Workshops</a></li>
              <li><a href="/events.html?category=Cultural">Cultural Fests</a></li>
              <li><a href="/venues.html">Campus Venues</a></li>
            </ul>
          </div>

          <div class="col-lg-2 col-md-3 col-6">
            <h6 class="text-white fw-bold mb-3">Portals</h6>
            <ul class="list-unstyled small d-flex flex-column gap-2 mb-0">
              <li><a href="/student-dashboard.html">Student Portal</a></li>
              <li><a href="/organizer-dashboard.html">Organizer Desk</a></li>
              <li><a href="/admin-dashboard.html">Admin Console</a></li>
              <li><a href="/feedback.html">Suggestions</a></li>
            </ul>
          </div>

          <div class="col-lg-4 col-md-6">
            <h6 class="text-white fw-bold mb-3">Quick Access & Status</h6>
            <p class="small text-secondary mb-2">College Campus Hub &copy; 2026. Built with modern web standards and responsive architecture.</p>
            <div class="p-2 rounded bg-dark border border-secondary d-flex align-items-center justify-content-between">
              <span class="small text-light"><i class="bi bi-shield-check text-success me-1"></i> System Online</span>
              <a href="/api/health" target="_blank" class="small text-primary text-decoration-none">API Health &rarr;</a>
            </div>
          </div>
        </div>
        <div class="border-top border-secondary border-opacity-25 mt-4 pt-3 text-center small text-secondary">
          College Event Management System &bull; Production Ready Full-Stack Application
        </div>
      </div>
    </footer>
  `;
}

async function setupNotificationsCounter() {
  if (!window.Auth || !window.Auth.isLoggedIn()) return;
  try {
    const res = await window.api.get('/api/notifications');
    if (res.success && res.data && res.data.unreadCount > 0) {
      const badge = document.getElementById('nav-unread-badge');
      if (badge) {
        badge.innerText = res.data.unreadCount > 99 ? '99+' : res.data.unreadCount;
        badge.classList.remove('d-none');
      }
    }
  } catch (e) {
    // Non-blocking
  }
}
