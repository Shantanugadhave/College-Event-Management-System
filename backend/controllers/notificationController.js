const Notification = require('../models/Notification');

// @desc    Get user notifications (with unread counter)
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res, next) => {
  try {
    const { type, isRead } = req.query;
    const query = { user: req.user._id };

    if (type && type !== 'all') {
      query.type = type;
    }

    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }

    const notifications = await Notification.find(query)
      .populate('event', 'title startDate venue')
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      message: 'Notifications retrieved',
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create notification (Admin or system announcements)
// @route   POST /api/notifications
// @access  Private (Admin)
const createNotification = async (req, res, next) => {
  try {
    const { userId, title, message, type, eventId } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'userId, title, and message are required',
      });
    }

    const notification = await Notification.create({
      user: userId,
      title: title.trim(),
      message: message.trim(),
      type: type || 'announcement',
      event: eventId || null,
    });

    res.status(201).json({
      success: true,
      message: 'Notification created',
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, user: req.user._id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or access denied',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete single notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: id,
      user: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Clear all notifications for user
// @route   DELETE /api/notifications/clear-all
// @access  Private
const clearAllNotifications = async (req, res, next) => {
  try {
    await Notification.deleteMany({ user: req.user._id });

    res.status(200).json({
      success: true,
      message: 'All notifications cleared successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
};
