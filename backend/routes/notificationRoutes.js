const express = require('express');
const router = express.Router();
const {
  getNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
} = require('../controllers/notificationController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', getNotifications);
router.post('/', adminMiddleware, createNotification);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);
router.delete('/clear-all', clearAllNotifications);
router.delete('/:id', deleteNotification);

module.exports = router;
