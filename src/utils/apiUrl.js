import { config as appConfig } from '../config/env';

/**
 * Safe API URL helpers to prevent undefined.replace() errors
 */

/**
 * Get base URL safely with fallbacks
 * Removes /api suffix for base server URL
 */
export const getBaseUrl = () => {
  const url = import.meta.env.VITE_API_URL || appConfig.API_URL || '';
  return url.replace(/\/api$/, '');
};

/**
 * Get full API URL with /api suffix
 */
export const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || appConfig.API_URL || 'http://localhost:5000/api';
};

/**
 * Get WebSocket URL from API URL
 */
export const getWsUrl = () => {
  const apiUrl = getApiUrl();
  return import.meta.env.VITE_WS_URL || apiUrl.replace(/^http/, 'ws');
};

export default {
  getBaseUrl,
  getApiUrl,
  getWsUrl
};
