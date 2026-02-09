/* eslint-disable no-console */
const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const { upload, cloudinary } = require('../config/cloudinary');
const bcrypt = require('bcryptjs');
const { getDocumentUrl, getDocumentDownloadUrl } = require('../utils/documentHelper');
const { sendEmail } = require('../utils/emailService');
// New unified plan config (durations & limits) imported from config
const { plans, getPlan, computeSubscriptionDates } = require('../config/plans');
const PLAN_LIMITS = { free: plans.free.jobLimit, paid3m: plans.paid3m.jobLimit, paid6m: plans.paid6m.jobLimit, paid12m: plans.paid12m.jobLimit };
const PLAN_PRICING = { free: 0, paid3m: 1, paid6m: 1, paid12m: 1 }; // INR pricing
// Messaging additions

// Middleware to authenticate company
const authenticateCompany = async (req, res, next) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const company = await Company.findOne({ email });
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    req.user = { email: company.email };
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// Regular company registration
router.post('/', upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'documents', maxCount: 10 },
  { name: 'images', maxCount: 10 }
]), async (req, res) => {
  try {

    // Check for existing company with same email or username
    const { email, Username } = req.body;
    const existingCompany = await Company.findOne({
      $or: [
        { email },
        { Username }
      ]
    });
    if (existingCompany) {
      // Clean up uploaded files if a conflict exists
      if (req.files?.logo) {
        try {
          await cloudinary.uploader.destroy(req.files.logo[0].filename);
  } catch {
          // ignore cleanup failure
        }
      }
      if (req.files?.documents) {
        try {
          await cloudinary.uploader.destroy(req.files.documents[0].filename);
  } catch {
          // ignore cleanup failure
        }
      }
      const conflictField = existingCompany.email === email ? 'Email' : 'Username';
      return res.status(400).json({ error: `${conflictField} already registered` });
    }

    // Parse socialMediaLinks if it's provided as a string
    const companyData = { ...req.body };
    if (companyData.socialMediaLinks && typeof companyData.socialMediaLinks === 'string') {
      try {
        companyData.socialMediaLinks = JSON.parse(companyData.socialMediaLinks);
      } catch (error) {
        console.error('Error parsing socialMediaLinks:', error);
        return res.status(400).json({ error: 'Invalid socialMediaLinks format' });
      }
    }

    const documentsArr = Array.isArray(req.files?.documents) ? req.files.documents.map(f => f.path) : [];
    const imagesArr = Array.isArray(req.files?.images) ? req.files.images.map(f => f.path) : [];

    const newCompany = new Company({
      ...companyData,
      // Ensure optional fields exist for minimal registration
      contactName: companyData.contactName || undefined,
      phone: companyData.phone || undefined,
      address: companyData.address || undefined,
      size: companyData.size || undefined,
      registrationNumber: companyData.registrationNumber ? companyData.registrationNumber : undefined,
      logo: req.files?.logo ? req.files.logo[0].path : null,
      // Keep first document for legacy field; store all in documentsList
      documents: documentsArr[0] || null,
      documentsList: documentsArr,
      images: imagesArr,
      approved: false,
      profileCompleted: false
    });

    await newCompany.save(); // Password will be hashed by pre-save hook
    res.status(201).json({ message: 'Company registration request sent for approval' });
  } catch (error) {
    console.error('Server error:', error);
    // Handle duplicate key error for unique Username/email
    if (error?.code === 11000) {
      const key = Object.keys(error.keyPattern || {})[0] || 'Field';
      return res.status(400).json({ error: `${key} already registered` });
    }
    res.status(400).json({ error: error.message });
  }
});

const jwt = require('jsonwebtoken');

