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
  exportIcs: async (id) => {
    const response = await fetch(`${API_URL}/events/${id}/ics`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!response.ok) throw new Error('Failed to export calendar');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'event.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
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

// Guide (AI Spiritual Guidance)
export const guide = {
  getSessions: () => api('/guide/sessions'),
  getSession: (sessionId) => api(`/guide/sessions/${sessionId}`),
  startSession: (data) => api('/guide/sessions', { method: 'POST', body: JSON.stringify(data) }),
  sendMessage: (sessionId, content) => api(`/guide/sessions/${sessionId}/messages`, { method: 'POST', body: JSON.stringify({ content }) }),
  getInspiration: (communityType) => api(`/guide/inspiration/${communityType}`)
};

// Conversations (Community Discussions)
export const conversations = {
  getForCommunity: (communityId) => api(`/conversations/community/${communityId}`),
  getOne: (id) => api(`/conversations/${id}`),
  addComment: (id, content, parentId) => api(`/conversations/${id}/comments`, { method: 'POST', body: JSON.stringify({ content, parentId }) }),
  addReaction: (id, emoji) => api(`/conversations/${id}/reactions`, { method: 'POST', body: JSON.stringify({ emoji }) }),
  addCommentReaction: (commentId, emoji) => api(`/conversations/comments/${commentId}/reactions`, { method: 'POST', body: JSON.stringify({ emoji }) })
};

// Updates Feed
export const updates = {
  getAll: (params = {}) => api(`/updates${Object.keys(params).length ? '?' + new URLSearchParams(params) : ''}`),
  markRead: (id) => api(`/updates/${id}/read`, { method: 'PUT' }),
  markAllRead: (communityId) => api('/updates/read-all', { method: 'PUT', body: JSON.stringify(communityId ? { communityId } : {}) })
};

// Supports (Support History)
export const supports = {
  getMyHistory: () => api('/supports/my-history'),
  getOne: (id) => api(`/supports/${id}`)
};

export default {
  auth,
  communities,
  access,
  events,
  streams,
  messages,
  notifications,
  waitingList,
  guide,
  conversations,
  updates,
  supports
};
