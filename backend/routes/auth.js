/* eslint-disable no-console */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Company = require('../models/Company');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { sendEmail } = require('../utils/emailService');
// Basic signup email verification OTP uses dedicated fields on Company model

// Helper to generate 6-digit codes
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Public route: basic account creation (phase 1 signup)
// Accepts: companyName, email, phone, password, confirmPassword (validated client-side), optional referral
// Creates a minimal Company record with placeholder fields and sends email OTP
router.post('/register-basic', async (req, res) => {
  try {
    const { companyName, email, phone, password } = req.body;
    if (!companyName || !email || !phone || !password) {
      return res.status(400).json({ error: 'companyName, email, phone, password required' });
    }

    // Prevent duplicate
    const existing = await Company.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Create minimal company (Username derive from email local-part if not set)
    const username = `${email.split('@')[0]  }-${  Math.random().toString(36).slice(2,6)}`;
    const nowYear = new Date().getFullYear().toString();
    const company = new Company({
      companyName,
      email,
      phone,
      password,
      Username: username,
      yearEstablished: nowYear,
      type: 'Unknown',
      description: 'No description provided',
      approved: false,
      status: 'pending',
      profileCompleted: false,
      subscriptionPlan: 'free',
      subscriptionStatus: 'inactive'
    });
    // Generate verification OTP
    company.emailVerificationCode = generateOtp();
    company.emailVerificationExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    await company.save();

    // Send OTP email (reuse existing otp template)
  sendEmail(email, 'otp', { code: company.emailVerificationCode, expiresInMinutes: 10, companyName, context: 'verify' });
    return res.status(201).json({ message: 'Account created. Verify OTP sent to email.' });
  } catch (err) {
    console.error('register-basic error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Verify signup email OTP
router.post('/verify-signup-otp', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'email and code required' });
    const company = await Company.findOne({ email });
    if (!company || !company.emailVerificationCode || !company.emailVerificationExpiry) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }
    if (company.emailVerificationCode !== code || company.emailVerificationExpiry.getTime() < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }
    company.emailVerified = true;
    company.emailVerificationCode = undefined;
    company.emailVerificationExpiry = undefined;
    await company.save({ validateModifiedOnly: true });
    return res.json({ message: 'Email verified. You can now login.' });
  } catch (err) {
    console.error('verify-signup-otp error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Resend signup OTP
router.post('/resend-signup-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    const company = await Company.findOne({ email });
    if (!company) return res.status(404).json({ error: 'Account not found' });
    if (company.emailVerified) return res.status(400).json({ error: 'Already verified' });
    company.emailVerificationCode = generateOtp();
    company.emailVerificationExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await company.save({ validateModifiedOnly: true });
  sendEmail(email, 'otp', { code: company.emailVerificationCode, expiresInMinutes: 10, companyName: company.companyName, context: 'verify' });
    return res.json({ message: 'OTP resent' });
  } catch (err) {
    console.error('resend-signup-otp error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});


// Basic authentication route - can be extended with actual authentication
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const company = await Company.findOne({ email });
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    // Use the comparePassword method
    const isMatch = await company.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // If email not verified, send OTP and block login until verified
    if (!company.emailVerified) {
      company.emailVerificationCode = generateOtp();
      company.emailVerificationExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await company.save({ validateModifiedOnly: true });
      try {
        await sendEmail(company.email, 'otp', {
          code: company.emailVerificationCode,
          expiresInMinutes: 10,
          companyName: company.companyName,
          context: 'verify'
        });
      } catch (err) {
        console.error('Login verification email send failed:', err);
      }
      return res.status(403).json({
        error: 'Email not verified. OTP sent to your email.',
        requireEmailVerification: true
      });
    }

    // Create JWT token
    const token = jwt.sign({ user: { id: company._id, email: company.email } }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });
    
    // Remove password from response
    const companySafe = company.toObject();
    delete companySafe.password;
    
    res.json({ token, company: companySafe });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Forgot Password - Generate OTP and send via email
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find company by email
    const company = await Company.findOne({ email });
    if (!company) {
      // For security reasons, don't reveal that the email doesn't exist
      return res.status(200).json({
        message: 'If your email is registered, you will receive an OTP to reset your password'
      });
    }

    // Generate a 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + (10 * 60 * 1000)); // 10 minutes

    // Update using updateOne to avoid any validation edge cases on save
    try {
      await Company.updateOne(
        { _id: company._id },
        { $set: { otpCode: code, otpExpiry } },
        { runValidators: false }
      );
  } catch {
      // As a fallback, bypass Mongoose validation entirely
      await Company.collection.updateOne(
        { _id: company._id },
        { $set: { otpCode: code, otpExpiry } }
      );
    }

    // Send OTP email (do not fail the request if email sending fails)
    const emailResult = await sendEmail(
      email,
      'otp',
      { code, expiresInMinutes: 10, companyName: company.companyName, contactName: company.contactName, context: 'reset' }
    );
    if (!emailResult?.success) {
      // Log but do not disclose to client
      console.error('OTP email send failed:', emailResult?.error);
    }

    return res.status(200).json({
      message: 'If your email is registered, you will receive an OTP to reset your password'
    });
  } catch (err) {
    console.error('Forgot password error:', err?.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }

    const company = await Company.findOne({ email });
    if (!company || !company.otpCode || !company.otpExpiry) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    if (company.otpCode !== code || company.otpExpiry.getTime() < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Issue a short-lived token to allow password reset and clear OTP via atomic update
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    try {
      await Company.updateOne(
        { _id: company._id },
        { $unset: { otpCode: "", otpExpiry: "" }, $set: { resetToken, resetTokenExpiry } },
        { runValidators: false }
      );
  } catch {
      await Company.collection.updateOne(
        { _id: company._id },
        { $unset: { otpCode: "", otpExpiry: "" }, $set: { resetToken, resetTokenExpiry } }
      );
    }

    res.json({ message: 'OTP verified', token: resetToken });
  } catch (err) {
    console.error('Verify OTP error:', err?.message || err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset Password - Validate token and update password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, email, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    // Find company with matching token and email
    const query = email
      ? { email, resetToken: token, resetTokenExpiry: { $gt: Date.now() } }
      : { resetToken: token, resetTokenExpiry: { $gt: Date.now() } };
    const company = await Company.findOne(query);
    if (!company) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    // Hash new password and update atomically to avoid double hashing via pre-save
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);
    try {
      await Company.updateOne(
        { _id: company._id },
        { $set: { password: hashed }, $unset: { resetToken: "", resetTokenExpiry: "" } },
        { runValidators: false }
      );
  } catch {
      await Company.collection.updateOne(
        { _id: company._id },
        { $set: { password: hashed }, $unset: { resetToken: "", resetTokenExpiry: "" } }
      );
    }

    res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err?.message || err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
