import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { FaBuilding, FaUser, FaSignOutAlt, FaKey, FaBriefcase } from 'react-icons/fa';
import Klogo from '../assets/KLOGO.png';

function AdminSidebar({ isDarkMode = false, isOpen: initialOpen = true, variant = 'panel', onNavigate }) {
  const [, setIsOpen] = useState(initialOpen);
  const location = useLocation();
  const navigate = useNavigate();
  const companiesBtnRef = useRef(null);
  const [companiesOpen, setCompaniesOpen] = useState(false);

  useEffect(() => { setIsOpen(initialOpen); }, [initialOpen]);
  useEffect(() => { setCompaniesOpen(false); }, [location]);

  // Close the companies popup on outside click
  useEffect(() => {
    function onDocClick(e) {
      if (!companiesOpen) return;
      if (companiesBtnRef.current && !companiesBtnRef.current.contains(e.target)) {
        setCompaniesOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [companiesOpen]);

  const isActive = (path) => location.pathname === path;

  const logout = () => {
    try {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminData');
    } catch { /* ignore */ }
    navigate('/admin-login', { replace: true });
  };

  const Item = ({ to, icon: Icon, label }) => (
    <Link to={to} onClick={() => onNavigate && onNavigate()} className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${
      isActive(to)
        ? 'bg-kgamify-500 text-white shadow-sm'
        : isDarkMode
          ? 'text-gray-300 hover:bg-gray-800 hover:text-gray-100'
          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
    }`}>
      <Icon className="w-5 h-5 mr-3" />
      <span className="font-medium">{label}</span>
    </Link>
  );

  Item.propTypes = { to: PropTypes.string.isRequired, icon: PropTypes.elementType.isRequired, label: PropTypes.string.isRequired };

  // Non-scrollable, sticky sidebar styles
  const containerClass = variant === 'drawer'
    ? `w-64 h-full overflow-hidden ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white'} p-4`
    : `w-64 flex-shrink-0 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} p-4 h-screen sticky top-16 overflow-hidden flex flex-col`;

  return (
    <aside className={containerClass}> 
      <div className="flex items-center gap-2 mb-3">
        <img src={Klogo} alt="kGamify" className="w-8 h-8 rounded" />
        <div>
          <div className="text-sm font-bold text-kgamify-500">kGamify</div>
          <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Admin</div>
        </div>
      </div>
      <nav className="space-y-1 flex-1">
        {/* Companies with popup filter */}
        <div className="relative" ref={companiesBtnRef}>
          <button
            type="button"
            onClick={() => setCompaniesOpen((o) => !o)}
            className={`w-full text-left flex items-center px-3 py-2.5 rounded-lg transition-colors ${
              location.pathname === '/admin'
                ? 'bg-kgamify-500 text-white shadow-sm'
                : isDarkMode
                  ? 'text-gray-300 hover:bg-gray-800 hover:text-gray-100'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
            }`}
            aria-haspopup="menu"
            aria-expanded={companiesOpen ? 'true' : 'false'}
          >
            <FaBuilding className="w-5 h-5 mr-3" />
            <span className="font-medium">Companies</span>
          </button>
          {/* Popup */}
          {companiesOpen && (
            <div className={`absolute left-0 top-full mt-2 z-50 w-full rounded-lg shadow-lg border ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`} role="menu">
              {[
                { key: 'pending', label: 'New' },
                { key: 'approved', label: 'Approved' },
                { key: 'hold', label: 'On Hold' },
                { key: 'denied', label: 'Denied' },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.key}
                  onClick={() => {
                    navigate(`/admin?tab=${opt.key}`);
                    onNavigate && onNavigate();
                    setCompaniesOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm ${isDarkMode ? 'hover:bg-gray-800 text-gray-200' : 'hover:bg-gray-50 text-gray-700'}`}
                  role="menuitem"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Jobs link removed per latest requirement */}
        <Item to="/admin/jobs" icon={FaBriefcase} label="Jobs" />
        <Item to="/admin/api" icon={FaKey} label="API Control" />
        <Item to="/admin/profile" icon={FaUser} label="My Profile" />
      </nav>
      {/* Move logout above divider for quicker access */}
      <button onClick={() => { logout(); onNavigate && onNavigate(); }} className={`w-full flex items-center px-3 py-2.5 rounded-lg mb-2 ${isDarkMode ? 'text-gray-300 hover:bg-red-900/20 hover:text-red-400' : 'text-gray-700 hover:bg-red-50 hover:text-red-600'}`}>
        <FaSignOutAlt className="w-5 h-5 mr-3" />
        <span className="font-medium">Logout</span>
      </button>
      <div className={`my-3 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`} />
    </aside>
  );
}

AdminSidebar.propTypes = { isDarkMode: PropTypes.bool, isOpen: PropTypes.bool, variant: PropTypes.oneOf(['panel','drawer']), onNavigate: PropTypes.func };

export default AdminSidebar;
