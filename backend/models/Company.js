const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Create a separate schema for social media links
const socialMediaLinksSchema = new mongoose.Schema({
  instagram: { type: String, default: '' },
  twitter: { type: String, default: '' },
  linkedin: { type: String, default: '' },
  youtube: { type: String, default: '' }
}, { _id: false });

const companySchema = new mongoose.Schema({
  companyName: { type: String, required: true },
  logo: {
    type: String, // Cloudinary URL
    required: false
  },
  website: { type: String },
  industry: { type: String },
  type: { type: String, required: true }, // Company type (e.g. Private Limited)
  size: { type: String }, // Company size (e.g. 10-50 employees)
  // Made optional to support minimal registration; complete later in profile
  contactName: { type: String },
  email: { type: String, required: true, unique: true },
  // Made optional to support minimal registration; complete later in profile
  phone: { type: String },
  address: { type: String },
  // New address lines for finer control (non-editable post-registration without admin grant)
  addressLine1: { type: String },
  addressLine2: { type: String },
  // Optional government/company registration number; must be unique when provided
  registrationNumber: { type: String, default: undefined },
  // GST Number (non-editable post-registration without admin grant)
  gstNumber: { type: String },
  Username: { type: String, required: true, unique: true },
  yearEstablished: { type: String, required: true },
  documents: {
    type: String, // Legacy primary document URL
    required: false
  },
  // New: support multiple documents and images
  documentsList: { type: [String], default: [] },
  images: { type: [String], default: [] },
  description: { type: String, default: 'No description provided' },
  socialMediaLinks: {
    type: socialMediaLinksSchema,
    default: () => ({})
  },
  password: { type: String, required: true },
  approved: { type: Boolean, default: false },
  // Account lifecycle status
  status: { type: String, enum: ['pending', 'approved', 'hold', 'denied'], default: 'pending' },
  // Messages from admin to the company (e.g., hold/deny reasons)
  adminMessages: [
    {
      type: { type: String, enum: ['info', 'hold', 'deny', 'system'], default: 'info' },
  message: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  // Sender of the message (admin/company); legacy messages will default to 'admin'
  from: { type: String, enum: ['admin', 'company'], default: 'admin' },
      // Optional client-generated id to deduplicate optimistic updates across sockets
      clientId: { type: String },
  // Optional attachments associated with this message
  attachments: [
    {
      url: { type: String }, // public URL (e.g., Cloudinary secure URL)
      type: { type: String }, // MIME type
      name: { type: String }, // original file name
      size: { type: Number }  // bytes
    }
  ]
    }
  ],
  // Simple unread tracking timestamps
  lastAdminReadAt: { type: Date }, // when admin last opened this company's thread
  lastCompanyReadAt: { type: Date }, // when company last opened their messages page
  // Track whether the company has filled the full profile details
  profileCompleted: { type: Boolean, default: false },
  
  // Add fields for password reset functionality
  resetToken: String,
  resetTokenExpiry: Date,

  // OTP for forgot password (email-based)
  otpCode: String,
  otpExpiry: Date,
  // Email verification separate from password reset OTP
  emailVerified: { type: Boolean, default: false },
  emailVerificationCode: String, // 6-digit OTP for signup verification
  emailVerificationExpiry: Date,

  // Subscription & plan management
  // Legacy fields (to be deprecated after migration): subscriptionPlan, subscriptionStatus, subscriptionActivatedAt, subscriptionExpiresAt
  // New unified subscription fields aligned with plan config in config/plans.js
  subscriptionPlan: { type: String, enum: ['free', 'paid3m', 'paid6m', 'paid12m'], default: 'free' },
  subscriptionStartedAt: { type: Date },
  subscriptionEndsAt: { type: Date },
  subscriptionJobLimit: { type: Number, default: 3 },
  lastExpiryNoticeSent: { type: Date }, // Track last reminder (7-day or day-of) to prevent duplicates
  downgradedFromPlan: { type: String }, // When auto-downgraded to free record previous plan id
  // Derived counter for active job postings (helps enforce job limit quickly)
  activeJobCount: { type: Number, default: 0 },

  // Subscription history for billing records and upgrades/downgrades
  subscriptionHistory: {
    type: [new mongoose.Schema({
      plan: { type: String, enum: ['free', 'paid3m', 'paid6m', 'paid12m'], required: true },
      status: { type: String, enum: ['active', 'expired', 'cancelled', 'downgraded'], default: 'active' },
      startAt: { type: Date, required: true },
      endAt: { type: Date },
      invoiceId: { type: String },
      paymentId: { type: String },
      orderId: { type: String },
      paymentProvider: { type: String },
      amount: { type: Number },
      currency: { type: String, default: 'INR' },
      downgradedAt: { type: Date },
      createdAt: { type: Date, default: Date.now }
    }, { _id: false })],
    default: []
  },

  // Profile completion tracking (percentage cached for quick UI display)
  profileCompletion: { type: Number, default: 0 },
  profileFieldsCompleted: { type: [String], default: [] },

  // One-time sensitive edit control
  sensitiveEditAllowed: { type: Boolean, default: false },
  sensitiveEditUsed: { type: Boolean, default: false },
  sensitiveEditGrantedAt: { type: Date },
  sensitiveEditUsedAt: { type: Date },
  sensitiveEditedFields: { type: [String], default: [] },
}, { toJSON: { getters: true } });

// Ensure uniqueness of registrationNumber only when it exists (string values)
// Prevents duplicate-key errors for null/undefined values created by a non-partial unique index
companySchema.index(
  { registrationNumber: 1 },
  { unique: true, partialFilterExpression: { registrationNumber: { $exists: true, $type: 'string' } } }
);

// Pre-save hook to hash password before saving
companySchema.pre('save', async function(next) {
  // Only hash the password if it's modified or new
  if (!this.isModified('password')) return next();
  
  try {
    // Generate a salt
    const salt = await bcrypt.genSalt(10);
    // Hash the password along with the new salt
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password for login
companySchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Company', companySchema);
