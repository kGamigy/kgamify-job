import { useState, useEffect, useRef, useCallback } from "react";
import PropTypes from 'prop-types';
import { useParams, useNavigate } from "react-router-dom";
import { FaCheckCircle, FaTimesCircle, FaMapMarkerAlt, FaBriefcase, FaClock, FaMoneyBillWave, FaBuilding, FaGlobe, FaBookmark } from "react-icons/fa";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import { getJobById, getApplicationsByJobId, getRecommendationsForJob, shortlistApplication, rejectApplication } from "../api";
import usePlanMeta from '../hooks/usePlanMeta';
import sanitizeHTML from "../utils/sanitizeHTML";
import ResumeViewer from "../components/ResumeViewer";
import { formatDateDDMMYYYY } from '../utils/date';

const Job = ({ isDarkMode }) => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [view, setView] = useState('table'); // 'table' | 'cards'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authError] = useState(false);
  const [updatingIds, setUpdatingIds] = useState(new Set());
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  // AI state
  const [ai, setAi] = useState({ loading: false, error: '', items: [] });
  const [topN, setTopN] = useState(5);
  const [recommendedOnly, setRecommendedOnly] = useState(true);

  // Derive company email (viewer) for plan gating
  let companyEmail = undefined;
  try {
    const cd = JSON.parse(localStorage.getItem('companyData') || 'null');
    if (cd?.email) companyEmail = cd.email;
  } catch { /* ignore */ }
  const { planMeta } = usePlanMeta(companyEmail, { auto: true });

  // Cache refs to avoid re-fetching unchanged job/applications data
  const jobCacheRef = useRef({}); // jobId -> job data (in-memory)
  const appCacheRef = useRef({}); // jobId -> { items, fetchedAt } (in-memory)
  const lastAppliedChangeRef = useRef(0); // timestamp of last shortlist/reject
  const SESSION_KEY_JOBS = 'jobCache';
  const SESSION_KEY_APPS = 'appCache';

  // Hydrate caches from sessionStorage once
  useEffect(() => {
    try {
      const jobsRaw = sessionStorage.getItem(SESSION_KEY_JOBS);
      if (jobsRaw) jobCacheRef.current = JSON.parse(jobsRaw) || {};
    } catch { /* ignore */ }
    try {
      const appsRaw = sessionStorage.getItem(SESSION_KEY_APPS);
      if (appsRaw) appCacheRef.current = JSON.parse(appsRaw) || {};
    } catch { /* ignore */ }
  }, []);

  const persistCaches = () => {
    try { sessionStorage.setItem(SESSION_KEY_JOBS, JSON.stringify(jobCacheRef.current)); } catch { /* ignore */ }
    try { sessionStorage.setItem(SESSION_KEY_APPS, JSON.stringify(appCacheRef.current)); } catch { /* ignore */ }
  };

  const fetchWithRetry = useCallback(async (fn, args = [], { retries = 2, baseDelay = 400 } = {}) => {
    let attempt = 0;
    while (true) {
      try { return await fn(...args); } catch (err) {
        attempt += 1;
        if (attempt > retries) throw err;
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 120;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      // Job: use cache if present
      const jobEntry = jobCacheRef.current[jobId];
      if (jobEntry) {
        setJob(jobEntry);
      } else {
        const jobData = await fetchWithRetry(getJobById, [jobId]);
        jobCacheRef.current[jobId] = jobData;
        setJob(jobData);
        persistCaches();
      }
      // Applications: reuse cache if no status changes since last fetch
      const cacheEntry = appCacheRef.current[jobId];
      const changedRecently = Date.now() - lastAppliedChangeRef.current < 5000; // within 5s of mutation always refetch
      if (cacheEntry && !changedRecently) {
        setApplications(cacheEntry.items);
      } else {
        try {
          const applicationsData = await fetchWithRetry(getApplicationsByJobId, [jobId]);
          const list = Array.isArray(applicationsData) ? applicationsData : [];
          appCacheRef.current[jobId] = { items: list, fetchedAt: Date.now() };
          setApplications(list);
          persistCaches();
        } catch {
          if (!cacheEntry) setApplications([]); // only clear if no cache fallback
        }
      }
    } catch (e) {
      setError(e?.message || 'Failed to fetch job details');
    } finally {
      setLoading(false);
    }
  }, [jobId, fetchWithRetry]);

  useEffect(() => { loadData(); }, [loadData]);

  // Fetch AI recommendations only if plan allows
  useEffect(() => {
    let cancelled = false;
    if (!planMeta || !planMeta.recommendationsEnabled) {
      setAi({ loading: false, error: 'Recommendations available on paid plans', items: [] });
      return;
    }
    (async () => {
      try {
        setAi(prev => ({ ...prev, loading: true, error: '', items: [] }));
        const recs = await getRecommendationsForJob(jobId, topN);
        if (cancelled) return;
        setAi({ loading: false, error: '', items: Array.isArray(recs) ? recs : [] });
      } catch (e) {
        if (cancelled) return;
        setAi({ loading: false, error: e?.message || 'Failed to fetch recommendations', items: [] });
      }
    })();
    return () => { cancelled = true; };
  }, [jobId, topN, planMeta]);

  if (loading) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="animate-pulse space-y-6">
            <div className={`h-8 w-1/3 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`}></div>
            <div className={`h-4 w-1/5 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`}></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className={`h-64 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}></div>
              <div className={`h-64 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className={`flex justify-center items-center h-screen ${isDarkMode ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-800"}`}>
        <div className="bg-red-100 dark:bg-red-900 p-4 rounded-lg">
          <p className="text-red-700 dark:text-red-200">Authentication Error</p>
          <p className="mt-2">You do not have permission to view this page.</p>
          <button 
            onClick={() => navigate("/login")}
            className={`mt-4 px-4 py-2 rounded-lg font-semibold transition-all duration-300 ${isDarkMode ? "bg-red-700 text-white hover:bg-red-600" : "bg-red-500 text-white hover:bg-red-400"}`}
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className={`flex justify-center items-center h-screen ${isDarkMode ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-800"}`}>
        <div className="bg-red-100 dark:bg-red-900 p-4 rounded-lg">
          <p className="text-red-700 dark:text-red-200">Error: {error}</p>
          <p className="mt-2">Please try again later or contact support.</p>
        </div>
      </div>
    );
  }

  // Helpers: sanitize and render rich content
  const getSanitizedHTML = (htmlContent) => {
    if (!htmlContent || typeof htmlContent !== 'string') return null;
    const clean = sanitizeHTML(htmlContent);
    return { __html: clean };
  };

  // Convert plain text with bullet-like prefixes to proper HTML lists
  const convertPlainTextToHTML = (text) => {
    if (!text) return '';
    const lines = String(text).split(/\r?\n/);
    const bulletRe = /^\s*([-*•◆▪◦►▶➤‣∙·])\s+(.*)$/;
    let html = '';
    let inList = false;
    for (const raw of lines) {
      const line = raw.trimEnd();
      const m = line.match(bulletRe);
      if (m) {
        if (!inList) {
          inList = true;
          html += '<ul>';
        }
        const item = m[2];
        html += `<li>${item}</li>`;
      } else {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        if (line.length) {
          html += `<p>${line}</p>`;
        } else {
          // preserve blank line spacing
          html += '<p></p>';
        }
      }
    }
    if (inList) html += '</ul>';
    return html;
  };

  // Normalize existing HTML: convert paragraphs starting with bullet markers into lists
  const normalizeBulletedHTML = (html) => {
    try {
      if (typeof window === 'undefined' || !html) return html;
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const body = doc.body;
      const bulletRe = /^\s*([-*•◆▪◦►▶➤‣∙·])\s+(.*)$/;
      const newFrag = doc.createDocumentFragment();
      let ul = null;
      const flushList = () => {
        if (ul) {
          newFrag.appendChild(ul);
          ul = null;
        }
      };
      Array.from(body.childNodes).forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE && (node.nodeName === 'P' || node.nodeName === 'DIV')) {
          const text = node.textContent || '';
          const m = text.match(bulletRe);
          if (m) {
            if (!ul) ul = doc.createElement('ul');
            const li = doc.createElement('li');
            li.textContent = m[2];
            ul.appendChild(li);
            return; // handled
          }
        }
        // Non-bullet element or text node
        flushList();
        newFrag.appendChild(node.cloneNode(true));
      });
      flushList();
      const wrapper = doc.createElement('div');
      wrapper.appendChild(newFrag);
      return wrapper.innerHTML;
    } catch {
      return html;
    }
  };

  const getFormattedHTML = (value) => {
    if (!value) return null;
    const hasTags = /<[^>]+>/.test(value);
    const html = hasTags ? normalizeBulletedHTML(value) : convertPlainTextToHTML(value);
    return getSanitizedHTML(html);
  };

  // Handlers: shortlist/reject
  const handleStatusChange = async (applicationId, target) => {
    const prev = applications.find(a => a._id === applicationId)?.status;
    setUpdatingIds(prevSet => new Set(prevSet).add(applicationId));
    setApplications(prevApps => prevApps.map(a => a._id === applicationId ? { ...a, status: target } : a));
    try {
      if (target === 'shortlisted') {
        await shortlistApplication(applicationId);
        setSnack({ open: true, message: 'Applicant shortlisted. Email notification sent.', severity: 'success' });
      } else {
        await rejectApplication(applicationId);
        setSnack({ open: true, message: 'Application rejected.', severity: 'success' });
      }
      lastAppliedChangeRef.current = Date.now();
      // Invalidate application cache for this job so subsequent view reflects latest
      delete appCacheRef.current[jobId];
    } catch (e) {
      // rollback
      setApplications(prevApps => prevApps.map(a => a._id === applicationId ? { ...a, status: prev } : a));
      setSnack({ open: true, message: e?.response?.data?.error || e?.message || 'Action failed', severity: 'error' });
    } finally {
      setUpdatingIds(prevSet => { const n = new Set(prevSet); n.delete(applicationId); return n; });
    }
  };

  const renderMaybeHTML = (value, extraClasses = '') => {
    if (!value) return <span className="opacity-60">—</span>;
    const hasTags = /<[^>]+>/.test(value);
    if (hasTags) {
      return (
        <div
          className={`prose max-w-none ${isDarkMode ? 'prose-invert' : ''} ${extraClasses}`}
          dangerouslySetInnerHTML={getSanitizedHTML(value)}
        />
      );
    }
    // Plain text: convert new lines to <br/>
    const textWithBreaks = String(value).split('\n').map((line, i) => (
      <p key={i} className="mb-2 last:mb-0">{line}</p>
    ));
    return (
      <div className={`prose max-w-none ${isDarkMode ? 'prose-invert' : ''} ${extraClasses}`}>
        {textWithBreaks}
      </div>
    );
  };

  // Normalize skills into an array of labels (supports array, comma/newline separated string)
  const skillsArray = (() => {
    const s = job?.skills;
    if (!s) return [];
    if (Array.isArray(s)) return s.filter(Boolean).map((v) => String(v).trim()).filter(Boolean);
    return String(s)
      .split(/[\n,]+/)
      .map((v) => v.trim())
      .filter(Boolean);
  })();

  return (
    <div className={`${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-black'}`}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">{job.jobTitle}</h1>
          <div className="mt-2 flex items-center gap-2">
            <FaBuilding className={`h-4 w-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
            <span className="text-[#ff8200] font-semibold">{job.companyName}</span>
          </div>
        </div>

        {/* Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job description */}
      <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-6`}>
              <h2 className="text-xl font-semibold mb-3">Job Description</h2>
              <div
        className={`job-description-content ${isDarkMode ? '' : ''}`}
                dangerouslySetInnerHTML={getFormattedHTML(job.jobDescription)}
              />
            </div>

            {/* Details cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-6`}>
                <h3 className="font-semibold mb-3">Role Details</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2"><FaBriefcase className="text-[#ff8200]" /> {job.employmentType || 'N/A'}</li>
                  <li className="flex items-center gap-2"><FaClock className="text-[#ff8200]" /> {job.experienceLevel || 'N/A'}</li>
                  <li className="flex items-center gap-2"><FaGlobe className="text-[#ff8200]" /> {job.remoteOrOnsite || 'N/A'}</li>
                </ul>
                {(Array.isArray(job.jdFiles) && job.jdFiles.length > 0) ? (
                  <div className="mt-3 space-y-1">
                    <div className="text-sm font-medium">JD Attachments</div>
                    <ul className="list-disc list-inside text-sm">
                      {job.jdFiles.map((u, i) => (
                        <li key={i}><a href={u} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Attachment {i + 1}</a></li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  job.jdPdfUrl ? (
                    <div className="mt-3">
                      <a
                        href={job.jdPdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-sm text-blue-600 underline"
                      >
                        View JD
                      </a>
                    </div>
                  ) : null
                )}
                {/* Skills moved to the right sidebar */}
              </div>
              <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-6`}>
                <h3 className="font-semibold mb-3">Compensation & Location</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2"><FaMoneyBillWave className="text-[#ff8200]" /> {job.salary || 'Not specified'}</li>
                  <li className="flex items-center gap-2"><FaMapMarkerAlt className="text-[#ff8200]" /> {job.location || 'Not specified'}</li>
                  {job.equity && <li className="flex items-center gap-2"><FaBookmark className="text-[#ff8200]" /> Equity: {job.equity}</li>}
                  {job.sponsorship && <li className="flex items-center gap-2"><FaBookmark className="text-[#ff8200]" /> Sponsorship: {job.sponsorship}</li>}
                </ul>
              </div>
            </div>

            {/* Rich sections */}
      {job.responsibilities && (
              <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-6`}>
                <h3 className="font-semibold mb-2">Responsibilities</h3>
        {renderMaybeHTML(job.responsibilities, 'job-description-content')}
              </div>
            )}
            {job.eligibility && (
              <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-6`}>
                <h3 className="font-semibold mb-2">Eligibility</h3>
        {renderMaybeHTML(job.eligibility, 'job-description-content')}
              </div>
            )}
            {job.benefits && (
              <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-6`}>
                <h3 className="font-semibold mb-2">Benefits</h3>
        {renderMaybeHTML(job.benefits, 'job-description-content')}
              </div>
            )}

    {job.recruitmentProcess && (
              <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-6`}>
                <h3 className="font-semibold mb-2">Recruitment Process</h3>
                <div
      className={`job-description-content ${isDarkMode ? '' : ''}`}
                  dangerouslySetInnerHTML={getFormattedHTML(job.recruitmentProcess)}
                />
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm p-6 sticky top-24`}>
              <div className="flex flex-col gap-3">
                {/* Apply/Save/Share removed as requested */}
                <button
                  onClick={() => navigate(-1)}
                  className="w-full px-4 py-2 bg-gradient-to-r from-[#ff8200] to-[#ffb347] text-white rounded-md font-semibold"
                >
                  Back
                </button>
              </div>
              <div className="mt-5 border-t pt-5 space-y-3 text-sm">
                <div className="flex items-center gap-2"><FaBriefcase className="text-[#ff8200]" /> {job.employmentType || 'N/A'}</div>
                <div className="flex items-center gap-2"><FaClock className="text-[#ff8200]" /> {job.experienceLevel || 'N/A'}</div>
                <div className="flex items-center gap-2"><FaGlobe className="text-[#ff8200]" /> {job.remoteOrOnsite || 'N/A'}</div>
                <div className="flex items-center gap-2"><FaMapMarkerAlt className="text-[#ff8200]" /> {job.location || 'Not specified'}</div>
                <div className="flex items-center gap-2"><FaMoneyBillWave className="text-[#ff8200]" /> {job.salary || 'Not specified'}</div>
                {job.status && (
                  <div className="flex items-center gap-2">
                    {job.status === 'active' ? (
                      <FaCheckCircle className="text-green-500" />
                    ) : (
                      <FaTimesCircle className="text-red-500" />
                    )}
                    <span className="capitalize">{job.status}</span>
                  </div>
                )}
                {job.numberOfPositions && (
                  <div className="flex items-center gap-2"><FaBookmark className="text-yellow-500" /> Positions: {job.numberOfPositions}</div>
                )}
                {job.category && (
                  <div className="flex items-center gap-2"><FaBookmark className="text-yellow-500" /> Category: {job.category}</div>
                )}
                {(Array.isArray(job.jdFiles) && job.jdFiles.length > 0) ? (
                  <div className="mt-2">
                    <a href={job.jdFiles[0]} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm">View JD</a>
                  </div>
                ) : (
                  job.jdPdfUrl ? (
                    <div className="mt-2">
                      <a href={job.jdPdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm">View JD</a>
                    </div>
                  ) : null
                )}
                {skillsArray.length > 0 && (
                  <div className="mt-4">
                    <div className="text-sm font-medium mb-2">Skills</div>
                    <div className="flex flex-wrap gap-2">
                      {skillsArray.map((s, i) => (
                        <span key={i} className={`px-2 py-1 rounded text-xs ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Applicants section */}
        <div className="mt-10 pb-10">
          <div className={`flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            <div>
              <div className="text-xl font-semibold">Applicants</div>
              <div className="mt-2 flex items-center gap-3 text-sm">
                {planMeta?.recommendationsEnabled ? (
                  <>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={recommendedOnly}
                        onChange={(e)=>setRecommendedOnly(e.target.checked)}
                      />
                      <span>Show only AI-recommended</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <span>Top N:</span>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={topN}
                        onChange={(e)=> setTopN(() => {
                          const v = parseInt(e.target.value||'5',10);
                          if (Number.isNaN(v)) return 5;
                          return Math.min(50, Math.max(1, v));
                        })}
                        className={`w-20 px-2 py-1 rounded border ${isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                      />
                    </label>
                    {ai.loading && <span className="text-xs opacity-70">Updating…</span>}
                    {!ai.loading && ai.error && (
                      <span className="text-xs text-red-500">AI error: {ai.error}</span>
                    )}
                  </>
                ) : (
                  <div className={`px-3 py-2 rounded text-xs font-medium ${isDarkMode ? 'bg-gray-800 text-gray-300 border border-gray-700' : 'bg-white text-gray-600 border border-gray-300'}`}>AI recommendations available on paid plans</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="opacity-70">View:</span>
              <button
                className={`px-3 py-1 rounded border ${view === 'table' ? 'bg-[#ff8200] text-white border-[#ff8200]' : (isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900')}`}
                onClick={() => setView('table')}
              >Table</button>
              <button
                className={`px-3 py-1 rounded border ${view === 'cards' ? 'bg-[#ff8200] text-white border-[#ff8200]' : (isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900')}`}
                onClick={() => setView('cards')}
              >Cards</button>
              <button
                onClick={() => { lastAppliedChangeRef.current = 0; delete appCacheRef.current[jobId]; loadData(); }}
                className={`px-3 py-1 rounded border font-medium transition-colors ${isDarkMode ? 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-white' : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-900'}`}
                disabled={loading}
              >{loading ? 'Refreshing…' : 'Refresh'}</button>
            </div>
          </div>

          {/* Compute visible applicants based on AI results */}
          {(() => null)()}
          {
            (() => {
              const recNames = new Set((ai.items||[]).map(r => String(r.applicantName || r.name || '').trim().toLowerCase()).filter(Boolean));
              const recEmails = new Set((ai.items||[]).map(r => String(r.email || '').trim().toLowerCase()).filter(Boolean));
              const recResumes = new Set((ai.items||[]).map(r => String(r.resume_url || '').trim()).filter(u => !!u));
              const isRec = (a) => {
                const nameKey = String(a.applicantName||'').trim().toLowerCase();
                const emailKey = String(a.applicantEmail||'').trim().toLowerCase();
                const resumeKey = String(a.resume||'').trim();
                return (nameKey && recNames.has(nameKey)) || (emailKey && recEmails.has(emailKey)) || (resumeKey && recResumes.has(resumeKey));
              };
              const visibleApps = planMeta?.recommendationsEnabled && recommendedOnly ? applications.filter(isRec) : applications;

              if (planMeta?.recommendationsEnabled && recommendedOnly && !ai.loading && (ai.items||[]).length === 0) {
                return (
                  <div className={`p-4 mb-3 rounded border ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700'}`}>
                    No AI recommendations found for this job. Try adjusting Top N.
                  </div>
                );
              }

              if (visibleApps.length === 0) {
                return (
                  <div className={`p-4 rounded-lg text-center ${isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-50 text-gray-600'} shadow-sm`}>
                    {recommendedOnly ? 'No recommended applicants match current recommendations.' : 'No applicants for this job yet'}
                  </div>
                );
              }

              return (
                <>
                  {/* Existing render paths but using visibleApps */}
                  {view === 'table' ? (
                    <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-sm overflow-x-auto`}>
                      <table className="w-full table-auto text-sm">
                        <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                          <tr>
                            <th className="text-left py-2 px-3">Name</th>
                            <th className="text-left py-2 px-3">Status</th>
                            <th className="text-right py-2 px-3">Date</th>
                            <th className="text-right py-2 px-3">Resume</th>
                            <th className="text-right py-2 px-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleApps.map(applicant => (
                            <tr key={applicant._id} className={isDarkMode ? 'border-t border-gray-700' : 'border-top border-gray-200'}>
                              <td className="py-2 px-3 whitespace-nowrap">{applicant.applicantName}</td>
                              <td className="py-2 px-3">
                                <span className={`px-2 py-0.5 rounded text-xs ${applicant.status === 'shortlisted' ? 'bg-green-100 text-green-700' : applicant.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{applicant.status || 'new'}</span>
                              </td>
                              <td className="py-2 px-3 text-right whitespace-nowrap">{formatDateDDMMYYYY(applicant.createdAt)}</td>
                              <td className="py-2 px-3 text-right">
                                {applicant.resume ? (
                                  <a href={applicant.resume} target="_blank" rel="noreferrer" className="px-2 py-1 rounded border hover:bg-gray-50 dark:hover:bg-gray-700">View</a>
                                ) : (
                                  <span className="opacity-60">No resume</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={updatingIds.has(applicant._id) || applicant.status === 'shortlisted'}
                                    onClick={() => handleStatusChange(applicant._id, 'shortlisted')}
                                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                      updatingIds.has(applicant._id) || applicant.status === 'shortlisted'
                                        ? 'opacity-60 cursor-not-allowed '
                                        : ''
                                    } ${isDarkMode ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                                  >
                                    Shortlist
                                  </button>
                                  <button
                                    type="button"
                                    disabled={updatingIds.has(applicant._id) || applicant.status === 'rejected'}
                                    onClick={() => handleStatusChange(applicant._id, 'rejected')}
                                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                      updatingIds.has(applicant._id) || applicant.status === 'rejected'
                                        ? 'opacity-60 cursor-not-allowed '
                                        : ''
                                    } ${isDarkMode ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'}`}
                                  >
                                    Reject
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {visibleApps.map((applicant) => (
                        <div
                          key={applicant._id}
                          className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow-sm flex flex-col gap-2`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className={`text-base font-semibold truncate ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{applicant.applicantName}</div>
                              <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Applied on: {formatDateDDMMYYYY(applicant.createdAt)}</div>
                            </div>
                            <div className="shrink-0">
                              {applicant.status ? (
                                <span className={`px-2 py-0.5 rounded text-xxs capitalize ${
                                  applicant.status === 'shortlisted' ? 'bg-green-100 text-green-700' :
                                  applicant.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                                }`}>{applicant.status}</span>
                              ) : null}
                            </div>
                          </div>

                          {applicant.testScore && (
                            <div className="text-xs">
                              <span className="font-medium">Test Score: </span>
                              <span className={`${parseInt(applicant.testScore) >= 70 ? 'text-green-500' : 'text-red-500'}`}>{applicant.testScore}</span>
                            </div>
                          )}

                          {Array.isArray(applicant.skills) && applicant.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {applicant.skills.slice(0, 6).map((skill, index) => (
                                <span key={index} className={`text-xxs px-2 py-0.5 rounded ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'}`}>{skill}</span>
                              ))}
                              {applicant.skills.length > 6 && (
                                <span className={`text-xxs px-2 py-0.5 rounded ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'}`}>+{applicant.skills.length - 6}</span>
                              )}
                            </div>
                          )}

                          <div className="mt-1">
                            {applicant.resume ? (
                              <ResumeViewer resumeUrl={applicant.resume} applicantName={applicant.applicantName} variant="inline" />
                            ) : (
                              <div className="text-xs text-gray-500">No resume provided</div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              disabled={updatingIds.has(applicant._id) || applicant.status === 'shortlisted'}
                              onClick={() => handleStatusChange(applicant._id, 'shortlisted')}
                              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                updatingIds.has(applicant._id) || applicant.status === 'shortlisted'
                                  ? 'opacity-60 cursor-not-allowed '
                                  : ''
                              } ${isDarkMode ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                            >
                              Shortlist
                            </button>
                            <button
                              type="button"
                              disabled={updatingIds.has(applicant._id) || applicant.status === 'rejected'}
                              onClick={() => handleStatusChange(applicant._id, 'rejected')}
                              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                updatingIds.has(applicant._id) || applicant.status === 'rejected'
                                  ? 'opacity-60 cursor-not-allowed '
                                  : ''
                              } ${isDarkMode ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'}`}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()
          }

          <Snackbar
            open={snack.open}
            autoHideDuration={3000}
            onClose={() => setSnack(s => ({ ...s, open: false }))}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert onClose={() => setSnack(s => ({ ...s, open: false }))} severity={snack.severity} sx={{ width: '100%' }}>
              {snack.message}
            </Alert>
          </Snackbar>
          {/* Legacy AI Top Candidates table removed as requested */}
        </div>
      </div>
    </div>
  );
};

export default Job;

Job.propTypes = {
  isDarkMode: PropTypes.bool
};

