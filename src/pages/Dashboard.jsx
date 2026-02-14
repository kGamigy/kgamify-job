import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import {
  FaCheckCircle,
  FaTimesCircle,
  FaBriefcase,
  FaUsers,
  FaEye,
  FaMapMarkerAlt,
  FaDollarSign,
  FaCalendarAlt,
  FaPlusCircle,
  FaInbox,
  FaLayerGroup,
  FaSyncAlt
} from "react-icons/fa";
import { fetchJobs } from "../store/slices/jobsSlice";
import { formatDateDDMMYYYY } from '../utils/date';
import { 
  selectJobs, 
  selectJobsLoading, 
  selectJobsError
} from "../store/slices/jobsSlice";
import { getJobsCached } from "../services/jobsCache";
import { toggleJobActive } from "../api";

// Helper kept outside component to avoid creating functions within render that might differ across hot reloads
// (Removed unused loadCompanyData helper)

// -----------------
// Subcomponents (kept in same file for simplicity & tree-shaking friendliness)
// -----------------

const Hero = ({ companyLogo, userCompany, cleanDescription, isDarkMode }) => {
  const headerGradient = isDarkMode
    ? "bg-gradient-to-r from-gray-900 to-[#ff8200]"
    : "bg-gradient-to-r from-[#ff8200] to-[#ffb347]";
  return (
    <header className={`w-full ${headerGradient} py-10 md:py-14 mb-8 rounded-4xl flex flex-col items-center text-center px-4`}>
      <img
        src={companyLogo}
        alt={`${userCompany?.companyName || 'Company'} logo`}
        className="w-20 h-20 rounded-xl shadow-lg border-4 border-white bg-white object-cover mb-4"
      />
      <h1 className="text-3xl md:text-4xl font-extrabold mb-2 text-white drop-shadow-lg">
        {userCompany?.companyName || "Company Dashboard"}
      </h1>
      <p className="text-base md:text-lg opacity-95 mb-2 text-white font-medium max-w-3xl">
        Track jobs, applications, and company performance at a glance.
      </p>
      {cleanDescription && (
        <p className="mt-1 text-white/85 text-sm md:text-base max-w-2xl leading-relaxed">
          {cleanDescription}
        </p>
      )}
    </header>
  );
};
Hero.propTypes = {
  companyLogo: PropTypes.string.isRequired,
  userCompany: PropTypes.object,
  cleanDescription: PropTypes.string,
  isDarkMode: PropTypes.bool
};

const StatCard = ({ icon: Icon, label, value, accent, isDarkMode, helper }) => (
  <div
    className={`rounded-xl shadow border p-5 sm:p-6 flex flex-col gap-1 ${
      isDarkMode ? 'bg-gray-800/70 border-gray-700' : 'bg-white border-orange-200/80'
    }`}
    aria-label={`${label}: ${value}`}
  >
    <div className="flex items-center gap-3">
      <span className={`text-2xl sm:text-3xl ${accent}`}> <Icon /> </span>
      <span className="text-sm font-semibold tracking-wide uppercase opacity-70">{label}</span>
    </div>
    <div className={`text-3xl font-extrabold ${accent}`}>{value}</div>
    {helper && <div className="text-xs opacity-70 leading-snug">{helper}</div>}
  </div>
);
StatCard.propTypes = {
  icon: PropTypes.any.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  accent: PropTypes.string,
  isDarkMode: PropTypes.bool,
  helper: PropTypes.string
};

