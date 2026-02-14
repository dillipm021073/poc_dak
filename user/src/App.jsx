// D.A.K MVP v3 - User Dashboard
// Lean MVP Specification v1.4 FINAL

import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, Link, useLocation, useParams, useNavigate } from 'react-router-dom'
import api, { setToken, getToken } from './api'

// ============================================================================
// ICONS & UI COMPONENTS
// ============================================================================

// Neutral D.A.K logo (no religious symbol)
const DakLogo = ({ size = 32 }) => (
  <div className="dak-logo" style={{ width: size, height: size, fontSize: size * 0.4, lineHeight: size + 'px' }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="var(--primary)" strokeWidth="1.5" />
      <path d="M8 8l4 4-4 4M13 8h3M13 12h3M13 16h3" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
)

// Religion-specific community symbols
const CommunitySymbol = ({ communityType, size = 24, color = 'var(--primary)' }) => {
  switch (communityType) {
    case 'judaism':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <polygon points="12,2 4,14 20,14" stroke={color} strokeWidth="1.5" fill="none"/>
          <polygon points="12,22 4,10 20,10" stroke={color} strokeWidth="1.5" fill="none"/>
        </svg>
      )
    case 'christianity':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <line x1="12" y1="2" x2="12" y2="22" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="5" y1="9" x2="19" y2="9" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      )
    case 'islam':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M15 4a8 8 0 100 16 6 6 0 110-16z" stroke={color} strokeWidth="1.5"/>
          <circle cx="17" cy="7" r="1.5" fill={color}/>
        </svg>
      )
    case 'hinduism':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M12 4c-1.5 2-3 3-3 5a3 3 0 006 0c0-2-1.5-3-3-5z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M9 12c-2 1-4 2.5-4 4.5C5 18.5 7 20 9 20c1.5 0 2.5-1 3-2" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M15 12c2 1 4 2.5 4 4.5c0 2-2 3.5-4 3.5c-1.5 0-2.5-1-3-2" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="12" cy="21" r="1" fill={color}/>
        </svg>
      )
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5"/>
          <circle cx="12" cy="12" r="3" fill={color}/>
        </svg>
      )
  }
}

// ============================================================================
// EVENT COLOR & MULTI-DAY HELPERS
// ============================================================================

const COMMUNITY_COLORS = [
  { bg: '#dbeafe', border: '#2563eb', text: '#1e40af' },  // Blue
  { bg: '#dcfce7', border: '#16a34a', text: '#166534' },  // Green
  { bg: '#fef3c7', border: '#d97706', text: '#92400e' },  // Amber
  { bg: '#fce7f3', border: '#db2777', text: '#9d174d' },  // Pink
  { bg: '#e0e7ff', border: '#6366f1', text: '#4338ca' },  // Indigo
  { bg: '#ffedd5', border: '#ea580c', text: '#9a3412' },  // Orange
  { bg: '#f3e8ff', border: '#9333ea', text: '#6b21a8' },  // Purple
  { bg: '#ccfbf1', border: '#0d9488', text: '#115e59' },  // Teal
]

function getCommunityColor(communityId) {
  if (!communityId) return COMMUNITY_COLORS[0]
  let hash = 0
  for (let i = 0; i < communityId.length; i++) {
    hash = ((hash << 5) - hash) + communityId.charCodeAt(i)
    hash |= 0
  }
  return COMMUNITY_COLORS[Math.abs(hash) % COMMUNITY_COLORS.length]
}

function isMultiDayEvent(event) {
  if (!event.endsAt || !event.startsAt) return false
  const start = new Date(event.startsAt)
  const end = new Date(event.endsAt)
  return start.toDateString() !== end.toDateString()
}

function eventSpansDays(event) {
  if (!event.endsAt || !event.startsAt) return 1
  const start = new Date(event.startsAt)
  const end = new Date(event.endsAt)
  const diffMs = end.getTime() - start.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1
}

// ============================================================================
// NOTIFICATION BELL
// ============================================================================

