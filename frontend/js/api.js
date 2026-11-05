// Centralized Frontend API Service for College Event Management System

const API_BASE_URL = ''; // Relative path because frontend is served from Express

async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    ...options.headers,
  };

  // Only set application/json if body is not FormData
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json().catch(() => ({
      success: response.ok,
      message: response.statusText,
    }));

    if (!response.ok) {
      if (response.status === 401 && token) {
        console.warn('Session expired or unauthorized. Clearing stored token.');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (!window.location.pathname.includes('login.html')) {
          window.location.href = '/login.html?expired=true';
        }
      }
      const errorMsg = data.message || (data.errors && data.errors[0]) || 'Something went wrong';
      const error = new Error(errorMsg);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    throw error;
  }
}

const api = {
  get: (endpoint, params = {}) => {
    const query = new URLSearchParams();
    Object.keys(params).forEach((key) => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        query.append(key, params[key]);
      }
    });
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return apiRequest(`${endpoint}${queryString}`, { method: 'GET' });
  },

  post: (endpoint, body = {}) => {
    return apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  put: (endpoint, body = {}) => {
    return apiRequest(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  delete: (endpoint, body = {}) => {
    return apiRequest(endpoint, {
      method: 'DELETE',
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
    });
  },

  upload: (formData) => {
    return apiRequest('/api/upload', {
      method: 'POST',
      body: formData,
    });
  },
};

window.api = api;
window.apiRequest = apiRequest;
