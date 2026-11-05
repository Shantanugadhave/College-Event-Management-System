// Validation utility functions according to exact business rules

const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
const phoneRegex = /^\+?[0-9]{10,15}$/;
const validCategories = ['Academic', 'Cultural', 'Sports', 'Social', 'Workshop', 'Seminar'];
const validRegistrationStatuses = ['registered', 'waitlisted', 'checked-in', 'cancelled', 'no-show'];

const validateRegistrationInput = (data) => {
  const errors = [];
  const { name, email, password, phone, role, organizationNumber } = data;

  if (!name || name.trim().length < 2 || name.trim().length > 100) {
    errors.push('Name must be between 2 and 100 characters');
  }

  if (!email || !emailRegex.test(email.trim())) {
    errors.push('A valid RFC 5322 email address is required');
  }

  if (!password || password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }

  if (!phone || !phoneRegex.test(phone.trim())) {
    errors.push('Phone number must be 10-15 digits with optional country code');
  }

  if (role && !['student', 'organizer', 'admin'].includes(role)) {
    errors.push('Invalid role specified');
  }

  if (role === 'organizer' && (!organizationNumber || organizationNumber.trim().length < 2)) {
    errors.push('Organizers must provide an organization registration number');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

const validateEventInput = (data, isUpdate = false) => {
  const errors = [];
  const { title, description, category, startDate, endDate, startTime, endTime, capacity, budget } = data;

  if (!isUpdate || title !== undefined) {
    if (!title || title.trim().length < 2 || title.trim().length > 200) {
      errors.push('Event title must be between 2 and 200 characters');
    }
  }

  if (!isUpdate || description !== undefined) {
    if (!description || description.trim().length < 50) {
      errors.push('Event description must be at least 50 characters');
    }
  }

  if (!isUpdate || category !== undefined) {
    if (!category || !validCategories.includes(category)) {
      errors.push(`Category must be one of: ${validCategories.join(', ')}`);
    }
  }

  if (startDate !== undefined && endDate !== undefined) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      errors.push('Valid start and end dates are required');
    } else {
      const now = new Date();
      // For new events, startDate must be in the future (allowing slight clock drift of 1 min)
      if (!isUpdate && start.getTime() < now.getTime() - 60000) {
        errors.push('Event start date must be in the future');
      }

      // Check date order and duration
      // Combine with time if provided
      let startDateTime = new Date(start);
      let endDateTime = new Date(end);

      if (startTime) {
        const [sh, sm] = startTime.split(':').map(Number);
        if (!isNaN(sh) && !isNaN(sm)) {
          startDateTime.setHours(sh, sm, 0, 0);
        }
      }
      if (endTime) {
        const [eh, em] = endTime.split(':').map(Number);
        if (!isNaN(eh) && !isNaN(em)) {
          endDateTime.setHours(eh, em, 0, 0);
        }
      }

      if (endDateTime.getTime() <= startDateTime.getTime()) {
        errors.push('Start date and time must be before end date and time');
      } else {
        const durationHours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
        if (durationHours < 1) {
          errors.push('Event duration must be at least 1 hour');
        }
      }
    }
  }

  if (!isUpdate || capacity !== undefined) {
    const capNum = Number(capacity);
    if (isNaN(capNum) || capNum <= 0 || !Number.isInteger(capNum)) {
      errors.push('Capacity must be a positive integer greater than 0');
    }
  }

  if (budget !== undefined) {
    const budgetNum = Number(budget);
    if (isNaN(budgetNum) || budgetNum < 0) {
      errors.push('Budget cannot be negative');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

const validateVenueInput = (data, isUpdate = false) => {
  const errors = [];
  const { name, location, capacity } = data;

  if (!isUpdate || name !== undefined) {
    if (!name || name.trim().length < 2 || name.trim().length > 100) {
      errors.push('Venue name must be between 2 and 100 characters');
    }
  }

  if (!isUpdate || location !== undefined) {
    if (!location || location.trim().length === 0) {
      errors.push('Venue location is required');
    }
  }

  if (!isUpdate || capacity !== undefined) {
    const capNum = Number(capacity);
    if (isNaN(capNum) || capNum <= 0 || !Number.isInteger(capNum)) {
      errors.push('Venue capacity must be a positive integer');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

const validateFeedbackInput = (data) => {
  const errors = [];
  const { rating, comment, qualityRating, organizationRating, venueRating, contentRelevanceRating, overallValueRating } = data;

  const r = Number(rating);
  if (isNaN(r) || r < 1 || r > 5 || !Number.isInteger(r)) {
    errors.push('Overall rating must be an integer between 1 and 5');
  }

  if (comment && comment.length > 1000) {
    errors.push('Comment cannot exceed 1000 characters');
  }

  [qualityRating, organizationRating, venueRating, contentRelevanceRating, overallValueRating].forEach((subRating) => {
    if (subRating !== undefined) {
      const sr = Number(subRating);
      if (isNaN(sr) || sr < 1 || sr > 5) {
        errors.push('Detailed ratings must be between 1 and 5');
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
};

module.exports = {
  validateRegistrationInput,
  validateEventInput,
  validateVenueInput,
  validateFeedbackInput,
  validCategories,
  validRegistrationStatuses,
};
