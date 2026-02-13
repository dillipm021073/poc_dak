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
  me: () => api('/auth/me')
};

// Admin endpoints
export const admin = {
  getStats: () => api('/admin/stats'),
  getCommunities: (status) => api(`/admin/communities${status ? `?status=${status}` : ''}`),
  approveCommunity: (id) => api(`/admin/communities/${id}/approve`, { method: 'POST' }),
  suspendCommunity: (id, reason) => api(`/admin/communities/${id}/suspend`, { 
    method: 'POST', 
    body: JSON.stringify({ reason }) 
  }),
  reactivateCommunity: (id) => api(`/admin/communities/${id}/reactivate`, { method: 'POST' }),
  getUsers: () => api('/admin/users'),
  getWaitingList: (communityType) => api(`/admin/waiting-list${communityType ? `?communityType=${communityType}` : ''}`),
  getPayments: (communityId) => api(`/admin/payments${communityId ? `?communityId=${communityId}` : ''}`),
  getFeeStructure: () => api('/admin/fee-structure')
};

export default {
  auth,
  admin
};
