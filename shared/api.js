// Shared API utilities

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class ApiClient {
  constructor() {
    this.baseUrl = API_URL;
  }

  getToken() {
    return localStorage.getItem('dak_token');
  }

  setToken(token) {
    localStorage.setItem('dak_token', token);
  }

  clearToken() {
    localStorage.removeItem('dak_token');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    if (options.body) {
      config.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  // Auth
  async login(email, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    this.setToken(data.token);
    return data;
  }

  async register(email, password, name, inviteLink) {
    const data = await this.request('/api/auth/register', {
      method: 'POST',
      body: { email, password, name, inviteLink },
    });
    this.setToken(data.token);
    return data;
  }

  async getMe() {
    return this.request('/api/auth/me');
  }

  logout() {
    this.clearToken();
    window.location.href = '/';
  }

  // Communities
  async getMyCommunities() {
    return this.request('/api/communities/my');
  }

  async getCommunity(id) {
    return this.request(`/api/communities/${id}`);
  }

  async getCommunityByInvite(inviteLink) {
    return this.request(`/api/communities/invite/${inviteLink}`);
  }

  async createCommunity(data) {
    return this.request('/api/communities', {
      method: 'POST',
      body: data,
    });
  }

  async getCommunityAnalytics(communityId) {
    return this.request(`/api/communities/${communityId}/analytics`);
  }

  // Users
  async getProfile() {
    return this.request('/api/users/profile');
  }

  async updateProfile(data) {
    return this.request('/api/users/profile', {
      method: 'PUT',
      body: data,
    });
  }

  async getEntitlements() {
    return this.request('/api/users/entitlements');
  }

  async getMySupports() {
    return this.request('/api/users/supports');
  }

  // Supports
  async createSupport(communityId, amount, supportType) {
    return this.request('/api/supports', {
      method: 'POST',
      body: { communityId, amount, supportType },
    });
  }

  async cancelSupport(supportId) {
    return this.request(`/api/supports/${supportId}/cancel`, {
      method: 'POST',
    });
  }

  // Events
  async getCommunityEvents(communityId) {
    return this.request(`/api/events/community/${communityId}`);
  }

  async createEvent(data) {
    return this.request('/api/events', {
      method: 'POST',
      body: data,
    });
  }

  // Streams
  async getCommunityStreams(communityId) {
    return this.request(`/api/streams/community/${communityId}`);
  }

  async getLiveStream(communityId) {
    return this.request(`/api/streams/community/${communityId}/live`);
  }

  async createStream(data) {
    return this.request('/api/streams', {
      method: 'POST',
      body: data,
    });
  }

  async startStream(streamId) {
    return this.request(`/api/streams/${streamId}/start`, { method: 'POST' });
  }

  async endStream(streamId) {
    return this.request(`/api/streams/${streamId}/end`, { method: 'POST' });
  }

  // Messages
  async getThreads() {
    return this.request('/api/messages/threads');
  }

  async getThread(threadId) {
    return this.request(`/api/messages/threads/${threadId}`);
  }

  async sendMessage(threadId, content) {
    return this.request(`/api/messages/threads/${threadId}`, {
      method: 'POST',
      body: { content },
    });
  }

  async startThread(communityId, content) {
    return this.request('/api/messages/start', {
      method: 'POST',
      body: { communityId, content },
    });
  }

  // Admin
  async getAdminStats() {
    return this.request('/api/admin/stats');
  }

  async getAdminCommunities(status) {
    const query = status ? `?status=${status}` : '';
    return this.request(`/api/admin/communities${query}`);
  }

  async approveCommunity(id) {
    return this.request(`/api/admin/communities/${id}/approve`, { method: 'POST' });
  }

  async suspendCommunity(id) {
    return this.request(`/api/admin/communities/${id}/suspend`, { method: 'POST' });
  }

  async getAdminUsers() {
    return this.request('/api/admin/users');
  }

  async getWaitingList() {
    return this.request('/api/admin/waiting-list');
  }

  async getPspStatus() {
    return this.request('/api/admin/psp-status');
  }

  // Waiting list (public)
  async joinWaitingList(data) {
    return this.request('/api/waiting-list', {
      method: 'POST',
      body: data,
    });
  }
}

export const api = new ApiClient();
export default api;
