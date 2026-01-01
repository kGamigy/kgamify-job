/* eslint-disable no-console */
// filepath: /backend/routes/application.js
const express = require('express');
const router = express.Router();
const Application = require('../models/Application');
const Company = require('../models/Company');
const { upload } = require('../config/cloudinary');
const Job = require('../models/Job');

// Modified middleware to check logged-in company
const checkCompany = async (req, res, next) => {
  // Get email from query params, body, or headers (added company-email header)
  const email = req.query.email || req.body.email || req.headers['company-email'];
  
  try {
    if (!email) {
      console.error('Missing company email in request');
      return res.status(400).json({ error: 'Company email is required for authentication' });
    }
    
    const company = await Company.findOne({ email });
    if (!company) {
      console.error(`No company found with email: ${email}`);
      return res.status(401).json({ error: 'Unauthorized - company not found' });
    }
    
    req.companyName = company.companyName;
    next();
  } catch (err) {
    console.error('Error in company authentication middleware:', err);
    res.status(400).json({ error: err.message });
  }
};

// Enforce subscription active for resume/app access
const checkCompanySubscriptionActive = async (req, res, next) => {
  try {
    const email = req.query.email || req.body.email || req.headers['company-email'];
    if (!email) return res.status(400).json({ error: 'Company email is required' });
    const company = await Company.findOne({ email });
    if (!company) return res.status(401).json({ error: 'Unauthorized - company not found' });
    const now = new Date();
    const expired = company.subscriptionStatus === 'expired' || (company.subscriptionExpiresAt && now > new Date(company.subscriptionExpiresAt));
    if (expired) {
      if (company.subscriptionStatus !== 'expired') {
        company.subscriptionStatus = 'expired';
        await company.save({ validateModifiedOnly: true }).catch(()=>{});
      }
      return res.status(403).json({ error: 'Subscription expired. Access to applications and resumes is restricted until renewal.' });
    }
    return next();
  } catch {
    return res.status(500).json({ error: 'Subscription check failed' });
  }
};

// Create a new application with resume upload
router.post('/', upload.single('resume'), async (req, res) => {
  try {
    // Create application data object
    const applicationData = {
      ...req.body,
    };

    // Get the job details to ensure company email is included
    if (req.body.jobId) {
      try {
        const job = await Job.findById(req.body.jobId);
        if (job) {
          if (job.companyEmail && !applicationData.companyEmail) {
            applicationData.companyEmail = job.companyEmail;
          }
          // Ensure required CompanyName is present (Application schema requires capitalized CompanyName)
          if (!applicationData.CompanyName && (job.companyName || job.company)) {
            applicationData.CompanyName = job.companyName || job.company;
          }
        }
      } catch (err) {
        console.error("Error fetching job details:", err);
      }
    }

    // If still missing CompanyName but we have companyEmail, try to resolve via Company collection
    if (!applicationData.CompanyName && applicationData.companyEmail) {
      try {
        const companyDoc = await Company.findOne({ email: applicationData.companyEmail });
        if (companyDoc?.companyName) {
          applicationData.CompanyName = companyDoc.companyName;
        }
      } catch {
        // continue without blocking
      }
    }

    // Handle resume file if uploaded
    if (req.file) {
      applicationData.resume = req.file.path; // Cloudinary URL
      applicationData.resumePublicId = req.file.filename || 
        (req.file.public_id ? req.file.public_id : `resume_${Date.now()}`);
    }

    // Store appName if provided (e.g., "kGamify Web", "kGamify Mobile App")
    if (req.body.appName) {
      applicationData.appName = req.body.appName;
    }

    // Map applicant email if provided as `email` from form
    if (req.body.email && !applicationData.applicantEmail) {
      applicationData.applicantEmail = req.body.email;
    }

    const newApplication = new Application(applicationData);
    await newApplication.save();

    // Update job with the new applicant
    if (req.body.jobId) {
      await Job.findByIdAndUpdate(
        req.body.jobId,
        { $addToSet: { applicants: newApplication._id } }
      );
    }

    res.status(201).json(newApplication);
  } catch (err) {
    console.error('Error creating application:', err);
    res.status(400).json({ error: err.message });
  }
});

