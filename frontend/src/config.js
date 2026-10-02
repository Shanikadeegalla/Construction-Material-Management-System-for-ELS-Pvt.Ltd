// Base URL of the backend API. Set REACT_APP_API_URL at build time for a
// deployed frontend (e.g. https://els-cmms-api.vercel.app); it falls back to
// the local backend for development.
export const API_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