// Login a company (only regular companies now)
router.post('/login', async (req, res) => {
  try {
    const { identifier, email, password } = req.body;
    const userIdentifier = identifier || email; // backwards compatibility
    
    if (!userIdentifier || !password) {
      return res.status(400).json({ error: 'Email/Username and password are required' });
    }
    
    // Check regular company collection by email or Username
    const company = await Company.findOne({
      $or: [
        { email: userIdentifier },
        { Username: userIdentifier }
      ]
    });
    
    if (!company) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check password match using the comparePassword method
    const isMatch = await company.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Account lifecycle checks
    if (company.status === 'denied') {
      return res.status(403).json({ error: 'Your account has been denied. Please contact support or re-register.' });
    }
    // Allow pending / hold accounts to login but mark limited access; UI + protected routes handle gating
    const limitedAccess = (!company.approved && company.status === 'pending') || company.status === 'hold';
    
    // Create a copy of the company object without the password
    const companySafe = company.toObject();
    delete companySafe.password;

    // Backfill missing subscription dates from history (response-only)
    if ((!companySafe.subscriptionStartedAt || !companySafe.subscriptionEndsAt) && Array.isArray(companySafe.subscriptionHistory)) {
      const active = companySafe.subscriptionHistory
        .filter(h => h && h.status === 'active')
        .sort((a, b) => new Date(b.startAt || 0).getTime() - new Date(a.startAt || 0).getTime());
      if (active.length) {
        companySafe.subscriptionStartedAt = companySafe.subscriptionStartedAt || active[0].startAt || null;
        companySafe.subscriptionEndsAt = companySafe.subscriptionEndsAt || active[0].endAt || null;
      }
    }
    
    // Create a JWT for company session (lightweight auth for messaging)
    const token = jwt.sign({ companyId: company._id, email: company.email }, process.env.JWT_SECRET || 'temporarysecret', { expiresIn: '8h' });
    return res.status(200).json({ 
      success: true, 
      company: companySafe,
      type: 'regular',
      token,
      limitedAccess
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Get company details by ID
router.get('/details/:id', async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    } 
    res.status(200).json(company);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get company info by email (only regular companies now)
router.get('/info', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find in regular companies only
    const company = await Company.findOne({ email });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Create a copy of the company object without the password
    const companySafe = company.toObject();
    delete companySafe.password;

    res.status(200).json(companySafe);
  } catch (err) {
    console.error('Error fetching company info:', err);
    res.status(400).json({ error: err.message });
  }
});

// Update company profile
router.put('/update/:email', upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'documents', maxCount: 10 },
  { name: 'images', maxCount: 10 }
]), async (req, res) => {
  try {
    const { email } = req.params;
    const updateData = { ...req.body };
    const replaceExisting = String(req.body.replaceExisting || '').toLowerCase() === 'true';
    
    // Find the company
    const company = await Company.findOne({ email });
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Enforce non-editable fields after registration unless admin granted one-time edit
    const sensitiveFields = [
      'industry', 'type', 'companyName', 'registrationNumber', 'addressLine1', 'addressLine2',
      'yearEstablished', 'gstNumber', 'address' // include legacy address too
    ];
    const requestedSensitive = sensitiveFields.filter(f => Object.prototype.hasOwnProperty.call(updateData, f));
    if (requestedSensitive.length) {
      if (!company.sensitiveEditAllowed || company.sensitiveEditUsed) {
        return res.status(403).json({
          error: 'Sensitive company details are locked. Please contact admin to grant edit access.'
        });
      }
    }

    // Create social media links object from individual fields
    if (updateData.instagram || updateData.twitter || updateData.linkedin || updateData.youtube) {
      updateData.socialMediaLinks = {
        instagram: updateData.instagram || '',
        twitter: updateData.twitter || '',
        linkedin: updateData.linkedin || '',
        youtube: updateData.youtube || ''
      };
      
      // Remove individual fields to avoid duplicating data
      delete updateData.instagram;
      delete updateData.twitter;
      delete updateData.linkedin;
      delete updateData.youtube;
    }
    // If socialMediaLinks is passed as JSON string, parse it
    else if (updateData.socialMediaLinks && typeof updateData.socialMediaLinks === 'string') {
      try {
        updateData.socialMediaLinks = JSON.parse(updateData.socialMediaLinks);
      } catch (error) {
        console.error('Error parsing socialMediaLinks:', error);
      }
    }

    // Handle password update separately
    if (updateData.password) {
      // Only update password if it's different from what's already there
      try {
        const salt = await bcrypt.genSalt(10);
        updateData.password = await bcrypt.hash(updateData.password, salt);
      } catch (error) {
        console.error('Error hashing password:', error);
        return res.status(500).json({ error: 'Error processing password update' });
      }
    } else {
      // If no password provided in update, remove it from updateData to avoid overwriting
      delete updateData.password;
    }

  // Handle file uploads
    if (req.files?.logo) {
      // If there's an existing logo, delete it from Cloudinary
      if (company.logo) {
        try {
          // Extract public_id from the URL
          const publicId = company.logo.split('/').pop().split('.')[0];
          await cloudinary.uploader.destroy(publicId);
        } catch (error) {
          console.error('Error deleting old logo:', error);
          // Continue with the update even if the old file couldn't be deleted
        }
      }
      updateData.logo = req.files.logo[0].path;
    }
    
    // If replaceExisting is true, clear existing arrays and (best-effort) delete from Cloudinary
    if (replaceExisting) {
      const urlsToDelete = [
        ...(Array.isArray(company.documentsList) ? company.documentsList : []),
        ...(Array.isArray(company.images) ? company.images : [])
      ];
      // Fire and forget deletions
      const destroyByUrl = async (url) => {
        try {
          // Extract public id with folder from URL, e.g., https://res.cloudinary.com/<cloud>/image/upload/vNN/kgamify/<public_id>.<ext>
          const parts = url.split('/');
          // Find index of folder 'kgamify' and build public id from there without extension
          const idx = parts.findIndex(p => p === 'kgamify');
          let publicId;
          if (idx !== -1) {
            const last = parts.slice(idx).join('/');
            publicId = last.replace(/\.[^/.]+$/, '');
          } else {
            // Fallback: last path segment without extension
            publicId = parts.slice(-2).join('/').replace(/\.[^/.]+$/, '');
          }
          // Try image first, then raw
          try { await cloudinary.uploader.destroy(publicId); } catch { await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' }); }
        } catch { /* ignore */ }
      };
      urlsToDelete.forEach(u => { destroyByUrl(u); });
      updateData.documents = undefined;
      updateData.documentsList = [];
      updateData.images = [];
    }

    if (req.files?.documents) {
      const newDocs = req.files.documents.map(f => f.path);
      // Keep first doc in legacy field for backward compatibility
      updateData.documents = newDocs[0] || (replaceExisting ? undefined : (company.documents || undefined));
      if (replaceExisting) {
        // Replace entire array
        updateData.documentsList = newDocs;
      } else {
        updateData.$addToSet = updateData.$addToSet || {};
        updateData.$addToSet.documentsList = { $each: newDocs };
      }
    }

    if (req.files?.images) {
      const newImgs = req.files.images.map(f => f.path);
      if (replaceExisting) {
        updateData.images = newImgs;
      } else {
        updateData.$addToSet = updateData.$addToSet || {};
        updateData.$addToSet.images = { $each: newImgs };
      }
    }

    // If address lines are present, assemble legacy combined address
    const hasAddressParts = (
      (updateData.addressLine1 && String(updateData.addressLine1).trim()) ||
      (updateData.addressLine2 && String(updateData.addressLine2).trim()) ||
      (updateData.city && String(updateData.city).trim()) ||
      (updateData.state && String(updateData.state).trim()) ||
      (updateData.pinCode && String(updateData.pinCode).trim())
    );
    if (hasAddressParts) {
      const parts = [];
      if (updateData.addressLine1) parts.push(String(updateData.addressLine1).trim());
      if (updateData.addressLine2) parts.push(String(updateData.addressLine2).trim());
      if (updateData.city) parts.push(String(updateData.city).trim());
      if (updateData.state) parts.push(String(updateData.state).trim());
      if (updateData.pinCode) parts.push(String(updateData.pinCode).trim());
      const combined = parts.filter(Boolean).join(', ');
      updateData.address = combined;
    }

    // Update the company data
  // If using $addToSet, split atomic ops from $set
  const { $addToSet, ...$set } = updateData;
  const updateOps = {};
  if (Object.keys($set).length) updateOps.$set = $set;
  if ($addToSet) updateOps.$addToSet = $addToSet;

  // If sensitive fields were updated, mark one-time allowance as used
  if (requestedSensitive.length) {
    updateOps.$set = updateOps.$set || {};
    updateOps.$set.sensitiveEditAllowed = false;
    updateOps.$set.sensitiveEditUsed = true;
    updateOps.$set.sensitiveEditUsedAt = new Date();
    updateOps.$addToSet = updateOps.$addToSet || {};
    updateOps.$addToSet.sensitiveEditedFields = { $each: requestedSensitive };
  }

  await Company.findOneAndUpdate({ email }, updateOps, { new: true });

    res.status(200).json({ message: 'Company profile updated successfully' });
  } catch (error) {
    console.error('Error updating company profile:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete a specific document by index or url
router.delete('/update/:email/document', async (req, res) => {
  try {
    const { email } = req.params;
    const { index, url } = req.query;
    const company = await Company.findOne({ email });
    if (!company) return res.status(404).json({ error: 'Company not found' });
    const list = Array.isArray(company.documentsList) ? [...company.documentsList] : [];
    let removedUrl;
    if (typeof index !== 'undefined') {
      const i = parseInt(index, 10);
      if (isNaN(i) || i < 0 || i >= list.length) return res.status(400).json({ error: 'Invalid index' });
      removedUrl = list.splice(i, 1)[0];
    } else if (url) {
      const idx = list.findIndex(u => String(u) === String(url));
      if (idx === -1) return res.status(404).json({ error: 'Document not found' });
      removedUrl = list.splice(idx, 1)[0];
    } else {
      return res.status(400).json({ error: 'Provide index or url' });
    }
    // Update legacy primary doc
    const newPrimary = list[0] || null;
    company.documentsList = list;
    company.documents = newPrimary;
    await company.save({ validateModifiedOnly: true });
    // Best-effort delete from Cloudinary
    (async () => {
      try {
        const parts = removedUrl.split('/');
        const start = parts.findIndex(p => p === 'kgamify');
        let publicId;
        if (start !== -1) {
          publicId = parts.slice(start).join('/').replace(/\.[^/.]+$/, '');
        } else {
          publicId = parts.slice(-2).join('/').replace(/\.[^/.]+$/, '');
        }
        try { await cloudinary.uploader.destroy(publicId); } catch { await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' }); }
      } catch { /* ignore */ }
    })();
    return res.json({ message: 'Document removed', documentsList: company.documentsList, documents: company.documents });
  } catch {
    return res.status(500).json({ error: 'Failed to remove document' });
  }
});

// Delete a specific image by index or url
router.delete('/update/:email/image', async (req, res) => {
  try {
    const { email } = req.params;
    const { index, url } = req.query;
    const company = await Company.findOne({ email });
    if (!company) return res.status(404).json({ error: 'Company not found' });
    const list = Array.isArray(company.images) ? [...company.images] : [];
    let removedUrl;
    if (typeof index !== 'undefined') {
      const i = parseInt(index, 10);
      if (isNaN(i) || i < 0 || i >= list.length) return res.status(400).json({ error: 'Invalid index' });
      removedUrl = list.splice(i, 1)[0];
    } else if (url) {
      const idx = list.findIndex(u => String(u) === String(url));
      if (idx === -1) return res.status(404).json({ error: 'Image not found' });
      removedUrl = list.splice(idx, 1)[0];
    } else {
      return res.status(400).json({ error: 'Provide index or url' });
    }
    company.images = list;
    await company.save({ validateModifiedOnly: true });
    (async () => {
      try {
        const parts = removedUrl.split('/');
        const start = parts.findIndex(p => p === 'kgamify');
        let publicId;
        if (start !== -1) {
          publicId = parts.slice(start).join('/').replace(/\.[^/.]+$/, '');
        } else {
          publicId = parts.slice(-2).join('/').replace(/\.[^/.]+$/, '');
        }
        try { await cloudinary.uploader.destroy(publicId); } catch { await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' }); }
      } catch { /* ignore */ }
    })();
    return res.json({ message: 'Image removed', images: company.images });
  } catch {
    return res.status(500).json({ error: 'Failed to remove image' });
  }
});

// Add a route to get document URL
router.get('/document', authenticateCompany, async (req, res) => {
  try {
    const email = req.user.email;
    const company = await Company.findOne({ email });
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    if (!company.documents) {
      return res.status(404).json({ error: 'No documents found for this company' });
    }
    
    // Generate a proper URL for the document
    const documentUrl = getDocumentUrl(company.documents);
    
    res.status(200).json({ 
      documentUrl,
      message: 'Document URL retrieved successfully' 
    });
  } catch (error) {
    console.error('Error retrieving document URL:', error);
    res.status(500).json({ error: 'Error retrieving document URL' });
  }
});

// Download document by company ID (for admin portal)
router.get('/document/download/:id', async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    if (!company.documents) {
      return res.status(404).json({ error: 'No documents found for this company' });
    }
    
    const fileName = `${company.companyName.replace(/\s+/g, '_')}_documents.pdf`;
    
    // For Edge browser compatibility, we'll use a slightly different approach
    // Generate a proper URL for forcing document download
    const documentUrl = getDocumentDownloadUrl(company.documents, fileName);
    
    // Set appropriate headers to encourage download
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Redirect to the document URL for direct download
    return res.redirect(documentUrl);
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ error: 'Error downloading document' });
  }
});

// Add this new route for direct file download with proper headers
router.get('/document/direct-download/:id', async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    if (!company.documents) {
      return res.status(404).json({ error: 'No documents found for this company' });
    }
    
    const fileName = `${company.companyName.replace(/\s+/g, '_')}_documents.pdf`;
    
    // Get the document URL without attachment flag first
    const documentUrl = getDocumentUrl(company.documents);
    
    // Fetch the document from Cloudinary
    const axios = require('axios');
    const response = await axios({
      method: 'get',
      url: documentUrl,
      responseType: 'stream'
    });
    
    // Set appropriate headers for downloading
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    // Pipe the file directly to the response
    response.data.pipe(res);
  } catch (error) {
    console.error('Error providing direct download:', error);
    res.status(500).json({ error: 'Error downloading document' });
  }
});

// Get document direct link by company ID (for admin portal)
router.get('/document/link/:id', async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    if (!company.documents) {
      return res.status(404).json({ error: 'No documents found for this company' });
    }
    
    // Generate a proper URL for the document
    const documentUrl = getDocumentUrl(company.documents);
    
    res.status(200).json({ 
      documentUrl,
      fileName: `${company.companyName  }-document`,
      message: 'Document URL retrieved successfully' 
    });
  } catch (error) {
    console.error('Error retrieving document URL:', error);
    res.status(500).json({ error: 'Error retrieving document URL' });
  }
});

