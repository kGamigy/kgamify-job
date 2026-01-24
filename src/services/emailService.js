/**
 * Email Service for Application Management
 * Handles email notifications for job application status updates
 */
import { getApiUrl } from '../utils/apiUrl';

class EmailService {
  constructor() {
    this.apiBaseUrl = getApiUrl();
    this.templates = new Map();
    this.loadEmailTemplates();
  }

  /**
   * Load email templates
   */
  loadEmailTemplates() {
    // Application Submitted Template
    this.templates.set('application-submitted', {
      subject: 'Application Received - {{jobTitle}} at {{companyName}}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #0ea5e9; color: white; padding: 20px; text-align: center;">
            <h1>Application Received!</h1>
          </div>
          <div style="padding: 20px;">
            <p>Dear {{candidateName}},</p>
            <p>Thank you for your interest in the <strong>{{jobTitle}}</strong> position at <strong>{{companyName}}</strong>.</p>
            <p>We have successfully received your application and our team will review it carefully. You will be notified of any updates regarding your application status.</p>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3>Application Details:</h3>
              <ul>
                <li><strong>Position:</strong> {{jobTitle}}</li>
                <li><strong>Company:</strong> {{companyName}}</li>
                <li><strong>Application ID:</strong> {{applicationId}}</li>
                <li><strong>Submitted:</strong> {{statusDate}}</li>
              </ul>
            </div>

            <p>In the meantime, feel free to explore other opportunities on our platform.</p>
            <p>Best regards,<br>The kGamify Team</p>
          </div>
          <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666;">
            <p>This is an automated email. Please do not reply directly to this message.</p>
          </div>
        </div>
      `
    });

    // Application Under Review Template
    this.templates.set('application-reviewing', {
      subject: 'Application Under Review - {{jobTitle}}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #fbbf24; color: white; padding: 20px; text-align: center;">
            <h1>Application Under Review</h1>
          </div>
          <div style="padding: 20px;">
            <p>Dear {{candidateName}},</p>
            <p>Your application for the <strong>{{jobTitle}}</strong> position at <strong>{{companyName}}</strong> is currently under review by our hiring team.</p>
            <p>We will update you on the next steps soon. Thank you for your patience.</p>
            
            <div style="text-align: center; margin: 20px 0;">
              <a href="{{applicationUrl}}" style="background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">View Application Status</a>
            </div>

            <p>Best regards,<br>The {{companyName}} Hiring Team</p>
          </div>
        </div>
      `
    });

    // Application Shortlisted Template
    this.templates.set('application-shortlisted', {
      subject: 'Congratulations! You\'ve Been Shortlisted - {{jobTitle}}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #10b981; color: white; padding: 20px; text-align: center;">
            <h1>🎉 Congratulations!</h1>
            <h2>You've Been Shortlisted</h2>
          </div>
          <div style="padding: 20px;">
            <p>Dear {{candidateName}},</p>
            <p>Great news! Your application for the <strong>{{jobTitle}}</strong> position at <strong>{{companyName}}</strong> has been shortlisted.</p>
            <p>Our hiring team was impressed with your background and would like to move forward with the next step in our hiring process.</p>
            
            <div style="background-color: #ecfdf5; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #10b981;">
              <h3>What's Next?</h3>
              <p>{{nextSteps}}</p>
            </div>

            <p>We look forward to learning more about you!</p>
            <p>Best regards,<br>The {{companyName}} Hiring Team</p>
          </div>
        </div>
      `
    });

    // Interview Scheduled Template
    this.templates.set('interview-scheduled', {
      subject: 'Interview Scheduled - {{jobTitle}} at {{companyName}}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #8b5cf6; color: white; padding: 20px; text-align: center;">
            <h1>📅 Interview Scheduled</h1>
          </div>
          <div style="padding: 20px;">
            <p>Dear {{candidateName}},</p>
            <p>Your interview for the <strong>{{jobTitle}}</strong> position at <strong>{{companyName}}</strong> has been scheduled.</p>
            
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3>Interview Details:</h3>
              <ul>
                <li><strong>Date:</strong> {{interviewDate}}</li>
                <li><strong>Time:</strong> {{interviewTime}}</li>
                <li><strong>Duration:</strong> {{interviewDuration}}</li>
                <li><strong>Format:</strong> {{interviewFormat}}</li>
                <li><strong>Location/Link:</strong> {{interviewLocation}}</li>
                <li><strong>Interviewer(s):</strong> {{interviewers}}</li>
              </ul>
            </div>

            <div style="background-color: #fef3c7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h4>Preparation Tips:</h4>
              <ul>
                <li>Review the job description and company information</li>
                <li>Prepare examples of your relevant experience</li>
                <li>Have questions ready about the role and company</li>
                <li>Test your technology if it's a virtual interview</li>
              </ul>
            </div>

            <p>If you need to reschedule or have any questions, please contact us as soon as possible.</p>
            <p>Best of luck!</p>
            <p>Best regards,<br>The {{companyName}} Hiring Team</p>
          </div>
        </div>
      `
    });

    // Job Offer Template
    this.templates.set('job-offered', {
      subject: '🎉 Job Offer - {{jobTitle}} at {{companyName}}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #059669; color: white; padding: 20px; text-align: center;">
            <h1>🎉 Congratulations!</h1>
            <h2>You've Got The Job!</h2>
          </div>
          <div style="padding: 20px;">
            <p>Dear {{candidateName}},</p>
            <p>We are thrilled to offer you the position of <strong>{{jobTitle}}</strong> at <strong>{{companyName}}</strong>!</p>
            <p>After careful consideration, we believe you would be an excellent addition to our team.</p>
            
            <div style="background-color: #ecfdf5; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #059669;">
              <h3>Offer Details:</h3>
              <ul>
                <li><strong>Position:</strong> {{jobTitle}}</li>
                <li><strong>Department:</strong> {{department}}</li>
                <li><strong>Start Date:</strong> {{startDate}}</li>
                <li><strong>Salary:</strong> {{salary}}</li>
                <li><strong>Benefits:</strong> {{benefits}}</li>
              </ul>
            </div>

            <div style="background-color: #fef3c7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h4>Next Steps:</h4>
              <p>{{nextSteps}}</p>
              <p><strong>Response Required By:</strong> {{responseDeadline}}</p>
            </div>

            <div style="text-align: center; margin: 20px 0;">
              <a href="{{offerUrl}}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 5px;">Accept Offer</a>
              <a href="{{contactUrl}}" style="background-color: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 5px;">Contact HR</a>
            </div>

            <p>We look forward to welcoming you to the team!</p>
            <p>Best regards,<br>The {{companyName}} Team</p>
          </div>
        </div>
      `
    });

    // Application Rejected Template
    this.templates.set('application-rejected', {
      subject: 'Application Update - {{jobTitle}} at {{companyName}}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #6b7280; color: white; padding: 20px; text-align: center;">
            <h1>Application Update</h1>
          </div>
          <div style="padding: 20px;">
            <p>Dear {{candidateName}},</p>
            <p>Thank you for your interest in the <strong>{{jobTitle}}</strong> position at <strong>{{companyName}}</strong> and for taking the time to apply.</p>
            <p>After careful consideration, we have decided to move forward with other candidates whose background more closely matches our current needs.</p>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h4>We Encourage You To:</h4>
              <ul>
                <li>Keep an eye on our careers page for future opportunities</li>
                <li>Connect with us on professional networks</li>
                <li>Consider applying for other positions that match your skills</li>
              </ul>
            </div>

            <p>We appreciate the time and effort you put into your application and wish you the best of luck in your job search.</p>
            
            <div style="text-align: center; margin: 20px 0;">
              <a href="{{jobsUrl}}" style="background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">View Other Opportunities</a>
            </div>

            <p>Best regards,<br>The {{companyName}} Hiring Team</p>
          </div>
        </div>
      `
    });
  }

