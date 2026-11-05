// Utility Functions for UI, Formatting, Toasts, and Badges

const Utils = {
  showToast: (message, type = 'success', duration = 4000) => {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;

    let icon = 'bi-check-circle-fill text-success';
    if (type === 'error') icon = 'bi-exclamation-circle-fill text-danger';
    if (type === 'warning') icon = 'bi-exclamation-triangle-fill text-warning';
    if (type === 'info') icon = 'bi-info-circle-fill text-primary';

    toast.innerHTML = `
      <i class="bi ${icon} fs-4"></i>
      <div class="flex-grow-1">
        <div class="fw-bold text-dark small text-uppercase" style="letter-spacing:0.04em;">
          ${type === 'error' ? 'Attention' : type.charAt(0).toUpperCase() + type.slice(1)}
        </div>
        <div class="text-secondary small mt-1">${message}</div>
      </div>
      <button type="button" class="btn-close btn-sm" aria-label="Close"></button>
    `;

    const closeBtn = toast.querySelector('.btn-close');
    closeBtn.addEventListener('click', () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      setTimeout(() => toast.remove(), 300);
    });

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(50px)';
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  },

  formatDate: (dateString, options = {}) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-US', {
      month: options.shortMonth ? 'short' : 'long',
      day: 'numeric',
      year: 'numeric',
      ...options,
    });
  },

  formatTime: (timeString) => {
    if (!timeString) return '';
    // If it's already HH:MM format
    if (/^\d{1,2}:\d{2}$/.test(timeString)) {
      const [h, m] = timeString.split(':').map(Number);
      const period = h >= 12 ? 'PM' : 'AM';
      const hour12 = h % 12 || 12;
      return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
    }
    return timeString;
  },

  getCategoryBadge: (category) => {
    const valid = ['Academic', 'Cultural', 'Sports', 'Social', 'Workshop', 'Seminar'];
    const cat = valid.includes(category) ? category : 'Academic';
    return `<span class="badge-category badge-${cat}">${cat}</span>`;
  },

  getStatusBadge: (status) => {
    const s = (status || 'draft').toLowerCase();
    const formatted = s.charAt(0).toUpperCase() + s.slice(1);
    return `<span class="badge-status status-${s}">${formatted}</span>`;
  },

  renderStarRating: (rating, showNumber = true) => {
    const r = Math.round(Number(rating) || 0);
    let stars = '';
    for (let i = 1; i <= 5; i++) {
      if (i <= r) {
        stars += '<i class="bi bi-star-fill text-warning"></i>';
      } else {
        stars += '<i class="bi bi-star text-muted opacity-50"></i>';
      }
    }
    if (showNumber) {
      stars += ` <span class="ms-1 fw-bold text-dark small">${Number(rating || 0).toFixed(1)}</span>`;
    }
    return stars;
  },

  debounce: (fn, delay = 300) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  escapeHtml: (str) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },
};

window.Utils = Utils;