module.exports = router;
// Additional endpoints for subscription & profile completion

// Select FREE plan explicitly (no payment)
router.post('/subscription/select-free', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });
    const company = await Company.findOne({ email });
    if (!company) return res.status(404).json({ error: 'Company not found' });
    company.subscriptionPlan = 'free';
    company.subscriptionStartedAt = new Date();
    company.subscriptionEndsAt = undefined; // indefinite
    company.subscriptionJobLimit = PLAN_LIMITS.free;
    await company.save({ validateModifiedOnly: true });
    return res.json({ message: 'Free plan activated', plan: 'free', jobLimit: PLAN_LIMITS.free });
  } catch (err) {
    console.error('select-free error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Purchase (or activate) a subscription plan and generate invoice + history entry
// Expected body: { email, plan, amount? (override), currency? }
router.post('/subscription/purchase', async (req, res) => {
  try {
    const { email, plan, amount, currency } = req.body || {};
    if (!email || !plan) return res.status(400).json({ error: 'email and plan required' });
    if (!Object.keys(plans).includes(plan)) return res.status(400).json({ error: 'Invalid plan' });
    const company = await Company.findOne({ email });
    if (!company) return res.status(404).json({ error: 'Company not found' });
    const cfg = getPlan(plan);
    const finalAmount = typeof amount === 'number' ? amount : PLAN_PRICING[plan];
    const finalCurrency = currency || 'INR';
    const { startedAt, endsAt } = computeSubscriptionDates(new Date(), plan);
    // Expire existing active entries
    if (Array.isArray(company.subscriptionHistory)) {
      company.subscriptionHistory.forEach(h => { if (h.status === 'active' && !h.endAt) { h.status = 'expired'; h.endAt = new Date(); } });
    }
    const invoiceId = `INV-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    company.subscriptionHistory = company.subscriptionHistory || [];
    company.subscriptionHistory.push({ plan, status: 'active', startAt: startedAt, endAt: endsAt, invoiceId, amount: finalAmount, currency: finalCurrency });
    company.subscriptionPlan = plan;
    company.subscriptionStartedAt = startedAt;
    company.subscriptionEndsAt = endsAt;
    company.subscriptionJobLimit = cfg.jobLimit;
    await company.save({ validateModifiedOnly: true });
    const amountFormatted = finalAmount === 0 ? 'FREE' : new Intl.NumberFormat('en-IN',{ style:'currency', currency: finalCurrency }).format(finalAmount);
    sendEmail(company.email, 'subscriptionInvoice', {
      invoiceId,
      plan,
      planLabel: cfg.label,
      startAt: startedAt,
      endAt: endsAt || startedAt,
      companyName: company.companyName,
      companyEmail: company.email,
      billingAddress: [company.addressLine1, company.addressLine2, company.address].filter(Boolean).join(', ') || company.address || '',
      orderDate: new Date(),
      amountFormatted,
      amount: finalAmount,
      currency: finalCurrency,
      jobLimit: cfg.jobLimit,
      paymentMethod: '—'
    }).catch(()=>{});
    return res.json({ message: 'Subscription purchased', invoiceId, plan, startAt: startedAt, endAt: endsAt, amount: finalAmount, currency: finalCurrency, amountFormatted });
  } catch (err) {
    console.error('subscription purchase error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Repeat (renew same plan) - must be same as current plan; starts immediately after current expiry (or now if expired)
// Repeat (renew same plan) - adapted to new durations
router.post('/subscription/repeat', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });
    const company = await Company.findOne({ email });
    if (!company) return res.status(404).json({ error: 'Company not found' });
    const currentPlan = company.subscriptionPlan || 'free';
    if (process.env.NODE_ENV === 'production') {
      const { paymentId, orderId } = req.body || {};
      if (!paymentId && !orderId) return res.status(400).json({ error: 'Payment required to renew subscription' });
    }
    if (currentPlan === 'free') return res.status(400).json({ error: 'Free plan does not require renewal' });
    const cfg = getPlan(currentPlan);
    const now = new Date();
    const baseStart = (company.subscriptionEndsAt && now < new Date(company.subscriptionEndsAt)) ? new Date(company.subscriptionEndsAt) : now;
    const { startedAt, endsAt } = computeSubscriptionDates(baseStart, currentPlan);
    const invoiceId = `INV-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    const amount = PLAN_PRICING[currentPlan];
    const currency = 'INR';
    // Expire previous active
    if (Array.isArray(company.subscriptionHistory)) {
      company.subscriptionHistory.forEach(h => { if (h.status === 'active' && (!h.endAt || h.endAt <= startedAt)) { h.status = 'expired'; h.endAt = h.endAt || startedAt; } });
    }
    company.subscriptionHistory.push({ plan: currentPlan, status: 'active', startAt: startedAt, endAt: endsAt, invoiceId, amount, currency });
    company.subscriptionStartedAt = startedAt;
    company.subscriptionEndsAt = endsAt;
    company.subscriptionJobLimit = cfg.jobLimit;
    await company.save({ validateModifiedOnly: true });
    const amountFormatted = new Intl.NumberFormat('en-IN',{ style:'currency', currency }).format(amount);
    sendEmail(company.email, 'subscriptionInvoice', {
      invoiceId,
      plan: currentPlan,
      planLabel: cfg.label,
      startAt: startedAt,
      endAt: endsAt,
      companyName: company.companyName,
      companyEmail: company.email,
      billingAddress: [company.addressLine1, company.addressLine2, company.address].filter(Boolean).join(', ') || company.address || '',
      orderDate: new Date(),
      amountFormatted,
      amount,
      currency,
      jobLimit: cfg.jobLimit,
      paymentMethod: '—'
    }).catch(()=>{});
    return res.json({ message: 'Subscription renewed', plan: currentPlan, invoiceId, startAt: startedAt, endAt: endsAt, amount, currency, amountFormatted });
  } catch (err) {
    console.error('subscription repeat error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Upgrade to higher plan immediately (no proration logic yet; starts now)
// Upgrade to a longer duration plan (e.g., paid3m -> paid6m -> paid12m)
router.post('/subscription/upgrade', async (req, res) => {
  try {
    const { email, plan } = req.body || {};
    if (!email || !plan) return res.status(400).json({ error: 'email and plan required' });
    if (!Object.keys(plans).includes(plan) || plan === 'free') return res.status(400).json({ error: 'Invalid upgrade target' });
    if (process.env.NODE_ENV === 'production') {
      const { paymentId, orderId } = req.body || {};
      if (!paymentId && !orderId) return res.status(400).json({ error: 'Payment required to upgrade subscription' });
    }
    const company = await Company.findOne({ email });
    if (!company) return res.status(404).json({ error: 'Company not found' });
    const order = ['free','paid3m','paid6m','paid12m'];
    const currentIdx = order.indexOf(company.subscriptionPlan || 'free');
    const targetIdx = order.indexOf(plan);
    if (targetIdx <= currentIdx) return res.status(400).json({ error: 'Target plan must be higher' });
    // Expire existing active history item
    if (Array.isArray(company.subscriptionHistory)) {
      company.subscriptionHistory.forEach(h => { if (h.status === 'active' && !h.endAt) { h.status = 'expired'; h.endAt = new Date(); } });
    }
    const { startedAt, endsAt } = computeSubscriptionDates(new Date(), plan);
    const invoiceId = `INV-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    const amount = PLAN_PRICING[plan];
    const currency = 'INR';
    company.subscriptionHistory.push({ plan, status: 'active', startAt: startedAt, endAt: endsAt, invoiceId, amount, currency });
    company.subscriptionPlan = plan;
    company.subscriptionStartedAt = startedAt;
    company.subscriptionEndsAt = endsAt;
    company.subscriptionJobLimit = PLAN_LIMITS[plan];
    await company.save({ validateModifiedOnly: true });
    const amountFormatted = new Intl.NumberFormat('en-IN',{ style:'currency', currency }).format(amount);
    sendEmail(company.email, 'subscriptionInvoice', {
      invoiceId,
      plan,
      planLabel: getPlan(plan).label,
      startAt: startedAt,
      endAt: endsAt,
      companyName: company.companyName,
      companyEmail: company.email,
      billingAddress: [company.addressLine1, company.addressLine2, company.address].filter(Boolean).join(', ') || company.address || '',
      orderDate: new Date(),
      amountFormatted,
      amount,
      currency,
      jobLimit: getPlan(plan).jobLimit,
      paymentMethod: '—'
    }).catch(()=>{});
    return res.json({ message: 'Subscription upgraded', plan, invoiceId, startAt: startedAt, endAt: endsAt, amount, currency, amountFormatted });
  } catch (err) {
    console.error('subscription upgrade error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Get subscription history and current snapshot for a company
router.get('/subscription/history', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'email required' });
    const company = await Company.findOne(
      { email },
      {
        subscriptionHistory: 1,
        subscriptionPlan: 1,
        subscriptionStartedAt: 1,
        subscriptionEndsAt: 1,
        subscriptionJobLimit: 1,
        downgradedFromPlan: 1,
        subscriptionStatus: 1,
        subscriptionActivatedAt: 1,
        subscriptionExpiresAt: 1,
        activeJobCount: 1,
        companyName: 1
      }
    );
    if (!company) return res.status(404).json({ error: 'Company not found' });
    return res.json({
      company: {
        name: company.companyName,
        email,
        plan: company.subscriptionPlan,
        status: company.subscriptionStatus || (company.subscriptionPlan && company.subscriptionPlan !== 'free' ? 'active' : 'free'),
        startAt: company.subscriptionStartedAt || company.subscriptionActivatedAt || null,
        endAt: company.subscriptionEndsAt || company.subscriptionExpiresAt || null,
        jobLimit: typeof company.subscriptionJobLimit === 'number' ? company.subscriptionJobLimit : (PLAN_LIMITS[company.subscriptionPlan || 'free'] || 0),
        downgradedFromPlan: company.downgradedFromPlan || null,
        activeJobCount: company.activeJobCount,
        planLimit: PLAN_LIMITS[company.subscriptionPlan || 'free'] || 0
      },
      history: Array.isArray(company.subscriptionHistory) ? company.subscriptionHistory.slice().reverse() : []
    });
  } catch (err) {
    console.error('subscription history error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Update profile completion details (calculates completion %)
router.post('/profile/complete', upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'documents', maxCount: 10 },
  { name: 'images', maxCount: 10 }
]), async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    const company = await Company.findOne({ email });
    if (!company) return res.status(404).json({ error: 'Company not found' });

    // Fields considered for completion
    const completionFields = [
      'companyName','contactName','website','industry','type','size','phone','address','addressLine1','addressLine2','registrationNumber','gstNumber','description','documents','logo'
    ];
    const updated = {};
    // Apply simple scalar fields
    ['contactName','website','industry','type','size','phone','address','addressLine1','addressLine2','registrationNumber','gstNumber','description'].forEach(f => {
      if (req.body[f]) updated[f] = req.body[f];
    });
    if (req.files?.logo) updated.logo = req.files.logo[0].path;
    if (req.files?.documents) {
      const newDocs = req.files.documents.map(f => f.path);
      updated.documents = newDocs[0];
      updated.$addToSet = updated.$addToSet || {};
      updated.$addToSet.documentsList = { $each: newDocs };
    }
    if (req.files?.images) {
      const newImgs = req.files.images.map(f => f.path);
      updated.$addToSet = updated.$addToSet || {};
      updated.$addToSet.images = { $each: newImgs };
    }

  const { $addToSet, ...$set } = updated;
  const ops = { $set };
  if ($addToSet) ops.$addToSet = $addToSet;
  await Company.updateOne({ email }, ops);
    const fresh = await Company.findOne({ email });
    // Compute completion
    const completedList = completionFields.filter(f => !!fresh[f]);
    const pct = Math.round((completedList.length / completionFields.length) * 100);
    fresh.profileCompletion = pct;
    fresh.profileFieldsCompleted = completedList;
    if (pct === 100) fresh.profileCompleted = true;
    await fresh.save({ validateModifiedOnly: true });
    return res.json({ message: 'Profile updated', completion: pct, completedFields: completedList });
  } catch (err) {
    console.error('profile complete error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Middleware to enforce plan & approval before posting jobs (to be imported into job route if refactored)
async function enforceJobPostingRules(req, res, next) {
  try {
    const email = (req.body.companyEmail || req.body.email || req.query.email);
    if (!email) return res.status(400).json({ error: 'Company email required' });
    const company = await Company.findOne({ email });
    if (!company) return res.status(404).json({ error: 'Company not found' });
    if (!company.emailVerified) return res.status(403).json({ error: 'Verify your email first' });
    if (!company.profileCompleted) return res.status(403).json({ error: 'Complete profile before posting jobs' });
    if (!company.approved) return res.status(403).json({ error: 'Company not approved by admin yet' });
    // Subscription expiry enforcement using new fields
    const now = new Date();
    if (company.subscriptionEndsAt && now > new Date(company.subscriptionEndsAt)) {
      // Auto downgrade if expired
      if (company.subscriptionPlan !== 'free') {
        company.downgradedFromPlan = company.subscriptionPlan;
        company.subscriptionPlan = 'free';
        company.subscriptionJobLimit = PLAN_LIMITS.free;
        company.subscriptionEndsAt = undefined;
        await company.save({ validateModifiedOnly: true }).catch(()=>{});
      }
      return res.status(403).json({ error: 'Subscription expired. Upgrade to post jobs.' });
    }
    const plan = company.subscriptionPlan || 'free';
    const limit = company.subscriptionJobLimit || PLAN_LIMITS[plan] || PLAN_LIMITS.free;
    if (company.activeJobCount >= limit) {
      return res.status(403).json({ error: `Plan job post limit (${limit}) reached` });
    }
    // Pass company downstream
    req.companyDoc = company;
    return next();
  } catch {
    return res.status(500).json({ error: 'Rule enforcement failed' });
  }
}

module.exports.enforceJobPostingRules = enforceJobPostingRules;
// Helper exported for payment activation flows (Razorpay) - creates subscription via purchase endpoint logic
module.exports.activateSubscription = async function activateSubscription({ email, plan, amount, currency = 'INR', origin = 'api', paymentId, orderId }) {
  if (!email || !plan) return { success: false, error: 'email and plan required' };
  if (!['free','silver','gold'].includes(plan)) return { success: false, error: 'Invalid plan' };
  const company = await Company.findOne({ email });
  if (!company) return { success: false, error: 'Company not found' };
  // Expire previous active entries
  if (Array.isArray(company.subscriptionHistory)) {
    company.subscriptionHistory.forEach(h => { if (h.status === 'active' && !h.endAt) { h.status = 'expired'; h.endAt = new Date(); } });
  }
  const startAt = new Date();
  const endAt = plan === 'free' ? undefined : new Date(Date.now() + 30*24*60*60*1000);
  const invoiceId = `INV-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
  company.subscriptionHistory.push({ plan, status: 'active', startAt, endAt, invoiceId, amount, currency });
  company.subscriptionPlan = plan;
  company.subscriptionStatus = 'active';
  company.subscriptionActivatedAt = startAt;
  company.subscriptionExpiresAt = endAt;
  await company.save({ validateModifiedOnly: true });
  const amountFormatted = amount === 0 ? 'FREE' : new Intl.NumberFormat('en-IN',{ style:'currency', currency }).format(amount);
  sendEmail(company.email, 'subscriptionInvoice', {
    invoiceId,
    plan,
    planLabel: getPlan(plan).label,
    startAt,
    endAt: endAt || startAt,
    companyName: company.companyName,
    companyEmail: company.email,
    billingAddress: [company.addressLine1, company.addressLine2, company.address].filter(Boolean).join(', ') || company.address || '',
    orderDate: new Date(),
    amountFormatted,
    amount,
    currency,
    jobLimit: getPlan(plan).jobLimit,
    paymentMethod: '—'
  }).catch(()=>{});
  return { success: true, invoiceId, plan, startAt, endAt, origin, paymentId, orderId };
};
// Chat-style messaging endpoints appended below for company/admin conversation
// Simple company token auth middleware
function companyAuth(req, res, next) {
  const token = req.header('company-auth');
  if (!token) return res.status(401).json({ error: 'Auth token required' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'temporarysecret');
    req.companyAuth = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Get paginated messages for a company by email (now requires token)
router.get('/messages', companyAuth, async (req, res) => {
  try {
    const { email, limit, page } = req.query;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const company = await Company.findOne({ email }, { adminMessages: 1, lastCompanyReadAt: 1 });
    if (!company) return res.status(404).json({ error: 'Company not found' });
    const msgs = Array.isArray(company.adminMessages) ? company.adminMessages : [];
    const sorted = msgs.sort((a,b) => new Date(a.createdAt||0) - new Date(b.createdAt||0)); // chronological
    
    // If no pagination parameters provided, return ALL messages to ensure complete history access
    if (!limit && !page) {
      // Debug logging for message retrieval verification
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[ALL MESSAGES RETRIEVED] Company: ${company.companyName || email} | Total messages: ${sorted.length} | Oldest: ${sorted[0]?.createdAt || 'N/A'} | Newest: ${sorted[sorted.length-1]?.createdAt || 'N/A'}`);
      }
      // mark read timestamp
      await Company.updateOne({ email }, { $set: { lastCompanyReadAt: new Date() } }).catch(()=>{});
      return res.json({ page: 1, total: sorted.length, messages: sorted });
    }
    
    // Otherwise, use existing pagination logic
    const l = Math.min(100, Math.max(1, parseInt(limit,10)||50));
    const p = Math.max(1, parseInt(page,10)||1);
    const start = (p-1)*l;
    const slice = sorted.slice(start, start + l);
    
    // Debug logging for paginated retrieval
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[PAGINATED MESSAGES] Company: ${company.companyName || email} | Page: ${p} | Limit: ${l} | Returned: ${slice.length}/${sorted.length} total`);
    }
    
    // mark read timestamp
    await Company.updateOne({ email }, { $set: { lastCompanyReadAt: new Date() } }).catch(()=>{});
    return res.json({ page: p, total: sorted.length, messages: slice });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Company sends a message to admin (from company) with optional attachments
router.post('/messages', companyAuth, upload.array('attachments', 5), async (req, res) => {
  try {
  const { email, message, clientId } = req.body || {};
    if (!email || (!message && !Array.isArray(req.files))) return res.status(400).json({ error: 'Email or content is required' });
    const company = await Company.findOne({ email });
    if (!company) return res.status(404).json({ error: 'Company not found' });
    if (!Array.isArray(company.adminMessages)) company.adminMessages = [];
    const attachments = Array.isArray(req.files) ? req.files.map(f => ({
      url: f.path || f.secure_url,
      type: f.mimetype,
      name: f.originalname,
      size: f.size
    })) : [];
  const msgDoc = { type: 'info', message: String(message || '').slice(0, 2000), from: 'company', createdAt: new Date(), attachments, clientId };
    company.adminMessages.push(msgDoc);
    await company.save({ validateModifiedOnly: true });
    
    // Debug logging for message saving verification
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[MESSAGE SAVED] Company: ${company.companyName} | Total messages: ${company.adminMessages.length} | Latest: "${msgDoc.message.substring(0, 50)}..."`);
    }
    
    // Socket emit
    try {
      const io = req.app.get('io');
  if (io) io.to(`company:${company._id}`).emit('message:new', { companyId: String(company._id), message: msgDoc });
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Socket emit error (company -> admin):', e);
      }
    }
    // Email notification to admin(s) - simple single recipient for now
    const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || process.env.SMTP_EMAIL || 'natheprasad17@gmail.com';
    if (adminEmail) {
      sendEmail(adminEmail, 'custom', {
        subject: `New Message from ${company.companyName || 'Company'}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#3b82f6;">New Company Message</h2>
          <p><strong>From:</strong> ${company.companyName || company.email}</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:12px 16px;border-radius:6px;margin:16px 0;white-space:pre-wrap;">${msgDoc.message.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
          <p style="font-size:14px;color:#555;">Reply via admin portal:</p>
          <p><a href="${(process.env.FRONTEND_URL||'http://localhost:3000').replace(/\/$/,'')}/admin/messages/${company._id}" style="background:#ff8200;color:#fff;text-decoration:none;padding:10px 18px;border-radius:4px;display:inline-block;">Open Conversation</a></p>
        </div>`
      }).catch(()=>{});
    }
    return res.status(201).json({ message: 'Message sent', data: msgDoc });
  } catch {
    return res.status(500).json({ error: 'Failed to send message' });
  }
});
