// D.A.K MVP v3 - Admin API Client

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

let token = localStorage.getItem('dak_admin_token');

export function setToken(newToken) {
  token = newToken;
  if (newToken) {
    localStorage.setItem('dak_admin_token', newToken);
  } else {
    localStorage.removeItem('dak_admin_token');
  }
}

export function getToken() {
  return token;
}

async function api(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

// Auth
export const auth = {
  login: (data) => api('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  me: () => api('/auth/me'),
  changePassword: (data) => api('/auth/change-password', { method: 'POST', body: JSON.stringify(data) }),
  forgotPassword: (email) => api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (data) => api('/auth/reset-password', { method: 'POST', body: JSON.stringify(data) })
};

// Helper to build query string from params object
function buildQuery(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined);
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

// Admin endpoints
export const admin = {
  getStats: () => api('/admin/stats'),
  getCommunities: (params = {}) => api(`/admin/communities${buildQuery(typeof params === 'string' ? { status: params } : params)}`),
  approveCommunity: (id) => api(`/admin/communities/${id}/approve`, { method: 'POST' }),
  suspendCommunity: (id, reason) => api(`/admin/communities/${id}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  }),
  reactivateCommunity: (id) => api(`/admin/communities/${id}/reactivate`, { method: 'POST' }),
  getUsers: (params = {}) => api(`/admin/users${buildQuery(params)}`),
  getWaitingList: (params = {}) => api(`/admin/waiting-list${buildQuery(typeof params === 'string' ? { communityType: params } : params)}`),
  approveWaitingListEntry: (id) => api(`/admin/waiting-list/${id}/approve`, { method: 'POST' }),
  rejectWaitingListEntry: (id) => api(`/admin/waiting-list/${id}/reject`, { method: 'POST' }),
  removeWaitingListEntry: (id) => api(`/admin/waiting-list/${id}`, { method: 'DELETE' }),
  rejectCommunity: (id, reason) => api(`/admin/communities/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  }),
  getPayments: (params = {}) => api(`/admin/payments${buildQuery(typeof params === 'string' ? { communityId: params } : params)}`),
  getFeeStructure: () => api('/admin/fee-structure')
};

export default {
  auth,
  admin
};
