const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl}`,
    errors: ['Endpoint does not exist'],
  });
};

const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || 'Internal Server Error';
  let errors = [];

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((e) => e.message);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value entered for ${field}. Please use another value.`;
    errors = [`${field} already exists`];
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Resource not found with id: ${err.value}`;
    errors = ['Invalid ID format'];
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authorization token';
    errors = ['Token signature invalid'];
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authorization token has expired';
    errors = ['Token expired'];
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    message = 'Uploaded file exceeds the 5MB size limit';
    errors = ['File size too large'];
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors: errors.length > 0 ? errors : [message],
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { notFoundHandler, errorHandler };
