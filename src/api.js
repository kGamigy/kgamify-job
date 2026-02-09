import axios from 'axios';
import { config } from './config/env.js';
import backoff from './utils/backoff.js';

const API_URL = config.API_URL;
const AI_API_URL = config.AI_API_URL;

// Create a custom axios instance with default settings
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true // Include credentials in cross-origin requests
});

export const registerCompany = async (formData) => {
  const response = await axios.post(`${API_URL}/companies`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    validateStatus(status) { return status < 500; }
  });
  if (response.status === 400) {
    throw new Error(response.data.error || 'Registration failed');
  }
  return response.data;
};

export const loginCompany = async (loginData) => {
  try {
    // Ensure payload has 'identifier' field for backend compatibility
    const payload = {
      identifier: loginData.identifier || loginData.email,
      password: loginData.password
    };
    
    if (!payload.identifier || !payload.password) {
      throw { error: 'Email and password are required' };
    }
    
    const response = await apiClient.post('/companies/login', payload);
    
    // Only process successful responses
    if (response.status !== 200) {
      throw response.data || { error: 'Login failed' };
    }
    
    // Store the company data and token
    if (response.data.token) {
      localStorage.setItem('companyToken', response.data.token);
    }
    if (response.data.company) {
      localStorage.setItem('companyData', JSON.stringify(response.data.company));
      localStorage.setItem('companyType', response.data.company.companyType || 'company');
    }
    
    return response.data;
  } catch (error) {
    // Handle network errors
    if (error.code === 'ERR_NETWORK') {
      throw { error: 'Network error. Please check your connection and try again.' };
    }
    
    // Handle specific HTTP status codes
    if (error.response?.status === 403) {
      throw error.response.data || { error: 'Your email is not verified' };
    } else if (error.response?.status === 401) {
      throw { error: 'Invalid email or password' };
    } else if (error.response?.status === 404) {
      throw { error: 'Company not found. Please register first.' };
    } else if (error.response?.status === 400) {
      throw error.response.data || { error: 'Invalid request' };
    } else if (error.response?.status >= 500) {
      throw { error: 'Server error. Please try again later.' };
    } else {
      throw error.response?.data || { error: 'An error occurred during login' };
    }
  }
};

