const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    select: false,
    minlength: [8, 'Password must be at least 8 characters long'],
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
  },
  profilePicture: {
    type: String,
    default: null,
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  twoFactorSecret: {
    type: String,
    select: false,
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  language: {
    type: String,
    enum: ['en', 'es', 'fr', 'de', 'zh'],
    default: 'en',
  },
  carbonBudget: {
    daily: {
      type: Number,
      default: 20, // kg CO2e per day
    },
    weekly: {
      type: Number,
      default: 140, // kg CO2e per week
    },
    monthly: {
      type: Number,
      default: 600, // kg CO2e per month
    },
  },
  preferences: {
    notifications: {
      email: {
        type: Boolean,
        default: true,
      },
      push: {
        type: Boolean,
        default: true,
      },
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system',
    },
    units: {
      distance: {
        type: String,
        enum: ['km', 'mi'],
        default: 'km',
      },
      weight: {
        type: String,
        enum: ['kg', 'lb'],
        default: 'kg',
      },
    },
  },
  stats: {
    totalEmissions: {
      type: Number,
      default: 0,
    },
    streakDays: {
      type: Number,
      default: 0,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  emailVerificationToken: String,
  emailVerificationExpires: Date,
}, {
  timestamps: true,
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ 'stats.lastActive': 1 });

// Pre-save middleware
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance methods
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  delete obj.twoFactorSecret;
  return obj;
};

// Static methods
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

const User = mongoose.model('User', userSchema);

module.exports = User; 