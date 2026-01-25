import { apiClient } from './apiClient';
import { emailService } from './emailService';

/**
 * Application Management Service
 * Handles job applications, status updates, resume parsing, and skill matching
 */
class ApplicationService {
  constructor() {
    this.applications = new Map();
    this.statusCallbacks = new Map();
  }

  /**
   * Submit a job application
   * @param {Object} applicationData - Application details
   * @returns {Promise<Object>} Application result
   */
  async submitApplication(applicationData) {
    try {
      const { jobId, candidateId, resume, coverLetter, additionalInfo } = applicationData;
      
      // Lazy-load heavy skill matching service to avoid initial bundle bloat
      const { skillMatchingService } = await import('./skillMatchingService');

      // Parse resume if provided
      let parsedResume = null;
      if (resume) {
        parsedResume = await this.parseResume(resume);
      }

      // Calculate skill matching score
      const job = await apiClient.get(`/jobs/${jobId}`);
      const skillMatch = await skillMatchingService.calculateMatch(
        parsedResume?.skills || [],
        job.requiredSkills || []
      );

      // Submit application
      const application = await apiClient.post('/applications', {
        jobId,
        candidateId,
        resume: parsedResume,
        coverLetter,
        additionalInfo,
        skillMatchScore: skillMatch.score,
        skillMatchDetails: skillMatch.details,
        submittedAt: new Date().toISOString(),
        status: 'submitted'
      });

      // Store application locally
      this.applications.set(application.id, application);

      // Send confirmation email
      await this.sendStatusUpdateEmail(application, 'submitted');

      // Set up status monitoring
      this.monitorApplicationStatus(application.id);

      return {
        success: true,
        application,
        skillMatch,
        message: 'Application submitted successfully'
      };
    } catch (error) {
      throw new Error(`Failed to submit application: ${error.message}`);
    }
  }

  /**
   * Parse resume and extract relevant information
   * @param {File|Blob} resumeFile - Resume file
   * @returns {Promise<Object>} Parsed resume data
   */
  async parseResume(resumeFile) {
    try {
      const formData = new FormData();
      formData.append('resume', resumeFile);

      const response = await apiClient.post('/resume/parse', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const parsedData = response.data;

      return {
        name: parsedData.name || '',
        email: parsedData.email || '',
        phone: parsedData.phone || '',
        skills: parsedData.skills || [],
        experience: parsedData.experience || [],
        education: parsedData.education || [],
        certifications: parsedData.certifications || [],
        summary: parsedData.summary || '',
        languages: parsedData.languages || [],
        projects: parsedData.projects || [],
        achievements: parsedData.achievements || [],
        rawText: parsedData.rawText || ''
      };
    } catch (error) {
      // Fallback to basic text extraction
      return this.extractBasicResumeInfo(resumeFile);
    }
  }

  /**
   * Basic resume text extraction fallback
   * @param {File|Blob} resumeFile - Resume file
   * @returns {Promise<Object>} Basic resume data
   */
  async extractBasicResumeInfo(resumeFile) {
    try {
      const text = await this.extractTextFromFile(resumeFile);
      
      // Basic pattern matching for common resume elements
      const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
      const phoneMatch = text.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/);
      
      // Extract skills using common keywords
      const skillKeywords = [
        'JavaScript', 'React', 'Node.js', 'Python', 'Java', 'C++', 'HTML', 'CSS',
        'SQL', 'MongoDB', 'PostgreSQL', 'AWS', 'Docker', 'Kubernetes', 'Git',
        'Agile', 'Scrum', 'Machine Learning', 'Data Science', 'UI/UX'
      ];
      
      const foundSkills = skillKeywords.filter(skill => 
        text.toLowerCase().includes(skill.toLowerCase())
      );

      return {
        email: emailMatch ? emailMatch[0] : '',
        phone: phoneMatch ? phoneMatch[0] : '',
        skills: foundSkills,
        rawText: text,
        parsed: false // Indicates basic parsing was used
      };
    } catch (error) {
      return {
        rawText: '',
        skills: [],
        parsed: false,
        error: 'Failed to parse resume'
      };
    }
  }

