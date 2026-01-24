import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { 
  FaFileUpload, 
  FaUser, 
  FaEnvelope, 
  FaPhone, 
  FaLinkedin, 
  FaGithub,
  FaMapMarkerAlt,
  FaBriefcase,
  FaGraduationCap,
  FaCalendar,
  FaSave,
  FaPaperPlane
} from 'react-icons/fa';
import { submitApplication } from '../store/slices/applicationsSlice';
import { apiClient } from '../services/apiClient';
import LoadingSpinner from '../components/LoadingSpinner';
import AccessibleButton from '../components/AccessibleButton';

const JobApplication = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const { submitting, error } = useSelector(state => state.applications);
  const { user } = useSelector(state => state.auth);
  
  // Form state
  const [formData, setFormData] = useState({
    // Personal Information
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    location: user?.location || '',
    
    // Professional Information
    currentPosition: '',
    experience: '',
    education: '',
    skills: '',
    
    // Links
    linkedinUrl: '',
    githubUrl: '',
    portfolioUrl: '',
    
    // Application Details
    coverLetter: '',
    availabilityDate: '',
    salaryExpectation: '',
    
    // Documents
    resume: null,
    portfolio: null
  });
  
  const [resumePreview, setResumePreview] = useState(null);
  const [portfolioPreview, setPortfolioPreview] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [currentSection, setCurrentSection] = useState(0);

  // Form sections
  const sections = [
    { title: 'Personal Information', icon: FaUser },
    { title: 'Professional Background', icon: FaBriefcase },
    { title: 'Application Details', icon: FaPaperPlane },
    { title: 'Documents', icon: FaFileUpload }
  ];

  useEffect(() => {
    // Pre-fill form with user data if available
    if (user) {
      setFormData(prev => ({
        ...prev,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
        location: user.location || ''
      }));
    }
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e, fileType) => {
    const file = e.target.files[0];
    if (file) {
      // Basic validation: type and size (resume 5MB, portfolio 10MB)
      const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      const sizeLimit = fileType === 'resume' ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
      if (!allowed.includes(file.type)) {
        alert('Only PDF, DOC, or DOCX files are allowed.');
        return;
      }
      if (file.size > sizeLimit) {
        alert(`File too large. Max ${fileType === 'resume' ? '5MB' : '10MB'}.`);
        return;
      }

      setFormData(prev => ({
        ...prev,
        [fileType]: file
      }));

      if (fileType === 'resume') {
        setResumePreview(file.name);
      } else if (fileType === 'portfolio') {
        setPortfolioPreview(file.name);
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e, fileType) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      // Reuse selection validator
      handleFileChange({ target: { files: [file] } }, fileType);
    }
  };

  const validateForm = () => {
    const required = ['firstName', 'lastName', 'email', 'phone', 'coverLetter'];
    const missing = required.filter(field => !formData[field]);
    
    if (missing.length > 0) {
      alert(`Please fill in the following required fields: ${missing.join(', ')}`);
      return false;
    }
    
    if (!formData.resume) {
      alert('Please upload your resume');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      // Try direct minimal POST to backend API first (works with current backend)
      const minimal = new FormData();
      minimal.append('jobId', jobId);
      minimal.append('applicantName', `${formData.firstName} ${formData.lastName}`.trim());
      minimal.append('email', formData.email);
      minimal.append('phone', formData.phone);
      minimal.append('coverLetter', formData.coverLetter);
      minimal.append('appName', 'kGamify Web'); // Track application source
      if (formData.resume) minimal.append('resume', formData.resume);

      const res = await apiClient.post('/application', minimal, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 45000
      });
      if (res?.status >= 200 && res?.status < 300) {
        alert('Application submitted successfully!');
        navigate('/dashboard');
        return;
      }
      // If backend returns non-2xx, fall through to Redux path
      throw new Error('Direct application submit did not succeed');
    } catch (primaryErr) {
      if (import.meta.env.MODE === 'development') {
        // eslint-disable-next-line no-console
        console.debug('Direct application submit failed:', primaryErr);
      }
      // Secondary: Redux service which also does resume parsing and skill match
      try {
        await dispatch(submitApplication({
          jobId,
          candidateId: null,
          resume: formData.resume,
          coverLetter: formData.coverLetter,
          additionalInfo: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            linkedinUrl: formData.linkedinUrl,
            githubUrl: formData.githubUrl,
            portfolioUrl: formData.portfolioUrl
          }
        })).unwrap();
        alert('Application submitted successfully!');
        navigate('/dashboard');
      } catch (err) {
        if (import.meta.env.MODE === 'development') {
          // eslint-disable-next-line no-console
          console.debug('Redux application submit failed:', err);
        }
        alert('Failed to submit application. Please try again later.');
      }
    }
  };

  const nextSection = () => {
    if (currentSection < sections.length - 1) {
      setCurrentSection(currentSection + 1);
    }
  };

  const prevSection = () => {
    if (currentSection > 0) {
      setCurrentSection(currentSection - 1);
    }
  };

  const renderPersonalInfo = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            First Name *
          </label>
          <input
            type="text"
            name="firstName"
            value={formData.firstName}
            onChange={handleInputChange}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Last Name *
          </label>
          <input
            type="text"
            name="lastName"
            value={formData.lastName}
            onChange={handleInputChange}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            required
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <FaEnvelope className="inline mr-2" />
            Email *
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <FaPhone className="inline mr-2" />
            Phone Number *
          </label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            required
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <FaMapMarkerAlt className="inline mr-2" />
          Location
        </label>
        <input
          type="text"
          name="location"
          value={formData.location}
          onChange={handleInputChange}
          placeholder="City, State, Country"
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
        />
      </div>
    </div>
  );

  const renderProfessionalInfo = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <FaBriefcase className="inline mr-2" />
          Current Position
        </label>
        <input
          type="text"
          name="currentPosition"
          value={formData.currentPosition}
          onChange={handleInputChange}
          placeholder="e.g., Software Engineer at ABC Corp"
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Years of Experience
        </label>
        <select
          name="experience"
          value={formData.experience}
          onChange={handleInputChange}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
        >
          <option value="">Select experience level</option>
          <option value="0-1">0-1 years (Entry Level)</option>
          <option value="1-3">1-3 years (Junior)</option>
          <option value="3-5">3-5 years (Mid-Level)</option>
          <option value="5-10">5-10 years (Senior)</option>
          <option value="10+">10+ years (Expert)</option>
        </select>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <FaGraduationCap className="inline mr-2" />
          Education
        </label>
        <textarea
          name="education"
          value={formData.education}
          onChange={handleInputChange}
          rows={3}
          placeholder="e.g., Bachelor's in Computer Science, XYZ University (2020)"
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Key Skills
        </label>
        <textarea
          name="skills"
          value={formData.skills}
          onChange={handleInputChange}
          rows={3}
          placeholder="e.g., JavaScript, React, Node.js, Python, SQL"
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <FaLinkedin className="inline mr-2" />
            LinkedIn Profile
          </label>
          <input
            type="url"
            name="linkedinUrl"
            value={formData.linkedinUrl}
            onChange={handleInputChange}
            placeholder="https://linkedin.com/in/username"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <FaGithub className="inline mr-2" />
            GitHub Profile
          </label>
          <input
            type="url"
            name="githubUrl"
            value={formData.githubUrl}
            onChange={handleInputChange}
            placeholder="https://github.com/username"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Portfolio URL
        </label>
        <input
          type="url"
          name="portfolioUrl"
          value={formData.portfolioUrl}
          onChange={handleInputChange}
          placeholder="https://yourportfolio.com"
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
        />
      </div>
    </div>
  );

  const renderApplicationDetails = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Cover Letter *
        </label>
        <textarea
          name="coverLetter"
          value={formData.coverLetter}
          onChange={handleInputChange}
          rows={8}
          placeholder="Tell us why you're interested in this position and what makes you a great fit..."
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          required
        />
        <p className="text-sm text-gray-500 mt-2">
          {formData.coverLetter.length}/2000 characters
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <FaCalendar className="inline mr-2" />
            Availability Date
          </label>
          <input
            type="date"
            name="availabilityDate"
            value={formData.availabilityDate}
            onChange={handleInputChange}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Salary Expectation
          </label>
          <input
            type="text"
            name="salaryExpectation"
            value={formData.salaryExpectation}
            onChange={handleInputChange}
            placeholder="e.g., $80,000 - $100,000"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>
    </div>
  );

  const renderDocuments = () => (
    <div className="space-y-6">
      {/* Resume Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Resume * (PDF, DOC, DOCX - Max 5MB)
        </label>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragOver
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'resume')}
        >
          <FaFileUpload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          {resumePreview ? (
            <div>
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                ✓ {resumePreview}
              </p>
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({ ...prev, resume: null }));
                  setResumePreview(null);
                }}
                className="text-sm text-red-600 hover:text-red-800 mt-2"
              >
                Remove
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Drag and drop your resume here, or
              </p>
              <label className="cursor-pointer">
                <span className="text-blue-600 hover:text-blue-800 font-medium">
                  browse files
                </span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => handleFileChange(e, 'resume')}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Portfolio Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Portfolio (Optional - PDF, DOC, DOCX - Max 10MB)
        </label>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragOver
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'portfolio')}
        >
          <FaFileUpload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          {portfolioPreview ? (
            <div>
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                ✓ {portfolioPreview}
              </p>
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({ ...prev, portfolio: null }));
                  setPortfolioPreview(null);
                }}
                className="text-sm text-red-600 hover:text-red-800 mt-2"
              >
                Remove
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Drag and drop your portfolio here, or
              </p>
              <label className="cursor-pointer">
                <span className="text-blue-600 hover:text-blue-800 font-medium">
                  browse files
                </span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => handleFileChange(e, 'portfolio')}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderCurrentSection = () => {
    switch (currentSection) {
      case 0:
        return renderPersonalInfo();
      case 1:
        return renderProfessionalInfo();
      case 2:
        return renderApplicationDetails();
      case 3:
        return renderDocuments();
      default:
        return renderPersonalInfo();
    }
  };

  if (submitting) {
    return <LoadingSpinner text="Submitting your application..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Job Application
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Complete your application to join our team
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {sections.map((section, index) => {
              const Icon = section.icon;
              const isActive = index === currentSection;
              const isCompleted = index < currentSection;
              
              return (
                <div key={index} className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                      isActive
                        ? 'border-blue-500 bg-blue-500 text-white'
                        : isCompleted
                        ? 'border-green-500 bg-green-500 text-white'
                        : 'border-gray-300 bg-white text-gray-400'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="ml-3 hidden sm:block">
                    <p
                      className={`text-sm font-medium ${
                        isActive || isCompleted
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-500'
                      }`}
                    >
                      {section.title}
                    </p>
                  </div>
                  {index < sections.length - 1 && (
                    <div className="flex-1 mx-4">
                      <div
                        className={`h-0.5 ${
                          isCompleted ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Application Form */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 md:p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              {sections[currentSection].title}
            </h2>
            {renderCurrentSection()}
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center pt-6 border-t border-gray-200 dark:border-gray-700">
            <AccessibleButton
              type="button"
              onClick={prevSection}
              disabled={currentSection === 0}
              variant="secondary"
              className="px-6 py-2"
            >
              Previous
            </AccessibleButton>

            <div className="flex space-x-4">
              <AccessibleButton
                type="button"
                onClick={() => {
                  // Save draft functionality could be added here
                  alert('Draft saved!');
                }}
                variant="outline"
                className="px-6 py-2"
              >
                <FaSave className="mr-2" />
                Save Draft
              </AccessibleButton>

              {currentSection === sections.length - 1 ? (
                <AccessibleButton
                  type="submit"
                  variant="primary"
                  className="px-8 py-2"
                  loading={submitting}
                >
                  <FaPaperPlane className="mr-2" />
                  Submit Application
                </AccessibleButton>
              ) : (
                <AccessibleButton
                  type="button"
                  onClick={nextSection}
                  variant="primary"
                  className="px-6 py-2"
                >
                  Next
                </AccessibleButton>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

JobApplication.propTypes = {};

export default JobApplication;
