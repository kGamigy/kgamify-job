// Environment configuration
const host = typeof window !== 'undefined' ? window.location.host : '';

// Map frontends to the correct backend base URL
const HOST_API_MAP = {
  'kgamify-job.onrender.com': '/api',  // Same origin backend
  'kgamify-job-portal.vercel.app': 'https://job-portal-backend-629b.onrender.com/api',
  'localhost:5173': 'http://localhost:5000/api',
  'localhost:3000': 'http://localhost:5000/api'
};

const resolvedApiUrl = import.meta.env.VITE_API_URL || HOST_API_MAP[host] || 'https://job-portal-backend-629b.onrender.com/api';

export const config = {
  API_URL: resolvedApiUrl,
  AI_API_URL: import.meta.env.VITE_AI_API_URL || 'http://localhost:8000',
  NODE_ENV: import.meta.env.MODE,
  IS_DEVELOPMENT: import.meta.env.DEV,
  IS_PRODUCTION: import.meta.env.PROD,
};

// API endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/companies/login',
    REGISTER: '/companies',
    FORGOT_PASSWORD: '/auth/forgot-password',
  VERIFY_OTP: '/auth/verify-otp',
    RESET_PASSWORD: '/auth/reset-password',
  },
  COMPANIES: {
    INFO: '/companies/info',
    UPDATE: '/companies/update',
  },
  JOBS: {
    CREATE: '/job',
    GET_ALL: '/job',
    GET_BY_ID: (id) => `/job/${id}`,
    UPDATE: (id) => `/job/${id}`,
    DELETE: (id) => `/job/${id}`,
  },
  APPLICATIONS: {
    CREATE: '/application',
    GET_BY_JOB: (jobId) => `/application/job/${jobId}`,
    GET_BY_ID: (id) => `/application/${id}`,
  },
  ADMIN: {
    LOGIN: '/admin/login',
    PENDING_COMPANIES: '/admin/pending-companies',
    APPROVE_COMPANY: (id) => `/admin/approve-company/${id}`,
    DENY_COMPANY: (id) => `/admin/deny-company/${id}`,
  },
}; 
