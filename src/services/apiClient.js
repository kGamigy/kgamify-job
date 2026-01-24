import axios from 'axios';
import { getApiUrl } from '../utils/apiUrl';

/**
 * API Client with Request/Response Interceptors
 * Comprehensive API layer with error handling, retry logic, caching, and rate limiting
 */

// Base configuration: always resolve to explicit backend URL
const API_BASE_URL = getApiUrl();
// Increase default timeout to better handle cold starts and file uploads
const DEFAULT_TIMEOUT = 30000;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Cache implementation
class APICache {
  constructor(maxSize = 100, ttl = 300000) { // 5 minutes default TTL
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  generateKey(config) {
    const { method, url, params, data } = config;
    return `${method}:${url}:${JSON.stringify(params)}:${JSON.stringify(data)}`;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  set(key, data, customTTL) {
    // Remove oldest items if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      expiry: Date.now() + (customTTL || this.ttl)
    });
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  // Clear cache entries that match a pattern
  invalidatePattern(pattern) {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}

// Rate limiting implementation
class RateLimiter {
  constructor(maxRequests = 100, windowMs = 60000) { // 100 requests per minute
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  canMakeRequest() {
    const now = Date.now();
    // Remove old requests outside the window
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    return this.requests.length < this.maxRequests;
  }

  recordRequest() {
    this.requests.push(Date.now());
  }

  getWaitTime() {
    if (this.requests.length === 0) return 0;
    const oldestRequest = Math.min(...this.requests);
    return Math.max(0, this.windowMs - (Date.now() - oldestRequest));
  }
}

// Initialize cache and rate limiter
const cache = new APICache();
const rateLimiter = new RateLimiter();

// Network status tracking
let isOnline = navigator.onLine;
const onlineListeners = new Set();

window.addEventListener('online', () => {
  isOnline = true;
  onlineListeners.forEach(listener => listener(true));
});

window.addEventListener('offline', () => {
  isOnline = false;
  onlineListeners.forEach(listener => listener(false));
});

// Request queue for offline requests
const requestQueue = [];

// Utility functions
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const shouldRetry = (error, attempt) => {
  if (attempt >= MAX_RETRY_ATTEMPTS) return false;
  
  // Retry on network errors or 5xx status codes
  if (!error.response) return true; // Network error
  
  const status = error.response.status;
  return status >= 500 || status === 408 || status === 429; // Server errors, timeout, rate limit
};

const getRetryDelay = (attempt, error) => {
  // Exponential backoff with jitter
  const baseDelay = RETRY_DELAY * Math.pow(2, attempt);
  const jitter = Math.random() * 1000;
  
  // Check for Retry-After header
  if (error.response?.headers?.['retry-after']) {
    const retryAfter = parseInt(error.response.headers['retry-after']) * 1000;
    return Math.max(retryAfter, baseDelay);
  }
  
  return baseDelay + jitter;
};

const isCacheable = (config) => {
  // Only cache GET requests by default
  if (config.method !== 'get') return false;
  
  // Check for explicit cache control
  if (config.cache === false) return false;
  if (config.cache === true) return true;
  
  // Don't cache requests with authorization by default (unless explicitly enabled)
  if (config.headers?.Authorization && !config.cache) return false;
  
  return true;
};

// Request interceptor
apiClient.interceptors.request.use(
  async (config) => {
    // Add timestamp for request tracking
    config.metadata = { startTime: Date.now() };
    
    // Rate limiting check
    if (!rateLimiter.canMakeRequest()) {
      const waitTime = rateLimiter.getWaitTime();
      if (waitTime > 0) {
        await sleep(waitTime);
      }
    }
    rateLimiter.recordRequest();
    
    // Add authentication token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add request ID for tracking
    config.headers['X-Request-ID'] = generateRequestId();
    
    // Add client info
    config.headers['X-Client-Version'] = import.meta.env.VITE_APP_VERSION || '1.0.0';
    config.headers['X-Client-Platform'] = 'web';
    
    // Handle offline requests
    if (!isOnline && config.method !== 'get') {
      // Queue non-GET requests for later
      requestQueue.push(config);
      throw new Error('Request queued for when connection is restored');
    }
    
    // Check cache for GET requests
    if (isCacheable(config)) {
      const cacheKey = cache.generateKey(config);
      const cachedResponse = cache.get(cacheKey);
      
      if (cachedResponse) {
        // Return cached response
        const response = {
          ...cachedResponse,
          config,
          fromCache: true
        };
        return Promise.reject({ config, response, fromCache: true });
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    // Add response timing
    if (response.config.metadata?.startTime) {
      response.duration = Date.now() - response.config.metadata.startTime;
    }
    
    // Cache successful GET responses
    if (isCacheable(response.config) && response.status >= 200 && response.status < 300) {
      const cacheKey = cache.generateKey(response.config);
      const cacheTTL = response.config.cacheTTL || 
                      (response.headers['cache-control']?.includes('max-age=') ? 
                       parseInt(response.headers['cache-control'].match(/max-age=(\d+)/)?.[1]) * 1000 : 
                       undefined);
      
      cache.set(cacheKey, {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      }, cacheTTL);
    }
    
    return response;
  },
  async (error) => {
    // Handle cached responses
    if (error.fromCache) {
      return Promise.resolve(error.response);
    }
    
    const { config } = error;
    const attempt = config._retryCount || 0;
    
    // Increment retry count
    config._retryCount = attempt + 1;
    
    // Handle specific error types
    if (error.response) {
      const status = error.response.status;
      
      // Handle authentication errors
      if (status === 401) {
        // Try to refresh token
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken && !config._tokenRefreshed) {
          try {
            const refreshResponse = await axios.post(`${API_BASE_URL}/auth/refresh`, {
              refreshToken
            });
            
            const { token } = refreshResponse.data;
            localStorage.setItem('token', token);
            
            // Retry original request with new token
            config.headers.Authorization = `Bearer ${token}`;
            config._tokenRefreshed = true;
            
            return apiClient.request(config);
          } catch (refreshError) {
            // Refresh failed, redirect to login
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        } else {
          // No refresh token or already tried refresh
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      }
      
      // Handle rate limiting
      if (status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : getRetryDelay(attempt, error);
        
        if (shouldRetry(error, attempt)) {
          await sleep(delay);
          return apiClient.request(config);
        }
      }
      
      // Invalidate cache on certain errors
      if (status >= 400) {
        const cacheKey = cache.generateKey(config);
        cache.delete(cacheKey);
        
        // Invalidate related cache entries
        if (config.method !== 'get') {
          cache.invalidatePattern(config.url.split('/')[0]);
        }
      }
    }
    
    // Retry logic for network errors and server errors
    if (shouldRetry(error, attempt)) {
      const delay = getRetryDelay(attempt, error);
      await sleep(delay);
      return apiClient.request(config);
    }
    
    // Transform error for consistent error handling
    const transformedError = {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      code: error.code,
      config: {
        method: config?.method,
        url: config?.url,
        baseURL: config?.baseURL
      },
      isNetworkError: !error.response,
      isTimeout: error.code === 'ECONNABORTED',
      isRetryableError: shouldRetry(error, 0),
      requestId: config?.headers?.['X-Request-ID']
    };
    
    return Promise.reject(transformedError);
  }
);

// Helper function to generate request IDs
function generateRequestId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Enhanced API methods
const apiMethods = {
  // Standard HTTP methods
  get: (url, config = {}) => apiClient.get(url, config),
  post: (url, data, config = {}) => apiClient.post(url, data, config),
  put: (url, data, config = {}) => apiClient.put(url, data, config),
  patch: (url, data, config = {}) => apiClient.patch(url, data, config),
  delete: (url, config = {}) => apiClient.delete(url, config),
  
  // Enhanced methods with built-in features
  getCached: (url, config = {}) => {
    return apiClient.get(url, { ...config, cache: true });
  },
  
  getWithTimeout: (url, timeout, config = {}) => {
    return apiClient.get(url, { ...config, timeout });
  },
  
  postWithRetry: (url, data, retries = 3, config = {}) => {
    return apiClient.post(url, data, { ...config, _maxRetries: retries });
  },
  
  // Batch requests
  batch: async (requests) => {
    const results = await Promise.allSettled(
      requests.map(request => apiClient.request(request))
    );
    
    return results.map((result, index) => ({
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value.data : null,
      error: result.status === 'rejected' ? result.reason : null,
      request: requests[index]
    }));
  },
  
  // Upload with progress
  upload: (url, file, config = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    
    return apiClient.post(url, formData, {
      ...config,
      headers: {
        ...config.headers,
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: config.onProgress
    });
  },
  
  // Download with progress
  download: (url, config = {}) => {
    return apiClient.get(url, {
      ...config,
      responseType: 'blob',
      onDownloadProgress: config.onProgress
    });
  }
};

// Offline support
const offlineSupport = {
  // Add listener for online/offline status
  onStatusChange: (callback) => {
    onlineListeners.add(callback);
    return () => onlineListeners.delete(callback);
  },
  
  // Process queued requests when back online
  processQueue: async () => {
    if (!isOnline || requestQueue.length === 0) return;
    
    const queuedRequests = [...requestQueue];
    requestQueue.length = 0; // Clear queue
    
    const results = [];
    for (const request of queuedRequests) {
      try {
        const response = await apiClient.request(request);
        results.push({ success: true, response, request });
      } catch (error) {
        results.push({ success: false, error, request });
        // Re-queue failed requests
        requestQueue.push(request);
      }
    }
    
    return results;
  },
  
  // Get queued requests count
  getQueueLength: () => requestQueue.length,
  
  // Clear queue
  clearQueue: () => {
    requestQueue.length = 0;
  }
};

// Cache management
const cacheManager = {
  clear: () => cache.clear(),
  delete: (pattern) => cache.invalidatePattern(pattern),
  size: () => cache.cache.size,
  keys: () => Array.from(cache.cache.keys())
};

// Request monitoring and analytics
const analytics = {
  requestCount: 0,
  errorCount: 0,
  averageResponseTime: 0,
  responseTimes: [],
  
  recordRequest: (duration, isError = false) => {
    analytics.requestCount++;
    if (isError) analytics.errorCount++;
    
    if (duration) {
      analytics.responseTimes.push(duration);
      if (analytics.responseTimes.length > 100) {
        analytics.responseTimes.shift(); // Keep only last 100
      }
      analytics.averageResponseTime = 
        analytics.responseTimes.reduce((a, b) => a + b) / analytics.responseTimes.length;
    }
  },
  
  getStats: () => ({
    requestCount: analytics.requestCount,
    errorCount: analytics.errorCount,
    errorRate: analytics.requestCount > 0 ? analytics.errorCount / analytics.requestCount : 0,
    averageResponseTime: analytics.averageResponseTime,
    cacheSize: cache.cache.size,
    queueLength: requestQueue.length,
    isOnline
  }),
  
  reset: () => {
    analytics.requestCount = 0;
    analytics.errorCount = 0;
    analytics.averageResponseTime = 0;
    analytics.responseTimes = [];
  }
};

// Auto-process queue when coming back online
window.addEventListener('online', () => {
  setTimeout(() => offlineSupport.processQueue(), 1000);
});

// Configure global error handling
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.config?.url) {
    analytics.recordRequest(null, true);
  }
});

// Export enhanced API client
export {
  apiClient,
  apiMethods as api,
  cacheManager,
  offlineSupport,
  analytics,
  cache,
  rateLimiter
};

export default apiClient;