  /**
   * Send email using the email service
   * @param {Object} emailData - Email configuration
   * @returns {Promise<Object>} Send result
   */
  async sendEmail(emailData) {
    try {
      const { to, subject, template, data, from, replyTo } = emailData;

      if (!to || !subject) {
        throw new Error('Email recipient and subject are required');
      }

      let emailContent;
      
      if (template && this.templates.has(template)) {
        emailContent = this.renderTemplate(template, data);
      } else {
        emailContent = {
          subject,
          html: data?.html || data?.content || '<p>No content provided</p>',
          text: data?.text || ''
        };
      }

      const emailPayload = {
        to,
        from: from || import.meta.env.VITE_FROM_EMAIL || 'noreply@kgamify.com',
        replyTo: replyTo || import.meta.env.VITE_REPLY_TO_EMAIL,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        metadata: {
          template,
          applicationId: data?.applicationId,
          candidateId: data?.candidateId,
          jobId: data?.jobId,
          timestamp: new Date().toISOString()
        }
      };

      const response = await fetch(`${this.apiBaseUrl}/api/email/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(emailPayload)
      });

      if (!response.ok) {
        throw new Error(`Email sending failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        messageId: result.messageId,
        timestamp: new Date().toISOString(),
        ...result
      };
    } catch (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Render email template with data
   * @param {string} templateName - Template name
   * @param {Object} data - Template data
   * @returns {Object} Rendered email content
   */
  renderTemplate(templateName, data = {}) {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Email template '${templateName}' not found`);
    }

    // Helper function to replace placeholders
    const replacePlaceholders = (text, values) => {
      return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return values[key] || match;
      });
    };

    return {
      subject: replacePlaceholders(template.subject, data),
      html: replacePlaceholders(template.html, data),
      text: this.htmlToText(replacePlaceholders(template.html, data))
    };
  }

  /**
   * Convert HTML to plain text
   * @param {string} html - HTML content
   * @returns {string} Plain text
   */
  htmlToText(html) {
    // Simple HTML to text conversion
    return html
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Send bulk emails
   * @param {Array} emailList - List of email configurations
   * @returns {Promise<Array>} Send results
   */
  async sendBulkEmails(emailList) {
    const results = [];
    const batchSize = 10; // Process in batches to avoid rate limiting
    
    for (let i = 0; i < emailList.length; i += batchSize) {
      const batch = emailList.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (emailData, index) => {
        try {
          const result = await this.sendEmail(emailData);
          return {
            index: i + index,
            success: true,
            result,
            email: emailData.to
          };
        } catch (error) {
          return {
            index: i + index,
            success: false,
            error: error.message,
            email: emailData.to
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults.map(r => r.value || r.reason));

      // Add delay between batches to respect rate limits
      if (i + batchSize < emailList.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Schedule email for later sending
   * @param {Object} emailData - Email configuration
   * @param {Date|string} scheduledTime - When to send the email
   * @returns {Promise<Object>} Schedule result
   */
  async scheduleEmail(emailData, scheduledTime) {
    try {
      const schedulePayload = {
        ...emailData,
        scheduledFor: new Date(scheduledTime).toISOString(),
        status: 'scheduled'
      };

      const response = await fetch(`${this.apiBaseUrl}/api/email/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(schedulePayload)
      });

      if (!response.ok) {
        throw new Error(`Email scheduling failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to schedule email: ${error.message}`);
    }
  }