export const createApplication = async (applicationData) => {
  // If it contains a file, we need to use FormData
  if (applicationData.resume instanceof File) {
    const dataToSend = new FormData();
    // Add all fields to FormData
    Object.keys(applicationData).forEach(key => {
      dataToSend.append(key, applicationData[key]);
    });
    const response = await axios.post(`${API_URL}/application`, dataToSend, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }
  // Regular JSON submission (no files)
  const response = await axios.post(`${API_URL}/application`, applicationData);
  return response.data;
};

export const getApplication = async (id, email) => {
  const response = await axios.get(`${API_URL}/application/${id}`, { params: { email } });
  return response.data;
};

export const createJob = async (jobData, options = {}) => {
  const isFormData = typeof FormData !== 'undefined' && jobData instanceof FormData;
  const headers = options.headers || (isFormData ? { 'Content-Type': 'multipart/form-data' } : { 'Content-Type': 'application/json' });
  const response = await axios.post(`${API_URL}/job`, jobData, { headers });
  return response.data;
};

export const getJobs = async (filters = {}) => {
  const qp = new URLSearchParams();
  if (filters?.email) qp.set('email', filters.email);
  if (filters?.includeInactive) qp.set('includeInactive', 'true');
  // Add cache-busting param to avoid 304 + stale empty list issues
  qp.set('_cb', Date.now().toString());
  const requestUrl = `${API_URL}/job${qp.toString() ? `?${qp.toString()}` : ''}`;
  const response = await axios.get(requestUrl, {
    // Explicitly disable caching layers where possible
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  });
  return response.data;
};

export const getJobById = async (jobId) => {
  const response = await axios.get(`${API_URL}/job/${jobId}`);
  return response.data;
};

export const getCompanyInfo = async (email) => {
  if (!email) { throw new Error("Email is required"); }
  // Try to get from localStorage first for better performance
  const cachedCompanyData = localStorage.getItem('companyData');
  if (cachedCompanyData) {
    try {
      const parsedData = JSON.parse(cachedCompanyData);
      if (parsedData.email === email) {
        return parsedData;
      }
    } catch {
      // ignore parse errors
    }
  }
  // If not in cache, fetch from API
  const response = await axios.get(`${API_URL}/companies/info?email=${encodeURIComponent(email)}`);
  // Update the cache
  localStorage.setItem('companyData', JSON.stringify(response.data));
  return response.data;
};

// Company messaging (chat-like)
export const getCompanyMessages = async (email, page = null, limit = null) => {
  if (!email) throw new Error('Email required');
  const token = sessionStorage.getItem('companyToken') || localStorage.getItem('companyToken');
  const headers = {};
  if (token) headers['company-auth'] = token;
  
  // Build params object, only include pagination if explicitly provided
  const params = { email };
  if (page !== null) params.page = page;
  if (limit !== null) params.limit = limit;
  
  const response = await axios.get(`${API_URL}/companies/messages`, { params, headers });
  return response.data;
};

export const sendCompanyMessage = async (email, message, files = []) => {
  if (!email) throw new Error('Email required');
  const token = sessionStorage.getItem('companyToken') || localStorage.getItem('companyToken');
  const headers = {};
  if (token) headers['company-auth'] = token;
  // Build multipart if files exist
  const clientId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  if (files && files.length) {
    const fd = new FormData();
    fd.append('email', email);
    if (message) fd.append('message', message);
    fd.append('clientId', clientId);
    [...files].forEach(f => fd.append('attachments', f));
    const response = await axios.post(`${API_URL}/companies/messages`, fd, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
    return { ...response.data, clientId };
  }
  const response = await axios.post(`${API_URL}/companies/messages`, { email, message, clientId }, { headers });
  return { ...response.data, clientId };
};

// Admin messaging helpers
export const getAdminCompanyMessages = async (companyId) => {
  const token = localStorage.getItem('adminToken');
  const response = await axios.get(`${API_URL}/admin/company/${companyId}/messages`, { headers: token ? { 'x-auth-token': token } : undefined });
  return response.data;
};

export const sendAdminCompanyMessage = async (companyId, message, files = []) => {
  const token = localStorage.getItem('adminToken');
  const clientId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  if (files && files.length) {
    const fd = new FormData();
    fd.append('message', message || '');
    fd.append('clientId', clientId);
    [...files].forEach(f => fd.append('attachments', f));
    const response = await axios.post(`${API_URL}/admin/company/${companyId}/messages`, fd, { headers: token ? { 'x-auth-token': token } : undefined });
    return { ...response.data, clientId };
  }
  const response = await axios.post(`${API_URL}/admin/company/${companyId}/messages`, { message, clientId }, { headers: token ? { 'x-auth-token': token } : undefined });
  return { ...response.data, clientId };
};

export const editJob = async (jobId, jobData) => {
  const isFormData = typeof FormData !== 'undefined' && jobData instanceof FormData;
  const headers = isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined;
  const response = await axios.put(`${API_URL}/job/${jobId}`, jobData, { headers });
  return response.data;
};

export const deleteJob = async (jobId) => {
  const response = await axios.delete(`${API_URL}/job/${jobId}`);
  return response.data;
};

export const toggleJobActive = async (jobId, jobActive, email) => {
  const response = await axios.patch(`${API_URL}/job/${jobId}/toggle-active`, { jobActive, email }, { headers: { 'Content-Type': 'application/json' } });
  return response.data;
};

// --- Admin Job Management ---
export const adminListCompanyJobs = async (companyId) => {
  const token = localStorage.getItem('adminToken');
  const res = await axios.get(`${API_URL}/admin/company/${companyId}/jobs`, { headers: token ? { 'x-auth-token': token } : undefined });
  return res.data;
};

export const adminToggleJobStatus = async (jobId, jobActive) => {
  const token = localStorage.getItem('adminToken');
  const res = await axios.patch(`${API_URL}/admin/job/${jobId}/status`, { jobActive }, { headers: token ? { 'x-auth-token': token } : undefined });
  return res.data;
};

export const adminDeleteJob = async (jobId) => {
  const token = localStorage.getItem('adminToken');
  const res = await axios.delete(`${API_URL}/admin/job/${jobId}`, { headers: token ? { 'x-auth-token': token } : undefined });
  return res.data;
};

export const getPendingCompanies = async () => {
  const response = await axios.get(`${API_URL}/admin/pending-companies`);
  return response.data;
};

export const approveCompany = async (companyId) => {
  const token = localStorage.getItem('adminToken');
  const response = await axios.post(`${API_URL}/admin/approve-company/${companyId}`, {}, { headers: token ? { 'x-auth-token': token } : undefined });
  return response.data;
};

export const denyCompany = async (companyId) => {
  const token = localStorage.getItem('adminToken');
  const response = await axios.post(`${API_URL}/admin/deny-company/${companyId}`, {}, {
    headers: token ? { 'x-auth-token': token } : undefined
  });
  return response.data;
};

export const denyCompanyWithReason = async (companyId, reason) => {
  const token = localStorage.getItem('adminToken');
  const response = await axios.post(`${API_URL}/admin/deny-company/${companyId}`, { reason }, {
    headers: token ? { 'x-auth-token': token } : undefined
  });
  return response.data;
};

export const holdCompanyWithReason = async (companyId, reason) => {
  const token = localStorage.getItem('adminToken');
  const response = await axios.post(`${API_URL}/admin/hold-company/${companyId}`, { reason }, {
    headers: token ? { 'x-auth-token': token } : undefined
  });
  return response.data;
};

export const revokeCompanyAccess = async (companyId, reason) => {
  const token = localStorage.getItem('adminToken');
  const response = await axios.post(`${API_URL}/admin/revoke-access/${companyId}`, { reason }, {
    headers: token ? { 'x-auth-token': token } : undefined
  });
  return response.data;
};

export const grantSensitiveEdit = async (companyId) => {
  const token = localStorage.getItem('adminToken');
  const response = await axios.post(`${API_URL}/admin/grant-sensitive-edit/${companyId}`, {}, {
    headers: token ? { 'x-auth-token': token } : undefined
  });
  return response.data;
};

export const revokeSensitiveEdit = async (companyId) => {
  const token = localStorage.getItem('adminToken');
  const response = await axios.post(`${API_URL}/admin/revoke-sensitive-edit/${companyId}`, {}, {
    headers: token ? { 'x-auth-token': token } : undefined
  });
  return response.data;
};

export const adminLogin = async (loginData) => {
  try {
    const response = await axios.post(`${API_URL}/admin/login`, loginData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const updateCompanyProfile = async (email, formData) => {
  const response = await axios.put(`${API_URL}/companies/update/${email}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    validateStatus(status) { return status < 500; }
  });
  if (response.status === 400) {
    throw new Error(response.data.error || 'Update failed');
  }
  return response.data;
};

export const deleteCompanyDocument = async (email, { index, url }) => {
  const params = new URLSearchParams();
  if (typeof index !== 'undefined') params.set('index', String(index));
  if (url) params.set('url', url);
  const res = await axios.delete(`${API_URL}/companies/update/${encodeURIComponent(email)}/document?${params.toString()}`);
  return res.data;
};

export const deleteCompanyImage = async (email, { index, url }) => {
  const params = new URLSearchParams();
  if (typeof index !== 'undefined') params.set('index', String(index));
  if (url) params.set('url', url);
  const res = await axios.delete(`${API_URL}/companies/update/${encodeURIComponent(email)}/image?${params.toString()}`);
  return res.data;
};

export const requestPasswordReset = async (email) => {
  const response = await axios.post(`${API_URL}/auth/forgot-password`, { email });
  return response.data;
};

// Verify OTP to obtain a short-lived reset token
export const verifyOtp = async (email, code) => {
  const response = await axios.post(`${API_URL}/auth/verify-otp`, { email, code });
  return response.data;
};

export const resetPassword = async (token, email, password) => {
  const response = await axios.post(`${API_URL}/auth/reset-password`, { token, email, password });
  return response.data;
};

export const changeAdminPassword = async (currentPassword, newPassword) => {
  try {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      throw new Error("No authentication token found. Please login again.");
    }
    
    const response = await axios.post(
      `${API_URL}/admin-management/change-password`,
      { currentPassword, newPassword },
      {
        headers: {
          "x-auth-token": token
        }
      }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const getApplicationsByJobId = async (jobId) => {
  try {
    // Get email from localStorage for authentication
    let email = localStorage.getItem("rememberedEmail");
    if (!email) {
      // Fallback to companyData if available
      try {
        const cd = JSON.parse(localStorage.getItem("companyData") || "null");
        if (cd?.email) email = cd.email;
      } catch { /* ignore */ }
    }
    
  if (!email) { throw new Error('Authentication required to view applications'); }
    
    
    // Add email to both headers and query params to ensure it's properly sent
    // Add retry logic in case of initial failure
    let retries = 0;
    const maxRetries = 2;
    let response;
    
  while (retries <= maxRetries) {
      try {
        response = await axios.get(`${API_URL}/application/job/${jobId}`, {
          headers: {
            'company-email': email,
            'Authorization': `Bearer ${localStorage.getItem("token") || ""}`
          },
          params: {
            email
          }
        });
        
        // If we got a response, break out of retry loop
        break;
  } catch (requestError) {
        retries++;
        
        // If we've used all retries, throw the error
        if (retries > maxRetries) throw requestError;
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      }
    }
    
  if (!Array.isArray(response?.data)) {
      // Convert to array if needed
      response.data = Array.isArray(response?.data) ? response.data : [];
    }
    
    return response.data;
  } catch (error) {
    
    // More helpful error message based on error type
    if (error.response?.status === 400) {
      // Authentication error
    } else if (error.response?.status === 403) {
      // Permission denied
    }
    
    // Return empty array instead of throwing to avoid UI errors
    return [];
  }
};

// Get all applications for a company by email (aggregated)
export const getApplicationsForCompany = async (email) => {
  if (!email) throw new Error('Email is required');
  const response = await axios.get(`${API_URL}/application/company`, {
    headers: { 'company-email': email },
    params: { email },
  });
  return response.data;
};

// Application status updates
export const shortlistApplication = async (applicationId) => {
  const email = localStorage.getItem('rememberedEmail') || (JSON.parse(localStorage.getItem('companyData') || 'null')?.email || undefined);
  const response = await axios.post(`${API_URL}/application/${applicationId}/shortlist`, {}, { headers: email ? { 'company-email': email } : undefined });
  return response.data;
};

export const rejectApplication = async (applicationId) => {
  const email = localStorage.getItem('rememberedEmail') || (JSON.parse(localStorage.getItem('companyData') || 'null')?.email || undefined);
  const response = await axios.post(`${API_URL}/application/${applicationId}/reject`, {}, { headers: email ? { 'company-email': email } : undefined });
  return response.data;
};

// AI recommendations for a job
export const getRecommendationsForJob = async (jobId, topN = 5) => {
  const response = await axios.get(`${AI_API_URL}/recommend`, {
    params: { job_id: jobId, top_n: topN },
    withCredentials: false
  });
  const recs = response.data?.recommendations || [];
  // Normalize to always include .name for UI
  return recs.map(r => ({
    ...r,
    name: r.applicantName || r.name || 'N/A'
  }));
};

export async function registerBasic(data) {
  const res = await fetch(`${API_URL}/auth/register-basic`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || 'Register failed');
  return j;
}

export async function verifySignupOtp(email, code) {
  try {
    const response = await apiClient.post('/auth/verify-signup-otp', { email, code });
    return response.data;
  } catch (error) {
    const apiError = error.response?.data?.error || error.response?.data?.message;
    throw new Error(apiError || 'OTP verification failed');
  }
}

export async function resendSignupOtp(email) {
  try {
    const response = await apiClient.post('/auth/resend-signup-otp', { email });
    return response.data;
  } catch (error) {
    const apiError = error.response?.data?.error || error.response?.data?.message;
    throw new Error(apiError || 'Failed to resend OTP');
  }
}

// Subscription & profile helpers (company routes mounted at /api/companies)

export async function chooseSubscription(email, plan) {
  if (!email) throw new Error('email required');
  const result = await backoff(() => apiClient.post('/companies/subscription/choose', { email, plan }));
  // Refresh company info
  let updated;
  try { updated = await getCompanyInfo(email); } catch { /* ignore */ }
  return { ...result.data, company: updated };
}

export async function completeProfile(formData) {
  const email = formData?.get?.('email');
  const result = await backoff(() => apiClient.post('/companies/profile/complete', formData, { headers: { 'Content-Type': 'multipart/form-data' } }));
  // Optionally refresh cached company
  if (email) {
    try { const c = await getCompanyInfo(email); return { ...result.data, company: c }; } catch { /* ignore */ }
  }
  return result.data;
}

// ---------------- Notifications (in-app) ----------------
// Backend currently sends emails; this client layer will consume future API endpoints for in-app notifications.
// We implement graceful fallbacks so UI can adopt dynamic data incrementally.

export async function fetchNotifications(email, opts = {}) {
  if (!email) return [];
  try {
    const res = await fetch(`${API_URL}/notifications/list?email=${encodeURIComponent(email)}${opts.after ? `&after=${encodeURIComponent(opts.after)}` : ''}`);
    if (!res.ok) return [];
    const data = await res.json();
    // Normalize shape: [{ id, message, createdAt, read }]
    if (Array.isArray(data)) {
      return data.map(n => ({
        id: n.id || n._id || n.createdAt,
        message: n.message || n.text || 'Notification',
        createdAt: n.createdAt || n.timestamp || new Date().toISOString(),
        read: !!(n.read || n.seen),
        type: n.type || 'info'
      }));
    }
    return [];
  } catch {
    return [];
  }
}

export async function markNotificationsRead(email, ids = []) {
  if (!email || !ids.length) return { success: false };
  try {
    const res = await fetch(`${API_URL}/notifications/mark-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, ids })
    });
    if (!res.ok) return { success: false };
    return await res.json();
  } catch {
    return { success: false };
  }
}

export async function markAllNotificationsRead(email) {
  if (!email) return { success: false };
  try {
    const res = await fetch(`${API_URL}/notifications/mark-all-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (!res.ok) return { success: false };
    return await res.json();
  } catch {
    return { success: false };
  }
}

// ---------------- Payments (Razorpay) ----------------
export async function getPaymentConfig() {
  const res = await fetch(`${API_URL}/payments/config`);
  if (!res.ok) throw new Error('Failed to load payment config');
  return res.json();
}

export async function createPaymentOrder(email, plan) {
  const res = await fetch(`${API_URL}/payments/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, plan })
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || 'Failed to create order');
  return j; // { orderId, amount, currency, keyId }
}

