import { useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useParams, useNavigate } from 'react-router-dom';
import { adminListCompanyJobs, adminToggleJobStatus, adminDeleteJob } from '../api';
import { formatDateDDMMYYYY } from '../utils/date';

export default function AdminJobs({ isDarkMode, $isDarkMode }) {
  const dark = $isDarkMode ?? isDarkMode ?? false;
  const { companyId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [company, setCompany] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [busy, setBusy] = useState({});

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await adminListCompanyJobs(companyId);
      setCompany(data.company);
      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  async function onToggle(job) {
    setBusy(b => ({ ...b, [job._id]: true }));
    try {
      const next = !job.jobActive;
      await adminToggleJobStatus(job._id, next);
      setJobs(list => list.map(j => j._id === job._id ? { ...j, jobActive: next } : j));
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to update status');
    } finally {
      setBusy(b => ({ ...b, [job._id]: false }));
    }
  }

  async function onDelete(job) {
    if (!window.confirm('Delete this job permanently?')) return;
    setBusy(b => ({ ...b, [job._id]: true }));
    try {
      await adminDeleteJob(job._id);
      setJobs(list => list.filter(j => j._id !== job._id));
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to delete job');
    } finally {
      setBusy(b => ({ ...b, [job._id]: false }));
    }
  }

  return (
    <div className={`min-h-[60vh] px-4 py-6 ${dark ? 'text-white' : 'text-gray-900'}`}> 
      <div className="max-w-6xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Company Jobs</h1>
            {company && (
              <div className="text-sm opacity-80 mt-1">{company.name} • {company.email}</div>
            )}
          </div>
          <button onClick={() => navigate(-1)} className={`px-3 py-2 rounded ${dark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}>Back</button>
        </div>
        {error && (
          <div className={`mb-4 p-3 rounded border ${dark ? 'bg-red-900/30 border-red-800 text-red-200' : 'bg-red-50 border-red-200 text-red-700'}`}>{error}</div>
        )}
        {loading ? (
          <div className="p-8 text-center opacity-70">Loading jobs…</div>
        ) : jobs.length === 0 ? (
          <div className={`p-8 rounded border text-center ${dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>No jobs found for this company.</div>
        ) : (
          <div className={`rounded border ${dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className={`grid grid-cols-12 text-xs uppercase tracking-wide px-4 py-3 ${dark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
              <div className="col-span-4">Title</div>
              <div className="col-span-3">Posted</div>
              <div className="col-span-2">Active</div>
              <div className="col-span-3 text-right">Actions</div>
            </div>
            <ul>
              {jobs.map(job => (
                <li key={job._id} className={`grid grid-cols-12 items-center px-4 py-3 border-t ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div className="col-span-4 truncate" title={job.jobTitle}>{job.jobTitle}</div>
                  <div className="col-span-3">{formatDateDDMMYYYY(job.createdAt || job.postedAt || job._id.substring(0,8) * 1000)}</div>
                  <div className="col-span-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${job.jobActive ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>{job.jobActive ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div className="col-span-3 flex justify-end gap-2">
                    <button disabled={!!busy[job._id]} onClick={() => onToggle(job)} className={`px-3 py-1.5 rounded text-sm ${job.jobActive ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : 'bg-green-600 hover:bg-green-700 text-white'} disabled:opacity-50`}>{job.jobActive ? 'Deactivate' : 'Activate'}</button>
                    <button disabled={!!busy[job._id]} onClick={() => onDelete(job)} className="px-3 py-1.5 rounded text-sm bg-red-600 hover:bg-red-700 text-white disabled:opacity-50">Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

AdminJobs.propTypes = {
  isDarkMode: PropTypes.bool,
  $isDarkMode: PropTypes.bool,
};
