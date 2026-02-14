import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { 
  FaBriefcase, 
  FaUsers, 
  FaCalendarAlt, 
  FaEye,
  FaSearch,
  FaFilter,
  FaPlus,
  FaChevronRight,
  FaArrowUp
} from 'react-icons/fa';
import { useMobile } from '../hooks/useMobile';
import { useAutoSave } from '../hooks/useAutoSave';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { 
  MobileCard, 
  MobileButton, 
  MobileInput, 
  MobileList, 
  MobileBottomSheet 
} from '../components/MobileComponents';
import { formatDateDDMMYYYY } from '../utils/date';
import { MobileNavigation } from '../components/MobileNavigation';
import VirtualScrollList from '../components/VirtualScrollList';
import LoadingSpinner from '../components/LoadingSpinner';
import { getJobs, deleteJob as apiDeleteJob } from '../api';

const MobileDashboard = ({ isDarkMode, email }) => {
  const { isMobile } = useMobile();
  const navigate = useNavigate();
  
  // State management
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalJobs: 0,
    totalApplications: 0,
    recentJobs: 0,
    activeJobs: 0
  });
  
  // Mobile-specific state
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterBy, setFilterBy] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [currentPage, setCurrentPage] = useState(1);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  
  // Auto-save search preferences
  const { updateField: updateSearch } = useAutoSave(
    'dashboard-search', 
    { query: searchQuery, filter: filterBy, sort: sortBy },
    (data) => {
      // Save search preferences
      localStorage.setItem('dashboard-preferences', JSON.stringify(data));
    }
  );

  // Keyboard shortcuts for mobile
  useKeyboardShortcuts({
    'ctrl+k': () => document.getElementById('mobile-search')?.focus(),
    'ctrl+f': () => setShowFilters(true),
  'ctrl+n': () => navigate('/post-job'),
    'escape': () => {
      setShowFilters(false);
      setShowJobDetails(false);
    }
  });

  // Items per page based on device type
  const itemsPerPage = isMobile ? 10 : 20;

  // Load dashboard data
  useEffect(() => {
    loadDashboardData();
    loadUserPreferences();
    // Provide global SPA navigation fallback for keyboard shortcuts helpers
    if (typeof window !== 'undefined') {
      window.__appNavigate = navigate;
    }
    return () => {
      if (typeof window !== 'undefined' && window.__appNavigate === navigate) {
        delete window.__appNavigate;
      }
    };
  }, [navigate, loadDashboardData, loadUserPreferences]);

  // Filter and sort jobs
  useEffect(() => {
    let filtered = [...jobs];
    
    // Search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(job => 
        job.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.location?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Category filter
    if (filterBy !== 'all') {
      filtered = filtered.filter(job => {
        switch (filterBy) {
          case 'active': return job.status === 'active';
          case 'recent': return new Date(job.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          case 'applications': return (job.applicants?.length || 0) > 0;
          default: return true;
        }
      });
    }
    
    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.createdAt || b.datePosted) - new Date(a.createdAt || a.datePosted);
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        case 'applications':
          return (b.applicants?.length || 0) - (a.applicants?.length || 0);
        case 'salary':
          return parseFloat(b.salary?.replace(/[^\d.-]/g, '') || 0) - parseFloat(a.salary?.replace(/[^\d.-]/g, '') || 0);
        default:
          return 0;
      }
    });
    
    setFilteredJobs(filtered);
    setCurrentPage(1);
    
    // Update search preferences
    updateSearch({ query: searchQuery, filter: filterBy, sort: sortBy });
  }, [jobs, searchQuery, filterBy, sortBy, updateSearch]);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch jobs for this company via API client (uses /api/job?email=...)
      const data = await getJobs(email ? { email } : undefined);
      const jobsArray = Array.isArray(data) ? data : (data?.jobs || []);
      setJobs(jobsArray);
      setStats({
        totalJobs: jobsArray.length,
        totalApplications: jobsArray.reduce((sum, j) => sum + (j.applicants?.length || 0), 0),
        recentJobs: jobsArray.filter(j => new Date(j.createdAt || j.datePosted) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length,
        activeJobs: jobsArray.filter(j => j.status === 'active').length
      });
  } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [email]);

  const loadUserPreferences = useCallback(() => {
    try {
      const saved = localStorage.getItem('dashboard-preferences');
      if (saved) {
        const prefs = JSON.parse(saved);
        setSearchQuery(prefs.query || '');
        setFilterBy(prefs.filter || 'all');
        setSortBy(prefs.sort || 'date');
      }
  } catch {
      // ignore
    }
  }, []);

  const handleJobClick = (job) => {
    setSelectedJob(job);
    setShowJobDetails(true);
  };

  const handleDeleteJob = async (jobId) => {
    try {
      await apiDeleteJob(jobId);
      setJobs(prev => prev.filter(job => job._id !== jobId));
      setShowJobDetails(false);
    } catch (error) {
      /* eslint-disable no-console */
      console.error('Failed to delete job:', error);
    }
  };

  // Navigation items for mobile
  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: FaBriefcase },
    { path: '/post-job', label: 'Post Job', icon: FaPlus },
    { path: '/applications', label: 'Applications', icon: FaUsers },
    { path: '/edit-registration', label: 'Profile', icon: FaUsers }
  ];

  // Stats cards data
  const statsCards = [
    {
      title: 'Total Jobs',
      value: stats.totalJobs,
      icon: FaBriefcase,
      color: 'blue',
      trend: '+12%'
    },
    {
      title: 'Applications',
      value: stats.totalApplications,
      icon: FaUsers,
      color: 'green',
      trend: '+8%'
    },
    {
      title: 'Active Jobs',
      value: stats.activeJobs,
      icon: FaCalendarAlt,
      color: 'orange',
      trend: '+5%'
    },
    {
      title: 'Recent Jobs',
      value: stats.recentJobs,
      icon: FaEye,
      color: 'purple',
      trend: '+15%'
    }
  ];

  // Filter options
  const filterOptions = [
    { value: 'all', label: 'All Jobs' },
    { value: 'active', label: 'Active Jobs' },
    { value: 'recent', label: 'Recent Jobs' },
    { value: 'applications', label: 'With Applications' }
  ];

  // Sort options
  const sortOptions = [
    { value: 'date', label: 'Date Posted' },
    { value: 'title', label: 'Job Title' },
    { value: 'applications', label: 'Applications' },
    { value: 'salary', label: 'Salary' }
  ];

  // Render job item for mobile list
  const renderJobItem = (job) => (
    <div 
      className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
      onClick={() => handleJobClick(job)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-black dark:text-white truncate">
            {job.title}
          </h3>
          <span className={`px-2 py-1 text-xs rounded-full ${
            job.status === 'active' 
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
          }`}>
            {job.status || 'Active'}
          </span>
        </div>
        
        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center">
            <FaBriefcase className="h-3 w-3 mr-2 text-gray-600 dark:text-gray-400" />
            <span className="truncate text-gray-600 dark:text-gray-300">{job.employmentType || 'Full-time'}</span>
          </div>
          
          <div className="flex items-center">
            <FaUsers className="h-3 w-3 mr-2 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-600 dark:text-gray-300">{job.applicants?.length || 0} applications</span>
          </div>
          
          <div className="flex items-center">
            <FaCalendarAlt className="h-3 w-3 mr-2 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-600 dark:text-gray-300">{formatDateDDMMYYYY(job.createdAt || job.datePosted)}</span>
          </div>
        </div>
      </div>
      
      <FaChevronRight className="h-4 w-4 text-gray-400 ml-4" />
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isMobile ? 'pb-20 pt-16' : ''} ${isDarkMode ? 'dark' : ''}`}>
      {/* Mobile Navigation */}
      {isMobile && (
        <MobileNavigation
          items={navItems}
          currentPath="/dashboard"
          onNavigate={(path) => navigate(path)}
          brandName="kGamify"
          showSearchProp={false}
        />
      )}

      <div className="mobile-spacing">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-mobile-2xl font-bold text-gray-900 dark:text-white mb-2">
            Dashboard
          </h1>
          <p className="text-mobile-sm text-gray-600 dark:text-gray-400">
            Welcome back! Here&apos;s what&apos;s happening with your jobs.
          </p>
        </div>

        {/* Stats Cards */}
        <div className={`grid ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-4 gap-6'} mb-6`}>
          {statsCards.map((stat, index) => (
            <MobileCard 
              key={index}
              className={`p-4 ${isMobile ? 'min-h-[100px]' : ''}`}
              touchFeedback={false}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-mobile-xs text-gray-600 dark:text-gray-400 mb-1">
                    {stat.title}
                  </p>
                  <p className="text-mobile-lg font-bold text-gray-900 dark:text-white">
                    {stat.value}
                  </p>
                  {!isMobile && (
                    <div className="flex items-center mt-2">
                      <span className="text-green-500 text-xs flex items-center">
                        <FaArrowUp className="h-3 w-3 mr-1" />
                        {stat.trend}
                      </span>
                    </div>
                  )}
                </div>
                <div className={`p-3 rounded-full bg-${stat.color}-100 dark:bg-${stat.color}-900/20`}>
                  <stat.icon className={`h-5 w-5 text-${stat.color}-500`} />
                </div>
              </div>
            </MobileCard>
          ))}
        </div>

        {/* Search and Filters */}
        <MobileCard className="p-4 mb-6">
          <div className="space-y-3">
            {/* Search */}
            <MobileInput
              id="mobile-search"
              type="search"
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<FaSearch className="h-4 w-4 text-gray-400" />}
            />
            
            {/* Filter Controls */}
            <div className="flex gap-2">
              <MobileButton
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(true)}
                className="flex-1"
              >
                <FaFilter className="h-4 w-4 mr-2" />
                Filters
              </MobileButton>
              
              <MobileButton
                variant="outline"
                size="sm"
                onClick={() => navigate('/post-job')}
                className="flex-1"
              >
                <FaPlus className="h-4 w-4 mr-2" />
                New Job
              </MobileButton>
            </div>
          </div>
        </MobileCard>

        {/* Jobs List */}
        <MobileCard className="overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-mobile-lg font-semibold text-black dark:text-white">
                Recent Jobs ({filteredJobs.length})
              </h2>
              {!isMobile && (
                <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                  <span>Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800"
                  >
                    {sortOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {filteredJobs.length === 0 ? (
            <div className="p-8 text-center">
              <FaBriefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-mobile-lg font-medium text-black dark:text-white mb-2">
                No jobs found
              </h3>
              <p className="text-mobile-sm text-black dark:text-white mb-4">
                {searchQuery || filterBy !== 'all' 
                  ? 'Try adjusting your search or filters'
                  : 'Start by posting your first job'
                }
              </p>
              <MobileButton
                variant="primary"
                onClick={() => navigate('/post-job')}
              >
                Post Your First Job
              </MobileButton>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {isMobile ? (
                <MobileList
                  items={filteredJobs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)}
                  renderItem={renderJobItem}
                  onSwipeLeft={(job) => handleJobClick(job)}
                  onSwipeRight={(job) => handleDeleteJob(job._id)}
                />
              ) : (
                <VirtualScrollList
                  items={filteredJobs}
                  renderItem={renderJobItem}
                  itemHeight={120}
                  containerHeight={600}
                />
              )}
            </div>
          )}
        </MobileCard>

        {/* Pagination for mobile */}
        {isMobile && filteredJobs.length > itemsPerPage && (
          <div className="flex justify-center mt-6 space-x-2">
            <MobileButton
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            >
              Previous
            </MobileButton>
            <span className="flex items-center px-4 text-sm text-gray-600 dark:text-gray-400">
              {currentPage} of {Math.ceil(filteredJobs.length / itemsPerPage)}
            </span>
            <MobileButton
              variant="outline"
              size="sm"
              disabled={currentPage >= Math.ceil(filteredJobs.length / itemsPerPage)}
              onClick={() => setCurrentPage(prev => prev + 1)}
            >
              Next
            </MobileButton>
          </div>
        )}
      </div>

      {/* Filters Bottom Sheet */}
      <MobileBottomSheet
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        height="auto"
      >
        <div className="space-y-4">
          <h3 className="text-mobile-lg font-semibold">Filters & Sort</h3>
          
          {/* Filter Options */}
          <div>
            <label className="block text-mobile-sm font-medium mb-2">Filter by:</label>
            <div className="space-y-2">
              {filterOptions.map(option => (
                <label key={option.value} className="flex items-center">
                  <input
                    type="radio"
                    name="filter"
                    value={option.value}
                    checked={filterBy === option.value}
                    onChange={(e) => setFilterBy(e.target.value)}
                    className="mr-3"
                  />
                  <span className="text-mobile-sm">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
          
          {/* Sort Options */}
          <div>
            <label className="block text-mobile-sm font-medium mb-2">Sort by:</label>
            <div className="space-y-2">
              {sortOptions.map(option => (
                <label key={option.value} className="flex items-center">
                  <input
                    type="radio"
                    name="sort"
                    value={option.value}
                    checked={sortBy === option.value}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="mr-3"
                  />
                  <span className="text-mobile-sm">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
          
          <div className="flex space-x-3">
            <MobileButton
              variant="outline"
              onClick={() => setShowFilters(false)}
              className="flex-1"
            >
              Cancel
            </MobileButton>
            <MobileButton
              variant="primary"
              onClick={() => setShowFilters(false)}
              className="flex-1"
            >
              Apply
            </MobileButton>
          </div>
        </div>
      </MobileBottomSheet>

      {/* Job Details Bottom Sheet */}
      <MobileBottomSheet
        isOpen={showJobDetails}
        onClose={() => setShowJobDetails(false)}
        height="80vh"
      >
        {selectedJob && (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-mobile-lg font-semibold mb-2">{selectedJob.title}</h3>
                <p className="text-mobile-sm text-gray-600 dark:text-gray-400">
                  {selectedJob.company} • {selectedJob.location}
                </p>
              </div>
              <span className={`px-3 py-1 text-xs rounded-full ${
                selectedJob.status === 'active' 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {selectedJob.status || 'Active'}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 py-4 border-y border-gray-200 dark:border-gray-700">
              <div className="text-center">
                <p className="text-mobile-lg font-semibold text-kgamify-500">
                  {selectedJob.applicants?.length || 0}
                </p>
                <p className="text-mobile-xs text-gray-600 dark:text-gray-400">Applications</p>
              </div>
              <div className="text-center">
                <p className="text-mobile-lg font-semibold text-kgamify-500">
                  {selectedJob.salary || 'Not specified'}
                </p>
                <p className="text-mobile-xs text-gray-600 dark:text-gray-400">Salary</p>
              </div>
            </div>
            
            <div>
              <h4 className="text-mobile-base font-medium mb-2">Description</h4>
              <div 
                className="text-mobile-sm text-gray-700 dark:text-gray-300 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: selectedJob.description || 'No description available.' }}
              />
            </div>
            
            <div className="flex space-x-3 pt-4">
              <MobileButton
                variant="outline"
                onClick={() => navigate(`/edit-job/${selectedJob._id}`)}
                className="flex-1"
              >
                Edit Job
              </MobileButton>
              <MobileButton
                variant="primary"
                onClick={() => navigate(`/applications?job=${selectedJob._id}`)}
                className="flex-1"
              >
                View Applications
              </MobileButton>
            </div>
          </div>
        )}
      </MobileBottomSheet>
    </div>
  );
};

MobileDashboard.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  email: PropTypes.string
};

export default MobileDashboard;
