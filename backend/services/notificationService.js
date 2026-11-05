const Notification = require('../models/Notification');

const createNotification = async ({ userId, title, message, type = 'announcement', eventId = null }) => {
  try {
    const notification = await Notification.create({
      user: userId,
      title,
      message,
      type,
      event: eventId,
    });
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error.message);
    return null;
  }
};

const notifyMultipleUsers = async (userIds, { title, message, type = 'announcement', eventId = null }) => {
  try {
    const records = userIds.map((uid) => ({
      user: uid,
      title,
      message,
      type,
      event: eventId,
    }));
    await Notification.insertMany(records);
  } catch (error) {
    console.error('Error notifying multiple users:', error.message);
  }
};

module.exports = {
  createNotification,
  notifyMultipleUsers,
};
