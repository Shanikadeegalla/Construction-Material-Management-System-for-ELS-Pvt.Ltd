import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api'
});

API.interceptors.request.use((req) => {
  const token = localStorage.getItem('token');
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

export const login = (formData) => API.post('/auth/login', formData);
export const register = (formData) => API.post('/auth/register', formData);
export const getMe = () => API.get('/auth/me');

export const getProjects = () => API.get('/projects');
export const createProject = (formData) => API.post('/projects', formData);

export const getMaterials = () => API.get('/materials');
export const createMaterial = (formData) => API.post('/materials', formData);

export const getInventory = () => API.get('/inventory');
export const getStockAlerts = () => API.get('/inventory/alerts');

export const getPORequests = () => API.get('/po-requests');
export const createPORequest = (formData) => API.post('/po-requests', formData);
export const approvePORequest = (id) => API.put(`/po-requests/${id}/approve`);
export const rejectPORequest = (id, reason) => API.put(`/po-requests/${id}/reject`, { rejectionReason: reason });

export default API;