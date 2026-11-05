// Authentication and Authorization Manager

const Auth = {
  getCurrentUser: () => {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    } catch (e) {
      return null;
    }
  },

  getToken: () => {
    return localStorage.getItem('token') || null;
  },

  isLoggedIn: () => {
    return Boolean(Auth.getToken() && Auth.getCurrentUser());
  },

  hasRole: (role) => {
    const user = Auth.getCurrentUser();
    return Boolean(user && user.role === role);
  },

  setAuthSession: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },

  updateLocalUser: (updatedFields) => {
    const user = Auth.getCurrentUser() || {};
    const newUser = { ...user, ...updatedFields };
    localStorage.setItem('user', JSON.stringify(newUser));
    return newUser;
  },

  clearAuthSession: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  logout: async () => {
    try {
      if (window.api) {
        await window.api.post('/api/auth/logout');
      }
    } catch (e) {
      console.warn('Logout API warning:', e.message);
    } finally {
      Auth.clearAuthSession();
      window.location.href = '/login.html';
    }
  },

  refreshUser: async () => {
    if (!Auth.isLoggedIn()) return null;
    try {
      const response = await window.api.get('/api/auth/me');
      if (response.success && response.data) {
        localStorage.setItem('user', JSON.stringify(response.data));
        return response.data;
      }
    } catch (e) {
      console.warn('Could not refresh user profile:', e.message);
    }
    return Auth.getCurrentUser();
  },

  // Guard: Protect pages by required roles
  requireAuth: (allowedRoles = []) => {
    if (!Auth.isLoggedIn()) {
      const currentUrl = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login.html?redirect=${currentUrl}`;
      return false;
    }

    const user = Auth.getCurrentUser();
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      alert('Access Denied: You do not have permission to view this page.');
      // Redirect to appropriate dashboard
      if (user.role === 'admin') window.location.href = '/admin-dashboard.html';
      else if (user.role === 'organizer') window.location.href = '/organizer-dashboard.html';
      else window.location.href = '/student-dashboard.html';
      return false;
    }

    return true;
  },
};

window.Auth = Auth;
