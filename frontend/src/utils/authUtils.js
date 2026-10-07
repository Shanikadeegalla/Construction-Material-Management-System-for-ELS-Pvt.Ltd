import { API_BASE } from '../config';

/**
 * Extracts authentication token from localStorage and returns standard request headers.
 */
export const getAuthHeaders = (extraHeaders = {}) => {
  let token = null;
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const userObj = JSON.parse(userStr);
      token = userObj?.token || userObj?.accessToken;
    }
  } catch (e) {
    console.error('Error parsing stored user from localStorage:', e);
  }
  
  if (!token) {
    token = localStorage.getItem('token');
  }

  const headers = {
    'Content-Type': 'application/json',
    ...extraHeaders
  };

  if (token && token !== 'null' && token !== 'undefined') {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

/**
 * Handles 401/Unauthorized API responses by clearing stored user session
 * and triggering global re-authentication redirect.
 */
export const handleAuthError = (message) => {
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { message } }));
};

/**
 * Fetch wrapper that automatically appends Auth headers and handles expired/invalid session errors.
 */
export const fetchWithAuth = async (url, options = {}) => {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  const headers = getAuthHeaders(options.headers || {});
  
  const response = await fetch(fullUrl, {
    ...options,
    headers
  });

  if (response.status === 401) {
    const body = await response.json().catch(() => ({}));
    const message = body.message || 'Not authorized, user not found or session expired';
    handleAuthError(message);
    throw new Error(message);
  }

  return response;
};
