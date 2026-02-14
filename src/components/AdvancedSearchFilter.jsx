import { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { 
  FaSearch, 
  FaMapMarkerAlt, 
  FaDollarSign, 
  FaBriefcase,
  FaBuilding,
  FaGraduationCap,
  FaFilter,
  FaTimes,
  FaBookmark,
  FaHistory,
  FaSave,
  FaTrash,
  FaChevronDown,
  FaChevronUp
} from 'react-icons/fa';
import { useAutoSave } from '../hooks/useAutoSave';
import { MobileButton, MobileInput, MobileBottomSheet } from './MobileComponents';
import { formatDateDDMMYYYY } from '../utils/date';

/**
 * Advanced Search and Filter Component
 * Features: Location search, salary filters, experience levels, remote work, company size, industry filters, saved searches
 */
const AdvancedSearchFilter = ({ 
  onSearchChange, 
  onFiltersChange, 
  initialFilters = {},
  showSavedSearches = true,
  className = '' 
}) => {
  
  // Search state
  const [searchQuery, setSearchQuery] = useState(initialFilters.query || '');
  const [locationQuery, setLocationQuery] = useState(initialFilters.location || '');
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    salaryMin: initialFilters.salaryMin || '',
    salaryMax: initialFilters.salaryMax || '',
    experienceLevel: initialFilters.experienceLevel || '',
    employmentType: initialFilters.employmentType || '',
    companySize: initialFilters.companySize || '',
    industry: initialFilters.industry || '',
    remote: initialFilters.remote || false,
    benefits: initialFilters.benefits || [],
    skills: initialFilters.skills || [],
    postedWithin: initialFilters.postedWithin || '',
    ...initialFilters
  });

  // Advanced states
  const [savedSearches, setSavedSearches] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [showSavedSearchModal, setShowSavedSearchModal] = useState(false);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [newSearchName, setNewSearchName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [sortBy, setSortBy] = useState(initialFilters.sortBy || 'relevance');
  const [sortOrder, setSortOrder] = useState(initialFilters.sortOrder || 'desc');

  // Location suggestions
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [skillSuggestions, setSkillSuggestions] = useState([]);
  const [showSkillSuggestions, setShowSkillSuggestions] = useState(false);

  // Refs
  const searchRef = useRef(null);
  const locationRef = useRef(null);
  const skillsRef = useRef(null);

  // Auto-save search preferences
  const { updateField } = useAutoSave(
    'search-preferences',
    { query: searchQuery, location: locationQuery, filters, sortBy, sortOrder },
    (data) => {
      localStorage.setItem('job-search-preferences', JSON.stringify(data));
    }
  );

  // Load saved data on mount
  useEffect(() => {
    loadSavedSearches();
    loadSearchHistory();
    loadSearchPreferences();
  }, []);

  // Update search when filters change
  useEffect(() => {
    const searchData = {
      query: searchQuery,
      location: locationQuery,
      filters,
      sortBy,
      sortOrder
    };
    
    onSearchChange?.(searchData);
    onFiltersChange?.(searchData);
    updateField(searchData);
  }, [searchQuery, locationQuery, filters, sortBy, sortOrder, onSearchChange, onFiltersChange, updateField]);

  // Add to search history
  const addToSearchHistory = useCallback((query) => {
    setSearchHistory(prev => {
      const newHistory = [query, ...prev.filter(h => h !== query)].slice(0, 10);
      localStorage.setItem('job-search-history', JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);

  // Debounced search
  const debouncedSearch = useCallback(
    (query) => {
      const timeoutId = setTimeout(() => {
        if (query.trim()) {
          addToSearchHistory(query);
        }
      }, 500);
      return () => clearTimeout(timeoutId);
    },
    [addToSearchHistory]
  );

  // Load saved searches
  const loadSavedSearches = () => {
    try {
      const saved = localStorage.getItem('saved-job-searches');
      if (saved) {
        setSavedSearches(JSON.parse(saved));
      }
    } catch {
      // Handle error silently
    }
  };

  // Load search history
  const loadSearchHistory = () => {
    try {
      const history = localStorage.getItem('job-search-history');
      if (history) {
        setSearchHistory(JSON.parse(history));
      }
    } catch {
      // Handle error silently
    }
  };

  // Load search preferences
  const loadSearchPreferences = () => {
    try {
      const prefs = localStorage.getItem('job-search-preferences');
      if (prefs) {
        const data = JSON.parse(prefs);
        setSearchQuery(data.query || '');
        setLocationQuery(data.location || '');
        setFilters(prev => ({ ...prev, ...data.filters }));
        setSortBy(data.sortBy || 'relevance');
        setSortOrder(data.sortOrder || 'desc');
      }
    } catch {
      // Handle error silently
    }
  };

  // Save current search
  const saveCurrentSearch = () => {
    if (!newSearchName.trim()) return;

    const searchToSave = {
      id: Date.now(),
      name: newSearchName,
      query: searchQuery,
      location: locationQuery,
      filters,
      sortBy,
      sortOrder,
      createdAt: new Date().toISOString()
    };

    const updatedSaved = [searchToSave, ...savedSearches].slice(0, 20);
    setSavedSearches(updatedSaved);
    localStorage.setItem('saved-job-searches', JSON.stringify(updatedSaved));
    
    setNewSearchName('');
    setShowSaveDialog(false);
  };

  // Load saved search
  const loadSavedSearch = (search) => {
    setSearchQuery(search.query || '');
    setLocationQuery(search.location || '');
    setFilters(search.filters || {});
    setSortBy(search.sortBy || 'relevance');
    setSortOrder(search.sortOrder || 'desc');
    setShowSavedSearchModal(false);
  };

  // Delete saved search
  const deleteSavedSearch = (searchId) => {
    const updated = savedSearches.filter(s => s.id !== searchId);
    setSavedSearches(updated);
    localStorage.setItem('saved-job-searches', JSON.stringify(updated));
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSearchQuery('');
    setLocationQuery('');
    setFilters({
      salaryMin: '',
      salaryMax: '',
      experienceLevel: '',
      employmentType: '',
      companySize: '',
      industry: '',
      remote: false,
      benefits: [],
      skills: [],
      postedWithin: ''
    });
    setSortBy('relevance');
    setSortOrder('desc');
  };

  // Get location suggestions
  const getLocationSuggestions = async (query) => {
    if (query.length < 2) {
      setLocationSuggestions([]);
      return;
    }

    try {
      // Mock location suggestions - replace with actual API
      const mockSuggestions = [
        'New York, NY',
        'San Francisco, CA',
        'Seattle, WA',
        'Austin, TX',
        'Boston, MA',
        'Los Angeles, CA',
        'Chicago, IL',
        'Denver, CO',
        'Remote',
        'Hybrid'
      ].filter(loc => loc.toLowerCase().includes(query.toLowerCase()));

      setLocationSuggestions(mockSuggestions);
    } catch {
      // Handle error silently
    }
  };

  // Get skill suggestions
  const getSkillSuggestions = async (query) => {
    if (query.length < 2) {
      setSkillSuggestions([]);
      return;
    }

    try {
      // Mock skill suggestions - replace with actual API
      const mockSkills = [
        'JavaScript', 'React', 'Node.js', 'Python', 'Java', 'C++', 'SQL',
        'AWS', 'Docker', 'Kubernetes', 'Machine Learning', 'Data Science',
        'UI/UX Design', 'Project Management', 'Agile', 'Scrum'
      ].filter(skill => skill.toLowerCase().includes(query.toLowerCase()));

      setSkillSuggestions(mockSkills);
    } catch {
      // Handle error silently
    }
  };

  // Handle skill addition
  const addSkill = (skill) => {
    if (!filters.skills.includes(skill)) {
      setFilters(prev => ({
        ...prev,
        skills: [...prev.skills, skill]
      }));
    }
    setShowSkillSuggestions(false);
  };

  // Remove skill
  const removeSkill = (skillToRemove) => {
    setFilters(prev => ({
      ...prev,
      skills: prev.skills.filter(skill => skill !== skillToRemove)
    }));
  };

  // Filter options
  const experienceLevels = [
    { value: '', label: 'Any Experience' },
    { value: 'entry', label: 'Entry Level (0-2 years)' },
    { value: 'mid', label: 'Mid Level (2-5 years)' },
    { value: 'senior', label: 'Senior Level (5-10 years)' },
    { value: 'executive', label: 'Executive (10+ years)' }
  ];

  const employmentTypes = [
    { value: '', label: 'Any Type' },
    { value: 'full-time', label: 'Full-time' },
    { value: 'part-time', label: 'Part-time' },
    { value: 'contract', label: 'Contract' },
    { value: 'freelance', label: 'Freelance' },
    { value: 'internship', label: 'Internship' }
  ];

  const companySizes = [
    { value: '', label: 'Any Size' },
    { value: 'startup', label: 'Startup (1-10)' },
    { value: 'small', label: 'Small (11-50)' },
    { value: 'medium', label: 'Medium (51-200)' },
    { value: 'large', label: 'Large (201-1000)' },
    { value: 'enterprise', label: 'Enterprise (1000+)' }
  ];

  const industries = [
    { value: '', label: 'Any Industry' },
    { value: 'technology', label: 'Technology' },
    { value: 'finance', label: 'Finance' },
    { value: 'healthcare', label: 'Healthcare' },
    { value: 'education', label: 'Education' },
    { value: 'retail', label: 'Retail' },
    { value: 'manufacturing', label: 'Manufacturing' },
    { value: 'consulting', label: 'Consulting' },
    { value: 'media', label: 'Media & Entertainment' }
  ];

  const postedWithinOptions = [
    { value: '', label: 'Any Time' },
    { value: '1', label: 'Past 24 hours' },
    { value: '3', label: 'Past 3 days' },
    { value: '7', label: 'Past week' },
    { value: '14', label: 'Past 2 weeks' },
    { value: '30', label: 'Past month' }
  ];

  const sortOptions = [
    { value: 'relevance', label: 'Most Relevant' },
    { value: 'date', label: 'Most Recent' },
    { value: 'salary', label: 'Highest Salary' },
    { value: 'company', label: 'Company Name' },
    { value: 'title', label: 'Job Title' }
  ];

  // Count active filters
  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.salaryMin || filters.salaryMax) count++;
    if (filters.experienceLevel) count++;
    if (filters.employmentType) count++;
    if (filters.companySize) count++;
    if (filters.industry) count++;
    if (filters.remote) count++;
    if (filters.skills.length > 0) count++;
    if (filters.postedWithin) count++;
    return count;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Search Bar */}
      <div className="card-kgamify p-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Job Search */}
          <div className="md:col-span-5 relative">
            <MobileInput
              ref={searchRef}
              type="search"
              placeholder="Search jobs, companies, keywords..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                debouncedSearch(e.target.value);
              }}
              onFocus={() => setShowSearchHistory(true)}
              icon={<FaSearch className="h-4 w-4 text-gray-400" />}
            />

            {/* Search History Dropdown */}
            {showSearchHistory && searchHistory.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-20 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 mt-1 max-h-64 overflow-y-auto">
                <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Recent Searches</span>
                    <button
                      onClick={() => setShowSearchHistory(false)}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <FaTimes className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                {searchHistory.map((query, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setSearchQuery(query);
                      setShowSearchHistory(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                  >
                    <FaHistory className="h-3 w-3 mr-2 text-gray-400" />
                    {query}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Location Search */}
          <div className="md:col-span-4 relative">
            <MobileInput
              ref={locationRef}
              type="search"
              placeholder="Location or 'Remote'"
              value={locationQuery}
              onChange={(e) => {
                setLocationQuery(e.target.value);
                getLocationSuggestions(e.target.value);
                setShowLocationSuggestions(true);
              }}
              onFocus={() => {
                if (locationSuggestions.length > 0) {
                  setShowLocationSuggestions(true);
                }
              }}
              icon={<FaMapMarkerAlt className="h-4 w-4 text-gray-400" />}
            />

            {/* Location Suggestions */}
            {showLocationSuggestions && locationSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-20 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 mt-1 max-h-64 overflow-y-auto">
                {locationSuggestions.map((location, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setLocationQuery(location);
                      setShowLocationSuggestions(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                  >
                    <FaMapMarkerAlt className="h-3 w-3 mr-2 text-gray-400" />
                    {location}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="md:col-span-3 flex gap-2">
            {/* Filter Button */}
            <MobileButton
              variant="outline"
              onClick={() => setShowFilters(true)}
              className="flex-1 relative"
            >
              <FaFilter className="h-4 w-4 mr-2" />
              Filters
              {getActiveFilterCount() > 0 && (
                <span className="absolute -top-2 -right-2 bg-kgamify-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {getActiveFilterCount()}
                </span>
              )}
            </MobileButton>

            {/* Saved Searches */}
            {showSavedSearches && (
              <MobileButton
                variant="outline"
                onClick={() => setShowSavedSearchModal(true)}
                className="flex-shrink-0"
              >
                <FaBookmark className="h-4 w-4" />
              </MobileButton>
            )}
          </div>
        </div>

        {/* Quick Filters */}
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            onClick={() => setFilters(prev => ({ ...prev, remote: !prev.remote }))}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              filters.remote
                ? 'bg-kgamify-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Remote
          </button>
          
          <button
            onClick={() => setFilters(prev => ({ 
              ...prev, 
              employmentType: prev.employmentType === 'full-time' ? '' : 'full-time' 
            }))}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              filters.employmentType === 'full-time'
                ? 'bg-kgamify-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Full-time
          </button>

          <button
            onClick={() => setFilters(prev => ({ 
              ...prev, 
              postedWithin: prev.postedWithin === '7' ? '' : '7' 
            }))}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              filters.postedWithin === '7'
                ? 'bg-kgamify-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Past Week
          </button>

          {getActiveFilterCount() > 0 && (
            <button
              onClick={clearAllFilters}
              className="px-3 py-1 rounded-full text-sm bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Sort Options */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3 text-sm">
            <span className="text-gray-600 dark:text-gray-400">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800"
            >
              {sortOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
            >
              {sortOrder === 'asc' ? (
                <FaChevronUp className="h-3 w-3" />
              ) : (
                <FaChevronDown className="h-3 w-3" />
              )}
            </button>
          </div>

          {/* Save Search */}
          <MobileButton
            variant="ghost"
            size="sm"
            onClick={() => setShowSaveDialog(true)}
            className="text-sm"
          >
            <FaSave className="h-3 w-3 mr-1" />
            Save Search
          </MobileButton>
        </div>
      </div>

      {/* Advanced Filters Bottom Sheet */}
      <MobileBottomSheet
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        height="90vh"
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Advanced Filters</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {getActiveFilterCount()} active
              </span>
              <button
                onClick={clearAllFilters}
                className="text-sm text-red-600 dark:text-red-400 hover:underline"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Salary Range */}
          <div>
            <label className="block text-sm font-medium mb-2">
              <FaDollarSign className="inline h-4 w-4 mr-1" />
              Salary Range
            </label>
            <div className="grid grid-cols-2 gap-3">
              <MobileInput
                type="number"
                placeholder="Min salary"
                value={filters.salaryMin}
                onChange={(e) => setFilters(prev => ({ ...prev, salaryMin: e.target.value }))}
              />
              <MobileInput
                type="number"
                placeholder="Max salary"
                value={filters.salaryMax}
                onChange={(e) => setFilters(prev => ({ ...prev, salaryMax: e.target.value }))}
              />
            </div>
          </div>

          {/* Experience Level */}
          <div>
            <label className="block text-sm font-medium mb-2">
              <FaGraduationCap className="inline h-4 w-4 mr-1" />
              Experience Level
            </label>
            <select
              value={filters.experienceLevel}
              onChange={(e) => setFilters(prev => ({ ...prev, experienceLevel: e.target.value }))}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
            >
              {experienceLevels.map(level => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>

          {/* Employment Type */}
          <div>
            <label className="block text-sm font-medium mb-2">
              <FaBriefcase className="inline h-4 w-4 mr-1" />
              Employment Type
            </label>
            <select
              value={filters.employmentType}
              onChange={(e) => setFilters(prev => ({ ...prev, employmentType: e.target.value }))}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
            >
              {employmentTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Company Size */}
          <div>
            <label className="block text-sm font-medium mb-2">
              <FaBuilding className="inline h-4 w-4 mr-1" />
              Company Size
            </label>
            <select
              value={filters.companySize}
              onChange={(e) => setFilters(prev => ({ ...prev, companySize: e.target.value }))}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
            >
              {companySizes.map(size => (
                <option key={size.value} value={size.value}>
                  {size.label}
                </option>
              ))}
            </select>
          </div>

          {/* Industry */}
          <div>
            <label className="block text-sm font-medium mb-2">Industry</label>
            <select
              value={filters.industry}
              onChange={(e) => setFilters(prev => ({ ...prev, industry: e.target.value }))}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
            >
              {industries.map(industry => (
                <option key={industry.value} value={industry.value}>
                  {industry.label}
                </option>
              ))}
            </select>
          </div>

          {/* Posted Within */}
          <div>
            <label className="block text-sm font-medium mb-2">Posted Within</label>
            <select
              value={filters.postedWithin}
              onChange={(e) => setFilters(prev => ({ ...prev, postedWithin: e.target.value }))}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
            >
              {postedWithinOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Skills */}
          <div>
            <label className="block text-sm font-medium mb-2">Required Skills</label>
            <div className="relative">
              <MobileInput
                ref={skillsRef}
                type="text"
                placeholder="Add skills..."
                onFocus={() => setShowSkillSuggestions(true)}
                onChange={(e) => getSkillSuggestions(e.target.value)}
              />
              
              {/* Skill Suggestions */}
              {showSkillSuggestions && skillSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 mt-1 max-h-48 overflow-y-auto">
                  {skillSuggestions.map((skill, index) => (
                    <button
                      key={index}
                      onClick={() => addSkill(skill)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Skills */}
            {filters.skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {filters.skills.map((skill, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 bg-kgamify-100 dark:bg-kgamify-900/20 text-kgamify-700 dark:text-kgamify-300 text-sm rounded-md"
                  >
                    {skill}
                    <button
                      onClick={() => removeSkill(skill)}
                      className="ml-1 hover:text-kgamify-900 dark:hover:text-kgamify-100"
                    >
                      <FaTimes className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Remote Work */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.remote}
                onChange={(e) => setFilters(prev => ({ ...prev, remote: e.target.checked }))}
                className="mr-2 rounded"
              />
              <span className="text-sm font-medium">Remote work options</span>
            </label>
          </div>

          {/* Apply Filters Button */}
          <div className="flex space-x-3 pt-4">
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
              Apply Filters ({getActiveFilterCount()})
            </MobileButton>
          </div>
        </div>
      </MobileBottomSheet>

      {/* Saved Searches Bottom Sheet */}
      <MobileBottomSheet
        isOpen={showSavedSearchModal}
        onClose={() => setShowSavedSearchModal(false)}
        height="70vh"
      >
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Saved Searches</h3>
          
          {savedSearches.length === 0 ? (
            <div className="text-center py-8">
              <FaBookmark className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No saved searches yet</p>
              <p className="text-sm text-gray-500 dark:text-gray-500">Save your favorite search criteria for quick access</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedSearches.map((search) => (
                <div
                  key={search.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => loadSavedSearch(search)}
                      className="text-left w-full"
                    >
                      <h4 className="font-medium text-sm truncate">{search.name}</h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {search.query && `"${search.query}"`}
                        {search.location && ` in ${search.location}`}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {formatDateDDMMYYYY(search.createdAt)}
                      </p>
                    </button>
                  </div>
                  <button
                    onClick={() => deleteSavedSearch(search.id)}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                  >
                    <FaTrash className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </MobileBottomSheet>

      {/* Save Search Dialog */}
      <MobileBottomSheet
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        height="auto"
      >
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Save Current Search</h3>
          
          <MobileInput
            type="text"
            placeholder="Enter search name..."
            value={newSearchName}
            onChange={(e) => setNewSearchName(e.target.value)}
            autoFocus
          />

          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p>Current search criteria:</p>
            <ul className="mt-1 space-y-1">
              {searchQuery && <li>• Query: &quot;{searchQuery}&quot;</li>}
              {locationQuery && <li>• Location: {locationQuery}</li>}
              {getActiveFilterCount() > 0 && <li>• {getActiveFilterCount()} active filters</li>}
            </ul>
          </div>

          <div className="flex space-x-3">
            <MobileButton
              variant="outline"
              onClick={() => setShowSaveDialog(false)}
              className="flex-1"
            >
              Cancel
            </MobileButton>
            <MobileButton
              variant="primary"
              onClick={saveCurrentSearch}
              disabled={!newSearchName.trim()}
              className="flex-1"
            >
              Save Search
            </MobileButton>
          </div>
        </div>
      </MobileBottomSheet>
    </div>
  );
};

// PropTypes
AdvancedSearchFilter.propTypes = {
  onSearchChange: PropTypes.func,
  onFiltersChange: PropTypes.func,
  initialFilters: PropTypes.object,
  showSavedSearches: PropTypes.bool,
  className: PropTypes.string
};

export default AdvancedSearchFilter;
