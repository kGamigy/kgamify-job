import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  FaEdit,
  FaTrashAlt,
  FaEye,
  FaList,
  FaUsers,
  FaPlus,
  FaFilter,
  FaBriefcase,
  FaMapMarkerAlt,
  FaMoneyBill,
  FaClock,
  FaUserTie,
  FaLaptopHouse,
  FaCheck,
  FaSearch,
  FaSortAlphaDown,
  FaSortAmountDown,
} from 'react-icons/fa';
import { getJobs, deleteJob } from '../api';
import PropTypes from 'prop-types';
import { formatDateDDMMYYYY } from '../utils/date';

const JobPosted = ({ isDarkMode, email }) => {
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [selectedType, setSelectedType] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // active | inactive | all
  const [sortBy, setSortBy] = useState('dateDesc'); // dateDesc | dateAsc | titleAsc | titleDesc
  // Missing filter states referenced in JSX
  const [locationFilter, setLocationFilter] = useState('all');
  const [jobTypeFilter, setJobTypeFilter] = useState('all');
  const [experienceFilter, setExperienceFilter] = useState('all');
  const [salaryFilter, setSalaryFilter] = useState('all');
  const [applicantsFilter, setApplicantsFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [notification, setNotification] = useState('');
  const [categories, setCategories] = useState(['All']);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        if (!email) {
          return;
        }
        const response = await getJobs({ email });
        // Normalize: API may return array or { jobs: [] }
        const list = Array.isArray(response?.jobs)
          ? response.jobs
          : Array.isArray(response)
            ? response
            : [];
        setJobs(list);
        setFilteredJobs(list);
        // Extract unique categories from jobs
        const uniqueCategories = [
          'All',
          ...new Set(list.map(job => job.category).filter(Boolean)),
        ];
        setCategories(uniqueCategories);
      } catch {
        // Silent
      }
    };
    fetchJobs();
  }, [email]);

  // Pick up notification from navigation state (e.g., after EditJob)
  useEffect(() => {
    const msg = location.state?.notification;
    if (msg) {
      setNotification(msg);
      // Clear the notification after a short time and remove state to prevent repeat
      const t = setTimeout(() => setNotification(''), 3000);
      // Replace state to clear it
      navigate(location.pathname, { replace: true, state: {} });
      return () => clearTimeout(t);
    }
  }, [location, navigate]);

  const applyFilters = (base = jobs, opt = {}) => {
    const {
      category = selectedType,
      q = searchQuery,
      status = statusFilter,
      sort = sortBy,
    } = opt;
    let list = Array.isArray(base) ? [...base] : [];
    // Category chip
    if (category && category !== 'All') {
      list = list.filter(j => j.category === category);
    }
    // Search by title/location/type
    if (q) {
      const s = q.toLowerCase();
      list = list.filter(
        j =>
          j.jobTitle?.toLowerCase().includes(s) ||
          j.location?.toLowerCase().includes(s) ||
          j.employmentType?.toLowerCase().includes(s) ||
          j.companyName?.toLowerCase?.().includes(s) ||
          (Array.isArray(j.skills) ? j.skills.join(' ').toLowerCase().includes(s) : (j.skills || '').toLowerCase().includes(s))
      );
    }
    // Location filter
    if (locationFilter !== 'all') {
      const loc = locationFilter.toLowerCase();
      list = list.filter(j => (j.location || '').toLowerCase().includes(loc));
    }
    // Job type filter
    if (jobTypeFilter !== 'all') {
      list = list.filter(j => (j.employmentType || '').toLowerCase() === jobTypeFilter);
    }
    // Experience filter (support both legacy codes and human-readable labels)
    if (experienceFilter !== 'all') {
      const mapLabelToLegacy = {
        'entry level': 'entry',
        'junior': 'junior',
        'mid level': 'mid',
        'senior': 'senior',
        'executive': 'executive'
      };
      const exp = experienceFilter.toLowerCase();
      list = list.filter(j => {
        const val = String(j.experienceLevel || '').trim().toLowerCase();
        // match either label directly or legacy token contained
        return val === exp || val.includes(mapLabelToLegacy[exp] || exp);
      });
    }
    // Salary range filter (best-effort parse of numeric value from string)
    const parseSalary = (val) => {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      const m = String(val).match(/\d[\d,]*/g);
      if (!m) return 0;
      const nums = m.map(x => Number(x.replace(/,/g, '')));
      if (nums.length === 0) return 0;
      // If range present, take average; else single number
      return nums.length >= 2 ? Math.round((nums[0] + nums[1]) / 2) : nums[0];
    };
    if (salaryFilter !== 'all') {
      list = list.filter(j => {
        const s = parseSalary(j.salary);
        switch (salaryFilter) {
          case '0-30000': return s >= 0 && s <= 30000;
          case '30000-50000': return s > 30000 && s <= 50000;
          case '50000-100000': return s > 50000 && s <= 100000;
          case '100000+': return s > 100000;
          default: return true;
        }
      });
    }
    // Applicants filter
    if (applicantsFilter !== 'all') {
      list = list.filter(j => {
        const n = j.applicants?.length || 0;
        switch (applicantsFilter) {
          case '0-10': return n >= 0 && n <= 10;
          case '10-50': return n > 10 && n <= 50;
          case '50+': return n > 50;
          default: return true;
        }
      });
    }
    // Posted date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      list = list.filter(j => {
        const d = new Date(j.postedAt || j.datePosted || j.createdAt || 0);
        if (dateFilter === '24h') {
          const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          return d >= dayAgo;
        }
        if (dateFilter === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return d >= weekAgo;
        }
        if (dateFilter === 'month') {
          const monthAgo = new Date();
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return d >= monthAgo;
        }
        return true;
      });
    }
    // Status filter (treat undefined as active by default only when filtering)
    if (status !== 'all') {
      list = list.filter(j => (j.status || 'active') === status);
    }
    // Sorting
    list.sort((a, b) => {
      if (sort === 'titleAsc' || sort === 'titleDesc') {
        const A = (a.jobTitle || '').toLowerCase();
        const B = (b.jobTitle || '').toLowerCase();
        return sort === 'titleAsc' ? (A > B ? 1 : -1) : A < B ? 1 : -1;
      }
      if (sort === 'salaryHigh' || sort === 'salaryLow') {
        const sa = parseSalary(a.salary);
        const sb = parseSalary(b.salary);
        return sort === 'salaryHigh' ? sb - sa : sa - sb;
      }
      const aDate = new Date(
        a.createdAt || a.datePosted || a.postedAt || 0
      ).getTime();
      const bDate = new Date(
        b.createdAt || b.datePosted || b.postedAt || 0
      ).getTime();
      // 'relevant' -> fallback to newest first
      return sort === 'dateAsc' ? aDate - bDate : bDate - aDate;
    });
    setFilteredJobs(list);
  };

  const filterJobs = type => {
    setSelectedType(type);
    applyFilters(jobs, { category: type });
  };

  useEffect(() => {
    applyFilters(jobs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, statusFilter, sortBy, locationFilter, jobTypeFilter, experienceFilter, salaryFilter, applicantsFilter, dateFilter]);

  const handleDelete = async jobId => {
    if (window.confirm('Are you sure you want to delete this job?')) {
      await deleteJob(jobId);
      const updatedJobs = await getJobs({ email });
      setJobs(updatedJobs);
      setFilteredJobs(
        selectedType === 'All'
          ? updatedJobs
          : updatedJobs.filter(job => job.category === selectedType)
      );
      // Update categories after job deletion
      const uniqueCategories = [
        'All',
        ...new Set(updatedJobs.map(job => job.category).filter(Boolean)),
      ];
      setCategories(uniqueCategories);
      setNotification('Job deleted successfully');
      setTimeout(() => setNotification(''), 3000);
    }
  };

  // Job stats for summary
  const totalJobs = jobs.length;
  const totalApplicants = jobs.reduce(
    (acc, job) => acc + (job.applicants?.length || 0),
    0
  );
  const jobsByCategory = categories.slice(1).map(cat => ({
    name: cat,
    count: jobs.filter(j => j.category === cat).length,
  }));

  const needsVerification = typeof window !== 'undefined' && localStorage.getItem('companyNeedsEmailVerification') === 'true';
  const companyData = typeof window !== 'undefined' ? (()=>{try{return JSON.parse(localStorage.getItem('companyData')||'null');}catch{return null;}})() : null;
  // Prefer persisted limitedAccess flag rather than recomputing purely from status
  const limitedStatus = typeof window !== 'undefined' && localStorage.getItem('companyLimitedAccess') === 'true';
  const statusLabel = companyData?.status;

  return (
    <div
      className={`min-h-screen py-8 px-2 sm:px-6 lg:px-8 flex flex-col items-center ${
        isDarkMode
          ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white"
          : "bg-gradient-to-br from-orange-50 via-white to-orange-100 text-black"
      }`}
    >
      <div
        className={`w-full max-w-6xl mx-auto rounded-3xl shadow-2xl border ${
          isDarkMode
            ? "bg-gray-800 border-gray-700"
            : "bg-white border-orange-200"
        } p-6 sm:p-10`}
      >
        {/* Header with stats and gating banners */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold flex items-center gap-2 tracking-tight bg-gradient-to-r from-[#ff8200] to-[#ffb347] bg-clip-text text-transparent drop-shadow-lg mb-2">
              <FaList className="text-[#ff8200]" /> Posted Jobs
            </h1>
            {(needsVerification || limitedStatus) && (
              <div className="mb-3 p-3 rounded-lg border text-xs sm:text-sm flex flex-wrap items-center gap-2 bg-amber-50 border-amber-200 text-amber-800">
                {needsVerification && <span><strong>Email not verified.</strong> Verify to unlock full posting.</span>}
                {limitedStatus && <span><strong>Account {companyData?.status}.</strong> Posting restricted. See <Link to="/messages" className="underline text-[#ff8200]">Messages</Link>.</span>}
                {needsVerification && <Link to={`/verify-email?email=${encodeURIComponent(companyData?.email||'')}`} className="ml-auto px-3 py-1 rounded-md bg-[#ff8200] text-white text-xs font-semibold hover:bg-[#e57400]">Verify Email</Link>}
              </div>
            )}
            <div className="flex flex-wrap gap-4 mt-2 text-sm">
              <span
                className={`flex items-center gap-1 rounded px-3 py-1 ${
                  isDarkMode ? "bg-gray-700" : "bg-gray-200"
                }`}
              >
                <FaBriefcase className="text-[#ff8200]" /> Total: <b>{totalJobs}</b>
              </span>
              <span
                className={`flex items-center gap-1 rounded px-3 py-1 ${
                  isDarkMode ? "bg-gray-700" : "bg-gray-200"
                }`}
              >
                <FaUsers className="text-[#ff8200]" /> Applicants: <b>{totalApplicants}</b>
              </span>
              {jobsByCategory.map(cat => (
                <button
                  key={cat.name}
                  onClick={() => filterJobs(cat.name)}
                  className={`flex items-center gap-1 rounded px-3 py-1 transition-colors ${
                    selectedType === cat.name
                      ? "bg-[#ff8200] text-white"
                      : isDarkMode
                        ? "bg-blue-900 text-blue-200 hover:bg-blue-800"
                        : "bg-blue-100 text-blue-800 hover:bg-blue-200"
                  }`}
                  title={`Filter by ${cat.name}`}
                >
                  <FaFilter className={selectedType === cat.name ? "text-white" : "text-[#ff8200]"} /> {cat.name}: <b>{cat.count}</b>
                </button>
              ))}
            </div>
          </div>
          <div className="relative group inline-block">
            <button
              onClick={() => { if(needsVerification || limitedStatus) return; navigate('/post-job'); }}
              disabled={needsVerification || limitedStatus}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl shadow-lg font-semibold text-lg transition-colors ${needsVerification || limitedStatus ? (isDarkMode ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-gray-300 text-gray-600 cursor-not-allowed') : 'bg-gradient-to-r from-[#ff8200] to-[#ffb347] text-white hover:from-[#e57400] hover:to-[#ffb347]'}`}
              aria-disabled={needsVerification || limitedStatus}
              aria-label={needsVerification ? 'Verify email to enable posting' : limitedStatus ? 'Account access limited' : 'Post a new job'}
            >
              <FaPlus /> {needsVerification || limitedStatus ? 'Posting Limited' : 'Post New Job'}
            </button>
            {(needsVerification || limitedStatus) && (
              <div className={`opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200 absolute z-40 w-64 -left-16 md:left-1/2 md:-translate-x-1/2 mt-2 p-3 rounded-lg shadow-xl text-xs ${isDarkMode ? 'bg-gray-900 border border-gray-700 text-gray-200' : 'bg-white border border-gray-200 text-gray-800'}`}
                   role="tooltip">
                {needsVerification && (
                  <div className="mb-2">
                    <span className="font-semibold text-[#ff8200]">Email not verified.</span><br />
                    Verify your email to unlock job posting.
                  </div>
                )}
                {limitedStatus && (
                  <div className="space-y-1">
                    <div className="font-semibold text-[#ff8200] flex items-center gap-1">Account {statusLabel || 'limited'}</div>
                    {statusLabel === 'pending' && <p>Your registration is under review. Approval usually takes <strong>24–48h</strong>.</p>}
                    {statusLabel === 'hold' && <p>Your account is on hold. Check <Link to="/messages" className="underline text-[#ff8200] font-medium">Messages</Link> for admin notes.</p>}
                    {!companyData?.profileCompleted && <p className="mt-1">Complete your profile to accelerate approval.</p>}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {needsVerification && <Link to={`/verify-email?email=${encodeURIComponent(companyData?.email||'')}`} className="px-2 py-1 rounded bg-[#ff8200] text-white font-semibold">Verify</Link>}
                      {!companyData?.profileCompleted && <Link to="/Edit-Registration" className="px-2 py-1 rounded bg-[#ff8200] text-white font-semibold">Complete Profile</Link>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {notification && (
          <div className="bg-green-500 text-white p-3 rounded-xl mb-6 shadow flex items-center gap-2 font-medium">
            <FaCheck /> {notification}
          </div>
        )}

        {/* Search and filters */}
        <div className="mb-6 grid md:grid-cols-5 gap-4">
          {/* Search */}
          <div className="relative">
            <label htmlFor="job-search" className="block text-xs mb-1 font-semibold">Search</label>
            <FaSearch className="pointer-events-none absolute left-3 top-2/3 -translate-y-1/2 text-gray-500 dark:text-gray-300" />
            <input
              id="job-search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by title, company, skills"
              className={`pl-9 pr-3 py-2 w-full rounded-xl border font-medium ${
                isDarkMode
                  ? "bg-gray-800 border-gray-700 text-white"
                  : "bg-white border-gray-300 text-gray-900"
              } focus:ring-2 focus:ring-[#ff8200] outline-none transition`}
            />
          </div>
          {/* Location */}
          <div>
            <label className="block text-xs mb-1 font-semibold">Location</label>
            <select
              value={locationFilter}
              onChange={e => setLocationFilter(e.target.value)}
              className={`w-full py-2 px-3 rounded-xl border font-medium ${
                isDarkMode
                  ? "bg-gray-800 border-gray-700 text-white"
                  : "bg-white border-gray-300 text-gray-900"
              } focus:ring-2 focus:ring-[#ff8200] outline-none transition`}
            >
              <option value="all">All</option>
              <option value="pune">Pune</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
          {/* Job Type */}
          <div>
            <label className="block text-xs mb-1 font-semibold">Job Type</label>
            <select
              value={jobTypeFilter}
              onChange={e => setJobTypeFilter(e.target.value)}
              className={`w-full py-2 px-3 rounded-xl border font-medium ${
                isDarkMode
                  ? "bg-gray-800 border-gray-700 text-white"
                  : "bg-white border-gray-300 text-gray-900"
              } focus:ring-2 focus:ring-[#ff8200] outline-none transition`}
            >
              <option value="all">All</option>
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
              <option value="freelance">Freelance</option>
              <option value="internship">Internship</option>
            </select>
          </div>
          {/* Status */}
          <div>
            <label className="block text-xs mb-1 font-semibold">Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className={`w-full py-2 px-3 rounded-xl border font-medium ${
                isDarkMode
                  ? "bg-gray-800 border-gray-700 text-white"
                  : "bg-white border-gray-300 text-gray-900"
              } focus:ring-2 focus:ring-[#ff8200] outline-none transition`}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          {/* Experience */}
          <div>
            <label className="block text-xs mb-1 font-semibold">Experience</label>
            <select
              value={experienceFilter}
              onChange={e => setExperienceFilter(e.target.value)}
              className={`w-full py-2 px-3 rounded-xl border font-medium ${
                isDarkMode
                  ? "bg-gray-800 border-gray-700 text-white"
                  : "bg-white border-gray-300 text-gray-900"
              } focus:ring-2 focus:ring-[#ff8200] outline-none transition`}
            >
              <option value="all">All</option>
              <option value="Entry Level">Entry Level</option>
              <option value="Junior">Junior</option>
              <option value="Mid Level">Mid Level</option>
              <option value="Senior">Senior</option>
              <option value="Executive">Executive</option>
            </select>
          </div>
        </div>

        {/* More filters */}
        <div className="mb-6 grid md:grid-cols-3 gap-4">
          {/* Salary */}
          <div>
            <label className="block text-xs mb-1 font-semibold">Salary Range</label>
            <select
              value={salaryFilter}
              onChange={e => setSalaryFilter(e.target.value)}
              className={`w-full py-2 px-3 rounded-xl border font-medium ${
                isDarkMode
                  ? "bg-gray-800 border-gray-700 text-white"
                  : "bg-white border-gray-300 text-gray-900"
              } focus:ring-2 focus:ring-[#ff8200] outline-none transition`}
            >
              <option value="all">All</option>
              <option value="0-30000">0 - 30,000</option>
              <option value="30000-50000">30,000 - 50,000</option>
              <option value="50000-100000">50,000 - 1,00,000</option>
              <option value="100000+">1,00,000+</option>
            </select>
          </div>
          {/* Applicants */}
          <div>
            <label className="block text-xs mb-1 font-semibold">Applicants</label>
            <select
              value={applicantsFilter}
              onChange={e => setApplicantsFilter(e.target.value)}
              className={`w-full py-2 px-3 rounded-xl border font-medium ${
                isDarkMode
                  ? "bg-gray-800 border-gray-700 text-white"
                  : "bg-white border-gray-300 text-gray-900"
              } focus:ring-2 focus:ring-[#ff8200] outline-none transition`}
            >
              <option value="all">All</option>
              <option value="0-10">0-10</option>
              <option value="10-50">10-50</option>
              <option value="50+">50+</option>
            </select>
          </div>
          {/* Posted date */}
          <div>
            <label className="block text-xs mb-1 font-semibold">Posted Date</label>
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className={`w-full py-2 px-3 rounded-xl border font-medium ${
                isDarkMode
                  ? "bg-gray-800 border-gray-700 text-white"
                  : "bg-white border-gray-300 text-gray-900"
              } focus:ring-2 focus:ring-[#ff8200] outline-none transition`}
            >
              <option value="all">Any time</option>
              <option value="24h">Past 24 hours</option>
              <option value="week">Past week</option>
              <option value="month">Past month</option>
            </select>
          </div>
        </div>

        {/* Sorting */}
        <div className="mb-8">
          <label className="block text-xs mb-1 font-semibold">Sort By</label>
          <div className="flex gap-2 flex-wrap">
            <button
              className={`px-4 py-2 rounded-xl border font-medium ${
                sortBy === 'titleAsc'
                  ? "bg-gradient-to-r from-[#ff8200] to-[#ffb347] text-white border-[#ff8200]"
                  : isDarkMode
                    ? "bg-gray-800 border-gray-700 text-white"
                    : "bg-white border-gray-300 text-gray-900"
              }`}
              onClick={() => setSortBy('titleAsc')}
            >
              <FaSortAlphaDown className="inline mr-1" /> A–Z
            </button>
            <button
              className={`px-4 py-2 rounded-xl border font-medium ${
                sortBy === 'titleDesc'
                  ? "bg-gradient-to-r from-[#ff8200] to-[#ffb347] text-white border-[#ff8200]"
                  : isDarkMode
                    ? "bg-gray-800 border-gray-700 text-white"
                    : "bg-white border-gray-300 text-gray-900"
              }`}
              onClick={() => setSortBy('titleDesc')}
            >
              <FaSortAmountDown className="inline mr-1" /> Z–A
            </button>
            <button
              className={`px-4 py-2 rounded-xl border font-medium ${
                sortBy === 'relevant'
                  ? "bg-gradient-to-r from-[#ff8200] to-[#ffb347] text-white border-[#ff8200]"
                  : isDarkMode
                    ? "bg-gray-800 border-gray-700 text-white"
                    : "bg-white border-gray-300 text-gray-900"
              }`}
              onClick={() => setSortBy('relevant')}
            >
              Most Relevant
            </button>
            <button
              className={`px-4 py-2 rounded-xl border font-medium ${
                sortBy === 'dateDesc'
                  ? "bg-gradient-to-r from-[#ff8200] to-[#ffb347] text-white border-[#ff8200]"
                  : isDarkMode
                    ? "bg-gray-800 border-gray-700 text-white"
                    : "bg-white border-gray-300 text-gray-900"
              }`}
              onClick={() => setSortBy('dateDesc')}
            >
              Newest
            </button>
            <button
              className={`px-4 py-2 rounded-xl border font-medium ${
                sortBy === 'salaryHigh'
                  ? "bg-gradient-to-r from-[#ff8200] to-[#ffb347] text-white border-[#ff8200]"
                  : isDarkMode
                    ? "bg-gray-800 border-gray-700 text-white"
                    : "bg-white border-gray-300 text-gray-900"
              }`}
              onClick={() => setSortBy('salaryHigh')}
            >
              Salary ↑
            </button>
            <button
              className={`px-4 py-2 rounded-xl border font-medium ${
                sortBy === 'salaryLow'
                  ? "bg-gradient-to-r from-[#ff8200] to-[#ffb347] text-white border-[#ff8200]"
                  : isDarkMode
                    ? "bg-gray-800 border-gray-700 text-white"
                    : "bg-white border-gray-300 text-gray-900"
              }`}
              onClick={() => setSortBy('salaryLow')}
            >
              Salary ↓
            </button>
          </div>
        </div>

        {/* Job cards or empty state */}
        {filteredJobs.length === 0 ? (
          <div
            className={`p-10 text-center rounded-2xl flex flex-col items-center justify-center ${
              isDarkMode ? "bg-gray-800" : "bg-white"
            } border ${isDarkMode ? "border-gray-700" : "border-gray-200"} shadow-lg`}
          >
            <FaBriefcase
              className={`text-6xl mb-4 ${isDarkMode ? "text-gray-600" : "text-gray-300"}`}
            />
            <p className="text-xl font-semibold mb-2">
              No jobs found in this category
            </p>
            <p className={`${isDarkMode ? "text-gray-400" : "text-gray-500"} mb-4`}>
              Try posting a new job or changing the filter above.
            </p>
            <button
              onClick={() => navigate('/post-job')}
              className="mt-2 px-6 py-2 bg-gradient-to-r from-[#ff8200] to-[#ffb347] text-white rounded-xl hover:from-[#e57400] hover:to-[#ffb347] font-semibold shadow-lg text-lg"
            >
              <FaPlus className="inline mr-1" /> Post a New Job
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredJobs.map((job, index) => (
              <div
                key={index}
                className={`shadow-xl rounded-2xl p-6 border flex flex-col h-full transition-all group ${
                  isDarkMode
                    ? "bg-gray-900 border-gray-700 text-white"
                    : "bg-white border-orange-200 text-black"
                } hover:shadow-2xl hover:-translate-y-1`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <FaBriefcase className="text-2xl text-[#ff8200]" />
                  <h2
                    className="text-xl font-bold flex-1 truncate"
                    title={job.jobTitle}
                  >
                    {job.jobTitle}
                  </h2>
                </div>
                {job.category && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded mb-2 ${
                      isDarkMode ? "bg-gray-700 text-white" : "bg-orange-50 text-[#ff8200]"
                    }`}
                  >
                    <FaFilter className="text-[#ff8200]" /> {job.category}
                  </span>
                )}
                {(Array.isArray(job.jdFiles) && job.jdFiles.length > 0) || job.jdPdfUrl ? (
                  <a
                    href={(Array.isArray(job.jdFiles) && job.jdFiles[0]) || job.jdPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded mb-2 ml-2 ${
                      isDarkMode ? "bg-blue-900 text-blue-100" : "bg-blue-50 text-blue-700"
                    } hover:underline`}
                    title="View JD attachment"
                  >
                    📎 JD attached
                  </a>
                ) : null}
                <div className="flex flex-wrap gap-2 mb-2 text-sm">
                  <span
                    className={`flex items-center gap-1 rounded px-2 py-0.5 ${
                      isDarkMode ? "bg-gray-700" : "bg-gray-100"
                    }`}
                  >
                    <FaMoneyBill className="text-[#ff8200]" /> {job.salary}
                  </span>
                  <span
                    className={`flex items-center gap-1 rounded px-2 py-0.5 ${
                      isDarkMode ? "bg-gray-700" : "bg-gray-100"
                    }`}
                  >
                    <FaMapMarkerAlt className="text-[#ff8200]" /> {job.location}
                  </span>
                  <span
                    className={`flex items-center gap-1 rounded px-2 py-0.5 ${
                      isDarkMode ? "bg-gray-700" : "bg-gray-100"
                    }`}
                  >
                    <FaUserTie className="text-[#ff8200]" /> {job.experienceLevel}
                  </span>
                  <span
                    className={`flex items-center gap-1 rounded px-2 py-0.5 ${
                      isDarkMode ? "bg-gray-700" : "bg-gray-100"
                    }`}
                  >
                    <FaClock className="text-[#ff8200]" /> {job.employmentType}
                  </span>
                  <span
                    className={`flex items-center gap-1 rounded px-2 py-0.5 ${
                      isDarkMode ? "bg-gray-700" : "bg-gray-100"
                    }`}
                  >
                    <FaLaptopHouse className="text-[#ff8200]" /> {job.remoteOrOnsite}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2 text-sm">
                  <FaUsers className="text-[#ff8200]" /> Applicants: <b>{job.applicants?.length || 0}</b>
                </div>
                <div
                  className={`mb-2 text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
                >
                  {(() => {
                    const d = job.postedAt || job.datePosted || job.createdAt;
                    const txt = d ? formatDateDDMMYYYY(d) : "N/A";
                    return <>Posted at: {txt}</>;
                  })()}
                </div>
                <div className="flex justify-between items-center mt-auto pt-4 gap-2">
                  <Link to={`/job/${job._id}`} title="View Details">
                    <button
                      className="flex items-center gap-1 px-5 py-2 bg-gradient-to-r from-[#ff8200] to-[#ffb347] text-white rounded-lg hover:from-[#e57400] hover:to-[#ffb347] transition-colors font-medium shadow"
                      aria-label="View Details"
                    >
                      <FaEye /> <span className="hidden sm:inline">View</span>
                    </button>
                  </Link>
                  <Link to={`/edit-job/${job._id}`} title="Edit Job">
                    <button
                      className="flex items-center gap-1 px-5 py-2 bg-gradient-to-r from-[#833f91] to-[#b47cc7] text-white rounded-lg hover:from-[#6a3274] hover:to-[#b47cc7] transition-colors font-medium shadow"
                      aria-label="Edit Job"
                    >
                      <FaEdit /> <span className="hidden sm:inline">Edit</span>
                    </button>
                  </Link>
                  <button
                    className="flex items-center gap-1 px-5 py-2 bg-gradient-to-r from-red-600 to-red-400 text-white rounded-lg hover:from-red-700 hover:to-red-500 transition-colors font-medium shadow"
                    onClick={() => handleDelete(job._id)}
                    aria-label="Delete Job"
                    title="Delete Job"
                  >
                    <FaTrashAlt /> <span className="hidden sm:inline">Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobPosted;

JobPosted.propTypes = {
  isDarkMode: PropTypes.bool,
  email: PropTypes.string,
};
