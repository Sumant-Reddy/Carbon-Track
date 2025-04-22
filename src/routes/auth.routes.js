const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const User = require('../models/user.model');
const { AppError } = require('../middleware/error.middleware');
const { getQueue } = require('../config/queues');
const logger = require('../utils/logger');

const router = express.Router();

// Validation middleware
const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

// Register new user
router.post('/register', registerValidation, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Invalid input data', 400);
    }

    const { email, password, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError('Email already registered', 400);
    }

    // Hash password with bcrypt
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = await User.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
    });

    // Generate verification token
    const verificationToken = jwt.sign(
      { 
        id: user._id,
        email: user.email,
        hash: await bcrypt.hash(user.email, salt) // Add email hash for additional security
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Send verification email
    const emailQueue = getQueue('email');
    await emailQueue.add('verification', {
      to: user.email,
      subject: 'Verify your email',
      template: 'verification',
      context: {
        name: user.firstName,
        verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`,
      },
    });

    // Generate JWT token with bcrypt hash
    const tokenPayload = {
      id: user._id,
      email: user.email,
      hash: await bcrypt.hash(user.email + user._id, salt) // Add combined hash for additional security
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });

    res.status(201).json({
      status: 'success',
      message: 'Registration successful. Please check your email to verify your account.',
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

// Login user
router.post('/login', loginValidation, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Invalid input data', 400);
    }

    const { email, password } = req.body;

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    // Check password with bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      throw new AppError('Please verify your email first', 401);
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      return res.status(200).json({
        status: 'success',
        message: '2FA required',
        requiresTwoFactor: true,
        userId: user._id,
      });
    }

    // Generate salt for token hash
    const salt = await bcrypt.genSalt(12);
    
    // Generate JWT token with bcrypt hash
    const tokenPayload = {
      id: user._id,
      email: user.email,
      hash: await bcrypt.hash(user.email + user._id, salt) // Add combined hash for additional security
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });

    res.status(200).json({
      status: 'success',
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

// Verify 2FA
router.post('/verify-2fa', async (req, res, next) => {
  try {
    const { userId, token } = req.body;

    const user = await User.findById(userId).select('+twoFactorSecret');
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
    });

    if (!verified) {
      throw new AppError('Invalid 2FA token', 401);
    }

    // Generate salt for token hash
    const salt = await bcrypt.genSalt(12);
    
    // Generate JWT token with bcrypt hash
    const tokenPayload = {
      id: user._id,
      email: user.email,
      hash: await bcrypt.hash(user.email + user._id, salt) // Add combined hash for additional security
    };

    const jwtToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });

    res.status(200).json({
      status: 'success',
      token: jwtToken,
      user: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

// Setup 2FA
router.post('/setup-2fa', async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('+twoFactorSecret');
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const secret = speakeasy.generateSecret({
      name: `CarbonTrack:${user.email}`,
    });

    user.twoFactorSecret = secret.base32;
    await user.save();

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.status(200).json({
      status: 'success',
      secret: secret.base32,
      qrCode: qrCodeUrl,
    });
  } catch (error) {
    next(error);
  }
});

// Enable 2FA
router.post('/enable-2fa', async (req, res, next) => {
  try {
    const { token } = req.body;

    const user = await User.findById(req.user.id).select('+twoFactorSecret');
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
    });

    if (!verified) {
      throw new AppError('Invalid 2FA token', 401);
    }

    user.twoFactorEnabled = true;
    await user.save();

    res.status(200).json({
      status: 'success',
      message: '2FA enabled successfully',
    });
  } catch (error) {
    next(error);
  }
});

// Disable 2FA
router.post('/disable-2fa', async (req, res, next) => {
  try {
    const { token } = req.body;

    const user = await User.findById(req.user.id).select('+twoFactorSecret');
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
    });

    if (!verified) {
      throw new AppError('Invalid 2FA token', 401);
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    await user.save();

    res.status(200).json({
      status: 'success',
      message: '2FA disabled successfully',
    });
  } catch (error) {
    next(error);
  }
});

// Forgot password
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      throw new AppError('No user found with that email', 404);
    }

    // Generate salt for reset token hash
    const salt = await bcrypt.genSalt(12);
    const resetHash = await bcrypt.hash(user.email + Date.now(), salt);

    const resetToken = jwt.sign(
      { 
        id: user._id,
        email: user.email,
        hash: resetHash
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const emailQueue = getQueue('email');
    await emailQueue.add('reset-password', {
      to: user.email,
      subject: 'Reset your password',
      template: 'reset-password',
      context: {
        name: user.firstName,
        resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`,
      },
    });

    res.status(200).json({
      status: 'success',
      message: 'Password reset email sent',
    });
  } catch (error) {
    next(error);
  }
});

// Reset password
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({
      _id: decoded.id,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    // Hash new password with bcrypt
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Password reset successful',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 