function NotificationBell() {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    loadNotifications()
    const interval = setInterval(loadNotifications, 60000)
    return () => clearInterval(interval)
  }, [])

  const loadNotifications = async () => {
    try {
      const [notifs, countData] = await Promise.all([
        api.notifications.getAll(),
        api.notifications.getUnreadCount()
      ])
      setNotifications(notifs)
      setUnreadCount(countData.count)
    } catch (err) {
      console.error('Failed to load notifications:', err)
    }
  }

  const handleMarkAllRead = async () => {
    await api.notifications.markAllRead()
    setUnreadCount(0)
    loadNotifications()
  }

  const getIcon = (type) => {
    switch(type) {
      case 'access': return '✨'
      case 'event': return '📅'
      case 'stream': return '📺'
      case 'message': return '💬'
      case 'welcome': return '👋'
      default: return '🔔'
    }
  }

  return (
    <div className="notification-wrapper">
      <button className="nav-bell" onClick={() => setOpen(!open)}>
        🔔
        {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
      </button>
      {open && (
        <div className="dropdown-menu notification-dropdown">
          <div className="dropdown-header">
            <h4>Notifications</h4>
            {unreadCount > 0 && (
              <button className="btn-link" onClick={handleMarkAllRead}>Mark all read</button>
            )}
          </div>
          <div className="dropdown-body">
            {notifications.length === 0 ? (
              <p className="empty-state">No notifications</p>
            ) : (
              notifications.slice(0, 10).map(n => (
                <div key={n.id} className={`notification-item ${!n.isRead ? 'unread' : ''}`}>
                  <span className="notification-icon">{getIcon(n.type)}</span>
                  <div className="notification-content">
                    <strong>{n.title}</strong>
                    <p>{n.message}</p>
                    <small>{new Date(n.createdAt).toLocaleDateString()}</small>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// CHANGE PASSWORD MODAL
// ============================================================================

function ChangePasswordModal({ onClose }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    setLoading(true)
    try {
      const result = await api.auth.changePassword({ currentPassword, newPassword })
      setSuccess(result.message)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Change Password</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {!success ? (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Current Password</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={6} required />
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={6} required />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        ) : (
          <button className="btn btn-primary btn-block" onClick={onClose}>Done</button>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// TOP NAVIGATION
// ============================================================================

function TopNav({ user, onLogout }) {
  const location = useLocation()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)

  return (
    <nav className="top-nav">
      <Link to="/" className="nav-brand">
        <DakLogo size={24} />
        <span>D.A.K</span>
      </Link>

      {user ? (
        <>
          <div className="nav-links">
            <Link to="/messages" className={`nav-link ${location.pathname === '/messages' ? 'active' : ''}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              Chat
            </Link>
            <Link to="/calendar" className={`nav-link ${location.pathname === '/calendar' ? 'active' : ''}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Calendar
            </Link>
            <Link to="/activity" className={`nav-link ${location.pathname === '/activity' ? 'active' : ''}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
              Activity
            </Link>
            <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              Updates
            </Link>
          </div>

          <div className="nav-right">
            <NotificationBell />
            <div className="nav-user-wrapper">
              <div className="nav-user" onClick={() => setUserMenuOpen(!userMenuOpen)}>
                <img
                  className="avatar-img"
                  src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=2563eb&color=fff&size=32`}
                  alt=""
                />
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              {userMenuOpen && (
                <div className="user-dropdown">
                  <div className="user-dropdown-header">
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                  </div>
                  <button className="user-dropdown-item" onClick={() => { setShowChangePassword(true); setUserMenuOpen(false) }}>Change Password</button>
                  <button className="user-dropdown-item" onClick={onLogout}>Sign Out</button>
                </div>
              )}
            </div>
          </div>
          {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
        </>
      ) : (
        <div className="nav-right">
          <Link to="/login" className="btn btn-outline">Sign In</Link>
        </div>
      )}
    </nav>
  )
}

// ============================================================================
// PUBLIC LANDING PAGE (Waiting List Only)
// ============================================================================

function LandingPage() {
  const [email, setEmail] = useState('')
  const [communityType, setCommunityType] = useState('')
  const [institution, setInstitution] = useState('')
  const [submitted, setSubmitted] = useState(false)
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
      await api.waitingList.join({
        email,
        communityType,
        recommendedInstitution: institution
      })
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="landing-page">
        <div className="landing-card success-card">
          <div className="success-icon">✓</div>
          <h2>Thank You!</h2>
          <p>We'll notify you when communities in your area become available.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="landing-page">
      <div className="landing-hero">
        <DakLogo size={64} />
        <h1>D.A.K</h1>
        <p className="tagline">Digital Access Key — Connect with your faith community</p>
      </div>

      <div className="landing-card">
        <h2>Join the Waiting List</h2>
        <p className="text-secondary">Be notified when your community goes live</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="waiting-form">
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
          </div>

          <div className="form-group">
            <label>Community Type</label>
            <select
              value={communityType}
              onChange={(e) => setCommunityType(e.target.value)}
              required
            >
              <option value="">Select...</option>
              {communityTypes.map(ct => (
                <option key={ct.value} value={ct.value}>{ct.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Recommend an Institution (Optional)</label>
            <input
              type="text"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="e.g., Temple Beth Israel"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Submitting...' : 'Join Waiting List'}
          </button>
        </form>
      </div>

      <p className="landing-footer">
        Already have an invite? <Link to="/login">Sign In</Link>
      </p>
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
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotMsg, setForgotMsg] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await api.auth.login({ email, password })
      setToken(result.token)
      onLogin(result.user)
      navigate('/')
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setForgotMsg('')
    try {
      const result = await api.auth.forgotPassword(forgotEmail)
      setForgotMsg(result.message)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  if (forgotMode) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <DakLogo size={48} />
            <h1>Reset Password</h1>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {forgotMsg && <div className="alert alert-success">{forgotMsg}</div>}

          {!forgotMsg && (
            <form onSubmit={handleForgot}>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          )}

          <p className="auth-footer">
            <button className="btn-link" onClick={() => { setForgotMode(false); setError(''); setForgotMsg('') }}>
              Back to Sign In
            </button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <DakLogo size={48} />
          <h1>Sign In</h1>
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

          <div className="forgot-password-link">
            <button type="button" className="btn-link" onClick={() => { setForgotMode(true); setError('') }}>
              Forgot Password?
            </button>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="auth-footer">
          Don't have an account? You need an invite link from a community.
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// REGISTER PAGE (Via Invite Link)
// ============================================================================

function RegisterPage({ onLogin }) {
  const { inviteLink } = useParams()
  const [community, setCommunity] = useState(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    loadCommunity()
  }, [inviteLink])

  const loadCommunity = async () => {
    try {
      const data = await api.communities.getByInvite(inviteLink)
      setCommunity(data)
    } catch (err) {
      setError('Invalid or expired invite link')
    }
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      const result = await api.auth.register({
        name,
        email,
        password,
        inviteLink
      })
      setToken(result.token)
      onLogin(result.user)
      navigate('/')
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  if (loading) return <div className="loading-page">Loading...</div>

  if (!community) {
    return (
      <div className="auth-page">
        <div className="auth-card error-card">
          <h2>Invalid Invite</h2>
          <p>{error || 'This invite link is invalid or has expired.'}</p>
          <Link to="/" className="btn btn-primary">Go Home</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <DakLogo size={48} />
          <h1>Join {community.name}</h1>
        </div>

        <div className="community-preview">
          {community.logoUrl && <img src={community.logoUrl} alt="" className="community-logo" />}
          <p className="confirmation-message">{community.confirmationMessage}</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

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
              minLength={6}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign In</Link>
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// HOME - USER DASHBOARD
// ============================================================================

function HomePage({ user }) {
  const [communities, setCommunities] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    loadCommunities()
  }, [])

  const loadCommunities = async () => {
    try {
      const data = await api.communities.getMy()
      setCommunities(data)
    } catch (err) {
      console.error('Failed to load communities:', err)
    }
    setLoading(false)
  }

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Welcome, {user.name}</h1>
        <p className="text-secondary">Your communities in the {user.communityType} network</p>
      </div>

      {communities.length === 0 ? (
        <div className="empty-state">
          <p>You haven't joined any communities yet.</p>
          <p className="text-secondary">Use an invite link from a community to get started.</p>
        </div>
      ) : (
        <div className="community-grid">
          {communities.map(community => (
            <CommunityCard key={community.id} community={community} onClick={() => { sessionStorage.setItem('dak_community', community.id); navigate('/community') }} />
          ))}
        </div>
      )}

      {/* Global Access Placeholder */}
      <div className="global-access-placeholder">
        <h3>🌍 Global Access</h3>
        <p>Coming soon — Access all communities in your network with one subscription.</p>
      </div>
    </div>
  )
}

// Community Card Component
function CommunityCard({ community, onClick }) {
  return (
    <div className="community-card" onClick={onClick}>
      <div className="community-card-header">
        {community.logoUrl ? (
          <img src={community.logoUrl} alt="" className="community-logo" />
        ) : (
          <div className="community-logo-placeholder">
            <CommunitySymbol communityType={community.communityType} size={28} color="white" />
          </div>
        )}
        <div className="community-info">
          <h3>{community.name}</h3>
          <span className="community-type">{community.communityType}</span>
        </div>
      </div>

      <div className="community-card-body">
        {community.messageOfDay && (
          <p className="message-of-day">"{community.messageOfDay}"</p>
        )}
      </div>

      <div className="community-card-footer">
        <AccessBadge community={community} />
      </div>
    </div>
  )
}

// Access Status Badge
function AccessBadge({ community }) {
  if (community.membershipStatus === 'pending') {
    return (
      <div className="access-badge view-only" style={{ background: '#fef3c7', color: '#92400e' }}>
        <span className="access-icon">⏳</span>
        <span>Pending Approval</span>
      </div>
    )
  }

  if (community.hasActiveAccess) {
    return (
      <div className="access-badge active">
        <span className="access-icon">✓</span>
        <span>Active Access</span>
        <span className="days-remaining">{community.daysRemaining} days</span>
      </div>
    )
  }

  return (
    <div className="access-badge view-only">
      <span className="access-icon">👁</span>
      <span>View Only</span>
    </div>
  )
}

// ============================================================================
// COMMUNITY PAGE
// ============================================================================

// ============================================================================
// MINI CALENDAR WIDGET
// ============================================================================

function MiniCalendar({ events = [], community }) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const getWeekDates = () => {
    const start = new Date(currentDate)
    const day = start.getDay()
    const diff = day === 0 ? -6 : 1 - day
    start.setDate(start.getDate() + diff)
    const dates = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      dates.push(d)
    }
    return dates
  }

  const weekDates = getWeekDates()
  const dayLabels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  const getEventsForDate = (date) => {
    const dateStart = new Date(date)
    dateStart.setHours(0, 0, 0, 0)
    const dateEnd = new Date(date)
    dateEnd.setHours(23, 59, 59, 999)
    return events.filter(event => {
      const start = new Date(event.startsAt)
      const end = event.endsAt ? new Date(event.endsAt) : start
      return start <= dateEnd && end >= dateStart
    })
  }

  const isToday = (date) => date.toDateString() === new Date().toDateString()

  const prevWeek = () => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() - 7)
    setCurrentDate(d)
  }

  const nextWeek = () => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + 7)
    setCurrentDate(d)
  }

  return (
    <div className="mini-calendar">
      <div className="mini-calendar-header">
        <span className="mini-calendar-title">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </span>
        <div className="mini-calendar-nav">
          <button onClick={prevWeek}>&lt;</button>
          <button onClick={nextWeek}>&gt;</button>
        </div>
      </div>
      <div className="mini-calendar-grid">
        {weekDates.map((date, i) => {
          const dayEvents = getEventsForDate(date)
          return (
            <div key={i} className="mini-calendar-day">
              <span className="mini-cal-label">{dayLabels[i]}</span>
              <span className={`mini-cal-date ${isToday(date) ? 'today' : ''}`}>
                {date.getDate()}
              </span>
              <div className="mini-cal-indicators">
                {dayEvents.slice(0, 3).map((evt, j) => {
                  const color = getCommunityColor(evt.communityId || (community && community.id))
                  const multiDay = isMultiDayEvent(evt)
                  return (
                    <span
                      key={j}
                      className={`mini-cal-dot ${multiDay ? 'mini-cal-bar' : ''}`}
                      style={{ background: color.border }}
                      title={`${evt.title}${community ? ' - ' + community.name : ''}`}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================================
// UPCOMING EVENTS SIDEBAR
// ============================================================================

function UpcomingEventsSidebar({ events = [], community }) {
  const upcoming = events
    .filter(e => new Date(e.startsAt) >= new Date())
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    .slice(0, 3)

  const formatDay = (dateStr) => {
    const d = new Date(dateStr)
    return d.getDate()
  }

  const formatWeekday = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en', { weekday: 'short' })
  }

  const formatDateRight = (dateStr) => {
    const d = new Date(dateStr)
    return `${d.toLocaleDateString('en', { weekday: 'short' })}, ${d.toLocaleDateString('en', { month: 'short' })} ${d.getDate()}`
  }

  return (
    <div className="sidebar-card">
      <div className="sidebar-card-header">
        <h3>Upcoming Events</h3>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
      </div>
      <div className="sidebar-card-body">
        {upcoming.length === 0 ? (
          <p className="text-secondary" style={{ padding: '16px', fontSize: '14px' }}>No upcoming events</p>
        ) : (
          upcoming.map(event => {
            const color = getCommunityColor(event.communityId || (community && community.id))
            const multiDay = isMultiDayEvent(event)
            return (
              <div key={event.id} className="upcoming-event-item" style={{ borderLeft: `3px solid ${color.border}` }}>
                <div className="upcoming-event-date-icon" style={{ background: color.bg }}>
                  <span className="ue-day" style={{ color: color.text }}>{formatDay(event.startsAt)}</span>
                </div>
                <div className="upcoming-event-info">
                  <strong>{event.title}</strong>
                  <span>
                    {new Date(event.startsAt).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}
                    {multiDay && ' (multi-day)'}
                  </span>
                </div>
                <div className="upcoming-event-right">
                  {formatDateRight(event.startsAt)}
                  {multiDay && <span className="multi-day-indicator"> - {formatDateRight(event.endsAt)}</span>}
                </div>
                <div className="event-tooltip">
                  <strong>{event.title}</strong>
                  {community && <span>{community.name}</span>}
                  {multiDay && <span>{formatDateRight(event.startsAt)} - {formatDateRight(event.endsAt)}</span>}
                  {event.description && <p>{event.description}</p>}
                </div>
              </div>
            )
          })
        )}
      </div>
      <Link to="/calendar" className="sidebar-card-link">View full calendar</Link>
    </div>
  )
}

// ============================================================================
// RECENTLY ADDED SIDEBAR
// ============================================================================

function RecentlyAddedSidebar({ streams = [] }) {
  const recent = streams
    .filter(s => s.recordingUrl)
    .sort((a, b) => new Date(b.createdAt || b.scheduledFor) - new Date(a.createdAt || a.scheduledFor))
    .slice(0, 2)

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Today'
    if (days === 1) return '1 day ago'
    return `${days} days ago`
  }

  return (
    <div className="sidebar-card">
      <div className="sidebar-card-header">
        <h3>Recently Added</h3>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
      </div>
      <div className="sidebar-card-body">
        {recent.length === 0 ? (
          <p className="text-secondary" style={{ padding: '16px', fontSize: '14px' }}>No recent media</p>
        ) : (
          recent.map(item => (
            <div key={item.id} className="recent-media-item">
              <div className="recent-media-thumb">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
              </div>
              <div className="recent-media-info">
                <strong>{item.title}</strong>
                <span className="recent-media-type">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5,3 19,12 5,21"/></svg>
                  Video
                </span>
              </div>
              <span className="recent-media-time">{timeAgo(item.createdAt || item.scheduledFor)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ============================================================================
// LIVE STREAM PLAYER
// ============================================================================

function LiveStreamPlayer({ stream }) {
  if (!stream) {
    return (
      <div className="livestream-section">
        <div className="section-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          <h3>Live Stream</h3>
        </div>
        <div className="livestream-placeholder">
          <p>No live stream at the moment</p>
        </div>
      </div>
    )
  }

  return (
    <div className="livestream-section">
      <div className="section-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        <h3>Live Stream</h3>
      </div>
      <div className="livestream-player">
        <div className="livestream-video">
          <div className="livestream-overlay">
            <span className="live-tag">LIVE</span>
            <span className="viewer-count">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              {stream.currentViewers || 0}
            </span>
          </div>
          <div className="livestream-poster">
            {stream.thumbnailUrl ? (
              <img src={stream.thumbnailUrl} alt="" />
            ) : (
              <div className="livestream-poster-placeholder" />
            )}
          </div>
        </div>
        <div className="livestream-controls">
          <div className="controls-left">
            <button className="control-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
            </button>
            <button className="control-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            </button>
            <button className="control-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
            </button>
            <div className="volume-slider">
              <div className="volume-track"><div className="volume-fill" style={{ width: '60%' }} /></div>
            </div>
          </div>
          <div className="controls-right">
            <button className="control-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            </button>
            <button className="control-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SUPPORT WIDGET
// ============================================================================

function SupportWidget({ community, communityId, onActivated }) {
  const [supportType, setSupportType] = useState('one-time')
  const [amount, setAmount] = useState('72.00')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successData, setSuccessData] = useState(null)

  const presets = [16, 36, 100, 250]

  const handleSupport = async () => {
    setLoading(true)
    setError('')
    try {
      const paymentResult = await api.access.activate({
        communityId,
        amount: parseFloat(amount),
        donationMethod: 'card',
        comment: comment.trim() || undefined
      })
      const result = await api.access.completePayment(paymentResult.paymentId)
      setSuccessData({
        amount: parseFloat(amount),
        daysGranted: result.daysGranted,
        daysRemaining: result.daysRemaining,
        expiresAt: result.expiresAt
      })
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const handleDone = () => {
    setSuccessData(null)
    setAmount('72.00')
    setComment('')
    if (onActivated) onActivated()
  }

  if (successData) {
    return (
      <div className="support-widget">
        <div className="support-success-overlay">
          <div className="support-success-icon">✓</div>
          <h3>Thank you for your support!</h3>
          <div className="support-success-details">
            <div className="support-success-row">
              <span>Amount</span>
              <strong>${successData.amount.toFixed(2)}</strong>
            </div>
            <div className="support-success-row">
              <span>Access granted</span>
              <strong>{successData.daysGranted} days</strong>
            </div>
            <div className="support-success-row">
              <span>Total remaining</span>
              <strong>{successData.daysRemaining} days</strong>
            </div>
            <div className="support-success-row">
              <span>Expires</span>
              <strong>{new Date(successData.expiresAt).toLocaleDateString()}</strong>
            </div>
          </div>
          <button className="btn btn-primary btn-block support-btn" onClick={handleDone}>
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="support-widget">
      <div className="support-header">
        <CommunitySymbol communityType={community.communityType} size={32} />
        <div>
          <h3>Support {community.name}</h3>
          <p>Your support helps keep this <strong>community</strong> active.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="support-type-toggle">
        <button
          className={supportType === 'one-time' ? 'active' : ''}
          onClick={() => setSupportType('one-time')}
        >One-time</button>
        <button
          className={supportType === 'monthly' ? 'active' : ''}
          onClick={() => setSupportType('monthly')}
        >Monthly</button>
      </div>

      <div className="support-amounts">
        {presets.map(preset => (
          <button
            key={preset}
            className={`support-amount-btn ${parseFloat(amount) === preset ? 'active' : ''}`}
            onClick={() => setAmount(preset.toString())}
          >
            ${preset}
          </button>
        ))}
        <div className="support-custom-input">
          <span className="currency-symbol">$</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="1"
            step="0.01"
          />
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 12 }}>
        <textarea
          className="support-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment (optional)"
          rows={2}
          maxLength={500}
        />
      </div>

      <p className="platform-fee-note">5% goes to platform upkeep</p>

      <button
        className="btn btn-primary btn-block support-btn"
        onClick={handleSupport}
        disabled={loading || !amount || parseFloat(amount) <= 0}
      >
        {loading ? 'Processing...' : 'Continue to Support'}
      </button>
    </div>
  )
}

// ============================================================================
// COMMUNITY PAGE
// ============================================================================

function CommunityPage() {
  const navigate = useNavigate()
  const id = sessionStorage.getItem('dak_community')
  const [community, setCommunity] = useState(null)
  const [events, setEvents] = useState([])
  const [streams, setStreams] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (!id) { navigate('/'); return }
    loadCommunity()
  }, [id])

  const loadCommunity = async () => {
    try {
      const [communityData, eventsData, streamsData] = await Promise.all([
        api.communities.getOne(id),
        api.events.getForCommunity(id),
        api.streams.getForCommunity(id)
      ])
      setCommunity(communityData)
      setEvents(eventsData.events || eventsData)
      setStreams(streamsData)
    } catch (err) {
      console.error('Failed to load community:', err)
    }
    setLoading(false)
  }

  if (!id) return null
  if (loading) return <div className="loading">Loading...</div>
  if (!community) return <div className="error-page">Community not found</div>

  const liveStream = streams.find(s => s.isLive)

  return (
    <div className="community-page">
      {/* Clean Header */}
      <div className="community-header-clean">
        <div className="community-header-left">
          <CommunitySymbol communityType={community.communityType} size={40} />
          <div>
            <h1>{community.name}</h1>
            <p className="community-location">{community.location || community.city || 'City, State'}</p>
          </div>
        </div>
      </div>

      {/* Pending Approval Banner */}
      {community.membershipStatus === 'pending' && (
        <div className="alert alert-warning" style={{ margin: '1rem 0', padding: '0.75rem 1rem', background: '#fef3c7', color: '#92400e', borderRadius: '8px', textAlign: 'center' }}>
          Your membership is pending approval by the community administrator.
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>Overview</button>
        <button className={activeTab === 'livestream' ? 'active' : ''} onClick={() => setActiveTab('livestream')}>Livestream</button>
        <button className={activeTab === 'community' ? 'active' : ''} onClick={() => setActiveTab('community')}>Community</button>
      </div>

      {/* Tab Content */}
      <div className="tab-content-wrapper">
        {activeTab === 'overview' && (
          <div className="overview-two-col">
            {/* Main Content */}
            <div className="overview-main">
              <LiveStreamPlayer stream={liveStream} />
              <SupportWidget community={community} communityId={id} onActivated={loadCommunity} />
            </div>

            {/* Sidebar */}
            <div className="overview-sidebar">
              <UpcomingEventsSidebar events={events} community={community} />
              <MiniCalendar events={events} community={community} />
              <RecentlyAddedSidebar streams={streams} />
            </div>
          </div>
        )}

        {activeTab === 'livestream' && (
          <StreamsTab streams={streams} community={community} />
        )}

        {activeTab === 'community' && (
          <div className="community-tab-content">
            {community.messageOfDay && (
              <div className="message-of-day-card">
                <h4>Message of the Day</h4>
                <p>"{community.messageOfDay}"</p>
              </div>
            )}
            <div className="about-section">
              <h4>About</h4>
              <p>{community.aboutText || community.shortDescription || 'No description available.'}</p>
            </div>
            {!community.isViewOnly && (
              <MessagesTab communityId={id} communityName={community.name} />
            )}
            <EventsTab events={events} isViewOnly={community.isViewOnly} community={community} />
          </div>
        )}
      </div>
    </div>
  )
}

// ActivateAccessPanel is replaced by SupportWidget in the new overview layout

// ============================================================================
// EVENTS TAB
// ============================================================================

function EventsTab({ events, isViewOnly, community }) {
  if (isViewOnly) {
    return (
      <div className="view-only-message">
        <p>🔒 Activate Active Access to view the community calendar and events</p>
      </div>
    )
  }

  if (events.length === 0) {
    return <div className="empty-state">No upcoming events</div>
  }

  return (
    <div className="events-list">
      {events.map(event => {
        const color = getCommunityColor(community && community.id)
        const multiDay = isMultiDayEvent(event)
        return (
          <div key={event.id} className={`event-card ${multiDay ? 'multi-day' : ''}`} style={{ borderLeft: `4px solid ${color.border}` }}>
            <div className="event-date" style={{ background: color.bg }}>
              <span className="month" style={{ color: color.border }}>{new Date(event.startsAt).toLocaleDateString('en', { month: 'short' })}</span>
              <span className="day">{new Date(event.startsAt).getDate()}</span>
              {multiDay && (
                <span className="multi-day-badge" style={{ background: color.border }}>
                  {eventSpansDays(event)}d
                </span>
              )}
            </div>
            <div className="event-info">
              <h4>{event.title}</h4>
              <p className="event-time">
                {new Date(event.startsAt).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}
                {multiDay && ` - ${new Date(event.endsAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })} ${new Date(event.endsAt).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}`}
                {event.location && ` • ${event.location}`}
                {event.isVirtual && ' • Virtual'}
              </p>
              {event.description && <p className="event-description">{event.description}</p>}
            </div>
            <button className="btn btn-sm btn-outline" onClick={() => api.events.exportIcs(event.id)}>
              Add to Calendar
            </button>
            <div className="event-tooltip">
              <strong>{event.title}</strong>
              {community && <span>{community.name}</span>}
              <span>
                {new Date(event.startsAt).toLocaleString()}
                {multiDay && ` - ${new Date(event.endsAt).toLocaleString()}`}
              </span>
              {event.location && <span>{event.location}</span>}
              {event.description && <p>{event.description}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================================
// STREAMS TAB
// ============================================================================

function StreamsTab({ streams, community }) {
  const liveStream = streams.find(s => s.isLive)

  return (
    <div className="streams-tab">
      {liveStream && (
        <div className="live-stream-card">
          <span className="live-badge">🔴 LIVE</span>
          <h4>{liveStream.title}</h4>
          <p>{liveStream.currentViewers} watching</p>
          <button className="btn btn-primary">Watch Now</button>
        </div>
      )}

      <h4>Upcoming & Past Streams</h4>
      {streams.length === 0 ? (
        <div className="empty-state">No streams scheduled</div>
      ) : (
        <div className="streams-list">
          {streams.filter(s => !s.isLive).map(stream => (
            <div key={stream.id} className="stream-card">
              <div className="stream-info">
                <h5>{stream.title}</h5>
                {stream.scheduledFor && (
                  <p className="stream-time">
                    {new Date(stream.scheduledFor).toLocaleString()}
                  </p>
                )}
                {stream.recordingUrl && (
                  <div className="recording-section">
                    {community.hasActiveAccess ? (
                      <a href={stream.recordingUrl} className="btn btn-sm btn-primary">▶ Watch Recording</a>
                    ) : (
                      <p className="gated-message">🔒 Active Access required to watch recording</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// MESSAGES TAB
// ============================================================================

function MessagesTab({ communityId, communityName }) {
  const [threads, setThreads] = useState([])
  const [selectedThread, setSelectedThread] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadThreads()
  }, [])

  const loadThreads = async () => {
    try {
      const data = await api.messages.getThreads()
      const communityThreads = data.filter(t => t.communityId === communityId)
      setThreads(communityThreads)
      if (communityThreads.length > 0) {
        selectThread(communityThreads[0])
      }
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
    if (!newMessage.trim()) return

    try {
      if (selectedThread) {
        await api.messages.sendMessage(selectedThread.id, newMessage)
        selectThread(selectedThread)
      } else {
        const result = await api.messages.startThread(communityId, newMessage)
        loadThreads()
      }
      setNewMessage('')
    } catch (err) {
      console.error('Failed to send message:', err)
    }
  }

  if (loading) return <div className="loading">Loading messages...</div>

  return (
    <div className="messages-tab">
      <div className="messages-container">
        {messages.length === 0 && !selectedThread ? (
          <div className="empty-messages">
            <p>No messages yet. Start a conversation with the community.</p>
          </div>
        ) : (
          <div className="messages-list">
            {messages.map(msg => (
              <div key={msg.id} className={`message ${msg.isFromAdmin ? 'from-admin' : 'from-me'}`}>
                <div className="message-content">{msg.content}</div>
                <div className="message-meta">
                  <span className="sender">{msg.senderName}</span>
                  <span className="time">{new Date(msg.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <form className="message-form" onSubmit={sendMessage}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Message ${communityName}...`}
          />
          <button type="submit" className="btn btn-primary">Send</button>
        </form>
      </div>
    </div>
  )
}

// ============================================================================
// CALENDAR PAGE (Aggregated)
// ============================================================================

function CalendarPage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCalendar()
  }, [])

  const loadCalendar = async () => {
    try {
      const data = await api.events.getMyCalendar()
      setEvents(data)
    } catch (err) {
      console.error('Failed to load calendar:', err)
    }
    setLoading(false)
  }

  if (loading) return <div className="loading">Loading calendar...</div>

  return (
    <div className="calendar-page">
      <h1>My Calendar</h1>
      <p className="text-secondary">Upcoming events from all your communities</p>

      {events.length === 0 ? (
        <div className="empty-state">
          <p>No upcoming events</p>
          <p className="text-secondary">Events from your communities with Active Access will appear here</p>
        </div>
      ) : (
        <div className="calendar-events">
          {events.map(event => {
            const color = getCommunityColor(event.communityId)
            const multiDay = isMultiDayEvent(event)
            return (
              <div key={event.id} className={`calendar-event-card ${multiDay ? 'multi-day' : ''}`} style={{ borderLeft: `4px solid ${color.border}` }}>
                <div className="event-date" style={{ background: color.bg }}>
                  <span className="month" style={{ color: color.border }}>{new Date(event.startsAt).toLocaleDateString('en', { month: 'short' })}</span>
                  <span className="day">{new Date(event.startsAt).getDate()}</span>
                  {multiDay && (
                    <span className="multi-day-badge" style={{ background: color.border }}>
                      {eventSpansDays(event)} days
                    </span>
                  )}
                </div>
                <div className="event-details">
                  <h4>{event.title}</h4>
                  <p className="community-name" style={{ color: color.text }}>{event.communityName}</p>
                  <p className="event-time">
                    {new Date(event.startsAt).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}
                    {multiDay && ` - ${new Date(event.endsAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })} ${new Date(event.endsAt).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}`}
                  </p>
                </div>
                <button className="btn btn-sm btn-outline" onClick={() => api.events.exportIcs(event.id)}>
                  Add to Calendar
                </button>
                <div className="event-tooltip">
                  <strong>{event.title}</strong>
                  <span>{event.communityName}</span>
                  <span>
                    {new Date(event.startsAt).toLocaleString()}
                    {multiDay && ` - ${new Date(event.endsAt).toLocaleString()}`}
                  </span>
                  {event.location && <span>{event.location}</span>}
                  {event.description && <p>{event.description}</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// MESSAGES PAGE (All Threads)
// ============================================================================

function MessagesPage() {
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    loadThreads()
  }, [])

  const loadThreads = async () => {
    try {
      const data = await api.messages.getThreads()
      setThreads(data)
    } catch (err) {
      console.error('Failed to load threads:', err)
    }
    setLoading(false)
  }

  if (loading) return <div className="loading">Loading messages...</div>

  return (
    <div className="messages-page">
      <h1>Messages</h1>
      
      {threads.length === 0 ? (
        <div className="empty-state">
          <p>No messages yet</p>
          <p className="text-secondary">Start a conversation from a community page</p>
        </div>
      ) : (
        <div className="threads-list">
          {threads.map(thread => (
            <div 
              key={thread.id} 
              className={`thread-card ${thread.unreadCount > 0 ? 'unread' : ''}`}
              onClick={() => { sessionStorage.setItem('dak_community', thread.communityId); navigate('/community') }}
            >
              <div className="thread-info">
                <h4>{thread.communityName}</h4>
                <p className="last-message">{thread.lastMessage}</p>
              </div>
              <div className="thread-meta">
                {thread.unreadCount > 0 && (
                  <span className="unread-badge">{thread.unreadCount}</span>
                )}
                <span className="time">{new Date(thread.lastMessageAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// ACTIVITY PAGE (Payment History + Access Status)
// ============================================================================

function ActivityPage() {
  const [payments, setPayments] = useState([])
  const [accessList, setAccessList] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadActivity()
  }, [])

  const loadActivity = async () => {
    try {
      const [paymentsData, accessData] = await Promise.all([
        api.access.getAllPayments(),
        api.access.getMyAccess()
      ])
      setPayments(paymentsData)
      setAccessList(accessData)
    } catch (err) {
      console.error('Failed to load activity:', err)
    }
    setLoading(false)
  }

  if (loading) return <div className="loading">Loading activity...</div>

  return (
    <div className="activity-page">
      <h1>My Activity</h1>
      <p className="text-secondary">Your access status and payment history</p>

      {/* Current Access Status */}
      {accessList.length > 0 && (
        <section className="activity-section">
          <h2>Current Access</h2>
          <div className="access-status-grid">
            {accessList.map(a => (
              <div key={a.communityId} className="access-status-card">
                <div className="access-status-header">
                  <strong>{a.communityName}</strong>
                  <span className={`access-status-badge ${a.hasActiveAccess ? 'active' : 'expired'}`}>
                    {a.hasActiveAccess ? 'Active' : 'Expired'}
                  </span>
                </div>
                {a.hasActiveAccess ? (
                  <div className="access-status-body">
                    <span>{a.daysRemaining} days remaining</span>
                    <span className="text-secondary">Expires {new Date(a.expiresAt).toLocaleDateString()}</span>
                  </div>
                ) : (
                  <div className="access-status-body">
                    <span className="text-secondary">No active access</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Donation History */}
      <section className="activity-section">
        <h2>Donation History</h2>
        {payments.length === 0 ? (
          <div className="empty-state">
            <p>No donations yet</p>
            <p className="text-secondary">Support a community to see your donation history here</p>
          </div>
        ) : (
          <div className="donation-history-table-wrap">
            <table className="donation-history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Community</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Comment</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td className="donation-date">{new Date(p.created_at).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                    <td><strong>{p.community_name}</strong></td>
                    <td>
                      <span className="donation-method-badge">
                        {p.donation_method === 'card' ? '💳' : '🏦'} {p.donation_method || 'card'}
                      </span>
                    </td>
                    <td className="donation-amount">${parseFloat(p.amount).toFixed(2)}</td>
                    <td className="donation-comment">{p.comment || <span className="text-secondary">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

// ============================================================================
// MAIN APP
// ============================================================================

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const token = getToken()
    if (token) {
      try {
        const userData = await api.auth.me()
        setUser(userData)
      } catch (err) {
        setToken(null)
      }
    }
    setLoading(false)
  }

  const handleLogin = (userData) => {
    setUser(userData)
  }

  const handleLogout = () => {
    setToken(null)
    setUser(null)
  }

  if (loading) {
    return (
      <div className="app-loading">
        <DakLogo size={64} />
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="app">
      <TopNav user={user} onLogout={handleLogout} />
      
      <main className="main-content">
        <Routes>
          {/* Public Routes */}
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage onLogin={handleLogin} />} />
          <Route path="/join/:inviteLink" element={<RegisterPage onLogin={handleLogin} />} />
          
          {/* Protected Routes */}
          <Route path="/" element={user ? <HomePage user={user} /> : <LandingPage />} />
          <Route path="/community" element={user ? <CommunityPage /> : <Navigate to="/login" />} />
          <Route path="/calendar" element={user ? <CalendarPage /> : <Navigate to="/login" />} />
          <Route path="/activity" element={user ? <ActivityPage /> : <Navigate to="/login" />} />
          <Route path="/messages" element={user ? <MessagesPage /> : <Navigate to="/login" />} />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