const JobCard = ({ job, isDarkMode, navigate, onToggle }) => (
  <article
    key={`job-${job._id}`}
    className={`rounded-2xl shadow border transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 cursor-pointer p-6 flex flex-col ${
      isDarkMode ? 'border-gray-700 bg-gray-900/70' : 'border-orange-200 bg-white/90 backdrop-blur'
    }`}
    onClick={() => navigate(`/job/${job._id}`)}
  >
    <div className="flex justify-between items-start mb-4 gap-4">
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-lg text-[#ff8200] dark:text-[#ff8200] hover:text-[#e57400] line-clamp-2 leading-snug">
          {job.jobTitle}
        </h3>
        {job.category && (
          <span className="inline-block px-2.5 py-0.5 text-xs rounded bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 mt-2 font-medium tracking-wide">
            {job.category}
          </span>
        )}
      </div>
      <div className="ml-2 shrink-0" aria-label={job.status === 'active' ? 'Active job' : 'Inactive job'}>
        {job.status === "active" ? (
          <span className="flex items-center text-[#ff8200]" title="Active"><FaCheckCircle className="h-5 w-5" /></span>
        ) : (
          <span className="flex items-center text-gray-400" title="Inactive"><FaTimesCircle className="h-5 w-5" /></span>
        )}
      </div>
    </div>
    <div className="space-y-2.5 mb-4 text-sm">
      <div className="flex items-center font-medium"><FaMapMarkerAlt className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" /> {job.location || '—'}</div>
      <div className="flex items-center font-medium"><FaBriefcase className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" /> <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xxs sm:text-xs font-medium">{job.employmentType}</span></div>
      <div className="flex items-center font-medium"><FaDollarSign className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" /> {job.salary || 'N/A'}</div>
    </div>
    <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700 text-xs sm:text-sm">
      <div className="flex items-center"><FaUsers className="h-4 w-4 mr-1.5 text-gray-500 dark:text-gray-400" /> {job.applicants?.length || 0} apps</div>
      <div className="flex items-center"><FaCalendarAlt className="h-4 w-4 mr-1.5 text-gray-500 dark:text-gray-400" /> {formatDateDDMMYYYY(job.createdAt || job.datePosted)}</div>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2">
      <button
        onClick={(e) => { e.stopPropagation(); navigate(`/job/${job._id}`); }}
        className="w-full px-4 py-2.5 bg-gradient-to-r from-[#ff8200] to-[#ffb347] text-white rounded-lg font-semibold shadow hover:from-[#e57400] hover:to-[#ffb347] flex items-center justify-center gap-2 text-sm"
        aria-label={`View job ${job.jobTitle}`}
      >
        <FaEye className="h-4 w-4" /> View
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onToggle?.(job); }}
        className={`w-full px-4 py-2.5 rounded-lg font-semibold shadow flex items-center justify-center gap-2 text-sm ${job.jobActive ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600' : 'bg-green-600 hover:bg-green-700 text-white'}`}
        aria-label={`${job.jobActive ? 'Deactivate' : 'Activate'} job ${job.jobTitle}`}
      >
        {job.jobActive ? 'Deactivate' : 'Activate'}
      </button>
    </div>
  </article>
);
JobCard.propTypes = {
  job: PropTypes.object.isRequired,
  isDarkMode: PropTypes.bool,
  navigate: PropTypes.func.isRequired,
  onToggle: PropTypes.func
};

const Pagination = ({ currentPage, totalPages, onPageChange, start, end, total }) => {
  if (totalPages <= 1) return null;
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      pages.push(i);
    } else if (i === currentPage - 2 || i === currentPage + 2) {
      pages.push(`ellipsis-${i}`);
    }
  }
  return (
    <nav className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" aria-label="Pagination">
      <div className="text-sm font-medium opacity-80">Showing {start} - {end} of {total}</div>
      <div className="flex items-center flex-wrap gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1.5 text-sm border rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800 border-gray-300 dark:border-gray-600"
          aria-label="Previous page"
        >Prev</button>
        {pages.map(p => p.toString().startsWith('ellipsis') ? (
          <span key={p} className="px-2 select-none">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            aria-current={p === currentPage ? 'page' : undefined}
            className={`px-3 py-1.5 text-sm border rounded-md transition ${p === currentPage ? 'bg-gradient-to-r from-[#ff8200] to-[#ffb347] text-white border-[#ff8200]' : 'hover:bg-gray-100 dark:hover:bg-gray-800 border-gray-300 dark:border-gray-600'}`}
          >{p}</button>
        ))}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 text-sm border rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800 border-gray-300 dark:border-gray-600"
          aria-label="Next page"
        >Next</button>
      </div>
    </nav>
  );
};
Pagination.propTypes = {
  currentPage: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
  start: PropTypes.number.isRequired,
  end: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired
};

