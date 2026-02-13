// D.A.K MVP v3 - User API Client

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Token management
let token = localStorage.getItem('dak_token');

export function setToken(newToken) {
  token = newToken;
  if (newToken) {
    localStorage.setItem('dak_token', newToken);
  } else {
    localStorage.removeItem('dak_token');
  }
}

export function getToken() {
  return token;
}

// API helper
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
  register: (data) => api('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => api('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  me: () => api('/auth/me'),
  changePassword: (data) => api('/auth/change-password', { method: 'POST', body: JSON.stringify(data) }),
  forgotPassword: (email) => api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (data) => api('/auth/reset-password', { method: 'POST', body: JSON.stringify(data) })
};

// Communities
export const communities = {
  getByInvite: (link) => api(`/communities/invite/${link}`),
  getMy: () => api('/communities/my'),
  getOne: (id) => api(`/communities/${id}`),
  join: (inviteLink) => api('/communities/join', { method: 'POST', body: JSON.stringify({ inviteLink }) })
};

// Active Access
export const access = {
  getStatus: (communityId) => api(`/access/status/${communityId}`),
  getMyAccess: () => api('/access/my-access'),
  activate: (data) => api('/access/activate', { method: 'POST', body: JSON.stringify(data) }),
  completePayment: (paymentId) => api(`/access/mock-complete/${paymentId}`, { method: 'POST' }),
  getPayments: (communityId) => api(`/access/payments/${communityId}`),
  getAllPayments: () => api('/access/payments')
};

// Events
export const events = {
  getForCommunity: (communityId) => api(`/events/community/${communityId}`),
  getOne: (id) => api(`/events/${id}`),
  getMyCalendar: () => api('/events/calendar/my'),
  exportIcs: (id) => `${API_URL}/events/${id}/ics`
};

// Streams
export const streams = {
  getForCommunity: (communityId) => api(`/streams/community/${communityId}`),
  getLive: (communityId) => api(`/streams/community/${communityId}/live`),
  leave: (streamId) => api(`/streams/${streamId}/leave`, { method: 'POST' })
};

// Messages
export const messages = {
  getThreads: () => api('/messages/threads'),
  getThread: (threadId) => api(`/messages/threads/${threadId}`),
  sendMessage: (threadId, content) => api(`/messages/threads/${threadId}`, { 
    method: 'POST', 
    body: JSON.stringify({ content }) 
  }),
  startThread: (communityId, content) => api('/messages/start', {
    method: 'POST',
    body: JSON.stringify({ communityId, content })
  })
};

// Notifications
export const notifications = {
  getAll: (unreadOnly = false) => api(`/notifications${unreadOnly ? '?unreadOnly=true' : ''}`),
  getUnreadCount: () => api('/notifications/unread-count'),
  markRead: (id) => api(`/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => api('/notifications/read-all', { method: 'POST' })
};

// Waiting List (public)
export const waitingList = {
  join: (data) => api('/waiting-list', { method: 'POST', body: JSON.stringify(data) }),
  getCommunityTypes: () => api('/waiting-list/community-types')
};

export default {
  auth,
  communities,
  access,
  events,
  streams,
  messages,
  notifications,
  waitingList
};