  /**
   * Extract text from various file formats
   * @param {File|Blob} file - File to extract text from
   * @returns {Promise<string>} Extracted text
   */
  async extractTextFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          if (file.type === 'application/pdf') {
            // For PDF files, we'd need a PDF parsing library
            // This is a placeholder for PDF text extraction
            resolve(event.target.result);
          } else if (file.type.includes('text') || file.name.endsWith('.txt')) {
            resolve(event.target.result);
          } else {
            // For other formats, return empty string
            resolve('');
          }
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      
      if (file.type.includes('text') || file.name.endsWith('.txt')) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  }

  /**
   * Update application status
   * @param {string} applicationId - Application ID
   * @param {string} newStatus - New status
   * @param {Object} metadata - Additional status metadata
   * @returns {Promise<Object>} Updated application
   */
  async updateApplicationStatus(applicationId, newStatus, metadata = {}) {
    try {
      const application = await apiClient.patch(`/applications/${applicationId}`, {
        status: newStatus,
        statusUpdatedAt: new Date().toISOString(),
        statusMetadata: metadata
      });

      // Update local cache
      this.applications.set(applicationId, application);

      // Send status update email
      await this.sendStatusUpdateEmail(application, newStatus);

      // Trigger status callbacks
      const callbacks = this.statusCallbacks.get(applicationId) || [];
      callbacks.forEach(callback => {
        try {
          callback(application, newStatus);
        } catch (error) {
          console.error('Status callback error:', error);
        }
      });

      return application;
    } catch (error) {
      throw new Error(`Failed to update application status: ${error.message}`);
    }
  }

  /**
   * Send status update email to candidate
   * @param {Object} application - Application object
   * @param {string} status - Application status
   */
  async sendStatusUpdateEmail(application, status) {
    try {
      const statusMessages = {
        submitted: {
          subject: 'Application Received - Thank You!',
          template: 'application-submitted',
          message: 'Your application has been successfully submitted and is under review.'
        },
        reviewing: {
          subject: 'Application Under Review',
          template: 'application-reviewing',
          message: 'Your application is currently being reviewed by our team.'
        },
        shortlisted: {
          subject: 'Great News! You\'ve Been Shortlisted',
          template: 'application-shortlisted',
          message: 'Congratulations! You have been shortlisted for the next round.'
        },
        interview_scheduled: {
          subject: 'Interview Scheduled',
          template: 'interview-scheduled',
          message: 'Your interview has been scheduled. Please check the details below.'
        },
        interview_completed: {
          subject: 'Interview Completed',
          template: 'interview-completed',
          message: 'Thank you for completing the interview. We will update you soon.'
        },
        offered: {
          subject: 'Job Offer - Congratulations!',
          template: 'job-offered',
          message: 'Congratulations! We are pleased to offer you the position.'
        },
        rejected: {
          subject: 'Application Update',
          template: 'application-rejected',
          message: 'Thank you for your interest. We have decided to move forward with other candidates.'
        },
        withdrawn: {
          subject: 'Application Withdrawn',
          template: 'application-withdrawn',
          message: 'Your application has been successfully withdrawn.'
        }
      };

      const statusConfig = statusMessages[status];
      if (!statusConfig) return;

      const emailData = {
        to: application.candidateEmail || application.candidate?.email,
        subject: statusConfig.subject,
        template: statusConfig.template,
        data: {
          candidateName: application.candidateName || application.candidate?.name,
          jobTitle: application.job?.title || 'Position',
          companyName: application.job?.company?.name || 'Company',
          applicationId: application.id,
          status,
          message: statusConfig.message,
          statusDate: new Date().toLocaleDateString(),
          applicationUrl: `${window.location.origin}/applications/${application.id}`,
          ...application.statusMetadata
        }
      };

      await emailService.sendEmail(emailData);
    } catch (error) {
      console.error('Failed to send status update email:', error);
    }
  }

  /**
   * Monitor application status changes
   * @param {string} applicationId - Application ID to monitor
   */
  monitorApplicationStatus(applicationId) {
    // Set up periodic status checks (every 5 minutes)
    const checkInterval = setInterval(async () => {
      try {
        const currentApp = await this.getApplication(applicationId);
        const cachedApp = this.applications.get(applicationId);
        
        if (currentApp && cachedApp && currentApp.status !== cachedApp.status) {
          // Status changed, update local cache and notify
          this.applications.set(applicationId, currentApp);
          await this.sendStatusUpdateEmail(currentApp, currentApp.status);
          
          // Trigger callbacks
          const callbacks = this.statusCallbacks.get(applicationId) || [];
          callbacks.forEach(callback => {
            try {
              callback(currentApp, currentApp.status);
            } catch (error) {
              console.error('Status callback error:', error);
            }
          });
        }
      } catch (error) {
        console.error('Status monitoring error:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Clean up after 24 hours
    setTimeout(() => {
      clearInterval(checkInterval);
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Get application by ID
   * @param {string} applicationId - Application ID
   * @returns {Promise<Object>} Application object
   */
  async getApplication(applicationId) {
    try {
      // Check cache first
      if (this.applications.has(applicationId)) {
        return this.applications.get(applicationId);
      }

      // Fetch from API
      const application = await apiClient.get(`/applications/${applicationId}`);
      this.applications.set(applicationId, application);
      return application;
    } catch (error) {
      throw new Error(`Failed to get application: ${error.message}`);
    }
  }

  /**
   * Get applications by candidate
   * @param {string} candidateId - Candidate ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} List of applications
   */
  async getApplicationsByCandidate(candidateId, filters = {}) {
    try {
      const params = new URLSearchParams({
        candidateId,
        ...filters
      });

      const applications = await apiClient.get(`/applications?${params}`);
      
      // Cache applications
      applications.forEach(app => {
        this.applications.set(app.id, app);
      });

      return applications;
    } catch (error) {
      throw new Error(`Failed to get applications: ${error.message}`);
    }
  }

  /**
   * Withdraw application
   * @param {string} applicationId - Application ID
   * @param {string} reason - Withdrawal reason
   * @returns {Promise<Object>} Updated application
   */
  async withdrawApplication(applicationId, reason = '') {
    try {
      const application = await this.updateApplicationStatus(applicationId, 'withdrawn', {
        withdrawalReason: reason,
        withdrawnAt: new Date().toISOString()
      });

      return application;
    } catch (error) {
      throw new Error(`Failed to withdraw application: ${error.message}`);
    }
  }

  /**
   * Add status change callback
   * @param {string} applicationId - Application ID
   * @param {Function} callback - Callback function
   */
  onStatusChange(applicationId, callback) {
    if (!this.statusCallbacks.has(applicationId)) {
      this.statusCallbacks.set(applicationId, []);
    }
    this.statusCallbacks.get(applicationId).push(callback);
  }

  /**
   * Remove status change callback
   * @param {string} applicationId - Application ID
   * @param {Function} callback - Callback function to remove
   */
  offStatusChange(applicationId, callback) {
    const callbacks = this.statusCallbacks.get(applicationId);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Get application statistics
   * @param {string} candidateId - Candidate ID
   * @returns {Promise<Object>} Application statistics
   */
  async getApplicationStats(candidateId) {
    try {
      const applications = await this.getApplicationsByCandidate(candidateId);
      
      const stats = {
        total: applications.length,
        submitted: 0,
        reviewing: 0,
        shortlisted: 0,
        interviewed: 0,
        offered: 0,
        rejected: 0,
        withdrawn: 0
      };

      applications.forEach(app => {
        stats[app.status] = (stats[app.status] || 0) + 1;
      });

      return stats;
    } catch (error) {
      throw new Error(`Failed to get application stats: ${error.message}`);
    }
  }

  /**
   * Bulk update application statuses
   * @param {Array} updates - Array of {applicationId, status, metadata}
   * @returns {Promise<Array>} Updated applications
   */
  async bulkUpdateStatus(updates) {
    try {
      const updatePromises = updates.map(update => 
        this.updateApplicationStatus(update.applicationId, update.status, update.metadata)
      );

      const results = await Promise.allSettled(updatePromises);
      
      return results.map((result, index) => ({
        applicationId: updates[index].applicationId,
        success: result.status === 'fulfilled',
        application: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason.message : null
      }));
    } catch (error) {
      throw new Error(`Failed to bulk update applications: ${error.message}`);
    }
  }
}

// Create singleton instance
export const applicationService = new ApplicationService();
export default applicationService;