  /**
   * Get email sending status
   * @param {string} messageId - Message ID
   * @returns {Promise<Object>} Email status
   */
  async getEmailStatus(messageId) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/email/status/${messageId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get email status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to get email status: ${error.message}`);
    }
  }

  /**
   * Get available email templates
   * @returns {Array} List of available templates
   */
  getAvailableTemplates() {
    return Array.from(this.templates.keys()).map(templateName => ({
      name: templateName,
      description: this.getTemplateDescription(templateName)
    }));
  }

  /**
   * Get template description
   * @param {string} templateName - Template name
   * @returns {string} Template description
   */
  getTemplateDescription(templateName) {
    const descriptions = {
      'application-submitted': 'Confirmation email when application is received',
      'application-reviewing': 'Notification when application is under review',
      'application-shortlisted': 'Congratulations email for shortlisted candidates',
      'interview-scheduled': 'Interview scheduling notification',
      'interview-completed': 'Post-interview acknowledgment',
      'job-offered': 'Job offer notification',
      'application-rejected': 'Application rejection notification',
      'application-withdrawn': 'Application withdrawal confirmation'
    };

    return descriptions[templateName] || 'Custom email template';
  }

  /**
   * Validate email configuration
   * @param {Object} emailData - Email configuration to validate
   * @returns {Object} Validation result
   */
  validateEmailData(emailData) {
    const errors = [];
    const warnings = [];

    // Required fields
    if (!emailData.to) {
      errors.push('Recipient email is required');
    } else if (!this.isValidEmail(emailData.to)) {
      errors.push('Invalid recipient email format');
    }

    if (!emailData.subject) {
      errors.push('Email subject is required');
    }

    if (!emailData.template && !emailData.html && !emailData.content) {
      errors.push('Email content or template is required');
    }

    // Warnings
    if (emailData.subject && emailData.subject.length > 78) {
      warnings.push('Subject line is longer than recommended (78 characters)');
    }

    if (emailData.template && !this.templates.has(emailData.template)) {
      errors.push(`Template '${emailData.template}' not found`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate email address format
   * @param {string} email - Email address
   * @returns {boolean} Is valid email
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Add custom email template
   * @param {string} name - Template name
   * @param {Object} template - Template configuration
   */
  addTemplate(name, template) {
    if (!template.subject || !template.html) {
      throw new Error('Template must have subject and html properties');
    }

    this.templates.set(name, template);
  }

  /**
   * Remove email template
   * @param {string} name - Template name
   */
  removeTemplate(name) {
    return this.templates.delete(name);
  }
}

// Create singleton instance
export const emailService = new EmailService();
export default emailService;
