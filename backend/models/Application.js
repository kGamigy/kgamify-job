// filepath: /backend/models/Application.js
const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  CompanyName: { type: String, required: true },
  companyEmail: { type: String, required: true }, // Add explicit company email field
  applicantName: { type: String, required: true },
  applicantEmail: { type: String },
  appName: { type: String }, // Store the name of the app/platform used for application
  resume: { 
    type: String, // Cloudinary URL for the resume
    required: false 
  },
  resumePublicId: {
    type: String, // Store Cloudinary public ID for easy management
    required: false
  },
  testScore: { type: String },
  skills: { type: [String] },
  status: { type: String, enum: ['new', 'shortlisted', 'rejected'], default: 'new' },
}, { timestamps: true }); // Add timestamps for tracking creation/update times

module.exports = mongoose.model('Application', applicationSchema);