// Get all applications for a company by email (aggregated, most recent first)
router.get('/company', checkCompanySubscriptionActive, async (req, res) => {
  try {
    const email = req.query.email || req.headers['company-email'];
    if (!email) {
      return res.status(400).json({ error: 'Company email is required' });
    }

    const apps = await Application.find({ companyEmail: email })
      .sort({ createdAt: -1 })
      .populate({ path: 'jobId', select: 'jobTitle createdAt' });

    const payload = apps.map(a => ({
      id: a._id,
      jobId: a.jobId?._id || a.jobId,
      jobTitle: a.jobId?.jobTitle || 'Unknown Job',
      applicantName: a.applicantName,
      companyEmail: a.companyEmail,
      companyName: a.CompanyName,
      appliedAt: a.createdAt,
      jobCreatedAt: a.jobId?.createdAt || null,
      resume: a.resume || null,
      testScore: a.testScore || null,
      skills: a.skills || [],
      status: a.status || 'new',
    }));

    res.json({ count: payload.length, applications: payload });
  } catch (err) {
    console.error('Error fetching company applications:', err);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Get applications by job ID
router.get('/job/:jobId', checkCompany, checkCompanySubscriptionActive, async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Enhanced debugging info
    
    // First, verify the job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    
  // Check for ALL applications first - for debugging (removed unused loop)
  await Application.find({ jobId });
    
    // Unified approach - try all reasonable queries at once
    const companyEmail = req.query.email || req.headers['company-email'];
    const applications = await Application.find({
      jobId,
      $or: [
        // Match by company name (case insensitive)
        { CompanyName: { $regex: new RegExp(req.companyName, 'i') } },
        // Match by company name as companyName field (some docs might use this format)
        { companyName: { $regex: new RegExp(req.companyName, 'i') } },
        // Match by email (various possible field names)
        { companyEmail },
        { CompanyEmail: companyEmail },
        { company_email: companyEmail },
        // If this job's email matches the auth email, return all applications
        ...(job.companyEmail === companyEmail ? [{}] : [])
      ]
    });
    
    
    // If still no applications, check if the job is owned by this company and return all
    if (applications.length === 0 && job.companyEmail === companyEmail) {
      const allForJob = await Application.find({ jobId });
      
      // Format application data for response
      const formattedApplications = allForJob.map(app => ({
        _id: app._id,
        jobId: app.jobId,
        applicantName: app.applicantName,
        companyName: app.CompanyName || app.companyName || 'Unknown',
        companyEmail: app.companyEmail || app.CompanyEmail || job.companyEmail || '',
        resume: app.resume,
        resumePublicId: app.resumePublicId,
        testScore: app.testScore,
        skills: app.skills || [],
        createdAt: app.createdAt,
        status: app.status || 'new',
      }));
      
      return res.status(200).json(formattedApplications);
    }
    
    // Format application data for response
    const formattedApplications = applications.map(app => ({
      _id: app._id,
      jobId: app.jobId,
      applicantName: app.applicantName,
      companyName: app.CompanyName || app.companyName || 'Unknown',
      companyEmail: app.companyEmail || app.CompanyEmail || job.companyEmail || '',
      resume: app.resume,
      resumePublicId: app.resumePublicId,
      testScore: app.testScore,
      skills: app.skills || [],
      createdAt: app.createdAt,
      status: app.status || 'new',
    }));
    
    
    res.status(200).json(formattedApplications);
  } catch (err) {
    console.error('Error fetching job applications:', err);
    res.status(500).json({ error: 'Failed to fetch applications', message: err.message });
  }
});

// Get a specific application with resume URL
router.get('/:id', checkCompany, checkCompanySubscriptionActive, async (req, res) => {
  try {
    const application = await Application.findOne({
      _id: req.params.id,
      CompanyName: req.companyName
    });
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    // Generate a secure, time-limited URL for the resume if it exists
    let resumeUrl = null;
    if (application.resume) {
      // Use the existing URL or generate a secure URL with cloudinary if necessary
      resumeUrl = application.resume;
    }
    
    res.status(200).json({
      ...application.toObject(),
      resumeUrl
    });
  } catch (err) {
    console.error('Error fetching application:', err);
    res.status(400).json({ error: err.message });
  }
});

// Update application status (shortlist)
router.post('/:id/shortlist', async (req, res) => {
  try {
    const { id } = req.params;
    const app = await Application.findById(id);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    const actorEmail = req.headers['company-email'] || req.body?.email;
    if (!actorEmail || String(actorEmail).toLowerCase() !== String(app.companyEmail || '').toLowerCase()) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    app.status = 'shortlisted';
    await app.save();
    // Try sending email notification via email service if available
    try {
      const { sendEmail } = require('../utils/emailService');
      if (app.applicantEmail) {
        await sendEmail(app.applicantEmail, 'applicationStatusUpdate', {
          jobTitle: app.jobTitle || 'Your Application',
          companyName: app.CompanyName || 'Company',
          status: 'shortlisted',
          message: 'Congratulations! You have been shortlisted. We will contact you soon with next steps.'
        });
      }
  } catch (e) { if (process.env.NODE_ENV === 'development') console.debug('Email send failed:', e?.message); }
    res.json({ success: true, status: app.status });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update application status (reject)
router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const app = await Application.findById(id);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    const actorEmail = req.headers['company-email'] || req.body?.email;
    if (!actorEmail || String(actorEmail).toLowerCase() !== String(app.companyEmail || '').toLowerCase()) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    app.status = 'rejected';
    await app.save();
    try {
      const { sendEmail } = require('../utils/emailService');
      if (app.applicantEmail) {
        await sendEmail(app.applicantEmail, 'applicationStatusUpdate', {
          jobTitle: app.jobTitle || 'Your Application',
          companyName: app.CompanyName || 'Company',
          status: 'rejected',
          message: 'Thank you for applying. We appreciate your interest, but we will not be moving forward at this time.'
        });
      }
  } catch (e) { if (process.env.NODE_ENV === 'development') console.debug('Email send failed:', e?.message); }
    res.json({ success: true, status: app.status });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
