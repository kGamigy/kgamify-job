import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PropTypes from 'prop-types';
import { 
  FaSun, 
  FaMoon, 
  FaEdit, 
  FaSignOutAlt, 
  FaBars, 
  FaSearch,
  FaBell,
  FaUser,
  FaChevronDown,
  FaCheck,
  FaInbox,
  FaCreditCard
} from "react-icons/fa";
import { fetchNotifications, markNotificationsRead, markAllNotificationsRead } from '../api';
import usePlanMeta from '../hooks/usePlanMeta';
import Klogo from '../assets/KLOGO.png';
import { formatDateDDMMYYYY } from '../utils/date';
import { colors } from '../config/designSystem';

  function Navbar({ onSidebarToggle, onThemeToggle, isDarkMode, $isDarkMode, userCompany = null, email = '' }) {
    const dark = $isDarkMode ?? isDarkMode;
  const location = useLocation();
  const navigate = useNavigate();
  const isForgetPasswordPage = location.pathname === "/forgot-password";
  
  // State management
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  // messages are now on a dedicated page
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [logoUrl, setLogoUrl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState(null);

  // Relative time formatter (simple – avoids extra deps)
  const formatAgo = useCallback((dateStr) => {
    try {
      const d = new Date(dateStr);
      const diff = Date.now() - d.getTime();
      if (isNaN(diff)) return '';
      const sec = Math.floor(diff / 1000);
      if (sec < 60) return `${sec}s ago`;
      const min = Math.floor(sec / 60);
      if (min < 60) return `${min}m ago`;
      const hr = Math.floor(min / 60);
      if (hr < 24) return `${hr}h ago`;
      const day = Math.floor(hr / 24);
      if (day < 7) return `${day}d ago`;
      return formatDateDDMMYYYY(d);
    } catch { return ''; }
  }, []);

  const hydrateNotifications = useCallback(async (opts = {}) => {
    if (!email) return;
    setLoadingNotifs(true);
    const data = await fetchNotifications(email, opts);
    setNotifications(data);
    setLastFetchedAt(Date.now());
    setLoadingNotifs(false);
  }, [email]);

  // Initial fetch (lazy: only when dropdown first opened)
  useEffect(() => {
    if (showNotifications && notifications.length === 0 && !loadingNotifs) {
      hydrateNotifications();
    }
  }, [showNotifications, notifications.length, loadingNotifs, hydrateNotifications]);

  // Polling every 90s while dropdown closed to keep badge fresh (lightweight)
  useEffect(() => {
    if (!email) return;
    const interval = setInterval(() => {
      if (!showNotifications) hydrateNotifications({ after: lastFetchedAt });
    }, 90000);
    return () => clearInterval(interval);
  }, [email, showNotifications, hydrateNotifications, lastFetchedAt]);

  const handleMarkAll = async () => {
    if (!notifications.some(n => !n.read)) return;
    setMarkingAll(true);
    await markAllNotificationsRead(email);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setMarkingAll(false);
  };

  const handleItemVisible = async (id) => {
    const target = notifications.find(n => n.id === id);
    if (!target || target.read) return;
    await markNotificationsRead(email, [id]);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  // Refs for click outside detection
  const userDropdownRef = useRef(null);
  const notificationDropdownRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setShowUserDropdown(false);
      }
      if (notificationDropdownRef.current && !notificationDropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Set logo URL from userCompany
  useEffect(() => {
    if (userCompany && userCompany.logo) {
      setLogoUrl(userCompany.logo);
    } else {
      setLogoUrl(null);
    }
  }, [userCompany]);

  if (isForgetPasswordPage) {
    return null;
  }

  // Get page title
  const getPageTitle = () => {
    switch (location.pathname) {
      case "/dashboard": return "Dashboard";
      case "/post-job": return "Post Job";
      case "/job-posted": return "Job Posted"; 
      case "/applications": return "Job Applications";
      case "/Edit-Registration": return "Edit Registration";
      case "/edit-registration": return "Edit Registration";
  // Settings route removed
      case "/admin": return "Admin Portal";
  default: return "kGamify Job Portal";
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    navigate("/");
    setShowUserDropdown(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Implement search functionality
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const unreadNotifications = notifications.filter(n => !n.read).length;
  const hasAdminMessages = Array.isArray(userCompany?.adminMessages) && userCompany.adminMessages.length > 0;

  const { planMeta } = usePlanMeta(email || null);

  return (
    <div className="relative">
    <nav className={`sticky top-0 z-30 w-full border-b backdrop-blur-sm transition-colors ${
      dark 
        ? "bg-gray-900/95 border-gray-700" 
        : "bg-white/95 border-gray-200"
    }`}>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left Section */}
          <div className="flex items-center space-x-4">
            {/* Mobile Menu Button */}
            <button
              onClick={onSidebarToggle}
              className="lg:hidden p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle sidebar"
            >
              <FaBars className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </button>

            {/* Logo and Title */}
            <div className="flex items-center space-x-3">
              <img
                src={logoUrl || Klogo}
                alt="Company Logo"
                className="h-8 w-8 rounded-full object-cover"
                onError={(e) => {
                  e.target.src = Klogo;
                }}
              />
              <div className="block min-w-0">
                <h1
                  className="font-heading font-bold title-strong text-base sm:text-lg md:text-xl truncate max-w-[45vw] md:max-w-none"
                  style={{ color: dark ? '#f3f4f6' : '#111827' }}
                >
                  {getPageTitle()}
                </h1>
                {userCompany?.companyName && (
                  <p
                    className="text-xs sm:text-sm subtitle-muted font-medium truncate max-w-[45vw] md:max-w-none"
                    style={{ color: dark ? '#d1d5db' : '#374151' }}
                  >
                    {userCompany.companyName}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Center Section - Search */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <form onSubmit={handleSearch} className="w-full">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search jobs, applications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-kgamify pl-10 py-2 text-sm w-full"
                />
              </div>
            </form>
          </div>

          {/* Right Section */}
          <div className="flex items-center space-x-3">
            {/* Mobile Search Button */}
            <button className="md:hidden p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <FaSearch className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={onThemeToggle}
              className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              aria-label="Toggle theme"
            >
              {dark ? (
                <FaSun className="h-5 w-5 text-yellow-500" />
              ) : (
                <FaMoon className="h-5 w-5 text-gray-600" />
              )}
            </button>

            {/* Notifications */}
            <div className="relative" ref={notificationDropdownRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                aria-label="Notifications"
              >
                <FaBell className={`h-5 w-5 ${dark ? 'text-gray-300' : 'dark:text-gray-800'}`} />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadNotifications}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div
                  className={`absolute right-0 mt-2 w-80 rounded-lg shadow-lg border z-50 ${
                    dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className={`p-4 border-b flex items-center justify-between gap-2 ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <h3 className={`font-semibold ${dark ? 'text-gray-100' : 'text-gray-900'}`}>Notifications</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={hydrateNotifications}
                        className={`text-xs px-2 py-1 rounded border ${dark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-100'} transition`}
                        title="Refresh"
                      >↻</button>
                      <button
                        onClick={handleMarkAll}
                        disabled={markingAll || unreadNotifications === 0}
                        className={`text-xs px-2 py-1 rounded border font-medium ${unreadNotifications === 0 ? 'opacity-40 cursor-not-allowed' : ''} ${dark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-100'} transition`}
                      >{markingAll ? '…' : 'Mark all'}</button>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto relative">
                    {loadingNotifs && notifications.length === 0 && (
                      <div className="p-6 text-center text-sm opacity-70 flex flex-col items-center gap-2">
                        <FaInbox className="text-xl" /> Loading…
                      </div>
                    )}
                    {!loadingNotifs && notifications.length === 0 && (
                      <div className="p-6 text-center text-sm opacity-70 flex flex-col items-center gap-2">
                        <FaInbox className="text-xl" /> No notifications
                      </div>
                    )}
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        onMouseEnter={() => handleItemVisible(n.id)}
                        className={`p-4 border-b flex gap-3 items-start transition-colors ${
                          dark ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-100 hover:bg-gray-50'
                        } ${!n.read ? (isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50') : ''}`}
                      >
                        {!n.read ? (
                          <span className="mt-1 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                        ) : (
                          <FaCheck className={`mt-0.5 h-3 w-3 ${dark ? 'text-gray-500' : 'text-gray-400'}`} />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-snug ${dark ? 'text-gray-100' : 'text-gray-700'}`}>{n.message}</p>
                          <p className={`text-[11px] mt-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{formatAgo(n.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className={`p-3 text-center border-t ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <button className={`text-sm font-medium`} style={{ color: colors.brand.orange }}>
                      View all notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Dropdown */}
            <div className="relative" ref={userDropdownRef}>
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                aria-label="User menu"
              >
                <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.brand.orange }}>
                  <FaUser className="h-4 w-4 text-white" />
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium" style={{ color: colors.brand.orange }}>
                    {userCompany?.companyName || "Company"}
                  </p>
                  <p className="text-xs text-gray-800 dark:text-gray-200">
                    {email}
                  </p>
                </div>
                <FaChevronDown className="h-3 w-3 text-gray-700 dark:text-gray-300" />
              </button>

              {/* User Dropdown Menu */}
              {showUserDropdown && (
                <div
                  className={`absolute right-0 mt-2 w-56 rounded-lg shadow-lg border z-50 ${
                    isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className={`p-3 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <p className="font-medium" style={{ color: colors.brand.orange }}>
                      {userCompany?.companyName || "Company"}
                    </p>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{email}</p>
                  </div>
                  <div className="py-1">
                    {hasAdminMessages && (
                      <button
                        onClick={() => { navigate('/messages'); setShowUserDropdown(false); }}
                        className={`${isDarkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'} flex items-center w-full px-4 py-2 text-sm`}
                      >
                        <span className="mr-3 inline-flex items-center justify-center h-5 w-5 rounded-full text-white text-[10px]" style={{ backgroundColor: colors.brand.orange }}>
                          {userCompany?.adminMessages?.length || 0}
                        </span>
                        Account Messages
                      </button>
                    )}
                    <button
                      onClick={() => {
                        navigate('/edit-registration');
                        setShowUserDropdown(false);
                      }}
                      className={`flex items-center w-full px-4 py-2 text-sm ${
                        isDarkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <FaEdit className="mr-3 h-4 w-4" />
                      Edit Profile
                    </button>
                    <button
                      onClick={() => {
                        navigate('/subscription');
                        setShowUserDropdown(false);
                      }}
                      className={`flex items-center w-full px-4 py-2 text-sm ${
                        isDarkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <FaCreditCard className="mr-3 h-4 w-4" />
                      Subscription Snapshot
                    </button>
                    {/* Settings removed from user dropdown */}
                    <div className={`border-t my-1 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}></div>
                    <button
                      onClick={handleLogout}
                      className={`flex items-center w-full px-4 py-2 text-sm ${
                        isDarkMode ? 'text-red-400 hover:bg-red-900/20' : 'text-red-600 hover:bg-red-50'
                      }`}
                    >
                      <FaSignOutAlt className="mr-3 h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
    {}
    </div>
  );
}

Navbar.propTypes = {
  onSidebarToggle: PropTypes.func.isRequired,
  onThemeToggle: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  $isDarkMode: PropTypes.bool,
  userCompany: PropTypes.shape({
    companyName: PropTypes.string,
    logo: PropTypes.string
  }),
  email: PropTypes.string
};

export default Navbar;