export async function verifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature, email, plan }) {
  const res = await fetch(`${API_URL}/payments/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ razorpay_order_id, razorpay_payment_id, razorpay_signature, email, plan })
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || 'Payment verification failed');
  return j;
}

export async function getSubscriptionHistory(email) {
  const res = await fetch(`${API_URL}/companies/subscription/history?email=${encodeURIComponent(email)}`);
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || 'Failed to load subscription history');
  return j;
}

// ---- New subscription helpers for updated plan system ----
// Activate free plan (no payment)
export async function selectFreePlan(email) {
  if (!email) throw new Error('email required');
  const res = await fetch(`${API_URL}/companies/subscription/select-free`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || 'Failed to activate free plan');
  return j; // { message, plan, jobLimit }
}

// Upgrade to a higher duration plan immediately
export async function upgradeSubscription(email, plan) {
  if (!email || !plan) throw new Error('email and plan required');
  const res = await fetch(`${API_URL}/companies/subscription/upgrade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, plan })
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || 'Upgrade failed');
  return j; // { message, plan, invoiceId, startAt, endAt }
}

// Renew the current paid plan (repeat)
export async function repeatSubscription(email) {
  if (!email) throw new Error('email required');
  const res = await fetch(`${API_URL}/companies/subscription/repeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || 'Renewal failed');
  return j; // { message, plan, invoiceId, startAt, endAt }
}
