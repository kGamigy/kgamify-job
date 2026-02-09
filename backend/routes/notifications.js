const express = require('express');
const router = express.Router();
const { sendEmail, sendBulkEmails, sendVerificationEmail } = require('../utils/emailService');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Notification = require('../models/Notification');

// Minimal list endpoint for in-app notifications UI (Mongo-backed)
router.get('/list', async (req, res) => {
  try {
    const { email, after } = req.query;
    if (!email) return res.json([]);
    const filter = { email };
    if (after) {
      const afterNum = Number(after);
      const afterDate = Number.isFinite(afterNum) ? new Date(afterNum) : new Date(after);
      if (!isNaN(afterDate.getTime())) {
        filter.createdAt = { $gt: afterDate };
      }
    }
    const list = await Notification.find(filter).sort({ createdAt: -1 }).limit(50).lean();
    res.json(list);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Mark selected notifications as read
router.post('/mark-read', async (req, res) => {
  try {
    const { email, ids } = req.body || {};
    if (!email || !Array.isArray(ids) || !ids.length) return res.status(400).json({ success: false, message: 'Invalid payload' });
    await Notification.updateMany({ email, _id: { $in: ids } }, { $set: { read: true } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Mark all notifications as read
router.post('/mark-all-read', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ success: false, message: 'Invalid payload' });
    await Notification.updateMany({ email, read: false }, { $set: { read: true } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Send job application notification to employer
router.post('/job-application', async (req, res) => {
  try {
    const { jobId, applicantData, employerEmail } = req.body;

    // Get job details
    const job = await Job.findById(jobId).populate('company');
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const emailData = {
      jobTitle: job.title,
      companyName: job.company.name,
      applicantName: applicantData.name,
      applicantEmail: applicantData.email,
      coverLetter: applicantData.coverLetter
    };

    const result = await sendEmail(employerEmail, 'jobApplication', emailData);

    // Persist in-app notification for employer
    try {
      await Notification.create({
        email: employerEmail,
        type: 'application',
        title: `New application for ${job.title}`,
        message: `${applicantData.name} applied to ${job.title}`,
        meta: { jobId: String(job._id), applicantEmail: applicantData.email }
      });
    } catch { /* ignore */ }

    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Application notification sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send notification',
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message
    });
  }
});

// Send job posted confirmation to employer
router.post('/job-posted', async (req, res) => {
  try {
    const { jobId, employerEmail } = req.body;

    const job = await Job.findById(jobId).populate('company');
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const emailData = {
      jobTitle: job.title,
      companyName: job.company.name,
      location: job.location,
      salary: job.salary
    };

    const result = await sendEmail(employerEmail, 'jobPosted', emailData);

    try {
      await Notification.create({
        email: employerEmail,
        type: 'job',
        title: `Job posted: ${job.title}`,
        message: `Your job "${job.title}" has been posted.`,
        meta: { jobId: String(job._id) }
      });
    } catch { /* ignore */ }

    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Job posted notification sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send notification',
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message
    });
  }
});

// Send application status update to applicant
router.post('/application-status', async (req, res) => {
  try {
    const { applicationId, status, message } = req.body;

    const application = await Application.findById(applicationId)
      .populate('job')
      .populate('user');

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    const job = await Job.findById(application.job).populate('company');

    const emailData = {
      jobTitle: job.title,
      companyName: job.company.name,
      status,
      message
    };

    const result = await sendEmail(application.user.email, 'applicationStatusUpdate', emailData);

    try {
      await Notification.create({
        email: application.user.email,
        type: 'status',
        title: `Application ${status}`,
        message: message || `Your application for ${job.title} was ${status}.`,
        meta: { applicationId: String(application._id), jobId: String(job._id) }
      });
    } catch { /* ignore */ }

    if (result.success) {
      // Update application status in database
      application.status = status;
      if (message) application.message = message;
      await application.save();

      res.json({ 
        success: true, 
        message: 'Status update notification sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send notification',
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message
    });
  }
});

// Send password reset email
router.post('/password-reset', async (req, res) => {
  try {
    const { email, resetToken } = req.body;

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const emailData = {
      resetLink
    };

    const result = await sendEmail(email, 'passwordReset', emailData);

    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Password reset email sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send reset email',
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message
    });
  }
});

// Send email verification
router.post('/verify-email', async (req, res) => {
  try {
    const { email, verificationToken } = req.body;

    const result = await sendVerificationEmail(email, verificationToken);

    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Verification email sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send verification email',
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message
    });
  }
});

// Send bulk notifications (for announcements, etc.)
router.post('/bulk-notify', async (req, res) => {
  try {
    const { recipients, template, data } = req.body;

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ message: 'Invalid recipients list' });
    }

    const results = await sendBulkEmails(recipients, template, data);

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    res.json({
      success: true,
      message: `Bulk email sent. ${successCount} successful, ${failCount} failed`,
      results
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message
    });
  }
});

// Test email endpoint (for development)
router.post('/test', async (req, res) => {
  try {
    const { email } = req.body;

    const testData = {
      jobTitle: 'Test Job Position',
      companyName: 'Test Company',
      applicantName: 'Test User',
      applicantEmail: 'test@example.com',
      coverLetter: 'This is a test email from KGamify notification system.'
    };

    const result = await sendEmail(email, 'jobApplication', testData);

    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Test email sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send test email',
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;
