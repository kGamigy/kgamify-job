import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { FaBriefcase, FaSearch, FaUsers, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { adminListAllJobs } from '../api';
import { formatDateDDMMYYYY } from '../utils/date';

export default function AdminAllJobs({ isDarkMode }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [expandedDetails, setExpandedDetails] = useState({});
  const [expandedApplicants, setExpandedApplicants] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) { navigate('/admin-login'); return; }
    (async () => {
      try {
        setLoading(true);
        const res = await adminListAllJobs();
        setJobs(Array.isArray(res.jobs) ? res.jobs : []);
        setError('');
      } catch (e) {
        setError(e?.response?.data?.message || e?.message || 'Failed to load jobs');
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const filtered = useMemo(() => {
    if (!query.trim()) return jobs;
    const q = query.trim().toLowerCase();
    return jobs.filter((job) => {
      const haystack = [
        job.jobTitle,
        job.companyName,
        job.companyEmail,
        job.location,
        job.employmentType
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [jobs, query]);

  const toggleDetails = (id) => {
    setExpandedDetails((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleApplicants = (id) => {
    setExpandedApplicants((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><FaBriefcase /> All Jobs</h1>
            <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>All jobs posted by every company with applicants.</p>
          </div>
          <button onClick={() => navigate('/admin')} className="px-3 py-1.5 rounded bg-[#ff8200] text-white text-sm">Back to Admin</button>
        </div>

        <div className={`mb-4 p-3 rounded border flex items-center gap-2 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <FaSearch className="text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by job, company, email, or location"
            className={`w-full bg-transparent outline-none text-sm ${isDarkMode ? 'text-white placeholder:text-gray-400' : 'text-gray-900 placeholder:text-gray-500'}`}
          />
        </div>

        {loading ? (
          <div className={`p-6 rounded border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>Loading jobs…</div>
        ) : error ? (
          <div className={`p-6 rounded border text-red-600 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>{error}</div>
        ) : filtered.length === 0 ? (
          <div className={`p-6 rounded border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>No jobs found.</div>
        ) : (
          <div className="space-y-4">
            {filtered.map((job) => {
              const id = job._id || job.id;
              const applicants = Array.isArray(job.applicants) ? job.applicants : [];
              return (
                <div key={id} className={`p-5 rounded border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold">{job.jobTitle}</div>
                      <div className="text-xs opacity-70">{job.companyName || 'Company'} • {job.companyEmail || '—'}</div>
                      <div className="text-xs opacity-70">Posted: {formatDateDDMMYYYY(job.createdAt || job.postedAt)}</div>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${job.jobActive ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>
                        {job.jobActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className="flex items-center gap-1 text-xs"><FaUsers /> {applicants.length}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-sm">
                    <div><span className="opacity-70">Location:</span> {job.location || '—'}</div>
                    <div><span className="opacity-70">Employment:</span> {job.employmentType || '—'}</div>
                    <div><span className="opacity-70">Salary:</span> {job.salary || '—'}</div>
                  </div>

                  <div className="flex items-center gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() => toggleDetails(id)}
                      className={`text-sm font-medium ${isDarkMode ? 'text-orange-300' : 'text-[#ff8200]'}`}
                    >
                      {expandedDetails[id] ? <span className="inline-flex items-center gap-2">Hide details <FaChevronUp /></span> : <span className="inline-flex items-center gap-2">View details <FaChevronDown /></span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleApplicants(id)}
                      className={`text-sm font-medium ${isDarkMode ? 'text-orange-300' : 'text-[#ff8200]'}`}
                    >
                      {expandedApplicants[id] ? <span className="inline-flex items-center gap-2">Hide applicants <FaChevronUp /></span> : <span className="inline-flex items-center gap-2">View applicants <FaChevronDown /></span>}
                    </button>
                  </div>

                  {expandedDetails[id] && (
                    <div className={`mt-4 rounded border p-4 text-sm ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="font-semibold mb-2">Job Details</div>
                      <div className="space-y-2">
                        <div><span className="opacity-70">Description:</span> {job.jobDescription || '—'}</div>
                        <div><span className="opacity-70">Experience:</span> {job.experienceLevel || '—'}</div>
                        <div><span className="opacity-70">Remote/Onsite:</span> {job.remoteOrOnsite || '—'}</div>
                        <div><span className="opacity-70">Skills:</span> {job.skills || '—'}</div>
                        <div><span className="opacity-70">Benefits:</span> {job.benefits || '—'}</div>
                        <div><span className="opacity-70">Validity:</span> {formatDateDDMMYYYY(job.validUntil)}</div>
                      </div>
                    </div>
                  )}

                  {expandedApplicants[id] && (
                    <div className={`mt-4 rounded border p-4 text-sm ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="font-semibold mb-2">Applicants</div>
                      {applicants.length === 0 ? (
                        <div className="text-sm opacity-70">No applicants yet.</div>
                      ) : (
                        <div className="space-y-2">
                          {applicants.map((app) => (
                            <div key={app._id || app.applicantEmail} className={`p-3 rounded border ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
                              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                <div>
                                  <div className="font-medium">{app.applicantName || 'Applicant'}</div>
                                  <div className="text-xs opacity-70">{app.applicantEmail || '—'} • {app.appName || 'Direct'}</div>
                                  <div className="text-xs opacity-70">Applied: {formatDateDDMMYYYY(app.createdAt)}</div>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                  <span className={`px-2 py-0.5 rounded ${app.status === 'shortlisted' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' : app.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>{app.status || 'new'}</span>
                                  {app.resume && (
                                    <a href={app.resume} target="_blank" rel="noreferrer" className="px-2 py-1 rounded bg-blue-600 text-white">Resume</a>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

AdminAllJobs.propTypes = { isDarkMode: PropTypes.bool, $isDarkMode: PropTypes.bool };
