require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const { connectDB } = require('./config/db');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');
const User = require('./models/User');
const seedData = require('./seeds/seed');

// Route imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const eventRoutes = require('./routes/eventRoutes');
const registrationRoutes = require('./routes/registrationRoutes');
const venueRoutes = require('./routes/venueRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const suggestionRoutes = require('./routes/suggestionRoutes');
const reportRoutes = require('./routes/reportRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();

// Security HTTP headers (allowing static resources/images)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Enable CORS
app.use(cors());

// Request logging
app.use(morgan('dev'));

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150, // limit each IP to 150 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication requests from this IP. Please try again after 15 minutes.',
  },
});
app.use('/api/auth', authLimiter);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve uploaded media
app.use('/uploads', express.static(uploadDir));

// Serve frontend static files
const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'College Event Management API is online and healthy.',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/suggestions', suggestionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/upload', uploadRoutes);

// Direct short URL for QR scanning / ticket verification
app.get('/registration/:id', (req, res) => {
  res.redirect(`/verify-ticket.html?id=${encodeURIComponent(req.params.id)}`);
});

// Fallback to frontend index.html for root path or HTML navigation
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// 404 for API routes
app.use('/api/*', notFoundHandler);

// Centralized error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';
const { getLocalIp } = require('./controllers/registrationController');

const startServer = async () => {
  try {
    await connectDB();
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('[Database] Empty database detected. Auto-seeding initial college events, venues, and users...');
      await seedData(false);
    }
    return new Promise((resolve, reject) => {
      const server = app.listen(PORT, HOST, () => {
        const lanIp = getLocalIp();
        console.log(`====================================================`);
        console.log(`🎓 College Event Management System Backend Started!`);
        console.log(`🚀 Local access:       http://localhost:${PORT}`);
        console.log(`🌐 Network LAN access:   http://${lanIp}:${PORT}`);
        console.log(`📱 QR Scan Base URL:    http://${lanIp}:${PORT}`);
        console.log(`📚 API Healthcheck:     http://localhost:${PORT}/api/health`);
        console.log(`====================================================`);
        resolve(server);
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`[Server] Port ${PORT} already in use. Continuing with existing running instance.`);
          resolve(null);
        } else {
          console.error('Fatal Server Startup Error:', err);
          reject(err);
        }
      });
    });
  } catch (error) {
    console.error('Fatal Server Startup Error:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