// -----------------
// Main component
// -----------------
const Dashboard = ({ isDarkMode, email = null, userCompany = null }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const jobs = useSelector(selectJobs);
  const loading = useSelector(selectJobsLoading);
  const error = useSelector(selectJobsError);
  // Local state
  // Local copies of jobs; we keep a direct API fallback only until Redux fills
  const [directAPIJobs, setDirectAPIJobs] = useState([]); // Fallback if Redux slice empty
  const [initialWaitOver, setInitialWaitOver] = useState(false);
  // Subscription modal removed from dashboard; plans moved to a dedicated page

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showInactive, setShowInactive] = useState(false); // toggle to include inactive jobs

  useEffect(() => {
    // Fetch jobs when component mounts or when inactive toggle changes
    const params = email
      ? { page: 1, limit: 12, filters: { email }, includeInactive: showInactive }
      : { page: 1, limit: 50, includeInactive: showInactive };
    dispatch(fetchJobs(params));
  }, [dispatch, email, showInactive]);

  // So the UI doesn't stay blocked by a slow request (new companies may have 0 jobs),
  // stop showing the initial full-screen loader after a short grace period
  useEffect(() => {
    const t = setTimeout(() => setInitialWaitOver(true), 1500);
    return () => clearTimeout(t);
  }, []);

  // Debounced cached direct API fallback
  useEffect(() => {
    let cancelled = false;
    const h = setTimeout(async () => {
      try {
        const response = await getJobsCached(email ? { email, includeInactive: showInactive } : { includeInactive: showInactive });
        if (cancelled) return;
        const normalized = Array.isArray(response?.jobs)
          ? response.jobs
          : Array.isArray(response)
            ? response
            : [];
        setDirectAPIJobs(normalized);
      } catch { /* ignore */ }
    }, 150);
    return () => { cancelled = true; clearTimeout(h); };
  }, [email, showInactive]);

  // Auto-retry: if first active-only fetch yields no jobs, enable inactive view.
  useEffect(() => {
    try {
      const hasDisplayJobs = Array.isArray(jobs) && jobs.length > 0 || Array.isArray(directAPIJobs) && directAPIJobs.length > 0;
      if (!showInactive && !loading && initialWaitOver && !hasDisplayJobs) {
        setShowInactive(true);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, initialWaitOver, showInactive, jobs, directAPIJobs]);

  // Normalize & unify job source with memoization
  const displayJobs = useMemo(() => {
    // Prefer Redux slice when populated
    const source = (jobs && jobs.length > 0) ? jobs : directAPIJobs;
    if (!source || source.length === 0) return [];

    // Normalize a consistent company email accessor
    const norm = source.map(j => ({
      ...j,
      __companyEmail: j.companyEmail || j.company?.email || j.createdBy || '',
      status: j.status || (j.jobActive ? 'active' : 'inactive')
    }));

    // If email provided we already filtered at API layer; skip strict client-side filter to avoid mismatches
    const base = norm;
    // Deduplicate by _id (direct API + Redux might overlap)
    const dedupMap = new Map();
    for (const job of base) {
      const key = job._id || job.id;
      if (!dedupMap.has(key)) dedupMap.set(key, job);
    }
    const deduped = Array.from(dedupMap.values());

    // Sort newest first
    deduped.sort((a, b) => {
      const aDate = new Date(a.createdAt || a.datePosted || a.postedAt || 0);
      const bDate = new Date(b.createdAt || b.datePosted || b.postedAt || 0);
      return bDate - aDate;
    });
    return deduped;
  }, [jobs, directAPIJobs]);
  
  const totalJobs = displayJobs.length;

  const handleToggle = useCallback(async (job) => {
    try {
      const next = !job.jobActive;
      await toggleJobActive(job._id, next, email || job.__companyEmail);
      // Optimistic UI
      setDirectAPIJobs(list => list.map(j => j._id === job._id ? { ...j, jobActive: next, status: next ? 'active' : 'inactive' } : j));
    } catch (e) {
      // Optionally implement toast later
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.log('Failed to toggle job', e?.response?.data || e?.message);
      }
    }
  }, [email]);

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentJobs = displayJobs.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(displayJobs.length / itemsPerPage);
  
  // Only count applications for displayed jobs
  const totalApplications = displayJobs.reduce(
    (acc, job) => acc + (job.applicants?.length || 0), 
    0
  );

  // Calculate additional statistics
  const activeJobs = displayJobs.filter(job => job.status === "active").length;
  const recentJobs = displayJobs.filter(job => {
    const jobDate = new Date(job.createdAt || job.datePosted);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return jobDate >= weekAgo;
  }).length;

  // ---------------- Count-up Animation (lightweight) ----------------
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [animVals, setAnimVals] = useState({ jobs: 0, apps: 0, active: 0, recent: 0 });
  const prevTargetsRef = useRef(animVals);

  useEffect(() => {
    const targets = { jobs: totalJobs, apps: totalApplications, active: activeJobs, recent: recentJobs };
    // If reduced motion, jump immediately
    if (prefersReducedMotion) {
      setAnimVals(targets);
      prevTargetsRef.current = targets;
      return;
    }
    const duration = 600;
    const start = performance.now();
    const from = { ...animVals };
    let frame;
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setAnimVals({
        jobs: Math.round(from.jobs + (targets.jobs - from.jobs) * ease),
        apps: Math.round(from.apps + (targets.apps - from.apps) * ease),
        active: Math.round(from.active + (targets.active - from.active) * ease),
        recent: Math.round(from.recent + (targets.recent - from.recent) * ease)
      });
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    prevTargetsRef.current = targets;
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalJobs, totalApplications, activeJobs, recentJobs]);

  // Only block the screen if we're still loading AND have no data yet AND grace period not over
  const hasAnyData = displayJobs.length > 0;
  const showSkeletons = loading && !hasAnyData && initialWaitOver;

  // Company banner colors and logo fallback
  // Quick action handler to refresh jobs manually
  const handleRefresh = useCallback(() => {
    const params = email
      ? { page: 1, limit: 12, filters: { email }, includeInactive: showInactive }
      : { page: 1, limit: 50, includeInactive: showInactive };
    dispatch(fetchJobs(params));
  }, [dispatch, email, showInactive]);

  const handleToggleInactive = useCallback(() => {
    setShowInactive(v => !v);
  }, []);
  const cleanDescription = userCompany?.description
    ? String(userCompany.description).replace(/<[^>]+>/g, '')
    : '';
  const companyLogo = userCompany?.logoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(userCompany?.companyName || "Company")}&background=ff8200&color=fff&size=128`;

  // (Modal visibility handled by useSubscriptionPrompt)

  return (
    <div className={`min-h-screen flex flex-col items-center ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'} pb-16`}>
      <Hero companyLogo={companyLogo} userCompany={userCompany} cleanDescription={cleanDescription} isDarkMode={isDarkMode} />

      {/* Quick Actions */}
      <section className="w-full max-w-6xl mx-auto px-4 mb-10" aria-label="Quick actions">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between min-h-[54px]">
            <div className="flex flex-wrap gap-3">
              {loading && !displayJobs.length ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className={`h-11 w-36 rounded-lg animate-pulse ${isDarkMode ? 'bg-gray-800/60' : 'bg-orange-100/40'} border ${isDarkMode ? 'border-gray-700' : 'border-orange-200'}`}></div>
                ))
              ) : (
                <>
                  <Link to="/post-job" className="group">
                    <button className="flex items-center gap-2 px-4 h-11 rounded-lg bg-gradient-to-r from-[#ff8200] to-[#ffb347] text-white font-semibold shadow hover:from-[#e57400] hover:to-[#ffb347] text-sm">
                      <FaPlusCircle className="h-4 w-4" /> Post Job
                    </button>
                  </Link>
                  <Link to="/applications">
                    <button className={`flex items-center gap-2 px-4 h-11 rounded-lg text-sm font-semibold shadow ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-100 border border-gray-200'} transition`}>
                      <FaInbox className="h-4 w-4 text-[#ff8200]" /> View Applications
                    </button>
                  </Link>
                  <Link to="/job-posted">
                    <button className={`flex items-center gap-2 px-4 h-11 rounded-lg text-sm font-semibold shadow ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-100 border border-gray-200'} transition`}>
                      <FaLayerGroup className="h-4 w-4 text-[#ff8200]" /> All Jobs
                    </button>
                  </Link>
                </>
              )}
            </div>
            <div className="flex gap-3 items-center flex-wrap">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className={`flex items-center gap-2 px-4 h-11 rounded-lg text-sm font-medium shadow ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700 disabled:opacity-50' : 'bg-white hover:bg-gray-100 border border-gray-200 disabled:opacity-50'} transition`}
                aria-label="Refresh jobs"
              >
                <FaSyncAlt className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Refreshing' : 'Refresh'}
              </button>
              {email && (
                <button
                  onClick={handleToggleInactive}
                  className={`flex items-center gap-2 px-4 h-11 rounded-lg text-sm font-medium shadow transition ${showInactive ? 'bg-[#ff8200] text-white' : (isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-white hover:bg-gray-100 border border-gray-200')}`}
                  aria-pressed={showInactive}
                  aria-label={showInactive ? 'Hide inactive jobs' : 'Show inactive jobs'}
                >
                  {showInactive ? 'Hide Inactive' : 'Show Inactive'}
                </button>
              )}
            </div>
        </div>
      </section>

      {/* Account Status Banner (Approved) */}
      {(userCompany?.status === 'approved' || userCompany?.approved) && (
        <div className="w-full max-w-6xl mx-auto mb-8">
          <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-green-900/20 border-green-700 text-green-200' : 'bg-green-50 border-green-200 text-green-900'}`}>
            <div className="font-semibold">Account active</div>
            <div className="text-sm">Your company account is approved and in good standing. Need anything from admin? See <a href="/messages" className="underline text-[#ff8200]">Messages</a>.</div>
          </div>
        </div>
      )}

      {/* Job Statistics (hidden if no jobs) */}
      {displayJobs.length > 0 && (
        <section className="w-full max-w-6xl mx-auto px-4 mb-12" aria-label="Job statistics">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            <StatCard icon={FaBriefcase} label="Total Jobs" value={animVals.jobs} accent="text-[#ff8200]" isDarkMode={isDarkMode} />
            <StatCard icon={FaUsers} label="Applications" value={animVals.apps} accent="text-blue-500" isDarkMode={isDarkMode} />
            <StatCard icon={FaCheckCircle} label="Active" value={animVals.active} accent="text-[#ff8200]" isDarkMode={isDarkMode} helper={animVals.jobs ? `${Math.round((animVals.active/animVals.jobs)*100)}% active` : ''} />
            <StatCard icon={FaCalendarAlt} label="New (7d)" value={animVals.recent} accent="text-blue-500" isDarkMode={isDarkMode} />
          </div>
        </section>
      )}

      {/* Recent Job Posts */}
      <section className={`w-full max-w-6xl mx-auto rounded-xl shadow border ${isDarkMode ? 'bg-gray-800/60 border-gray-700' : 'bg-white/95 border-orange-200'} p-6 sm:p-10 backdrop-blur`} aria-labelledby="recent-jobs-heading">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <h2 id="recent-jobs-heading" className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-[#ff8200] to-[#ffb347] bg-clip-text text-transparent drop-shadow-lg">Recent Job Posts</h2>
          <div className="flex gap-3">
            {displayJobs.length > 0 && (
              <Link to="/jobs" className="text-sm font-semibold text-[#ff8200] hover:text-[#e57400]">View All →</Link>
            )}
          </div>
        </div>
        {/* Results Summary */}
        {!showSkeletons && (
          <div className="mb-6 text-base font-semibold flex flex-col gap-2">
            <span>Showing {currentJobs.length} of {displayJobs.length} jobs</span>
            {showInactive && email && (
              <span className="text-xs font-normal opacity-75">
                Inactive jobs are visible. You can reactivate an inactive job if your subscription is active.
              </span>
            )}
          </div>
        )}
        {error && !showSkeletons && (
          <div className="mt-3 sm:mt-4 p-4 rounded bg-red-100 dark:bg-red-900/20">
            <p className="text-red-500 dark:text-red-400 text-base">{error}</p>
            {error.includes("No listed jobs") && (
              <div className="mt-2">
                <p className="text-sm">
                  It appears that some jobs in the database may be missing the company email field.
                  Contact your administrator to run the fix-jobs script.
                </p>
                <div className="mt-2">
                  <Link to="/post-job">
                    <button className="btn-primary px-4 py-2 text-base">
                      Post a New Job
                    </button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
        {/* Skeleton cards while loading */}
        {showSkeletons && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse p-8"
              >
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-blue-100 dark:bg-blue-900 rounded w-20 mb-4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-3"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-3"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-3"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
              </div>
            ))}
          </div>
        )}
        {!showSkeletons && !error && displayJobs.length === 0 && (
          <div className="text-center py-12" role="status" aria-live="polite">
            <FaBriefcase className="mx-auto h-16 w-16 text-gray-400 mb-6" />
            <p className="mb-6 font-semibold text-lg">No jobs posted yet.</p>
            <Link to="/post-job">
              <button className="btn-primary bg-gradient-to-r from-[#ff8200] to-[#ffb347] text-white px-8 py-4 rounded-xl font-bold shadow-lg text-xl hover:from-[#e57400] hover:to-[#ffb347]">
                Post Your First Job
              </button>
            </Link>
          </div>
        )}
        {!showSkeletons && !error && displayJobs.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {currentJobs.map(job => (
                <JobCard key={job._id} job={job} isDarkMode={isDarkMode} navigate={navigate} onToggle={handleToggle} />
              ))}
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              start={indexOfFirstItem + 1}
              end={Math.min(indexOfLastItem, displayJobs.length)}
              total={displayJobs.length}
            />
          </>
        )}
      </section>
    </div>
  );
};

Dashboard.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  email: PropTypes.string,
  userCompany: PropTypes.object
};

export default Dashboard;