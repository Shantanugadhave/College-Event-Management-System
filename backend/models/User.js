const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
const phoneRegex = /^\+?[0-9]{10,15}$/;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [emailRegex, 'Please provide a valid RFC 5322 email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [phoneRegex, 'Phone number must be 10-15 digits with optional + prefix'],
    },
    role: {
      type: String,
      enum: ['student', 'organizer', 'admin'],
      default: 'student',
    },
    organizationNumber: {
      type: String,
      trim: true,
      default: '',
    },
    interests: {
      type: [String],
      default: [],
    },
    preferences: {
      emailNotifications: { type: Boolean, default: true },
      eventReminders: { type: Boolean, default: true },
      theme: { type: String, enum: ['light', 'dark'], default: 'light' },
    },
    profileImage: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: function () {
        // Students and admins are verified by default, organizers require admin verification
        return this.role !== 'organizer';
      },
    },
  },
  {
    timestamps: true,
  }
);

// Password hashing pre-save hook
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;
