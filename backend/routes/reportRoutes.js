const express = require('express');
const router = express.Router();
const {
  getAdminOverview,
  getOrganizerOverview,
  getStudentOverview,
  exportCsvReport,
} = require('../controllers/reportController');
const {
  authMiddleware,
  adminMiddleware,
  organizerMiddleware,
} = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/admin-overview', adminMiddleware, getAdminOverview);
router.get('/organizer-overview', organizerMiddleware, getOrganizerOverview);
router.get('/student-overview', getStudentOverview);
router.get('/export-csv', organizerMiddleware, exportCsvReport);

module.exports = router;
