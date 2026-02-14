import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import PropTypes from "prop-types";
import { getApplicationsByJobId } from "../api"; // Import getApplicationsByJobId function
import { formatDateDDMMYYYY } from '../utils/date';

const JobApplications = ({ isDarkMode, email }) => {
  const { jobId } = useParams();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        setLoading(true);
        const response = await getApplicationsByJobId(jobId, email);
        setApplications(response);
      } catch (_error) {
        // Handle error silently or display an error message UI
        setApplications([]);
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, [jobId, email]);

  return (
    <div className={`p-4 sm:p-6 ${isDarkMode ? "bg-gray-900" : "bg-gray-100"}`}>
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-black dark:text-white">Job Applications</h1>
      
      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-kgamify-500"></div>
        </div>
      ) : applications.length === 0 ? (
        <p className="text-black dark:text-white text-lg">No applications found.</p>
      ) : (
        <div className="space-y-4">
          {applications.map((application) => (
            <div key={application._id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
              <div className="mb-3">
                <h3 className="font-bold text-black dark:text-white text-lg">{application.applicantName}</h3>
                <p className="text-sm text-black dark:text-white">{application.email}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium text-black dark:text-white">Skills:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {application.skills?.map((skill, index) => (
                        <span 
                          key={index} 
                          className="bg-kgamify-100 text-kgamify-800 dark:bg-kgamify-900 dark:text-kgamify-200 text-xs px-2 py-1 rounded"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-sm font-medium text-black dark:text-white">Test Score:</span>
                    <span className="ml-2 text-black dark:text-white">{application.testScore || 'N/A'}</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium text-black dark:text-white">Applied on:</span>
                    <span className="ml-2 text-black dark:text-white">
                      {formatDateDDMMYYYY(application.createdAt || application.dateApplied)}
                    </span>
                  </div>
                  
                  {application.appName && (
                    <div>
                      <span className="text-sm font-medium text-black dark:text-white">Source:</span>
                      <span className="ml-2 inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded">
                        {application.appName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex gap-3 mt-4">
                <a 
                  href={application.resume} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-kgamify-500 hover:bg-kgamify-600 text-white px-4 py-2 rounded text-sm font-medium"
                >
                  View Resume
                </a>
                <button className="bg-transparent border border-kgamify-500 text-kgamify-500 dark:text-kgamify-400 hover:bg-kgamify-50 dark:hover:bg-gray-700 px-4 py-2 rounded text-sm font-medium">
                  Contact Applicant
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

JobApplications.propTypes = {
  isDarkMode: PropTypes.bool,
  email: PropTypes.string
};

export default JobApplications;
