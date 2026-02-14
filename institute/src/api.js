// D.A.K MVP v3 - Institute API Client

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

let token = localStorage.getItem('dak_institute_token');

export function setToken(newToken) {
  token = newToken;
  if (newToken) {
    localStorage.setItem('dak_institute_token', newToken);
  } else {
    localStorage.removeItem('dak_institute_token');
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
  register: (data) => api('/auth/register-admin', { method: 'POST', body: JSON.stringify(data) }),
  me: () => api('/auth/me'),
  changePassword: (data) => api('/auth/change-password', { method: 'POST', body: JSON.stringify(data) }),
  forgotPassword: (email) => api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (data) => api('/auth/reset-password', { method: 'POST', body: JSON.stringify(data) })
};

// Communities
export const communities = {
  getMy: () => api('/communities/my'),
  getOne: (id) => api(`/communities/${id}`),
  update: (id, data) => api(`/communities/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getMembers: (id) => api(`/communities/${id}/members`),
  approveMember: (communityId, userId) => api(`/communities/${communityId}/members/${userId}/approve`, { method: 'POST' }),
  rejectMember: (communityId, userId) => api(`/communities/${communityId}/members/${userId}/reject`, { method: 'POST' }),
  setMemberAccess: (communityId, userId, data) => api(`/communities/${communityId}/members/${userId}/set-access`, { method: 'POST', body: JSON.stringify(data) }),
  getAnalytics: (id) => api(`/communities/${id}/analytics`),
  create: (data) => api('/communities', { method: 'POST', body: JSON.stringify(data) })
};

// Events
export const events = {
  getForCommunity: (communityId) => api(`/events/community/${communityId}`),
  create: (data) => api('/events', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => api(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => api(`/events/${id}`, { method: 'DELETE' })
};

// Streams
export const streams = {
  getForCommunity: (communityId) => api(`/streams/community/${communityId}`),
  getStatus: (communityId) => api(`/streams/community/${communityId}/status`),
  create: (data) => api('/streams', { method: 'POST', body: JSON.stringify(data) }),
  start: (id) => api(`/streams/${id}/start`, { method: 'POST' }),
  end: (id, data) => api(`/streams/${id}/end`, { method: 'POST', body: JSON.stringify(data) })
};

// Messages
export const messages = {
  getThreads: () => api('/messages/threads'),
  getThread: (id) => api(`/messages/threads/${id}`),
  sendMessage: (threadId, content) => api(`/messages/threads/${threadId}`, {
    method: 'POST',
    body: JSON.stringify({ content })
  }),
  blockUser: (threadId) => api(`/messages/threads/${threadId}/block`, { method: 'POST' }),
  unblockUser: (threadId) => api(`/messages/threads/${threadId}/unblock`, { method: 'POST' })
};

// Notifications
export const notifications = {
  getAll: () => api('/notifications'),
  getUnreadCount: () => api('/notifications/unread-count'),
  markAllRead: () => api('/notifications/read-all', { method: 'POST' })
};

export default {
  auth,
  communities,
  events,
  streams,
  messages,
  notifications
};
