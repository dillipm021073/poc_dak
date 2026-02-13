// D.A.K MVP v3 - Institute (Community Admin) Portal
// Lean MVP Specification v1.4 FINAL

import { useState, useEffect } from 'react'
import api, { setToken, getToken } from './api'

// ============================================================================
// MAIN APP
// ============================================================================

function App() {
  const [user, setUser] = useState(null)
  const [community, setCommunity] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const token = getToken()
    if (token) {
      try {
        const userData = await api.auth.me()
        if (userData.role !== 'community_admin' && userData.role !== 'platform_admin') {
          throw new Error('Not authorized')
        }
        setUser(userData)
        await loadCommunity()
      } catch (err) {
        setToken(null)
      }
    }
    setLoading(false)
  }

  const loadCommunity = async () => {
    try {
      const communities = await api.communities.getMy()
      if (communities.length > 0) {
        const fullCommunity = await api.communities.getOne(communities[0].id)
        setCommunity(fullCommunity)
      }
    } catch (err) {
      console.error('Failed to load community:', err)
    }
  }

  const handleLogin = async (email, password) => {
    const result = await api.auth.login({ email, password })
    if (result.user.role !== 'community_admin' && result.user.role !== 'platform_admin') {
      throw new Error('Access denied. This portal is for community administrators only.')
    }
    setToken(result.token)
    setUser(result.user)
    await loadCommunity()
  }

  const handleLogout = () => {
    setToken(null)
    setUser(null)
    setCommunity(null)
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="logo">D.A.K</div>
        <p>Loading...</p>
      </div>
    )
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />
  }

  if (!community) {
    return <OnboardingPage user={user} onComplete={loadCommunity} />
  }

  return (
    <div className="app">
      <Sidebar 
        community={community} 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        onLogout={handleLogout}
      />
      <main className="main-content">
        {activeTab === 'dashboard' && <DashboardTab community={community} />}
        {activeTab === 'settings' && <SettingsTab community={community} onUpdate={loadCommunity} />}
        {activeTab === 'events' && <EventsTab community={community} />}
        {activeTab === 'streams' && <StreamsTab community={community} />}
        {activeTab === 'messages' && <MessagesTab community={community} />}
        {activeTab === 'members' && <MembersTab community={community} />}
      </main>
    </div>
  )
}

// ============================================================================
// LOGIN PAGE
// ============================================================================

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      await onLogin(email, password)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1>D.A.K</h1>
          <p>Community Admin Portal</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ============================================================================
// ONBOARDING PAGE
// ============================================================================

