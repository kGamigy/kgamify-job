import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import PropTypes from "prop-types";
import { 
  FaCheck, FaTimes, FaBuilding, FaCalendarAlt, FaEnvelope, 
  FaPhone, FaGlobeAmericas, FaUserCircle, FaKey, FaLock,
  FaClock, FaCheckCircle, FaUsers,
  FaChevronLeft, FaChevronRight
} from "react-icons/fa";
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import { grantSensitiveEdit, revokeSensitiveEdit, changeAdminPassword, denyCompanyWithReason, holdCompanyWithReason, revokeCompanyAccess } from '../api';
import { getBaseUrl } from '../utils/apiUrl';
import { formatDateDDMMYYYY } from '../utils/date';
// Sidebar, header, and footer provided by AdminLayout wrapper

function GrantSensitiveEditButton({ company, $isDarkMode, onNotify }) {
  const [loading, setLoading] = React.useState(false);
  const [revoking, setRevoking] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const allowed = company?.sensitiveEditAllowed;
  const used = company?.sensitiveEditUsed;
  const companyLabel = company?.companyName || company?.email || 'company';

  const onGrant = async () => {
    if (!company?._id) return;
    setLoading(true);
    try {
      await grantSensitiveEdit(company._id);
      // Optimistic UI: reflect allowed=true
      company.sensitiveEditAllowed = true;
      if (typeof onNotify === 'function') onNotify('success', `One-time sensitive edit access granted for ${companyLabel}`);
    } catch {
      if (typeof onNotify === 'function') onNotify('error', `Failed to grant edit access for ${companyLabel}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mr-3">
      <span className={`mr-2 text-xs px-2 py-0.5 rounded ${allowed ? (used ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700') : 'bg-gray-100 text-gray-600'}`}>
        {allowed ? (used ? 'Edit used' : 'Edit allowed') : 'Edit locked'}
      </span>
      <button
        onClick={onGrant}
        disabled={loading}
        className={`mr-3 inline-flex items-center px-3 py-1.5 rounded border text-sm ${$isDarkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-800' : 'border-gray-300 text-gray-800 hover:bg-gray-100'}`}
        title="Allow company to edit sensitive fields once"
      >
        {loading ? 'Granting…' : (allowed && !used ? 'Edit Access Granted' : 'Grant Edit Access')}
      </button>
      {allowed && !used && (
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={revoking}
          className={`inline-flex items-center px-3 py-1.5 rounded border text-sm ${$isDarkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-800' : 'border-gray-300 text-gray-800 hover:bg-gray-100'}`}
          title="Revoke unused edit access"
        >
          {revoking ? 'Revoking…' : 'Revoke Edit Access'}
        </button>
      )}
      {allowed && !used && (
        <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
          <DialogTitle>Revoke edit access?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to revoke the unused one-time edit access for {companyLabel}?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              disabled={revoking}
              onClick={async () => {
                if (!company?._id) return;
                setRevoking(true);
                try {
                  await revokeSensitiveEdit(company._id);
                  company.sensitiveEditAllowed = false;
                  if (typeof onNotify === 'function') onNotify('success', `Unused edit access revoked for ${companyLabel}`);
                } catch {
                  if (typeof onNotify === 'function') onNotify('error', `Failed to revoke edit access for ${companyLabel}`);
                } finally {
                  setRevoking(false);
                  setConfirmOpen(false);
                }
              }}
            >
              Revoke
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
}
GrantSensitiveEditButton.propTypes = {
  company: PropTypes.object,
  $isDarkMode: PropTypes.bool,
  onNotify: PropTypes.func,
};

// Inline helper to highlight search matches in text (case-insensitive)
const HighlightedText = ({ text, query, $isDarkMode }) => {
  const safeText = typeof text === 'string' ? text : '';
  const q = (query || '').trim();
  if (!q) return <>{safeText}</>;
  const lower = safeText.toLowerCase();
  const qLower = q.toLowerCase();
  const parts = [];
  let i = 0;
  let idx;
  while ((idx = lower.indexOf(qLower, i)) !== -1) {
    if (idx > i) parts.push({ text: safeText.slice(i, idx), match: false });
    parts.push({ text: safeText.slice(idx, idx + q.length), match: true });
    i = idx + q.length;
  }
  if (i < safeText.length) parts.push({ text: safeText.slice(i), match: false });
  const dark = !!$isDarkMode;
  const cls = dark ? 'bg-yellow-600/40 rounded px-0.5' : 'bg-yellow-200 rounded px-0.5';
  return (
    <>
      {parts.map((p, key) => p.match ? <span key={key} className={cls}>{p.text}</span> : <span key={key}>{p.text}</span>)}
    </>
  );
};

HighlightedText.propTypes = {
  text: PropTypes.string,
  query: PropTypes.string,
  $isDarkMode: PropTypes.bool,
};

const AdminPortal = ({ $isDarkMode }) => {
  const [pendingCompanies, setPendingCompanies] = useState([]);
  const [approvedCompanies, setApprovedCompanies] = useState([]);
  const [activeTab, setActiveTab] = useState("pending"); // company list internal tabs
  // Drawer handled by AdminLayout
  const [notification, setNotification] = useState({ show: false, message: "", type: "" });
  const [isLoading, setIsLoading] = useState(false);
  // Removed embedded login state; AdminLogin page handles auth UI
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem("adminToken"));
  const [admin, setAdmin] = useState(null);
  
  // For password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const notify = (type, message) => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
  };

  // Reason modal for Hold / Deny
  const [reasonModal, setReasonModal] = useState({ open: false, mode: null, company: null, reason: "" });
  const [deniedCompanies, setDeniedCompanies] = useState([]);
  const [holdCompanies, setHoldCompanies] = useState([]);
  const [filters, setFilters] = useState({ q: '', sort: 'updatedAt', order: 'desc' });
  const [filterModal, setFilterModal] = useState(false);
  const [pages, setPages] = useState({ pending: 1, approved: 1, hold: 1, denied: 1 });
  const [pageSizes, setPageSizes] = useState({ pending: 10, approved: 10, hold: 10, denied: 10 });
  const [expanded, setExpanded] = useState({});
  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  // Theme toggle handler: prefer parent-provided, fallback to direct document/localStorage update
  // Theme handled by AdminLayout

  // (Optional) Filters & sorting could be added here if needed

  // Sync activeTab with ?tab= in URL; URL is the single source of truth to avoid refresh loops
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    let t = (params.get('tab') || '').toLowerCase();
    const allowed = ['pending', 'approved', 'hold', 'denied'];
    if (!allowed.includes(t)) {
      t = 'pending';
      params.set('tab', t);
      navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: true });
    }
    if (t !== activeTab) setActiveTab(t);
  }, [location.search, location.pathname, navigate]);

  // Initial load: auth + admin data + initial fetches
  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      navigate('/admin-login');
      return;
    }

    setIsAuthenticated(true);

    try {
      const adminData = JSON.parse(localStorage.getItem("adminData"));
      setAdmin(adminData);
    } catch {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminData");
      setIsAuthenticated(false);
      setAdmin(null);
      setPendingCompanies([]);
      return;
    }

    const headers = { "x-auth-token": token };
    const baseUrl = getBaseUrl();

    setIsLoading(true);
    axios
      .get(`${baseUrl}/api/admin/pending-companies`, { headers })
      .then((response) => setPendingCompanies(response.data))
      .catch((error) => {
        setNotification({
          show: true,
          message: "Failed to fetch pending companies",
          type: "error",
        });
        if (error?.response?.status === 401) {
          localStorage.removeItem("adminToken");
          localStorage.removeItem("adminData");
          setIsAuthenticated(false);
          setAdmin(null);
          setPendingCompanies([]);
        }
      })
      .finally(() => setIsLoading(false));

    axios
      .get(`${baseUrl}/api/admin/approved-companies`, { headers })
      .then((response) => setApprovedCompanies(response.data))
      .catch((error) => {
          if (error?.response?.status === 404) {
            // Fallback to generic companies endpoint (older backend without dedicated route)
            axios
              .get(`${baseUrl}/api/admin/companies?status=approved`, { headers })
              .then(r => {
                const list = Array.isArray(r.data) ? r.data.filter(c => c.approved === true && !['hold','denied'].includes(c.status)) : [];
                setApprovedCompanies(list);
              })
              .catch(() => {});
          } else if (error?.response?.status === 401) {
            localStorage.removeItem("adminToken");
            localStorage.removeItem("adminData");
            setIsAuthenticated(false);
            setAdmin(null);
            setPendingCompanies([]);
          }
      });

    axios
      .get(`${baseUrl}/api/admin/companies?status=denied`, { headers })
      .then((response) => setDeniedCompanies(response.data))
      .catch(() => {});

    axios
      .get(`${baseUrl}/api/admin/companies?status=hold`, { headers })
      .then((response) => setHoldCompanies(response.data))
      .catch(() => {});
  }, [navigate]);

  // Re-fetch hold/denied on filter changes
  useEffect(() => {
    if (!isAuthenticated) return;
    const token = localStorage.getItem('adminToken');
    const headers = { 'x-auth-token': token };
    const baseUrl = getBaseUrl();
    const params = new URLSearchParams({ status: 'hold', q: filters.q || '', sort: filters.sort || 'updatedAt', order: filters.order || 'desc' }).toString();
    axios.get(`${baseUrl}/api/admin/companies?${params}`, { headers }).then(r => setHoldCompanies(r.data)).catch(()=>{});
    const paramsDenied = new URLSearchParams({ status: 'denied', q: filters.q || '', sort: filters.sort || 'updatedAt', order: filters.order || 'desc' }).toString();
    axios.get(`${baseUrl}/api/admin/companies?${paramsDenied}`, { headers }).then(r => setDeniedCompanies(r.data)).catch(()=>{});
  }, [filters, isAuthenticated]);

  // Embedded login handler removed; dedicated AdminLogin page handles this

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminData");
    setIsAuthenticated(false);
    setAdmin(null);
    setPendingCompanies([]);
  // Redirect to admin login immediately
  navigate('/admin-login', { replace: true });
  };

  // Approve action for companies in Hold tab
  const handleApproveFromHold = async (companyId) => {
    try {
      const token = localStorage.getItem("adminToken");
      await axios.post(
        `${getBaseUrl()}/api/admin/approve-company/${companyId}`,
        {},
        { headers: { "x-auth-token": token } }
      );
      // Remove from hold list and refresh approved
      setHoldCompanies(prev => (Array.isArray(prev) ? prev.filter(c => c._id !== companyId) : []));
      fetchApprovedCompanies(token);
      setNotification({ show: true, message: 'Company approved from On Hold', type: 'success' });
      setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
    } catch (error) {
      setNotification({ show: true, message: 'Error approving company', type: 'error' });
      setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
      if (error.response?.status === 401) {
        handleLogout();
      }
    }
  };

  // Approve action for companies in Denied tab
  const handleApproveFromDenied = async (companyId) => {
    try {
      const token = localStorage.getItem("adminToken");
      await axios.post(
        `${getBaseUrl()}/api/admin/approve-company/${companyId}`,
        {},
        { headers: { "x-auth-token": token } }
      );
      // Remove from denied list and refresh approved
      setDeniedCompanies(prev => (Array.isArray(prev) ? prev.filter(c => c._id !== companyId) : []));
      fetchApprovedCompanies(token);
      setNotification({ show: true, message: 'Company approved from Denied', type: 'success' });
      setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
    } catch (error) {
      setNotification({ show: true, message: 'Error approving company', type: 'error' });
      setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
      if (error.response?.status === 401) {
        handleLogout();
      }
    }
  };

  // fetchPendingCompanies removed; initial useEffect already loads pending list

  const fetchApprovedCompanies = async (token) => {
    try {
      const authToken = token || localStorage.getItem("adminToken");
      if (!authToken) {
        return;
      }
      
      const response = await axios.get(
        `${getBaseUrl()}/api/admin/approved-companies`,
        {
          headers: {
            "x-auth-token": authToken
          }
        }
      );
      
      setApprovedCompanies(response.data);
    } catch (error) {
      // If endpoint not found (older server without dedicated route), fallback to generic companies query
      if (error.response?.status === 404) {
        try {
          const authToken = token || localStorage.getItem("adminToken");
          if (!authToken) return;
          const fallback = await axios.get(
            `${getBaseUrl()}/api/admin/companies?status=approved`,
            { headers: { "x-auth-token": authToken } }
          );
          // Filter defensively: approved true & not hold/denied
          const list = Array.isArray(fallback.data) ? fallback.data.filter(c => c.approved === true && !['hold','denied'].includes(c.status)) : [];
          setApprovedCompanies(list);
        } catch (err2) {
          if (err2.response?.status === 401) handleLogout();
        }
        return;
      }
      if (error.response?.status === 401) handleLogout();
    }
  };

  const handleApprove = async (companyId) => {
    try {
      const token = localStorage.getItem("adminToken");
      
      await axios.post(
        `${getBaseUrl()}/api/admin/approve-company/${companyId}`,
        {},
        {
          headers: {
            "x-auth-token": token
          }
        }
      );
      
  // Remove from pending (if present) and from hold (if approving from hold)
  setPendingCompanies(prev => (Array.isArray(prev) ? prev.filter((company) => company._id !== companyId) : []));
  setHoldCompanies(prev => (Array.isArray(prev) ? prev.filter((company) => company._id !== companyId) : []));
      setNotification({
        show: true,
        message: "Company approved successfully",
        type: "success"
      });
      setTimeout(() => setNotification({ show: false, message: "", type: "" }), 3000);
      
      // Refresh approved companies list
      fetchApprovedCompanies(token);
    } catch (error) {
      // Error handling without console.error
      setNotification({
        show: true,
        message: "Error approving company",
        type: "error"
      });
      setTimeout(() => setNotification({ show: false, message: "", type: "" }), 3000);
      // If unauthorized, logout
      if (error.response?.status === 401) {
        handleLogout();
      }
    }
  };

  const openReasonModal = (mode, company) => {
    setReasonModal({ open: true, mode, company, reason: "" });
  };

  const submitReasonModal = async () => {
    const { mode, company, reason } = reasonModal;
    if (!mode || !company) { setReasonModal({ open: false, mode: null, company: null, reason: "" }); return; }
    const trimmed = (reason || "").trim();
    if (!trimmed) { return; }
    try {
      if (mode === 'hold') {
        const resp = await holdCompanyWithReason(company._id, trimmed);
        const updated = resp?.company || { ...company, status: 'hold', approved: false, adminMessages: [ ...(company.adminMessages||[]), { type: 'hold', message: trimmed, createdAt: new Date().toISOString() } ] };
        // Move from pending to hold
        setPendingCompanies(prev => (Array.isArray(prev) ? prev.filter(c => c._id !== company._id) : []));
        setHoldCompanies(prev => [updated, ...(Array.isArray(prev) ? prev : [])]);
        setNotification({ show: true, message: 'Company moved to On Hold', type: 'success' });
      } else if (mode === 'deny') {
        const resp = await denyCompanyWithReason(company._id, trimmed);
        const updated = resp?.company || { ...company, status: 'denied', approved: false, adminMessages: [ ...(company.adminMessages||[]), { type: 'deny', message: trimmed, createdAt: new Date().toISOString() } ] };
        // Remove from source list (pending or hold), then add to denied list
        if (company.status === 'hold') {
          setHoldCompanies(prev => (Array.isArray(prev) ? prev.filter(c => c._id !== company._id) : []));
        } else {
          setPendingCompanies(prev => (Array.isArray(prev) ? prev.filter(c => c._id !== company._id) : []));
        }
        setDeniedCompanies(prev => [updated, ...(Array.isArray(prev) ? prev : [])]);
        setNotification({ show: true, message: 'Company denied (email sent)', type: 'success' });
      }
    } catch (error) {
      setNotification({ show: true, message: error?.response?.data?.message || 'Action failed', type: 'error' });
    } finally {
      setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
      setReasonModal({ open: false, mode: null, company: null, reason: '' });
    }
  };

  const handleRevoke = async (companyId) => {
    try {
      const reason = window.prompt('Enter a reason to revoke access (optional):') || '';
      const resp = await revokeCompanyAccess(companyId, reason.trim());
      const updated = resp?.company;
      setApprovedCompanies(prev => (Array.isArray(prev) ? prev.filter(c => c._id !== companyId) : []));
      setHoldCompanies(prev => {
        const list = Array.isArray(prev) ? prev : [];
        return updated ? [updated, ...list] : list;
      });
      // Refresh approved list in background
      fetchApprovedCompanies();
  setNotification({ show: true, message: 'Access revoked; company moved to On Hold', type: 'success' });
      setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
    } catch (error) {
      setNotification({ show: true, message: 'Error revoking access', type: 'error' });
      setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
      if (error.response?.status === 401) {
        handleLogout();
      }
    }
  };
  
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError(null);
    setIsLoading(true);
    
    // Validate passwords
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      setIsLoading(false);
      return;
    }
    
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters long");
      setIsLoading(false);
      return;
    }
    
    try {
      // Use our API function instead of axios directly
      await changeAdminPassword(currentPassword, newPassword);
      
      // Reset form fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      
      setNotification({
        show: true,
        message: "Password changed successfully",
        type: "success"
      });
      setTimeout(() => setNotification({ show: false, message: "", type: "" }), 3000);
    } catch (error) {
      setPasswordError(
        error.message || error.error || 
        "Error changing password. Please verify your current password."
      );
      
      // If unauthorized, logout
      if (error.status === 401) {
        handleLogout();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to format MongoDB ObjectId into a date
  const formatObjectIdToDate = (objectId) => {
    // MongoDB ObjectId format: 4-byte timestamp, 5-byte random, 3-byte counter
    // Extract timestamp from first 4 bytes (8 characters) of ObjectId
    try {
      // Check if objectId is a string
      if (typeof objectId === 'string' && objectId.length >= 8) {
        const timestamp = parseInt(objectId.substring(0, 8), 16) * 1000;
        return new Date(timestamp);
      }
      // Default to current date if conversion fails
      return new Date();
    } catch {
      // Silent error handling without console.error
      return new Date(); // Return current date as fallback
    }
  };
  
  const formatDate = (dateString) => formatDateDDMMYYYY(dateString);
  
  // If not authenticated, show redirect placeholder (dedicated login page handles UI)
  if (!isAuthenticated) {
    return (
  <div className={`min-h-screen flex items-center justify-center ${$isDarkMode ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-800"}`}>
        <div className="text-sm opacity-75">Redirecting to admin login…</div>
      </div>
    );
  }

  return (
  <div className={`flex flex-col min-h-screen ${$isDarkMode ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-800"}`}>
    {/* Main Content */}
    <div className="flex-1 w-full container mx-auto px-4 md:px-6 lg:px-8 py-8">
        <div className="my-6">
          <h1 className="text-3xl font-bold">Admin Portal</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage company registrations and account settings</p>
        </div>
      
      <Snackbar
        open={notification.show}
        autoHideDuration={3000}
        onClose={() => setNotification({ show: false, message: '', type: '' })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ width: '100%', position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1400 }}
      >
        <Alert
          onClose={() => setNotification({ show: false, message: '', type: '' })}
          severity={notification.type === 'success' ? 'success' : 'error'}
          sx={{ width: '100%', maxWidth: '600px', fontSize: '1rem', '& .MuiAlert-message': { fontSize: '1rem' } }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
      
      {/* Content layout: full-width body; nav via hamburger drawer */}
      <div className="flex gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`admin-tab ${activeTab === 'pending' ? 'admin-tab--active' : ''}`}
            >
              <FaClock className="mr-2" />
              <span>New</span>
              <span className={`admin-tab__badge ${activeTab === 'pending' ? 'admin-tab__badge--active' : ''}`}>
                {Array.isArray(pendingCompanies) ? pendingCompanies.filter(c => (c.status || 'pending') === 'pending').length : 0}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('approved')}
              className={`admin-tab ${activeTab === 'approved' ? 'admin-tab--active' : ''}`}
            >
              <FaCheckCircle className="mr-2" />
              <span>Approved</span>
              <span className={`admin-tab__badge ${activeTab === 'approved' ? 'admin-tab__badge--active' : ''}`}>
                {approvedCompanies?.length ?? 0}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('hold')}
              className={`admin-tab ${activeTab === 'hold' ? 'admin-tab--active' : ''}`}
            >
              <FaClock className="mr-2" />
              <span>On Hold</span>
              <span className={`admin-tab__badge ${activeTab === 'hold' ? 'admin-tab__badge--active' : ''}`}>
                {holdCompanies?.length ?? 0}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('denied')}
              className={`admin-tab ${activeTab === 'denied' ? 'admin-tab--active' : ''}`}
            >
              <FaTimes className="mr-2" />
              <span>Denied</span>
              <span className={`admin-tab__badge ${activeTab === 'denied' ? 'admin-tab__badge--active' : ''}`}>
                {deniedCompanies?.length ?? 0}
              </span>
            </button>
          </div>
        </div>
      </div>
      
      <h2 className="text-2xl font-semibold mb-6 text-[#ff8200]">
        {activeTab === "pending" 
          ? "New Companies" 
          : activeTab === "approved" 
            ? "Approved Companies" 
            : activeTab === "hold" 
              ? "On Hold" 
              : "Denied Companies"}
      </h2>

  {(activeTab === 'hold' || activeTab === 'denied' || activeTab === 'pending' || activeTab === 'approved') && (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <button onClick={()=>setFilterModal(true)} className="px-4 py-2 rounded bg-[#ff8200] text-white text-sm hover:bg-[#e57400]">Open Filters</button>
      {(filters.q || filters.sort !== 'updatedAt' || filters.order !== 'desc') && (
        <button onClick={()=>setFilters({ q:'', sort:'updatedAt', order:'desc' })} className="text-xs underline text-[#ff8200]">Clear</button>
      )}
    </div>
  )}

      {/* Pending Companies Tab Content */}
    {activeTab === "pending" && (
        <>
      {(!Array.isArray(pendingCompanies) || pendingCompanies.filter(c => (c.status || 'pending') === 'pending').length === 0) ? (
            <div className={`text-center p-16 rounded-lg shadow-sm border ${$isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="mb-6 flex justify-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${$isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <FaBuilding className="text-[#ff8200] text-3xl" />
                </div>
              </div>
              <p className="text-xl font-medium">No pending company approvals at the moment</p>
              <p className={`text-sm mt-2 ${$isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>New registration requests will appear here</p>
            </div>
          ) : (
      <div className="grid grid-cols-1 gap-6">
        <div className="flex justify-end items-center mb-2 text-sm">
          <span className="mr-2">Rows per page:</span>
          <select
            className={`border rounded px-2 py-1 ${$isDarkMode ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-800'}`}
            value={pageSizes.pending}
            onChange={(e)=>{ const v = Number(e.target.value)||10; setPageSizes(ps=>({...ps, pending:v})); setPages(p=>({...p, pending:1})); }}
          >
            {[10,25,50,100].map(n=> <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
  {(() => { const pageSize = pageSizes.pending; const all = pendingCompanies.filter(c => (c.status || 'pending') === 'pending'); const page = pages.pending; const slice = all.slice((page-1)*pageSize, page*pageSize); return slice.map((company) => (
                <div key={company._id} className={`rounded-lg shadow-md ${$isDarkMode ? "bg-gray-800" : "bg-white"} transition-all hover:shadow-xl border ${$isDarkMode ? "border-gray-700" : "border-gray-200"}`}>
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="sm:flex w-full sm:flex-col md:flex md:flex-row md:justify-between items-start md:items-center">
                      <div className="flex items-center md:flex-1 min-w-0 mb-4 md:mb-0">
                        <div className={`w-16 h-16 mr-4 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center border ${$isDarkMode ? "border-gray-600" : "border-gray-300"}`}>
                          {company.logo ? (
                            <img src={company.logo} alt={company.companyName} className="w-full h-full object-cover" />
                          ) : (
                            <FaBuilding className="text-[#ff8200] text-3xl" />
                          )}
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold">{company.companyName}</h3>
                          <div className="flex items-center mt-1">
                            <FaCalendarAlt className="text-[#ff8200] mr-2" />
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              Applied on: {formatDate(formatObjectIdToDate(company._id))}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 md:ml-auto md:flex-shrink-0">
                        <button
                          onClick={() => handleApprove(company._id)}
                          className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors shadow-sm"
                        >
                          <FaCheck className="mr-2" /> Approve
                        </button>
                        <button
              onClick={() => openReasonModal('hold', company)}
                          className="flex items-center px-4 py-2 bg-[#ff8200] text-white rounded hover:bg-[#e57400] transition-colors shadow-sm"
                        >
                          <FaClock className="mr-2" /> Hold
                        </button>
                        <button
              onClick={() => openReasonModal('deny', company)}
                          className="flex items-center px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors shadow-sm"
                        >
                          <FaTimes className="mr-2" /> Deny
                        </button>
                        <button
                          onClick={()=> navigate(`/admin/messages/${company._id}`)}
                          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors shadow-sm"
                        >
                          <FaEnvelope className="mr-2" /> Messages
                        </button>
                        {/* Applicants button removed for new (pending) companies */}
                      </div>
                      
                    </div>
                  </div>
                  {expanded[company._id] && (
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className={`p-4 rounded-lg ${$isDarkMode ? "bg-gray-700" : "bg-gray-50"}`}>
                        <h4 className="font-medium mb-4 text-[#ff8200]">Contact Information</h4>
                        <div className="space-y-4">
                          <div className="flex items-center">
                            <FaEnvelope className="text-[#ff8200] mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                              <p className="font-medium break-all">{company.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center">
                            <FaPhone className="text-[#ff8200] mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Phone</p>
                              <p className="font-medium">{company.phone}</p>
                            </div>
                          </div>
                          <div className="flex items-center">
                            <FaGlobeAmericas className="text-[#ff8200] mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Website</p>
                              <p className="font-medium break-all">
                                {company.website ? (
                                  <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                    {company.website}
                                  </a>
                                ) : (
                                  "Not provided"
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className={`p-4 rounded-lg ${$isDarkMode ? "bg-gray-700" : "bg-gray-50"}`}>
                        <h4 className="font-medium mb-4 text-[#ff8200]">Company Details</h4>
                        <div className="space-y-4">
                          <div className="flex items-center">
                            <FaBuilding className="text-[#ff8200] mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Industry</p>
                              <p className="font-medium">{company.industry || "Not specified"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Status:</span>
                            {company.status === 'hold' && (
                              <span className="px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">On Hold</span>
                            )}
                            {company.status === 'denied' && (
                              <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Denied</span>
                            )}
                            {(!company.status || company.status === 'pending') && (
                              <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">Pending</span>
                            )}
                          </div>
                          
                          {(company.documents || (Array.isArray(company.documentsList) && company.documentsList.length)) && (
                            <div className="flex items-start">
                              <svg className="h-5 w-5 text-[#ff8200] mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Documents</p>
                                {Array.isArray(company.documentsList) && company.documentsList.length ? (
                                  <ul className="list-disc pl-5 space-y-1">
                                    {company.documentsList.map((u, i) => (
                                      <li key={i}><a href={u} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Document {i+1}</a></li>
                                    ))}
                                  </ul>
                                ) : company.documents ? (
                                  <a href={company.documents} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline font-medium">View Verification Documents</a>
                                ) : null}
                              </div>
                            </div>
                          )}
                          {Array.isArray(company.images) && company.images.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Gallery</p>
                              <div className="grid grid-cols-3 gap-2">
                                {company.images.slice(0,6).map((img, idx) => (
                                  <a key={idx} href={img} target="_blank" rel="noopener noreferrer">
                                    <img src={img} alt={`img-${idx}`} className="h-16 w-full object-cover rounded border" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Admin message (latest) */}
                    {Array.isArray(company.adminMessages) && (
                      (() => {
                        const relevantType = company.status === 'denied' ? 'deny' : company.status === 'hold' ? 'hold' : null;
                        const msgs = relevantType ? company.adminMessages.filter(m => m.type === relevantType) : [];
                        const last = msgs[msgs.length - 1];
                        if (!last) return null;
                        return (
                          <div className={`mt-6 p-4 rounded ${company.status === 'denied' ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700' : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700'}`}>
                            <div className="text-sm font-medium mb-1">{company.status === 'denied' ? 'Denial Reason' : 'Hold Reason'}</div>
                            <div className="text-sm">{last.message}</div>
                          </div>
                        );
                      })()
                    )}
                    
                    {company.description && (
                      <div className={`mt-6 p-4 rounded-lg ${$isDarkMode ? "bg-gray-700" : "bg-gray-50"}`}>
                        <h4 className="font-medium mb-2 text-[#ff8200]">Company Description</h4>
                        <div className="prose dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: company.description }} />
                      </div>
                    )}
                  </div>
                  )}
                  <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex justify-end">
                      <button
                        onClick={()=> toggleExpand(company._id)}
                        className={`text-sm font-medium underline ${$isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                      >
                        {expanded[company._id] ? 'View less' : 'View more'}
                      </button>
                    </div>
                  </div>
                </div>
              )); })()}
              {(() => { const pageSize = pageSizes.pending; const all = pendingCompanies.filter(c => (c.status || 'pending') === 'pending'); const total = Math.max(1, Math.ceil(all.length / pageSize)); return (
                <div className="mt-6 mb-8 w-full flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPages(p => ({ ...p, pending: Math.max(1, p.pending - 1) }))}
                    disabled={pages.pending === 1}
                    className={`inline-flex items-center px-3 py-1.5 rounded border text-sm ${pages.pending===1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-800'} ${$isDarkMode ? 'border-gray-600 text-gray-200' : 'border-gray-300 text-gray-800'}`}
                    aria-label="Previous page"
                  >
                    <FaChevronLeft className="mr-1 h-4 w-4" /> Prev
                  </button>
                  {Array.from({ length: total }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPages(p => ({ ...p, pending: i + 1 }))}
                      className={`px-3 py-1.5 rounded border text-sm ${pages.pending===i+1 ? 'bg-[#ff8200] text-white border-[#ff8200]' : $isDarkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-800' : 'border-gray-300 text-gray-800 hover:bg-gray-100'}`}
                      aria-current={pages.pending===i+1 ? 'page' : undefined}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setPages(p => ({ ...p, pending: Math.min(total, p.pending + 1) }))}
                    disabled={pages.pending === total}
                    className={`inline-flex items-center px-3 py-1.5 rounded border text-sm ${pages.pending===total ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-800'} ${$isDarkMode ? 'border-gray-600 text-gray-200' : 'border-gray-300 text-gray-800'}`}
                    aria-label="Next page"
                  >
                    Next <FaChevronRight className="ml-1 h-4 w-4" />
                  </button>
                </div> ); })()}
            </div>
          )}
        </>
      )}

      {/* Approved Companies Tab Content */}
  {activeTab === "approved" && (
        <>
          {/* Approved list */}
      {(() => { const filtered = approvedCompanies.filter(c => c.approved === true && (c.status === 'approved' || c.status === undefined || c.status === null) && (!filters.q || (c.companyName?.toLowerCase().includes(filters.q.toLowerCase()) || c.email?.toLowerCase().includes(filters.q.toLowerCase()) || c.industry?.toLowerCase().includes(filters.q.toLowerCase())))); return filtered.length === 0; })() ? (
            <div className={`text-center p-16 rounded-lg shadow-sm border ${$isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="mb-6 flex justify-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${$isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <FaBuilding className="text-[#ff8200] text-3xl" />
                </div>
              </div>
              <p className="text-xl font-medium">No approved companies yet</p>
              <p className={`text-sm mt-2 ${$isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Approved companies will appear here</p>
              <button
                onClick={() => fetchApprovedCompanies()}
                className="mt-6 inline-flex items-center px-4 py-2 rounded bg-[#ff8200] text-white text-sm font-medium hover:bg-[#e57400] transition"
              >
                Refresh
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              <div className="flex justify-start  ">
                <button
                  onClick={() => fetchApprovedCompanies()}
                  className="inline-flex items-center px-3 py-1.5 rounded bg-[#ff8200] text-white text-xs font-semibold hover:bg-[#e57400] transition"
                >
                  Refresh List
                </button>
              </div>
              <div className="flex justify-end items-center -mt-3 mb-2 text-sm">
                <span className="mr-2">Rows per page:</span>
                <select
                  className={`border rounded px-2 py-1 ${$isDarkMode ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-800'}`}
                  value={pageSizes.approved}
                  onChange={(e)=>{ const v = Number(e.target.value)||10; setPageSizes(ps=>({...ps, approved:v})); setPages(p=>({...p, approved:1})); }}
                >
                  {[10,25,50,100].map(n=> <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
  {(() => { const pageSize = pageSizes.approved; const all = approvedCompanies.filter(c => c.approved === true && (c.status === 'approved' || c.status === undefined || c.status === null) && (!filters.q || (c.companyName?.toLowerCase().includes(filters.q.toLowerCase()) || c.email?.toLowerCase().includes(filters.q.toLowerCase()) || c.industry?.toLowerCase().includes(filters.q.toLowerCase())))); const page = pages.approved; const slice = all.slice((page-1)*pageSize, page*pageSize); return slice.map((company) => (
                <div key={company._id} className={`rounded-lg shadow-md ${$isDarkMode ? "bg-gray-800" : "bg-white"} transition-all hover:shadow-xl border ${$isDarkMode ? "border-gray-700" : "border-gray-200"}`}>
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="sm:flex w-full sm:flex-col md:flex-row md:justify-between items-start md:items-center">
                      <div className="flex items-center md:flex-1 min-w-0 mb-4 md:mb-0">
                        <div className={`w-16 h-16 mr-4 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center border ${$isDarkMode ? "border-gray-600" : "border-gray-300"}`}>
                          {company.logo ? (
                            <img src={company.logo} alt={company.companyName} className="w-full h-full object-cover" />
                          ) : (
                            <FaBuilding className="text-[#ff8200] text-3xl" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center">
                            <h3 className="text-2xl font-bold">{company.companyName}</h3>
                            <span className="ml-3 bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded dark:bg-green-900 dark:text-green-300">
                              Approved
                            </span>
                          </div>
                          <div className="flex items-center mt-1">
                            <FaCalendarAlt className="text-[#ff8200] mr-2" />
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              Approved on: {formatDate(company.updatedAt || formatObjectIdToDate(company._id))}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 md:ml-auto md:flex-shrink-0">
                        <button
                          onClick={() => handleRevoke(company._id)}
                          className="flex items-center px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors shadow-sm"
                        >
                          <FaTimes className="mr-2" /> Deny Access
                        </button>
                        <button
                          onClick={()=> navigate(`/admin/jobs/${company._id}`)}
                          className="flex items-center px-4 py-2 bg-orange-primary text-white rounded hover:bg-purple-700 transition-colors shadow-sm"
                        >
                          <FaBuilding className="mr-2" /> Jobs
                        </button>
                        <button
                          onClick={()=> navigate(`/admin/messages/${company._id}`)}
                          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors shadow-sm"
                        >
                          <FaEnvelope className="mr-2" /> Messages
                        </button>
                        <button
                          onClick={()=> navigate(`/admin/applicants/${company._id}`)}
                          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors shadow-sm"
                        >
                          <FaUsers className="mr-2" /> Applicants
                        </button>
                      </div>
                    </div>
                  </div>
                  {expanded[company._id] && (
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className={`p-4 rounded-lg ${$isDarkMode ? "bg-gray-700" : "bg-gray-50"}`}>
                        <h4 className="font-medium mb-4 text-[#ff8200]">Contact Information</h4>
                        <div className="space-y-4">
                          <div className="flex items-center">
                            <FaEnvelope className="text-[#ff8200] mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                              <p className="font-medium break-all">{company.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center">
                            <FaPhone className="text-[#ff8200] mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Phone</p>
                              <p className="font-medium">{company.phone}</p>
                            </div>
                          </div>
                          <div className="flex items-center">
                            <FaGlobeAmericas className="text-[#ff8200] mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Website</p>
                              <p className="font-medium break-all">
                                {company.website ? (
                                  <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                    {company.website}
                                  </a>
                                ) : (
                                  "Not provided"
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className={`p-4 rounded-lg ${$isDarkMode ? "bg-gray-700" : "bg-gray-50"}`}>
                        <h4 className="font-medium mb-4 text-[#ff8200]">Company Details</h4>
                        <div className="flex items-center">
                          <FaBuilding className="text-[#ff8200] mr-3 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Industry</p>
                            <p className="font-medium">{company.industry || "Not specified"}</p>
                          </div>
                        </div>
                        
                        <div className="mt-4">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                          <div className="flex items-center mt-1">
                            <div className="h-2.5 w-2.5 rounded-full bg-green-500 mr-2"></div>
                            <p className="font-medium">Active Account</p>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Username</p>
                            <p className="font-medium break-all">{company.Username}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Company Type</p>
                            <p className="font-medium">{company.type || '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Company Size</p>
                            <p className="font-medium">{company.size || '—'}</p>
                          </div>
                          <div className="sm:col-span-2">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Address</p>
                            <p className="font-medium break-words">{company.address || '—'}</p>
                          </div>
                          {company.registrationNumber && (
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">CIN / Registration Number</p>
                              <p className="font-medium">{company.registrationNumber}</p>
                            </div>
                          )}
                          {(company.addressLine1 || company.addressLine2) && (
                            <div className="sm:col-span-2">
                              <p className="text-xs text-gray-500 dark:text-gray-400">Address (Lines)</p>
                              <p className="font-medium break-words">{company.addressLine1 || '—'}{company.addressLine2 ? `, ${company.addressLine2}` : ''}</p>
                            </div>
                          )}
                          {company.gstNumber && (
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">GST Number</p>
                              <p className="font-medium">{company.gstNumber}</p>
                            </div>
                          )}
                        </div>
                        {company.socialMediaLinks && (
                          <div className="mt-4">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Social</p>
                            <div className="flex flex-wrap gap-3 mt-1">
                              {company.socialMediaLinks.instagram && <a className="text-blue-500 hover:underline" href={company.socialMediaLinks.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>}
                              {company.socialMediaLinks.twitter && <a className="text-blue-500 hover:underline" href={company.socialMediaLinks.twitter} target="_blank" rel="noopener noreferrer">Twitter</a>}
                              {company.socialMediaLinks.linkedin && <a className="text-blue-500 hover:underline" href={company.socialMediaLinks.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a>}
                              {company.socialMediaLinks.youtube && <a className="text-blue-500 hover:underline" href={company.socialMediaLinks.youtube} target="_blank" rel="noopener noreferrer">YouTube</a>}
                            </div>
                          </div>
                        )}
                        {(company.documents || (Array.isArray(company.documentsList) && company.documentsList.length)) && (
                          <div className="mt-4">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Verification Document</p>
                            {Array.isArray(company.documentsList) && company.documentsList.length ? (
                              <ul className="list-disc pl-5 space-y-1">
                                {company.documentsList.map((u, i) => (
                                  <li key={i}><a href={u} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Document {i+1}</a></li>
                                ))}
                              </ul>
                            ) : company.documents ? (
                              <a href={company.documents} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline font-medium">View Document</a>
                            ) : null}
                          </div>
                        )}
                        {Array.isArray(company.images) && company.images.length > 0 && (
                          <div className="mt-4">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Images</p>
                            <div className="grid grid-cols-3 gap-2">
                              {company.images.slice(0,6).map((img, idx) => (
                                <a key={idx} href={img} target="_blank" rel="noopener noreferrer">
                                  <img src={img} alt={`img-${idx}`} className="h-16 w-full object-cover rounded border" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {company.description && (
                      <div className={`mt-6 p-4 rounded-lg ${$isDarkMode ? "bg-gray-700" : "bg-gray-50"}`}>
                        <h4 className="font-medium mb-2 text-[#ff8200]">Company Description</h4>
                        <div className="prose dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: company.description }} />
                      </div>
                    )}
                  </div>
                  )}
                  <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex justify-end">
                      {/* Grant one-time sensitive edit access */}
                      <GrantSensitiveEditButton company={company} $isDarkMode={$isDarkMode} onNotify={notify} />
                      <button
                        onClick={()=> toggleExpand(company._id)}
                        className={`text-sm font-medium underline ${$isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                      >
                        {expanded[company._id] ? 'View less' : 'View more'}
                      </button>
                    </div>
                  </div>
                </div>
              )); })()}
              {(() => { const pageSize = pageSizes.approved; const all = approvedCompanies.filter(c => c.approved === true && (c.status === 'approved' || c.status === undefined || c.status === null) && (!filters.q || (c.companyName?.toLowerCase().includes(filters.q.toLowerCase()) || c.email?.toLowerCase().includes(filters.q.toLowerCase()) || c.industry?.toLowerCase().includes(filters.q.toLowerCase())))); const total = Math.max(1, Math.ceil(all.length / pageSize)); return (
                <div className="mt-6 mb-8 w-full flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPages(p => ({ ...p, approved: Math.max(1, p.approved - 1) }))}
                    disabled={pages.approved === 1}
                    className={`inline-flex items-center px-3 py-1.5 rounded border text-sm ${pages.approved===1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-800'} ${$isDarkMode ? 'border-gray-600 text-gray-200' : 'border-gray-300 text-gray-800'}`}
                    aria-label="Previous page"
                  >
                    <FaChevronLeft className="mr-1 h-4 w-4" /> Prev
                  </button>
                  {Array.from({ length: total }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPages(p => ({ ...p, approved: i + 1 }))}
                      className={`px-3 py-1.5 rounded border text-sm ${pages.approved===i+1 ? 'bg-[#ff8200] text-white border-[#ff8200]' : $isDarkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-800' : 'border-gray-300 text-gray-800 hover:bg-gray-100'}`}
                      aria-current={pages.approved===i+1 ? 'page' : undefined}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setPages(p => ({ ...p, approved: Math.min(total, p.approved + 1) }))}
                    disabled={pages.approved === total}
                    className={`inline-flex items-center px-3 py-1.5 rounded border text-sm ${pages.approved===total ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-800'} ${$isDarkMode ? 'border-gray-600 text-gray-200' : 'border-gray-300 text-gray-800'}`}
                    aria-label="Next page"
                  >
                    Next <FaChevronRight className="ml-1 h-4 w-4" />
                  </button>
                </div>
              ); })()}
            </div>
          )}
        </>
      )}
      
      {/* Denied Companies Tab Content */}
      {activeTab === 'denied' && (
        <>
          {deniedCompanies.length === 0 ? (
            <div className={`text-center p-16 rounded-lg shadow-sm border ${$isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="mb-6 flex justify-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${$isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <FaTimes className="text-red-600 text-3xl" />
                </div>
              </div>
              <p className="text-xl font-medium">No denied companies</p>
              <p className={`text-sm mt-2 ${$isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Denied companies will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              <div className="flex justify-end items-center mb-2 text-sm">
                <span className="mr-2">Rows per page:</span>
                <select
                  className={`border rounded px-2 py-1 ${$isDarkMode ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-800'}`}
                  value={pageSizes.denied}
                  onChange={(e)=>{ const v = Number(e.target.value)||10; setPageSizes(ps=>({...ps, denied:v})); setPages(p=>({...p, denied:1})); }}
                >
                  {[10,25,50,100].map(n=> <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              {(() => { const pageSize = pageSizes.denied; const all = deniedCompanies.filter(c => !filters.q || (c.companyName?.toLowerCase().includes(filters.q.toLowerCase()) || c.email?.toLowerCase().includes(filters.q.toLowerCase()) || c.industry?.toLowerCase().includes(filters.q.toLowerCase()))); const page = pages.denied; const slice = all.slice((page-1)*pageSize, page*pageSize); return slice.map((company) => (
                <div key={company._id} className={`rounded-lg shadow-md ${$isDarkMode ? 'bg-gray-800' : 'bg-white'} transition-all hover:shadow-xl border ${$isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="sm:flex w-full sm:flex-col md:flex-row md:justify-between items-start md:items-center">
                      <div className="flex items-center md:flex-1 min-w-0 mb-4 md:mb-0">
                        <div className={`w-16 h-16 mr-4 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center border ${$isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}>
                          {company.logo ? (
                            <img src={company.logo} alt={company.companyName} className="w-full h-full object-cover" />
                          ) : (
                            <FaBuilding className="text-[#ff8200] text-xl" />
                          )}
                        </div>
                        <div>
                          <div className="flex gap-2">
                          <h3 className="text-2xl font-bold">{company.companyName}</h3>
                            <h2 className="mt-2">
                              <span className=" px-2 py-0.5 rounded text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Denied</span>
                            </h2>
                          </div>
                          <div className="flex items-center mt-1">
                            <FaCalendarAlt className="text-[#ff8200] mr-2" />
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              Applied on: {formatDate(formatObjectIdToDate(company._id))}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            <HighlightedText text={company.email} query={filters.q} $isDarkMode={$isDarkMode} />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 md:ml-auto md:flex-shrink-0">
                        <button
                          onClick={() => handleApproveFromDenied(company._id)}
                          className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm shadow-sm"
                        >
                          <FaCheck className="mr-2" /> Approve
                        </button>
                        <button
                          onClick={()=> navigate(`/admin/jobs/${company._id}`)}
                          className="flex items-center px-4 py-2 bg-orange-primary text-white rounded hover:bg-purple-700 transition-colors text-sm shadow-sm"
                        >
                          <FaBuilding className="mr-2" /> Jobs
                        </button>
                        <button
                          onClick={()=> navigate(`/admin/messages/${company._id}`)}
                          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm shadow-sm"
                        >
                          <FaEnvelope className="mr-2" /> Messages
                        </button>
                        <button
                          onClick={()=> navigate(`/admin/applicants/${company._id}`)}
                          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm shadow-sm"
                        >
                          <FaUsers className="mr-2" /> Applicants
                        </button>
                      </div>
                      {/* Mobile action bar */}
                      <div className="w-full md:hidden">
                        <div className="flex gap-4 pt-2">
                          <button
                            onClick={() => handleApproveFromDenied(company._id)}
                            className="flex-1 flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm shadow-sm"
                          >
                            <FaCheck className="mr-2" /> Approve
                          </button>
                          <button
                            onClick={()=> navigate(`/admin/messages/${company._id}`)}
                            className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm shadow-sm"
                          >
                            <FaEnvelope className="mr-2" /> Messages
                          </button>
                          <button
                            onClick={()=> navigate(`/admin/applicants/${company._id}`)}
                            className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm shadow-sm"
                          >
                            <FaUsers className="mr-2" /> Applicants
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  {expanded[company._id] && (
                  <div className="p-6 space-y-6">
                    {Array.isArray(company.adminMessages) && company.adminMessages.filter(m => m.type === 'deny').length > 0 ? (
                      <div className="text-sm">
                        <div className="font-medium mb-1">Reason</div>
                        <div className="p-3 rounded border bg-red-50 dark:bg-red-900/20 dark:border-red-700">
                          {company.adminMessages.filter(m => m.type === 'deny').slice(-1)[0].message}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm opacity-70">No reason provided.</div>
                    )}

                    {/* Contact & Details similar to other tabs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className={`p-4 rounded-lg ${$isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <h4 className="font-medium mb-4 text-[#ff8200]">Contact Information</h4>
                        <div className="space-y-4">
                          <div className="flex items-center">
                            <FaEnvelope className="text-[#ff8200] mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                              <p className="font-medium break-all">{company.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center">
                            <FaPhone className="text-[#ff8200] mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Phone</p>
                              <p className="font-medium">{company.phone || '—'}</p>
                            </div>
                          </div>
                          <div className="flex items-center">
                            <FaGlobeAmericas className="text-[#ff8200] mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Website</p>
                              <p className="font-medium break-all">{company.website ? <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{company.website}</a> : 'Not provided'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className={`p-4 rounded-lg ${$isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <h4 className="font-medium mb-4 text-[#ff8200]">Company Details</h4>
                        <div className="space-y-4">
                          <div className="flex items-center">
                            <FaBuilding className="text-[#ff8200] mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Industry</p>
                              <p className="font-medium">{company.industry || 'Not specified'}</p>
                            </div>
                          </div>
                          {(company.documents || (Array.isArray(company.documentsList) && company.documentsList.length)) && (
                            <div className="flex items-start">
                              <svg className="h-5 w-5 text-[#ff8200] mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Documents</p>
                                {Array.isArray(company.documentsList) && company.documentsList.length ? (
                                  <ul className="list-disc pl-5 space-y-1">
                                    {company.documentsList.map((u, i) => (
                                      <li key={i}><a href={u} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Document {i+1}</a></li>
                                    ))}
                                  </ul>
                                ) : company.documents ? (
                                  <a href={company.documents} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline font-medium">View Verification Documents</a>
                                ) : null}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Images gallery */}
                    {Array.isArray(company.images) && company.images.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Images</p>
                        <div className="grid grid-cols-3 gap-2 mt-1">
                          {company.images.slice(0,6).map((img, idx) => (
                            <a key={idx} href={img} target="_blank" rel="noopener noreferrer">
                              <img src={img} alt={`img-${idx}`} className="h-16 w-full object-cover rounded border" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {company.description && (
                      <div className={`p-4 rounded-lg ${$isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <h4 className="font-medium mb-2 text-[#ff8200]">Company Description</h4>
                        <div className="prose dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: company.description }} />
                      </div>
                    )}
                  </div>
                  )}
                  <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex justify-end">
                      <button
                        onClick={()=> toggleExpand(company._id)}
                        className={`text-sm font-medium underline ${$isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                      >
                        {expanded[company._id] ? 'View less' : 'View more'}
                      </button>
                    </div>
                  </div>
                </div>
              )); })()}
              {(() => { const pageSize = pageSizes.denied; const all = deniedCompanies.filter(c => !filters.q || (c.companyName?.toLowerCase().includes(filters.q.toLowerCase()) || c.email?.toLowerCase().includes(filters.q.toLowerCase()) || c.industry?.toLowerCase().includes(filters.q.toLowerCase()))); const total = Math.max(1, Math.ceil(all.length / pageSize)); return (
                <div className="mt-6 mb-8 w-full flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPages(p => ({ ...p, denied: Math.max(1, p.denied - 1) }))}
                    disabled={pages.denied === 1}
                    className={`inline-flex items-center px-3 py-1.5 rounded border text-sm ${pages.denied===1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-800'} ${$isDarkMode ? 'border-gray-600 text-gray-200' : 'border-gray-300 text-gray-800'}`}
                    aria-label="Previous page"
                  >
                    <FaChevronLeft className="mr-1 h-4 w-4" /> Prev
                  </button>
                  {Array.from({ length: total }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPages(p => ({ ...p, denied: i + 1 }))}
                      className={`px-3 py-1.5 rounded border text-sm ${pages.denied===i+1 ? 'bg-[#ff8200] text-white border-[#ff8200]' : $isDarkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-800' : 'border-gray-300 text-gray-800 hover:bg-gray-100'}`}
                      aria-current={pages.denied===i+1 ? 'page' : undefined}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setPages(p => ({ ...p, denied: Math.min(total, p.denied + 1) }))}
                    disabled={pages.denied === total}
                    className={`inline-flex items-center px-3 py-1.5 rounded border text-sm ${pages.denied===total ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-800'} ${$isDarkMode ? 'border-gray-600 text-gray-200' : 'border-gray-300 text-gray-800'}`}
                    aria-label="Next page"
                  >
                    Next <FaChevronRight className="ml-1 h-4 w-4" />
                  </button>
                </div>
              ); })()}
            </div>
          )}
        </>
      )}
      {/* On Hold Companies Tab Content */}
      {activeTab === 'hold' && (
        <>
          {holdCompanies.length === 0 ? (
            <div className={`text-center p-16 rounded-lg shadow-sm border ${$isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="mb-6 flex justify-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${$isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <FaClock className="text-yellow-600 text-3xl" />
                </div>
              </div>
              <p className="text-xl font-medium">No companies on hold</p>
              <p className={`text-sm mt-2 ${$isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Companies marked as on hold will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              <div className="flex justify-end items-center mb-2 text-sm">
                <span className="mr-2">Rows per page:</span>
                <select
                  className={`border rounded px-2 py-1 ${$isDarkMode ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-800'}`}
                  value={pageSizes.hold}
                  onChange={(e)=>{ const v = Number(e.target.value)||10; setPageSizes(ps=>({...ps, hold:v})); setPages(p=>({...p, hold:1})); }}
                >
                  {[10,25,50,100].map(n=> <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              {(() => { const pageSize = pageSizes.hold; const all = holdCompanies.filter(c => !filters.q || (c.companyName?.toLowerCase().includes(filters.q.toLowerCase()) || c.email?.toLowerCase().includes(filters.q.toLowerCase()) || c.industry?.toLowerCase().includes(filters.q.toLowerCase()))); const page = pages.hold; const slice = all.slice((page-1)*pageSize, page*pageSize); return slice.map((company) => (
                <div key={company._id} className={`rounded-lg shadow-md ${$isDarkMode ? 'bg-gray-800' : 'bg-white'} transition-all hover:shadow-xl border ${$isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center border ${$isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}>
                          {company.logo ? (
                            <img src={company.logo} alt={company.companyName} className="w-full h-full object-cover" />
                          ) : (
                            <FaBuilding className="text-[#ff8200] text-xl" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold">
                              <HighlightedText text={company.companyName} query={filters.q} $isDarkMode={$isDarkMode} />
                            </h3>
                            <span className="px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">On Hold</span>
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            <HighlightedText text={company.email} query={filters.q} $isDarkMode={$isDarkMode} />
                          </div>
                        </div>
                      </div>
                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-4">
                        <button
                          onClick={() => handleApproveFromHold(company._id)}
                          className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm shadow-sm"
                        >
                          <FaCheck className="mr-2" /> Approve
                        </button>
                        <button
                          onClick={() => openReasonModal('deny', company)}
                          className="flex items-center px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm shadow-sm"
                        >
                          <FaTimes className="mr-2" /> Deny
                        </button>
                        <button
                          onClick={()=> navigate(`/admin/jobs/${company._id}`)}
                          className="flex items-center px-4 py-2 bg-orange-primary text-white rounded hover:bg-purple-700 transition-colors text-sm shadow-sm"
                        >
                          <FaBuilding className="mr-2" /> Jobs
                        </button>
                        <button
                          onClick={()=> navigate(`/admin/messages/${company._id}`)}
                          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm shadow-sm"
                        >
                          <FaEnvelope className="mr-2" /> Messages
                        </button>
                        <button
                          onClick={()=> navigate(`/admin/applicants/${company._id}`)}
                          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm shadow-sm"
                        >
                          <FaUsers className="mr-2" /> Applicants
                        </button>
                      </div>
                    </div>
                  </div>
                  {expanded[company._id] && (
                  <div className="p-6 space-y-6">
                    {/* Reason block */}
                    <div>
                      {Array.isArray(company.adminMessages) && company.adminMessages.filter(m => m.type === 'hold').length > 0 ? (
                        <div className="text-sm">
                          <div className="font-medium mb-1">Reason</div>
                          <div className="p-3 rounded border bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700">
                            {company.adminMessages.filter(m => m.type === 'hold').slice(-1)[0].message}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm opacity-70">No reason provided.</div>
                      )}
                    </div>
                    {/* Contact & Details similar to pending */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className={`p-4 rounded-lg ${$isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <h4 className="font-medium mb-4 text-[#ff8200]">Contact Information</h4>
                        <div className="space-y-4">
                          <div className="flex items-center">
                            <FaEnvelope className="text-[#ff8200] mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                              <p className="font-medium break-all">{company.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center">
                            <FaPhone className="text-[#ff8200] mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Phone</p>
                              <p className="font-medium">{company.phone || '—'}</p>
                            </div>
                          </div>
                          <div className="flex items-center">
                            <FaGlobeAmericas className="text-[#ff8200] mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Website</p>
                              <p className="font-medium break-all">{company.website ? <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{company.website}</a> : 'Not provided'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className={`p-4 rounded-lg ${$isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <h4 className="font-medium mb-4 text-[#ff8200]">Company Details</h4>
                        <div className="space-y-4">
                          <div className="flex items-center">
                            <FaBuilding className="text-[#ff8200] mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Industry</p>
                              <p className="font-medium">{company.industry || 'Not specified'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Status:</span>
                            <span className="px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">On Hold</span>
                          </div>
                          {(company.documents || (Array.isArray(company.documentsList) && company.documentsList.length)) && (
                            <div className="flex items-start">
                              <svg className="h-5 w-5 text-[#ff8200] mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Documents</p>
                                {Array.isArray(company.documentsList) && company.documentsList.length ? (
                                  <ul className="list-disc pl-5 space-y-1">
                                    {company.documentsList.map((u, i) => (
                                      <li key={i}><a href={u} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Document {i+1}</a></li>
                                    ))}
                                  </ul>
                                ) : company.documents ? (
                                  <a href={company.documents} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline font-medium">View Verification Documents</a>
                                ) : null}
                              </div>
                            </div>
                          )}
                          {Array.isArray(company.images) && company.images.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Images</p>
                              <div className="grid grid-cols-3 gap-2">
                                {company.images.slice(0,6).map((img, idx) => (
                                  <a key={idx} href={img} target="_blank" rel="noopener noreferrer">
                                    <img src={img} alt={`img-${idx}`} className="h-16 w-full object-cover rounded border" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {company.description && (
                      <div className={`p-4 rounded-lg ${$isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <h4 className="font-medium mb-2 text-[#ff8200]">Company Description</h4>
                        <div className="prose dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: company.description }} />
                      </div>
                    )}
                  </div>
                  )}
                  <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex justify-end">
                      <button
                        onClick={()=> toggleExpand(company._id)}
                        className={`text-sm font-medium underline ${$isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                      >
                        {expanded[company._id] ? 'View less' : 'View more'}
                      </button>
                    </div>
                  </div>
                </div>
              )); })()}
              {(() => { const pageSize = pageSizes.hold; const all = holdCompanies.filter(c => !filters.q || (c.companyName?.toLowerCase().includes(filters.q.toLowerCase()) || c.email?.toLowerCase().includes(filters.q.toLowerCase()) || c.industry?.toLowerCase().includes(filters.q.toLowerCase()))); const total = Math.max(1, Math.ceil(all.length / pageSize)); return (
                <div className="mt-6 mb-8 w-full flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPages(p => ({ ...p, hold: Math.max(1, p.hold - 1) }))}
                    disabled={pages.hold === 1}
                    className={`inline-flex items-center px-3 py-1.5 rounded border text-sm ${pages.hold===1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-800'} ${$isDarkMode ? 'border-gray-600 text-gray-200' : 'border-gray-300 text-gray-800'}`}
                    aria-label="Previous page"
                  >
                    <FaChevronLeft className="mr-1 h-4 w-4" /> Prev
                  </button>
                  {Array.from({ length: total }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPages(p => ({ ...p, hold: i + 1 }))}
                      className={`px-3 py-1.5 rounded border text-sm ${pages.hold===i+1 ? 'bg-[#ff8200] text-white border-[#ff8200]' : $isDarkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-800' : 'border-gray-300 text-gray-800 hover:bg-gray-100'}`}
                      aria-current={pages.hold===i+1 ? 'page' : undefined}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setPages(p => ({ ...p, hold: Math.min(total, p.hold + 1) }))}
                    disabled={pages.hold === total}
                    className={`inline-flex items-center px-3 py-1.5 rounded border text-sm ${pages.hold===total ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-800'} ${$isDarkMode ? 'border-gray-600 text-gray-200' : 'border-gray-300 text-gray-800'}`}
                    aria-label="Next page"
                  >
                    Next <FaChevronRight className="ml-1 h-4 w-4" />
                  </button>
                </div>
              ); })()}
            </div>
          )}
        </>
      )}
      {/* Profile Tab Content */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          {/* Admin Info Card */}
          <div className={`p-8 rounded-lg shadow-sm ${$isDarkMode ? "bg-gray-800" : "bg-white"}`}>
            <div className="flex flex-col items-center">
              <div className="flex flex-col items-center mb-6">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                  <FaUserCircle className="text-[#ff8200] text-6xl" />
                </div>
                <h3 className="text-2xl font-bold mt-3">{admin?.firstName || 'System'} {admin?.lastName || 'Admin'}</h3>
                <p className={`text-sm ${$isDarkMode ? "text-gray-400" : "text-gray-600"}`}>{admin?.email}</p>
                <div className="mt-2">
                  <span className="text-sm bg-[#ff8200] text-white px-3 py-1 rounded-full inline-block">
                    {admin?.role === 'super_admin' ? 'Super Admin' : admin?.role === 'moderator' ? 'Moderator' : 'Admin'}
                  </span>
                </div>
              </div>
              
              <div className="w-full max-w-3xl">
                <div className={`p-4 rounded-lg ${$isDarkMode ? "bg-gray-700" : "bg-gray-100"}`}>
                  <h4 className="font-semibold mb-2 flex items-center">
                    <FaKey className="mr-2 text-[#ff8200]" /> Account Security
                  </h4>
                  <p className="text-sm">Keeping your password secure is important for maintaining the security of the admin portal.</p>
                  
                  <div className="mt-4">
                    <h4 className="font-semibold mb-2 flex items-center">
                      <FaLock className="mr-2 text-[#ff8200]" /> Password Guidelines
                    </h4>
                    <ul className="text-sm list-disc pl-5 space-y-1">
                      <li>Use at least 8 characters</li>
                      <li>Include uppercase and lowercase letters</li>
                      <li>Add numbers and special characters</li>
                      <li>Avoid using obvious information</li>
                      <li>Don&#39;t reuse passwords from other sites</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Change Password Card */}
          <div className={`p-8 rounded-lg shadow-sm ${$isDarkMode ? "bg-gray-800" : "bg-white"}`}>
            <h3 className="text-xl font-bold mb-4 flex items-center">
              <FaKey className="mr-2 text-[#ff8200]" /> Change Password
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Regularly updating your password helps maintain security. Your new password must be at least 6 characters long.
            </p>
            
            {passwordError && (
              <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 p-4 rounded mb-6 flex items-start">
                <div className="flex-shrink-0 mr-2 mt-0.5">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  {passwordError}
                </div>
              </div>
            )}
            
            <form onSubmit={handlePasswordChange} className="max-w-lg">
              <div className="mb-4">
                <label htmlFor="currentPassword" className="block text-sm font-medium mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={`w-full px-4 py-3 border rounded ${$isDarkMode ? "bg-gray-700 border-gray-600" : "bg-white border-gray-300"}`}
                    required
                  />
                  <FaLock className="absolute right-3 top-3.5 text-gray-400" />
                </div>
              </div>
              
              <div className="mb-4">
                <label htmlFor="newPassword" className="block text-sm font-medium mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`w-full px-4 py-3 border rounded ${$isDarkMode ? "bg-gray-700 border-gray-600" : "bg-white border-gray-300"}`}
                    required
                    minLength="6"
                  />
                  <FaLock className="absolute right-3 top-3.5 text-gray-400" />
                </div>
              </div>
              
              <div className="mb-6">
                <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full px-4 py-3 border rounded ${$isDarkMode ? "bg-gray-700 border-gray-600" : "bg-white border-gray-300"}`}
                    required
                    minLength="6"
                  />
                  <FaLock className="absolute right-3 top-3.5 text-gray-400" />
                </div>
              </div>
              
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3 px-4 rounded font-medium text-white flex items-center justify-center ${
                  isLoading 
                    ? "bg-gray-400 cursor-not-allowed" 
                    : "bg-[#ff8200] hover:bg-[#e67600] transition-colors"
                }`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Updating...
                  </>
                ) : (
                  <>
                    <FaKey className="mr-2" /> Change Password
                  </>
                )}
              </button>
            </form>
            
            <div className="mt-6 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="flex items-center">
                <svg className="h-4 w-4 mr-2 text-[#ff8200]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                For security reasons, you&#39;ll need to enter your current password before setting a new one.
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Jobs tab removed: use sidebar navigation to dedicated Jobs route */}

          {/* Reason Modal */}
          {reasonModal.open && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className={`w-full max-w-md rounded-lg shadow-lg ${$isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
                <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold">
                    {reasonModal.mode === 'hold' ? 'Put Company on Hold' : 'Deny Company Registration'}
                  </h3>
                </div>
                <div className="px-5 py-4 space-y-3">
                  <div className="text-sm opacity-80">
                    {reasonModal.mode === 'hold'
                      ? 'Please provide a reason. The company will be able to log in but cannot post jobs.'
                      : 'Please provide a reason. The company will not be able to log in and will receive an email notification.'}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Reason</label>
                    <textarea
                      rows={4}
                      value={reasonModal.reason}
                      onChange={(e) => setReasonModal(s => ({ ...s, reason: e.target.value }))}
                      className={`w-full rounded border px-3 py-2 ${$isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                      placeholder="Enter a clear, actionable reason..."
                    />
                  </div>
                </div>
                <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setReasonModal({ open: false, mode: null, company: null, reason: '' })}
                    className={`px-4 py-2 rounded ${$isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitReasonModal}
                    className={`px-4 py-2 rounded text-white ${reasonModal.mode === 'hold' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-red-600 hover:bg-red-700'}`}
                    disabled={!reasonModal.reason.trim()}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          )}
          {filterModal && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
              <div className={`w-full max-w-md rounded-lg shadow-lg ${$isDarkMode? 'bg-gray-800 text-white':'bg-white text-gray-900'}`}>
                <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Filters</h3>
                  <button onClick={()=>setFilterModal(false)} className="text-sm opacity-70 hover:opacity-100">✕</button>
                </div>
                <div className="px-5 py-5 space-y-5">
                  <div>
                    <label className="block text-sm font-medium mb-1">Search</label>
                    <input value={filters.q} onChange={e=>setFilters(s=>({...s,q:e.target.value}))} placeholder="Name / Email / Industry" className={`w-full rounded border px-3 py-2 ${$isDarkMode? 'bg-gray-700 border-gray-600':'bg-white border-gray-300'}`} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Sort By</label>
                      <select value={filters.sort} onChange={e=>setFilters(s=>({...s,sort:e.target.value}))} className={`w-full rounded border px-3 py-2 ${$isDarkMode? 'bg-gray-700 border-gray-600':'bg-white border-gray-300'}`}>
                        <option value="updatedAt">Updated</option>
                        <option value="name">Name</option>
                        <option value="status">Status</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Order</label>
                      <select value={filters.order} onChange={e=>setFilters(s=>({...s,order:e.target.value}))} className={`w-full rounded border px-3 py-2 ${$isDarkMode? 'bg-gray-700 border-gray-600':'bg-white border-gray-300'}`}>
                        <option value="desc">Descending</option>
                        <option value="asc">Ascending</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
                  <button onClick={()=>setFilters({ q:'', sort:'updatedAt', order:'desc' })} className={`px-4 py-2 rounded ${$isDarkMode? 'bg-gray-700 hover:bg-gray-600':'bg-gray-100 hover:bg-gray-200'}`}>Reset</button>
                  <button onClick={()=>setFilterModal(false)} className="px-4 py-2 rounded bg-[#ff8200] text-white hover:bg-[#e57400]">Apply</button>
                </div>
              </div>
            </div>
          )}
      </div>
      
    </div>
  );
};

AdminPortal.propTypes = {
  isDarkMode: PropTypes.bool,
  $isDarkMode: PropTypes.bool,
  onThemeToggle: PropTypes.func
};

export default AdminPortal;