function OnboardingPage({ user, onComplete }) {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    name: '',
    country: '',
    communityType: '',
    adminName: user.name || '',
    adminEmail: user.email || '',
    roleInInstitution: '',
    officialWebsite: '',
    shortDescription: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const communityTypes = [
    { value: 'judaism', label: 'Judaism' },
    { value: 'christianity', label: 'Christianity' },
    { value: 'islam', label: 'Islam' },
    { value: 'hinduism', label: 'Hinduism' }
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await api.communities.create(formData)
      onComplete()
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <div className="onboarding-header">
          <h1>Register Your Community</h1>
          <p>Step {step} of 2</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <>
              <div className="form-group">
                <label>Community Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., Temple Beth Israel"
                  required
                />
              </div>

              <div className="form-group">
                <label>Country *</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({...formData, country: e.target.value})}
                  placeholder="e.g., United States"
                  required
                />
              </div>

              <div className="form-group">
                <label>Community Type *</label>
                <select
                  value={formData.communityType}
                  onChange={(e) => setFormData({...formData, communityType: e.target.value})}
                  required
                >
                  <option value="">Select...</option>
                  {communityTypes.map(ct => (
                    <option key={ct.value} value={ct.value}>{ct.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Short Description</label>
                <textarea
                  value={formData.shortDescription}
                  onChange={(e) => setFormData({...formData, shortDescription: e.target.value})}
                  placeholder="Brief description of your community"
                  rows={3}
                />
              </div>

              <button 
                type="button" 
                className="btn btn-primary btn-block"
                onClick={() => setStep(2)}
                disabled={!formData.name || !formData.country || !formData.communityType}
              >
                Continue
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="form-group">
                <label>Your Name *</label>
                <input
                  type="text"
                  value={formData.adminName}
                  onChange={(e) => setFormData({...formData, adminName: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Your Email *</label>
                <input
                  type="email"
                  value={formData.adminEmail}
                  onChange={(e) => setFormData({...formData, adminEmail: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Your Role in the Institution *</label>
                <input
                  type="text"
                  value={formData.roleInInstitution}
                  onChange={(e) => setFormData({...formData, roleInInstitution: e.target.value})}
                  placeholder="e.g., Rabbi, Pastor, Imam, Priest"
                  required
                />
              </div>

              <div className="form-group">
                <label>Official Website (Optional)</label>
                <input
                  type="url"
                  value={formData.officialWebsite}
                  onChange={(e) => setFormData({...formData, officialWebsite: e.target.value})}
                  placeholder="https://..."
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-outline" onClick={() => setStep(1)}>
                  Back
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Submitting...' : 'Submit for Approval'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  )
}

// ============================================================================
// SIDEBAR
// ============================================================================

function Sidebar({ community, activeTab, onTabChange, onLogout }) {
  const tabs = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'settings', icon: '⚙️', label: 'Page Settings' },
    { id: 'events', icon: '📅', label: 'Events' },
    { id: 'streams', icon: '📺', label: 'Streams' },
    { id: 'messages', icon: '💬', label: 'Messages' },
    { id: 'members', icon: '👥', label: 'Members' }
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="community-badge">
          <div className="community-avatar">{community.name.charAt(0)}</div>
          <div className="community-info">
            <h3>{community.name}</h3>
            <span className={`status-badge ${community.status}`}>{community.status}</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span className="nav-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="invite-link">
          <label>Invite Link</label>
          <code>{window.location.origin.replace(':3002', ':3003')}/join/{community.inviteLink}</code>
        </div>
        <button className="btn btn-outline btn-block" onClick={onLogout}>
          Sign Out
        </button>
      </div>
    </aside>
  )
}

// ============================================================================
// DASHBOARD TAB
// ============================================================================

function DashboardTab({ community }) {
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAnalytics()
  }, [community.id])

  const loadAnalytics = async () => {
    try {
      const data = await api.communities.getAnalytics(community.id)
      setAnalytics(data)
    } catch (err) {
      console.error('Failed to load analytics:', err)
    }
    setLoading(false)
  }

  if (loading) return <div className="loading">Loading analytics...</div>

  return (
    <div className="dashboard-tab">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Overview of your community's activity</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon">👥</span>
          <div className="stat-content">
            <span className="stat-value">{analytics?.totalMembers || 0}</span>
            <span className="stat-label">Total Members</span>
          </div>
        </div>

        <div className="stat-card highlight">
          <span className="stat-icon">✨</span>
          <div className="stat-content">
            <span className="stat-value">{analytics?.activeSubscribers || 0}</span>
            <span className="stat-label">Active Subscribers</span>
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-icon">💰</span>
          <div className="stat-content">
            <span className="stat-value">${analytics?.monthlyActivity?.total_collected || '0.00'}</span>
            <span className="stat-label">This Month</span>
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-icon">📈</span>
          <div className="stat-content">
            <span className="stat-value">${analytics?.monthlyActivity?.platform_fee_total || '0.00'}</span>
            <span className="stat-label">Platform Fee</span>
          </div>
        </div>
      </div>

      <div className="info-section">
        <h3>Platform Fee Structure</h3>
        <p className="text-secondary">Your platform fee is calculated monthly based on total payments collected:</p>
        <div className="fee-table">
          <div className="fee-row">
            <span>$0 - $300</span>
            <span className="fee-percent">25%</span>
          </div>
          <div className="fee-row">
            <span>$300 - $600</span>
            <span className="fee-percent">20%</span>
          </div>
          <div className="fee-row">
            <span>$600 - $1,000</span>
            <span className="fee-percent">12%</span>
          </div>
          <div className="fee-row">
            <span>$1,000+</span>
            <span className="fee-percent">7%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SETTINGS TAB (Admin CMS)
// ============================================================================

function SettingsTab({ community, onUpdate }) {
  const [formData, setFormData] = useState({
    logoUrl: community.logoUrl || '',
    coverImageUrl: community.coverImageUrl || '',
    aboutText: community.aboutText || '',
    headOfInstitution: community.headOfInstitution || '',
    messageOfDay: community.messageOfDay || ''
  })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSuccess(false)

    try {
      await api.communities.update(community.id, formData)
      setSuccess(true)
      onUpdate()
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error('Failed to update:', err)
    }
    setSaving(false)
  }

  return (
    <div className="settings-tab">
      <div className="page-header">
        <h1>Page Settings</h1>
        <p>Customize your community's public page</p>
      </div>

      {success && <div className="alert alert-success">Settings saved successfully!</div>}

      <form onSubmit={handleSubmit} className="settings-form">
        <div className="form-section">
          <h3>Branding</h3>

          <div className="form-group">
            <label>Logo URL</label>
            <input
              type="url"
              value={formData.logoUrl}
              onChange={(e) => setFormData({...formData, logoUrl: e.target.value})}
              placeholder="https://..."
            />
            {formData.logoUrl && (
              <img src={formData.logoUrl} alt="Preview" className="image-preview" />
            )}
          </div>

          <div className="form-group">
            <label>Cover Image URL</label>
            <input
              type="url"
              value={formData.coverImageUrl}
              onChange={(e) => setFormData({...formData, coverImageUrl: e.target.value})}
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Content</h3>

          <div className="form-group">
            <label>Head of Institution</label>
            <input
              type="text"
              value={formData.headOfInstitution}
              onChange={(e) => setFormData({...formData, headOfInstitution: e.target.value})}
              placeholder="e.g., Rabbi David Cohen"
            />
          </div>

          <div className="form-group">
            <label>About</label>
            <textarea
              value={formData.aboutText}
              onChange={(e) => setFormData({...formData, aboutText: e.target.value})}
              rows={5}
              placeholder="Tell members about your community..."
            />
          </div>

          <div className="form-group">
            <label>Message of the Day</label>
            <textarea
              value={formData.messageOfDay}
              onChange={(e) => setFormData({...formData, messageOfDay: e.target.value})}
              rows={3}
              placeholder="Daily inspiration or announcement..."
            />
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}

// ============================================================================
// EVENTS TAB
// ============================================================================

function EventsTab({ community }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startsAt: '',
    endsAt: '',
    location: '',
    isVirtual: false
  })

  useEffect(() => {
    loadEvents()
  }, [community.id])

  const loadEvents = async () => {
    try {
      const data = await api.events.getForCommunity(community.id)
      setEvents(data.events || data)
    } catch (err) {
      console.error('Failed to load events:', err)
    }
    setLoading(false)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await api.events.create({
        communityId: community.id,
        ...formData
      })
      setShowForm(false)
      setFormData({ title: '', description: '', startsAt: '', endsAt: '', location: '', isVirtual: false })
      loadEvents()
    } catch (err) {
      console.error('Failed to create event:', err)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this event?')) return
    try {
      await api.events.delete(id)
      loadEvents()
    } catch (err) {
      console.error('Failed to delete event:', err)
    }
  }

  if (loading) return <div className="loading">Loading events...</div>

  return (
    <div className="events-tab">
      <div className="page-header">
        <div>
          <h1>Events</h1>
          <p>Manage your community calendar</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New Event'}
        </button>
      </div>

      {showForm && (
        <form className="event-form card" onSubmit={handleCreate}>
          <h3>Create Event</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label>Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Start *</label>
              <input
                type="datetime-local"
                value={formData.startsAt}
                onChange={(e) => setFormData({...formData, startsAt: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label>End</label>
              <input
                type="datetime-local"
                value={formData.endsAt}
                onChange={(e) => setFormData({...formData, endsAt: e.target.value})}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
              placeholder="e.g., Main Sanctuary"
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows={3}
            />
          </div>

          <div className="form-group checkbox">
            <label>
              <input
                type="checkbox"
                checked={formData.isVirtual}
                onChange={(e) => setFormData({...formData, isVirtual: e.target.checked})}
              />
              This is a virtual event
            </label>
          </div>

          <button type="submit" className="btn btn-primary">Create Event</button>
        </form>
      )}

      {events.length === 0 ? (
        <div className="empty-state">
          <p>No upcoming events</p>
          <p className="text-secondary">Create events for your community members</p>
        </div>
      ) : (
        <div className="events-list">
          {events.map(event => (
            <div key={event.id} className="event-card card">
              <div className="event-date">
                <span className="month">{new Date(event.startsAt).toLocaleDateString('en', { month: 'short' })}</span>
                <span className="day">{new Date(event.startsAt).getDate()}</span>
              </div>
              <div className="event-info">
                <h4>{event.title}</h4>
                <p className="event-time">
                  {new Date(event.startsAt).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}
                  {event.location && ` • ${event.location}`}
                  {event.isVirtual && ' • Virtual'}
                </p>
              </div>
              <button className="btn btn-sm btn-outline" onClick={() => handleDelete(event.id)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// STREAMS TAB
// ============================================================================

function StreamsTab({ community }) {
  const [streams, setStreams] = useState([])
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scheduledFor: ''
  })

  useEffect(() => {
    loadData()
  }, [community.id])

  const loadData = async () => {
    try {
      const [streamsData, statusData] = await Promise.all([
        api.streams.getForCommunity(community.id),
        api.streams.getStatus(community.id)
      ])
      setStreams(streamsData)
      setStatus(statusData)
    } catch (err) {
      console.error('Failed to load streams:', err)
    }
    setLoading(false)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await api.streams.create({
        communityId: community.id,
        ...formData
      })
      setShowForm(false)
      setFormData({ title: '', description: '', scheduledFor: '' })
      loadData()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleStart = async (id) => {
    try {
      await api.streams.start(id)
      loadData()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleEnd = async (id) => {
    try {
      await api.streams.end(id, {})
      loadData()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <div className="loading">Loading streams...</div>

  return (
    <div className="streams-tab">
      <div className="page-header">
        <div>
          <h1>Streams</h1>
          <p>Manage live streams for your community</p>
        </div>
        {status && status.remainingThisWeek > 0 && (
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ New Stream'}
          </button>
        )}
      </div>

      {status && (
        <div className="stream-status card">
          <div className="status-item">
            <span className="status-value">{status.remainingThisWeek}</span>
            <span className="status-label">Streams remaining this week</span>
          </div>
          <div className="status-item">
            <span className="status-value">{status.maxDurationMinutes} min</span>
            <span className="status-label">Max duration</span>
          </div>
          <div className="status-item">
            <span className="status-value">{status.viewerCapPercent}%</span>
            <span className="status-label">Viewer capacity</span>
          </div>
        </div>
      )}

      {showForm && (
        <form className="stream-form card" onSubmit={handleCreate}>
          <h3>Schedule Stream</h3>
          
          <div className="form-group">
            <label>Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label>Scheduled Time</label>
            <input
              type="datetime-local"
              value={formData.scheduledFor}
              onChange={(e) => setFormData({...formData, scheduledFor: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows={3}
            />
          </div>

          <button type="submit" className="btn btn-primary">Create Stream</button>
        </form>
      )}

      <div className="streams-list">
        {streams.map(stream => (
          <div key={stream.id} className={`stream-card card ${stream.isLive ? 'live' : ''}`}>
            <div className="stream-info">
              {stream.isLive && <span className="live-badge">🔴 LIVE</span>}
              <h4>{stream.title}</h4>
              {stream.scheduledFor && (
                <p className="stream-time">{new Date(stream.scheduledFor).toLocaleString()}</p>
              )}
              {stream.isLive && (
                <p className="viewer-count">{stream.currentViewers} viewers</p>
              )}
            </div>
            <div className="stream-actions">
              {stream.isLive ? (
                <button className="btn btn-sm" style={{background: '#dc2626', color: 'white'}} onClick={() => handleEnd(stream.id)}>
                  End Stream
                </button>
              ) : !stream.endedAt && (
                <button className="btn btn-sm btn-primary" onClick={() => handleStart(stream.id)}>
                  Go Live
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// MESSAGES TAB
// ============================================================================

function MessagesTab({ community }) {
  const [threads, setThreads] = useState([])
  const [selectedThread, setSelectedThread] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadThreads()
  }, [community.id])

  const loadThreads = async () => {
    try {
      const data = await api.messages.getThreads()
      const communityThreads = data.filter(t => t.communityId === community.id)
      setThreads(communityThreads)
    } catch (err) {
      console.error('Failed to load threads:', err)
    }
    setLoading(false)
  }

  const selectThread = async (thread) => {
    setSelectedThread(thread)
    try {
      const data = await api.messages.getThread(thread.id)
      setMessages(data.messages)
    } catch (err) {
      console.error('Failed to load messages:', err)
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedThread) return

    try {
      await api.messages.sendMessage(selectedThread.id, newMessage)
      setNewMessage('')
      selectThread(selectedThread)
    } catch (err) {
      console.error('Failed to send message:', err)
    }
  }

  const handleBlock = async (threadId) => {
    if (!confirm('Block this user from messaging?')) return
    try {
      await api.messages.blockUser(threadId)
      loadThreads()
    } catch (err) {
      console.error('Failed to block user:', err)
    }
  }

  if (loading) return <div className="loading">Loading messages...</div>

  return (
    <div className="messages-tab">
      <div className="page-header">
        <h1>Messages</h1>
        <p>Conversations with your community members</p>
      </div>

      <div className="messages-layout">
        <div className="threads-panel">
          {threads.length === 0 ? (
            <div className="empty-state">No messages yet</div>
          ) : (
            threads.map(thread => (
              <div 
                key={thread.id}
                className={`thread-item ${selectedThread?.id === thread.id ? 'active' : ''} ${thread.unreadCount > 0 ? 'unread' : ''}`}
                onClick={() => selectThread(thread)}
              >
                <div className="thread-avatar">{thread.userName?.charAt(0) || 'U'}</div>
                <div className="thread-info">
                  <h4>{thread.userName}</h4>
                  <p className="last-message">{thread.lastMessage}</p>
                </div>
                {thread.unreadCount > 0 && (
                  <span className="unread-badge">{thread.unreadCount}</span>
                )}
              </div>
            ))
          )}
        </div>

        <div className="messages-panel">
          {!selectedThread ? (
            <div className="empty-state">Select a conversation</div>
          ) : (
            <>
              <div className="messages-header">
                <h3>{selectedThread.userName}</h3>
                <button 
                  className="btn btn-sm btn-outline"
                  onClick={() => handleBlock(selectedThread.id)}
                >
                  {selectedThread.isBlocked ? 'Unblock' : 'Block'}
                </button>
              </div>

              <div className="messages-list">
                {messages.map(msg => (
                  <div key={msg.id} className={`message ${msg.isFromAdmin ? 'from-me' : 'from-them'}`}>
                    <div className="message-content">{msg.content}</div>
                    <div className="message-time">
                      {new Date(msg.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              {!selectedThread.isBlocked && (
                <form className="message-form" onSubmit={sendMessage}>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                  />
                  <button type="submit" className="btn btn-primary">Send</button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// MEMBERS TAB
// ============================================================================

function MembersTab({ community }) {
  return (
    <div className="members-tab">
      <div className="page-header">
        <h1>Members</h1>
        <p>View your community members</p>
      </div>

      <div className="stats-summary">
        <div className="stat-item">
          <span className="stat-value">{community.memberCount || 0}</span>
          <span className="stat-label">Total Members</span>
        </div>
      </div>

      <div className="info-card">
        <p>Detailed member management will be available in a future update.</p>
        <p className="text-secondary">Currently, you can view member count and communicate via messages.</p>
      </div>
    </div>
  )
}

export default App
