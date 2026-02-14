// D.A.K Devotee Portal — Warm Spiritual Redesign
// All "donations" renamed to "supports"

import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, Link, useLocation, useParams, useNavigate } from 'react-router-dom'
import api, { setToken, getToken } from './api'

// ============================================================================
// ICONS & UI COMPONENTS
// ============================================================================

const DakLogo = ({ size = 32 }) => (
  <div className="dak-logo" style={{ width: size, height: size }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 8l4 4-4 4M13 8h3M13 12h3M13 16h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
)

const CommunitySymbol = ({ communityType, size = 24, color = 'var(--primary)' }) => {
  switch (communityType) {
    case 'judaism':
      return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><polygon points="12,2 4,14 20,14" stroke={color} strokeWidth="1.5" fill="none"/><polygon points="12,22 4,10 20,10" stroke={color} strokeWidth="1.5" fill="none"/></svg>)
    case 'christianity':
      return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><line x1="12" y1="2" x2="12" y2="22" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><line x1="5" y1="9" x2="19" y2="9" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></svg>)
    case 'islam':
      return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M15 4a8 8 0 100 16 6 6 0 110-16z" stroke={color} strokeWidth="1.5"/><circle cx="17" cy="7" r="1.5" fill={color}/></svg>)
    case 'hinduism':
      return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M12 4c-1.5 2-3 3-3 5a3 3 0 006 0c0-2-1.5-3-3-5z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 12c-2 1-4 2.5-4 4.5C5 18.5 7 20 9 20c1.5 0 2.5-1 3-2" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><path d="M15 12c2 1 4 2.5 4 4.5c0 2-2 3.5-4 3.5c-1.5 0-2.5-1-3-2" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><circle cx="12" cy="21" r="1" fill={color}/></svg>)
    default:
      return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5"/><circle cx="12" cy="12" r="3" fill={color}/></svg>)
  }
}

// ============================================================================
// EVENT COLOR & MULTI-DAY HELPERS
// ============================================================================

const COMMUNITY_COLORS = [
  { bg: '#fef3c7', border: '#d97706', text: '#92400e' },
  { bg: '#dcfce7', border: '#16a34a', text: '#166534' },
  { bg: '#dbeafe', border: '#2563eb', text: '#1e40af' },
  { bg: '#fce7f3', border: '#db2777', text: '#9d174d' },
  { bg: '#e0e7ff', border: '#6366f1', text: '#4338ca' },
  { bg: '#ffedd5', border: '#ea580c', text: '#9a3412' },
  { bg: '#f3e8ff', border: '#9333ea', text: '#6b21a8' },
  { bg: '#ccfbf1', border: '#0d9488', text: '#115e59' },
]

function getCommunityColor(communityId) {
  if (!communityId) return COMMUNITY_COLORS[0]
  let hash = 0
  for (let i = 0; i < communityId.length; i++) { hash = ((hash << 5) - hash) + communityId.charCodeAt(i); hash |= 0 }
  return COMMUNITY_COLORS[Math.abs(hash) % COMMUNITY_COLORS.length]
}

function isMultiDayEvent(event) {
  if (!event.endsAt || !event.startsAt) return false
  return new Date(event.startsAt).toDateString() !== new Date(event.endsAt).toDateString()
}

function eventSpansDays(event) {
  if (!event.endsAt || !event.startsAt) return 1
  return Math.ceil((new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime()) / (1000 * 60 * 60 * 24)) + 1
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
      const [notifs, countData] = await Promise.all([api.notifications.getAll(), api.notifications.getUnreadCount()])
      setNotifications(notifs)
      setUnreadCount(countData.count)
    } catch (err) { console.error('Failed to load notifications:', err) }
  }

  const handleMarkAllRead = async () => {
    await api.notifications.markAllRead()
    setUnreadCount(0)
    loadNotifications()
  }

  const getIcon = (type) => {
    switch(type) { case 'access': return '✨'; case 'event': return '📅'; case 'stream': return '📺'; case 'message': return '💬'; case 'welcome': return '👋'; default: return '🔔' }
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
            {unreadCount > 0 && <button className="btn-link" onClick={handleMarkAllRead}>Mark all read</button>}
          </div>
          <div className="dropdown-body">
            {notifications.length === 0 ? (
              <p className="empty-state">No notifications</p>
            ) : notifications.slice(0, 10).map(n => (
              <div key={n.id} className={`notification-item ${!n.isRead ? 'unread' : ''}`}>
                <span className="notification-icon">{getIcon(n.type)}</span>
                <div className="notification-content">
                  <strong>{n.title}</strong>
                  <p>{n.message}</p>
                  <small>{new Date(n.createdAt).toLocaleDateString()}</small>
                </div>
              </div>
            ))}
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
    setError(''); setSuccess('')
    if (newPassword.length < 6) { setError('New password must be at least 6 characters'); return }
    if (newPassword !== confirmPassword) { setError('New passwords do not match'); return }
    setLoading(true)
    try {
      const result = await api.auth.changePassword({ currentPassword, newPassword })
      setSuccess(result.message)
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } catch (err) { setError(err.message) }
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
            <div className="form-group"><label>Current Password</label><input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required /></div>
            <div className="form-group"><label>New Password</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={6} required /></div>
            <div className="form-group"><label>Confirm New Password</label><input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={6} required /></div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>{loading ? 'Changing...' : 'Change Password'}</button>
          </form>
        ) : <button className="btn btn-primary btn-block" onClick={onClose}>Done</button>}
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
            <Link to="/updates" className={`nav-link ${location.pathname === '/updates' ? 'active' : ''}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              Updates
            </Link>
          </div>
          <div className="nav-right">
            <NotificationBell />
            <div className="nav-user-wrapper">
              <div className="nav-user" onClick={() => setUserMenuOpen(!userMenuOpen)}>
                <img className="avatar-img" src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=d97706&color=fff&size=32`} alt="" />
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              {userMenuOpen && (
                <div className="user-dropdown">
                  <div className="user-dropdown-header"><strong>{user.name}</strong><span>{user.email}</span></div>
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
          <Link to="/login" className="btn btn-outline" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)' }}>Sign In</Link>
        </div>
      )}
    </nav>
  )
}

// ============================================================================
// MOBILE BOTTOM NAVIGATION
// ============================================================================

function MobileBottomNav() {
  const location = useLocation()
  return (
    <nav className="mobile-bottom-nav">
      <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
        <span>Home</span>
      </Link>
      <Link to="/calendar" className={location.pathname === '/calendar' ? 'active' : ''}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span>Calendar</span>
      </Link>
      <Link to="/messages" className={location.pathname === '/messages' ? 'active' : ''}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        <span>Chat</span>
      </Link>
      <Link to="/updates" className={location.pathname === '/updates' ? 'active' : ''}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        <span>Updates</span>
      </Link>
      <Link to="/activity" className={location.pathname === '/activity' ? 'active' : ''}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
        <span>Activity</span>
      </Link>
    </nav>
  )
}

// ============================================================================
// PUBLIC LANDING PAGE
// ============================================================================

function LandingPage() {
  const [email, setEmail] = useState('')
  const [communityType, setCommunityType] = useState('')
  const [institution, setInstitution] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const communityTypes = [
    { value: 'judaism', label: 'Judaism', description: 'Jewish communities and synagogues' },
    { value: 'christianity', label: 'Christianity', description: 'Churches and Christian fellowships' },
    { value: 'islam', label: 'Islam', description: 'Mosques and Islamic centers' },
    { value: 'hinduism', label: 'Hinduism', description: 'Temples and Hindu communities' }
  ]

  const features = [
    { icon: '🎥', title: 'Live Streaming', description: 'Attend services and events from anywhere' },
    { icon: '📅', title: 'Community Calendar', description: 'Never miss important events and gatherings' },
    { icon: '💬', title: 'Connect & Engage', description: 'Join discussions and message your community' },
    { icon: '🙏', title: 'Spiritual Guidance', description: 'Access AI-powered spiritual support and wisdom' }
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await api.waitingList.join({ email, communityType, recommendedInstitution: institution })
      setSubmitted(true)
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="landing-page">
        <div className="landing-success-container">
          <div className="landing-card success-card">
            <div className="success-icon">✓</div>
            <h2>Welcome to the Journey!</h2>
            <p>Thank you for your interest in joining D.A.K. We'll notify you as soon as communities in your area become available.</p>
            <div className="success-next-steps">
              <p className="next-steps-title">What happens next?</p>
              <ul>
                <li>We'll send you an email confirmation</li>
                <li>You'll be notified when nearby communities join</li>
                <li>You'll receive an invitation to create your account</li>
              </ul>
            </div>
            <button className="btn btn-outline" onClick={() => setSubmitted(false)}>Submit Another Request</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <div className="landing-hero">
        <div className="hero-badge">✨ A Sacred Space for Your Faith Community</div>
        <DakLogo size={96} />
        <h1>Connect with Your <br/>Faith Community</h1>
        <p className="tagline">Experience meaningful spiritual connection through live services, events, and community engagement — all in one sacred digital space</p>
        <div className="hero-cta">
          <a href="#join-form" className="btn btn-primary btn-large">Join the Waiting List</a>
          <Link to="/login" className="btn btn-outline btn-large">Sign In</Link>
        </div>
      </div>

      {/* Features Section */}
      <div className="landing-features">
        <h2 className="section-title">Everything Your Community Needs</h2>
        <div className="features-grid">
          {features.map((feature, idx) => (
            <div key={idx} className="feature-card">
              <div className="feature-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Join Form Section */}
      <div id="join-form" className="landing-form-section">
        <div className="landing-card">
          <div className="form-header">
            <h2>Join the Waiting List</h2>
            <p className="text-secondary">Be among the first to know when your community goes live</p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
              />
            </div>

            <div className="form-group">
              <label>Select Your Faith Community</label>
              <p className="field-hint">Choose the tradition that resonates with your spiritual path</p>
              <div className="community-type-cards">
                {communityTypes.map(ct => (
                  <div
                    key={ct.value}
                    className={`community-type-card ${communityType === ct.value ? 'selected' : ''}`}
                    onClick={() => setCommunityType(ct.value)}
                  >
                    <CommunitySymbol communityType={ct.value} size={32} />
                    <div className="type-info">
                      <span className="type-label">{ct.label}</span>
                      <span className="type-description">{ct.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Recommend an Institution <span className="optional-badge">Optional</span></label>
              <p className="field-hint">Help us connect with your local place of worship</p>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="e.g., Temple Beth Israel, First Baptist Church"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block btn-large"
              disabled={loading || !communityType}
            >
              {loading ? 'Submitting...' : 'Join Waiting List →'}
            </button>

            <p className="form-privacy">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              Your information is secure and will never be shared
            </p>
          </form>
        </div>
      </div>

      {/* Testimonial Section */}
      <div className="landing-testimonials">
        <h2 className="section-title">Trusted by Faith Communities</h2>
        <div className="testimonials-grid">
          <div className="testimonial-card">
            <div className="testimonial-quote">"D.A.K has brought our congregation closer together, even when we're apart. It's truly a blessing."</div>
            <div className="testimonial-author">
              <strong>Rabbi Sarah Cohen</strong>
              <span>Temple Beth Shalom</span>
            </div>
          </div>
          <div className="testimonial-card">
            <div className="testimonial-quote">"The spiritual guidance feature has been a source of comfort and wisdom for our members."</div>
            <div className="testimonial-author">
              <strong>Pastor Michael Johnson</strong>
              <span>Grace Community Church</span>
            </div>
          </div>
          <div className="testimonial-card">
            <div className="testimonial-quote">"Our community stays connected through live streams and events. It's made such a difference."</div>
            <div className="testimonial-author">
              <strong>Imam Ahmed Hassan</strong>
              <span>Islamic Center of Hope</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="landing-footer-section">
        <p className="footer-text">Already have an invite? <Link to="/login" className="footer-link">Sign In Here</Link></p>
        <p className="footer-copyright">© 2026 D.A.K — Devotion, Access, Knowledge</p>
      </div>
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
    e.preventDefault(); setLoading(true); setError('')
    try { const result = await api.auth.login({ email, password }); setToken(result.token); onLogin(result.user); navigate('/') } catch (err) { setError(err.message) }
    setLoading(false)
  }

  const handleForgot = async (e) => {
    e.preventDefault(); setLoading(true); setError(''); setForgotMsg('')
    try { const result = await api.auth.forgotPassword(forgotEmail); setForgotMsg(result.message) } catch (err) { setError(err.message) }
    setLoading(false)
  }

  if (forgotMode) {
    return (
      <div className="auth-page"><div className="auth-card">
        <div className="auth-header"><DakLogo size={48} /><h1>Reset Password</h1></div>
        {error && <div className="alert alert-error">{error}</div>}
        {forgotMsg && <div className="alert alert-success">{forgotMsg}</div>}
        {!forgotMsg && (
          <form onSubmit={handleForgot}>
            <div className="form-group"><label>Email</label><input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="Enter your email address" required /></div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>{loading ? 'Sending...' : 'Send Reset Link'}</button>
          </form>
        )}
        <p className="auth-footer"><button className="btn-link" onClick={() => { setForgotMode(false); setError(''); setForgotMsg('') }}>Back to Sign In</button></p>
      </div></div>
    )
  }

  return (
    <div className="auth-page"><div className="auth-card">
      <div className="auth-header"><DakLogo size={48} /><h1>Sign In</h1></div>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div className="form-group"><label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        <div className="forgot-password-link"><button type="button" className="btn-link" onClick={() => { setForgotMode(true); setError('') }}>Forgot Password?</button></div>
        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>
      </form>
      <p className="auth-footer">Don't have an account? You need an invite link from a community.</p>
    </div></div>
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

  useEffect(() => { loadCommunity() }, [inviteLink])

  const loadCommunity = async () => {
    try { setCommunity(await api.communities.getByInvite(inviteLink)) } catch (err) { setError('Invalid or expired invite link') }
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError('')
    try { const result = await api.auth.register({ name, email, password, inviteLink }); setToken(result.token); onLogin(result.user); navigate('/') } catch (err) { setError(err.message) }
    setLoading(false)
  }

  if (loading) return <div className="loading-page">Loading...</div>
  if (!community) return (<div className="auth-page"><div className="auth-card error-card"><h2>Invalid Invite</h2><p>{error || 'This invite link is invalid or has expired.'}</p><Link to="/" className="btn btn-primary">Go Home</Link></div></div>)

  return (
    <div className="auth-page"><div className="auth-card">
      <div className="auth-header"><DakLogo size={48} /><h1>Join {community.name}</h1></div>
      <div className="community-preview">
        {community.logoUrl && <img src={community.logoUrl} alt="" className="community-logo" />}
        <p className="confirmation-message">{community.confirmationMessage}</p>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group"><label>Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div className="form-group"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div className="form-group"><label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required /></div>
        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>{loading ? 'Creating Account...' : 'Create Account'}</button>
      </form>
      <p className="auth-footer">Already have an account? <Link to="/login">Sign In</Link></p>
    </div></div>
  )
}

// ============================================================================
// DAILY INSPIRATION CARD
// ============================================================================

function DailyInspirationCard({ communityType }) {
  const [inspiration, setInspiration] = useState(null)

  useEffect(() => {
    if (communityType) {
      api.guide.getInspiration(communityType).then(data => setInspiration(data.inspiration || data)).catch(() => {})
    }
  }, [communityType])

  if (!inspiration) return null

  return (
    <div className="daily-inspiration-card">
      <div className="inspiration-header">
        <span>✨</span>
        <h3>Today's Inspiration</h3>
      </div>
      <blockquote className="inspiration-content">"{inspiration.content || inspiration}"</blockquote>
      {inspiration.source && <cite className="inspiration-source">— {inspiration.source}</cite>}
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

  useEffect(() => { loadCommunities() }, [])

  const loadCommunities = async () => {
    try { setCommunities(await api.communities.getMy()) } catch (err) { console.error('Failed to load communities:', err) }
    setLoading(false)
  }

  const getGreeting = (type) => {
    const greetings = { judaism: 'Shalom', christianity: 'Peace be with you', islam: 'Assalamu Alaikum', hinduism: 'Namaste' }
    return greetings[type] || 'Welcome'
  }

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>{getGreeting(user.communityType)}, {user.name}</h1>
        <p className="text-secondary">Your communities in the {user.communityType} network</p>
      </div>

      <DailyInspirationCard communityType={user.communityType} />

      {communities.length === 0 ? (
        <div className="empty-state"><p>You haven't joined any communities yet.</p><p className="text-secondary">Use an invite link from a community to get started.</p></div>
      ) : (
        <div className="community-grid">
          {communities.map(community => (
            <CommunityCard key={community.id} community={community} onClick={() => { sessionStorage.setItem('dak_community', community.id); navigate('/community') }} />
          ))}
        </div>
      )}

      <div className="global-access-placeholder">
        <h3>🌍 Global Access</h3>
        <p>Coming soon — Access all communities in your network with one subscription.</p>
      </div>
    </div>
  )
}

function CommunityCard({ community, onClick }) {
  return (
    <div className="community-card" onClick={onClick}>
      <div className="community-card-header">
        {community.logoUrl ? <img src={community.logoUrl} alt="" className="community-logo" /> : (
          <div className="community-logo-placeholder"><CommunitySymbol communityType={community.communityType} size={28} color="white" /></div>
        )}
        <div className="community-info"><h3>{community.name}</h3><span className="community-type">{community.communityType}</span></div>
      </div>
      <div className="community-card-body">{community.messageOfDay && <p className="message-of-day">"{community.messageOfDay}"</p>}</div>
      <div className="community-card-footer"><AccessBadge community={community} /></div>
    </div>
  )
}

function AccessBadge({ community }) {
  if (community.membershipStatus === 'pending') {
    return (
      <div className="access-badge-container">
        <div className="access-badge view-only" style={{ background: '#fef3c7', color: '#92400e' }}>
          <span className="access-icon">⏳</span>
          <span>Pending Approval</span>
        </div>
      </div>
    )
  }
  if (community.hasActiveAccess) {
    const expiresDate = community.expiresAt ? new Date(community.expiresAt) : null
    const startDate = expiresDate ? new Date(expiresDate.getTime() - (community.daysRemaining * 24 * 60 * 60 * 1000) + (24 * 60 * 60 * 1000)) : null
    const fmt = (d) => d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
    return (
      <div className="access-badge-container">
        <div className="access-badge active">
          <span className="access-icon">✓</span>
          <span>Active Access</span>
          <span className="days-remaining">{community.daysRemaining} days left</span>
        </div>
        {expiresDate && (
          <div className="access-dates-info">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>{fmt(startDate)} → {fmt(expiresDate)}</span>
          </div>
        )}
      </div>
    )
  }
  return (
    <div className="access-badge-container">
      <div className="access-badge view-only">
        <span className="access-icon">👁</span>
        <span>View Only</span>
      </div>
      <p className="access-hint">Support this community to unlock full access</p>
    </div>
  )
}

// ============================================================================
// MINI CALENDAR WIDGET
// ============================================================================

function MiniCalendar({ events = [], community }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const getWeekDates = () => {
    const start = new Date(currentDate); const day = start.getDay(); start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day))
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
  }
  const weekDates = getWeekDates()
  const dayLabels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const getEventsForDate = (date) => {
    const ds = new Date(date); ds.setHours(0,0,0,0); const de = new Date(date); de.setHours(23,59,59,999)
    return events.filter(e => { const s = new Date(e.startsAt); const en = e.endsAt ? new Date(e.endsAt) : s; return s <= de && en >= ds })
  }
  const isToday = (date) => date.toDateString() === new Date().toDateString()
  return (
    <div className="mini-calendar">
      <div className="mini-calendar-header">
        <span className="mini-calendar-title">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
        <div className="mini-calendar-nav">
          <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d) }}>&lt;</button>
          <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d) }}>&gt;</button>
        </div>
      </div>
      <div className="mini-calendar-grid">
        {weekDates.map((date, i) => {
          const dayEvents = getEventsForDate(date)
          return (
            <div key={i} className="mini-calendar-day">
              <span className="mini-cal-label">{dayLabels[i]}</span>
              <span className={`mini-cal-date ${isToday(date) ? 'today' : ''}`}>{date.getDate()}</span>
              <div className="mini-cal-indicators">
                {dayEvents.slice(0, 3).map((evt, j) => {
                  const color = getCommunityColor(evt.communityId || (community && community.id))
                  return <span key={j} className={`mini-cal-dot ${isMultiDayEvent(evt) ? 'mini-cal-bar' : ''}`} style={{ background: color.border }} title={evt.title} />
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
  const upcoming = events.filter(e => new Date(e.startsAt) >= new Date()).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)).slice(0, 3)
  const formatDateRight = (dateStr) => { const d = new Date(dateStr); return `${d.toLocaleDateString('en', { weekday: 'short' })}, ${d.toLocaleDateString('en', { month: 'short' })} ${d.getDate()}` }
  return (
    <div className="sidebar-card">
      <div className="sidebar-card-header"><h3>Upcoming Events</h3></div>
      <div className="sidebar-card-body">
        {upcoming.length === 0 ? <p className="text-secondary" style={{ padding: '16px', fontSize: '14px' }}>No upcoming events</p> : upcoming.map(event => {
          const color = getCommunityColor(event.communityId || (community && community.id))
          return (
            <div key={event.id} className="upcoming-event-item" style={{ borderLeft: `3px solid ${color.border}` }}>
              <div className="upcoming-event-date-icon" style={{ background: color.bg }}><span className="ue-day" style={{ color: color.text }}>{new Date(event.startsAt).getDate()}</span></div>
              <div className="upcoming-event-info"><strong>{event.title}</strong><span>{new Date(event.startsAt).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}{isMultiDayEvent(event) && ' (multi-day)'}</span></div>
              <div className="upcoming-event-right">{formatDateRight(event.startsAt)}</div>
              <div className="event-tooltip"><strong>{event.title}</strong>{community && <span>{community.name}</span>}{event.description && <p>{event.description}</p>}</div>
            </div>
          )
        })}
      </div>
      <Link to="/calendar" className="sidebar-card-link">View full calendar</Link>
    </div>
  )
}

// ============================================================================
// RECENTLY ADDED SIDEBAR
// ============================================================================

function RecentlyAddedSidebar({ streams = [] }) {
  const recent = streams.filter(s => s.recordingUrl).sort((a, b) => new Date(b.createdAt || b.scheduledFor) - new Date(a.createdAt || a.scheduledFor)).slice(0, 2)
  const timeAgo = (dateStr) => { const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)); return days === 0 ? 'Today' : days === 1 ? '1 day ago' : `${days} days ago` }
  return (
    <div className="sidebar-card">
      <div className="sidebar-card-header"><h3>Recently Added</h3></div>
      <div className="sidebar-card-body">
        {recent.length === 0 ? <p className="text-secondary" style={{ padding: '16px', fontSize: '14px' }}>No recent media</p> : recent.map(item => (
          <div key={item.id} className="recent-media-item">
            <div className="recent-media-thumb"><svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg></div>
            <div className="recent-media-info"><strong>{item.title}</strong><span className="recent-media-type">Video</span></div>
            <span className="recent-media-time">{timeAgo(item.createdAt || item.scheduledFor)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// LIVE STREAM PLAYER
// ============================================================================

function LiveStreamPlayer({ stream }) {
  if (!stream) {
    return (<div className="livestream-section"><div className="section-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg><h3>Live Stream</h3></div><div className="livestream-placeholder"><p>No live stream at the moment</p></div></div>)
  }
  return (
    <div className="livestream-section">
      <div className="section-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg><h3>Live Stream</h3></div>
      <div className="livestream-player">
        <div className="livestream-video">
          <div className="livestream-overlay"><span className="live-tag">LIVE</span><span className="viewer-count"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>{stream.currentViewers || 0}</span></div>
          <div className="livestream-poster">{stream.thumbnailUrl ? <img src={stream.thumbnailUrl} alt="" /> : <div className="livestream-poster-placeholder" />}</div>
        </div>
        <div className="livestream-controls">
          <div className="controls-left">
            <button className="control-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg></button>
            <button className="control-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/></svg></button>
            <div className="volume-slider"><div className="volume-track"><div className="volume-fill" style={{ width: '60%' }} /></div></div>
          </div>
          <div className="controls-right"><button className="control-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg></button></div>
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
    setLoading(true); setError('')
    try {
      const paymentResult = await api.access.activate({ communityId, amount: parseFloat(amount), donationMethod: 'card', comment: comment.trim() || undefined })
      const result = await api.access.completePayment(paymentResult.paymentId)
      setSuccessData({ amount: parseFloat(amount), daysGranted: result.daysGranted, daysRemaining: result.daysRemaining, expiresAt: result.expiresAt })
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  const handleDone = () => { setSuccessData(null); setAmount('72.00'); setComment(''); if (onActivated) onActivated() }

  if (successData) {
    const fmt = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return (
      <div className="support-widget">
        <div className="support-success-overlay">
          <div className="support-success-icon">✓</div>
          <h3>Thank you for your support!</h3>
          <div className="support-success-details">
            <div className="support-success-row"><span>Amount</span><strong>${successData.amount.toFixed(2)}</strong></div>
            <div className="support-success-row"><span>Access granted</span><strong>{successData.daysGranted} days</strong></div>
            <div className="support-success-row"><span>Total remaining</span><strong>{successData.daysRemaining} days</strong></div>
            <div className="support-success-row"><span>Access period</span><strong>{fmt(new Date())} - {fmt(successData.expiresAt)}</strong></div>
            <div className="support-success-row"><span className="text-secondary" style={{ fontSize: '12px' }}>After {fmt(successData.expiresAt)}, this community will move to View Only</span></div>
          </div>
          <button className="btn btn-primary btn-block support-btn" onClick={handleDone}>Done</button>
        </div>
      </div>
    )
  }

  return (
    <div className="support-widget">
      <div className="support-header">
        <CommunitySymbol communityType={community.communityType} size={32} />
        <div><h3>Support {community.name}</h3><p>Your support helps keep this <strong>community</strong> active.</p></div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="support-type-toggle">
        <button className={supportType === 'one-time' ? 'active' : ''} onClick={() => setSupportType('one-time')}>One-time</button>
        <button className={supportType === 'monthly' ? 'active' : ''} onClick={() => setSupportType('monthly')}>Monthly</button>
      </div>
      <div className="support-amounts">
        {presets.map(preset => (<button key={preset} className={`support-amount-btn ${parseFloat(amount) === preset ? 'active' : ''}`} onClick={() => setAmount(preset.toString())}>${preset}</button>))}
        <div className="support-custom-input"><span className="currency-symbol">$</span><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min="1" step="0.01" /></div>
      </div>
      <div className="form-group" style={{ marginBottom: 12 }}><textarea className="support-comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment (optional)" rows={2} maxLength={500} /></div>
      <p className="platform-fee-note">5% goes to platform upkeep</p>
      <button className="btn btn-primary btn-block support-btn" onClick={handleSupport} disabled={loading || !amount || parseFloat(amount) <= 0}>{loading ? 'Processing...' : 'Continue to Support'}</button>
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
  const [activeTab, setActiveTab] = useState('home')

  useEffect(() => { if (!id) { navigate('/'); return } loadCommunity() }, [id])

  const loadCommunity = async () => {
    try {
      const [communityData, eventsData, streamsData] = await Promise.all([api.communities.getOne(id), api.events.getForCommunity(id), api.streams.getForCommunity(id)])
      setCommunity(communityData); setEvents(eventsData.events || eventsData); setStreams(streamsData)
    } catch (err) { console.error('Failed to load community:', err) }
    setLoading(false)
  }

  if (!id) return null
  if (loading) return <div className="loading">Loading...</div>
  if (!community) return <div className="error-page">Community not found</div>

  const liveStream = streams.find(s => s.isLive)

  return (
    <div className="community-page">
      <div className="community-header-clean">
        <div className="community-header-left">
          <CommunitySymbol communityType={community.communityType} size={40} />
          <div><h1>{community.name}</h1><p className="community-location">{community.location || community.city || 'Community'}</p></div>
        </div>
      </div>

      {community.membershipStatus === 'pending' && (
        <div className="alert alert-warning" style={{ margin: '1rem 32px', textAlign: 'center' }}>Your membership is pending approval by the community administrator.</div>
      )}

      <div className="tabs">
        <button className={activeTab === 'home' ? 'active' : ''} onClick={() => setActiveTab('home')}>Home</button>
        <button className={activeTab === 'events' ? 'active' : ''} onClick={() => setActiveTab('events')}>Events</button>
        <button className={activeTab === 'streams' ? 'active' : ''} onClick={() => setActiveTab('streams')}>Streams</button>
        <button className={activeTab === 'discussions' ? 'active' : ''} onClick={() => setActiveTab('discussions')}>Discussions</button>
        <button className={activeTab === 'messages' ? 'active' : ''} onClick={() => setActiveTab('messages')}>Messages</button>
        <button className={activeTab === 'guide' ? 'active' : ''} onClick={() => setActiveTab('guide')}>Spiritual Guide</button>
      </div>

      <div className="tab-content-wrapper">
        {activeTab === 'home' && (
          <div className="overview-two-col">
            <div className="overview-main">
              <LiveStreamPlayer stream={liveStream} />
              <SupportWidget community={community} communityId={id} onActivated={loadCommunity} />
            </div>
            <div className="overview-sidebar">
              <UpcomingEventsSidebar events={events} community={community} />
              <MiniCalendar events={events} community={community} />
              <RecentlyAddedSidebar streams={streams} />
            </div>
          </div>
        )}
        {activeTab === 'events' && <EventsTab events={events} isViewOnly={community.isViewOnly} community={community} />}
        {activeTab === 'streams' && <StreamsTab streams={streams} community={community} />}
        {activeTab === 'discussions' && <DiscussionsTab communityId={id} isViewOnly={community.isViewOnly} />}
        {activeTab === 'messages' && (community.isViewOnly ? <div className="view-only-message"><p>🔒 Activate Active Access to send messages</p></div> : <MessagesTab communityId={id} communityName={community.name} />)}
        {activeTab === 'guide' && <SpiritualGuideTab communityId={id} community={community} />}
      </div>
    </div>
  )
}

// ============================================================================
// EVENTS TAB
// ============================================================================

function EventsTab({ events, isViewOnly, community }) {
  if (isViewOnly) return <div className="view-only-message"><p>🔒 Activate Active Access to view the community calendar and events</p></div>
  if (events.length === 0) return <div className="empty-state">No upcoming events</div>

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
              {multiDay && <span className="multi-day-badge" style={{ background: color.border }}>{eventSpansDays(event)}d</span>}
            </div>
            <div className="event-info">
              <h4>{event.title}</h4>
              <p className="event-time">{new Date(event.startsAt).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}{multiDay && ` - ${new Date(event.endsAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}`}{event.location && ` • ${event.location}`}{event.isVirtual && ' • Virtual'}</p>
              {event.description && <p className="event-description">{event.description}</p>}
            </div>
            <button className="btn btn-sm btn-outline" onClick={() => api.events.exportIcs(event.id)}>Add to Calendar</button>
            <div className="event-tooltip"><strong>{event.title}</strong>{community && <span>{community.name}</span>}<span>{new Date(event.startsAt).toLocaleString()}{multiDay && ` - ${new Date(event.endsAt).toLocaleString()}`}</span>{event.location && <span>{event.location}</span>}{event.description && <p>{event.description}</p>}</div>
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
      {liveStream && (<div className="live-stream-card"><span className="live-badge">🔴 LIVE</span><h4>{liveStream.title}</h4><p>{liveStream.currentViewers} watching</p><button className="btn btn-primary">Watch Now</button></div>)}
      <h4>Upcoming & Past Streams</h4>
      {streams.length === 0 ? <div className="empty-state">No streams scheduled</div> : (
        <div className="streams-list">
          {streams.filter(s => !s.isLive).map(stream => (
            <div key={stream.id} className="stream-card">
              <div className="stream-info">
                <h5>{stream.title}</h5>
                {stream.scheduledFor && <p className="stream-time">{new Date(stream.scheduledFor).toLocaleString()}</p>}
                {stream.recordingUrl && <div className="recording-section">{community.hasActiveAccess ? <a href={stream.recordingUrl} className="btn btn-sm btn-primary">▶ Watch Recording</a> : <p className="gated-message">🔒 Active Access required to watch recording</p>}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// DISCUSSIONS TAB
// ============================================================================

function DiscussionsTab({ communityId, isViewOnly }) {
  const [conversations, setConversations] = useState([])
  const [selectedConv, setSelectedConv] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadConversations() }, [communityId])

  const loadConversations = async () => {
    try { const data = await api.conversations.getForCommunity(communityId); setConversations(data.conversations || data || []) } catch (err) { console.error('Failed to load conversations:', err) }
    setLoading(false)
  }

  const openConversation = async (convId) => {
    try { setSelectedConv(await api.conversations.getOne(convId)) } catch (err) { console.error('Failed to load conversation:', err) }
  }

  const handleReaction = async (convId, emoji) => {
    try { await api.conversations.addReaction(convId, emoji); loadConversations(); if (selectedConv) openConversation(convId) } catch (err) { console.error('Reaction failed:', err) }
  }

  const handleComment = async (convId, content, parentId) => {
    try { await api.conversations.addComment(convId, content, parentId); openConversation(convId) } catch (err) { console.error('Comment failed:', err) }
  }

  if (isViewOnly) return <div className="view-only-message"><p>🔒 Activate Active Access to view and participate in community discussions</p></div>
  if (loading) return <div className="loading">Loading discussions...</div>

  if (selectedConv) {
    const conv = selectedConv.conversation || selectedConv
    const comments = selectedConv.comments || []
    return <ConversationView conversation={conv} comments={comments} onBack={() => setSelectedConv(null)} onReaction={handleReaction} onComment={handleComment} />
  }

  return (
    <div className="discussions-list">
      <div className="discussions-header"><h3>Community Discussions</h3><p className="text-secondary">Connect with fellow devotees</p></div>
      {conversations.length === 0 ? <div className="empty-state"><p>No discussions yet</p><p className="text-secondary">Community admins can start conversations</p></div> : (
        <div className="conversations-grid">
          {conversations.map(conv => (
            <div key={conv.id} className="conversation-card" onClick={() => openConversation(conv.id)}>
              {conv.is_pinned && <span className="pinned-badge">📌 Pinned</span>}
              <h4>{conv.title}</h4>
              <p className="conversation-preview">{(conv.content || '').substring(0, 150)}{conv.content && conv.content.length > 150 ? '...' : ''}</p>
              <div className="conversation-meta"><span>{conv.author_name}</span><span>{new Date(conv.created_at).toLocaleDateString()}</span></div>
              <div className="conversation-stats"><span>💬 {conv.comment_count || 0}</span>
                {conv.reactions && conv.reactions.length > 0 && <div className="reactions-preview">{conv.reactions.slice(0, 3).map((r, i) => <span key={i} className="reaction-item">{r.emoji} {r.count}</span>)}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ConversationView({ conversation, comments, onBack, onReaction, onComment }) {
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const reactionEmojis = ['👍', '❤️', '😂', '🙏', '🎉']

  const handleSubmit = (e) => {
    e.preventDefault(); if (!newComment.trim()) return
    onComment(conversation.id, newComment, replyingTo)
    setNewComment(''); setReplyingTo(null)
  }

  return (
    <div className="conversation-view">
      <button className="btn btn-outline back-btn" onClick={onBack}>← Back to Discussions</button>
      <div className="conversation-content">
        <h2>{conversation.title}</h2>
        <div className="conversation-author">By {conversation.author_name || 'Admin'} • {new Date(conversation.created_at).toLocaleDateString()}</div>
        <p className="conversation-body">{conversation.content}</p>
        <div className="reactions-bar">
          {reactionEmojis.map(emoji => (
            <button key={emoji} className={`reaction-btn ${conversation.user_reactions?.includes(emoji) ? 'active' : ''}`} onClick={() => onReaction(conversation.id, emoji)}>
              {emoji} {(conversation.reactions?.find(r => r.emoji === emoji)?.count) || ''}
            </button>
          ))}
        </div>
      </div>
      <div className="comments-section">
        <h3>{comments.length} Comments</h3>
        {comments.map(c => <CommentItem key={c.id} comment={c} onReply={(id) => setReplyingTo(id)} />)}
        <form className="comment-form" onSubmit={handleSubmit}>
          {replyingTo && <div className="replying-to">Replying to comment <button type="button" onClick={() => setReplyingTo(null)}>Cancel</button></div>}
          <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Add a comment..." rows={3} required />
          <button type="submit" className="btn btn-primary">Post Comment</button>
        </form>
      </div>
    </div>
  )
}

function CommentItem({ comment, onReply }) {
  return (
    <div className="comment-item">
      <div className="comment-header"><strong>{comment.user_name}</strong><span className="comment-date">{new Date(comment.created_at).toLocaleString()}</span></div>
      <p className="comment-content">{comment.content}</p>
      <button className="btn-link comment-reply" onClick={() => onReply(comment.id)}>Reply</button>
      {comment.replies && comment.replies.length > 0 && <div className="comment-replies">{comment.replies.map(reply => <CommentItem key={reply.id} comment={reply} onReply={onReply} />)}</div>}
    </div>
  )
}

// ============================================================================
// SPIRITUAL GUIDE TAB
// ============================================================================

function SpiritualGuideTab({ communityId, community }) {
  const [sessions, setSessions] = useState([])
  const [currentSession, setCurrentSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadSessions() }, [])

  const loadSessions = async () => {
    try { const data = await api.guide.getSessions(); setSessions((data.sessions || data || []).filter(s => s.community_id === communityId)) } catch (err) { console.error('Failed to load sessions:', err) }
  }

  const loadSession = async (sessionId) => {
    try { const data = await api.guide.getSession(sessionId); setCurrentSession(data.session || data); setMessages(data.messages || []) } catch (err) { console.error('Failed to load session:', err) }
  }

  const sendMessage = async (e) => {
    e.preventDefault(); if (!inputMessage.trim()) return; setLoading(true)
    try {
      if (!currentSession) {
        const data = await api.guide.startSession({ communityId, initialMessage: inputMessage })
        setCurrentSession(data.session); setMessages(data.messages || []); setSessions([data.session, ...sessions])
      } else {
        const data = await api.guide.sendMessage(currentSession.id, inputMessage)
        setMessages(prev => [...prev, ...(data.userMessage ? [data.userMessage, data.guideMessage] : [data])])
      }
      setInputMessage('')
    } catch (err) { console.error('Failed to send message:', err) }
    setLoading(false)
  }

  return (
    <div className="spiritual-guide-tab">
      <div className="guide-header">
        <CommunitySymbol communityType={community.communityType} size={32} />
        <div><h3>Spiritual Guidance</h3><p className="text-secondary">Connect with wisdom from your tradition</p></div>
      </div>
      <div className="guide-layout">
        <div className="guide-sessions">
          <button className="btn btn-primary btn-block" onClick={() => { setCurrentSession(null); setMessages([]) }}>+ New Conversation</button>
          <div className="sessions-list">
            {sessions.map(session => (
              <div key={session.id} className={`session-item ${currentSession?.id === session.id ? 'active' : ''}`} onClick={() => loadSession(session.id)}>
                <strong>{session.title || 'Session'}</strong>
                <small>{new Date(session.updated_at || session.created_at).toLocaleDateString()}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="guide-chat">
          {!currentSession && messages.length === 0 ? (
            <div className="guide-welcome">
              <h4>Welcome to Your Spiritual Guide</h4>
              <p>Ask questions about your faith, seek guidance, or simply share what's on your heart.</p>
              <div className="suggested-prompts">
                <button onClick={() => setInputMessage("I'm feeling anxious today")}>Feeling anxious</button>
                <button onClick={() => setInputMessage("Help me with prayer")}>Prayer guidance</button>
                <button onClick={() => setInputMessage("What is my purpose?")}>Finding purpose</button>
                <button onClick={() => setInputMessage("I need comfort in grief")}>Comfort in grief</button>
              </div>
            </div>
          ) : (
            <div className="guide-messages">
              {messages.map((msg, i) => (
                <div key={i} className={`guide-message ${msg.role}`}>
                  <div className="message-avatar">{msg.role === 'guide' ? <CommunitySymbol communityType={community.communityType} size={20} /> : '👤'}</div>
                  <div className="message-bubble"><p>{msg.content}</p>{msg.created_at && <small>{new Date(msg.created_at).toLocaleTimeString()}</small>}</div>
                </div>
              ))}
              {loading && <div className="guide-message guide"><div className="message-avatar"><CommunitySymbol communityType={community.communityType} size={20} /></div><div className="message-bubble"><div className="typing-dots"><span></span><span></span><span></span></div></div></div>}
            </div>
          )}
          <form className="guide-input-form" onSubmit={sendMessage}>
            <textarea value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} placeholder="Share what's on your heart..." rows={2} disabled={loading} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e) } }} />
            <button type="submit" className="btn btn-primary" disabled={loading || !inputMessage.trim()}>Send</button>
          </form>
        </div>
      </div>
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

  useEffect(() => { loadThreads() }, [])

  const loadThreads = async () => {
    try { const data = await api.messages.getThreads(); const ct = data.filter(t => t.communityId === communityId); setThreads(ct); if (ct.length > 0) selectThread(ct[0]) } catch (err) { console.error('Failed to load threads:', err) }
    setLoading(false)
  }

  const selectThread = async (thread) => {
    setSelectedThread(thread)
    try { const data = await api.messages.getThread(thread.id); setMessages(data.messages) } catch (err) { console.error('Failed to load messages:', err) }
  }

  const sendMessage = async (e) => {
    e.preventDefault(); if (!newMessage.trim()) return
    try {
      if (selectedThread) { await api.messages.sendMessage(selectedThread.id, newMessage); selectThread(selectedThread) }
      else { await api.messages.startThread(communityId, newMessage); loadThreads() }
      setNewMessage('')
    } catch (err) { console.error('Failed to send message:', err) }
  }

  if (loading) return <div className="loading">Loading messages...</div>

  return (
    <div className="messages-tab">
      <div className="messages-container">
        {messages.length === 0 && !selectedThread ? <div className="empty-messages"><p>No messages yet. Start a conversation with the community.</p></div> : (
          <div className="messages-list">
            {messages.map(msg => (
              <div key={msg.id} className={`message ${msg.isFromAdmin ? 'from-admin' : 'from-me'}`}>
                <div className="message-content">{msg.content}</div>
                <div className="message-meta"><span className="sender">{msg.senderName}</span><span className="time">{new Date(msg.createdAt).toLocaleString()}</span></div>
              </div>
            ))}
          </div>
        )}
        <form className="message-form" onSubmit={sendMessage}>
          <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder={`Message ${communityName}...`} />
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

  useEffect(() => { api.events.getMyCalendar().then(setEvents).catch(err => console.error(err)).finally(() => setLoading(false)) }, [])

  if (loading) return <div className="loading">Loading calendar...</div>

  return (
    <div className="calendar-page">
      <h1>My Calendar</h1>
      <p className="text-secondary">Upcoming events from all your communities</p>
      {events.length === 0 ? <div className="empty-state"><p>No upcoming events</p><p className="text-secondary">Events from your communities with Active Access will appear here</p></div> : (
        <div className="calendar-events">
          {events.map(event => {
            const color = getCommunityColor(event.communityId)
            const multiDay = isMultiDayEvent(event)
            return (
              <div key={event.id} className={`calendar-event-card ${multiDay ? 'multi-day' : ''}`} style={{ borderLeft: `4px solid ${color.border}` }}>
                <div className="event-date" style={{ background: color.bg }}>
                  <span className="month" style={{ color: color.border }}>{new Date(event.startsAt).toLocaleDateString('en', { month: 'short' })}</span>
                  <span className="day">{new Date(event.startsAt).getDate()}</span>
                  {multiDay && <span className="multi-day-badge" style={{ background: color.border }}>{eventSpansDays(event)} days</span>}
                </div>
                <div className="event-details">
                  <h4>{event.title}</h4>
                  <p className="community-name" style={{ color: color.text }}>{event.communityName}</p>
                  <p className="event-time">{new Date(event.startsAt).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}{multiDay && ` - ${new Date(event.endsAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })} ${new Date(event.endsAt).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}`}</p>
                </div>
                <button className="btn btn-sm btn-outline" onClick={() => api.events.exportIcs(event.id)}>Add to Calendar</button>
                <div className="event-tooltip"><strong>{event.title}</strong><span>{event.communityName}</span><span>{new Date(event.startsAt).toLocaleString()}{multiDay && ` - ${new Date(event.endsAt).toLocaleString()}`}</span>{event.location && <span>{event.location}</span>}{event.description && <p>{event.description}</p>}</div>
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

  useEffect(() => { api.messages.getThreads().then(setThreads).catch(err => console.error(err)).finally(() => setLoading(false)) }, [])

  if (loading) return <div className="loading">Loading messages...</div>

  return (
    <div className="messages-page">
      <h1>Messages</h1>
      {threads.length === 0 ? <div className="empty-state"><p>No messages yet</p><p className="text-secondary">Start a conversation from a community page</p></div> : (
        <div className="threads-list">
          {threads.map(thread => (
            <div key={thread.id} className={`thread-card ${thread.unreadCount > 0 ? 'unread' : ''}`} onClick={() => { sessionStorage.setItem('dak_community', thread.communityId); navigate('/community') }}>
              <div className="thread-info"><h4>{thread.communityName}</h4><p className="last-message">{thread.lastMessage}</p></div>
              <div className="thread-meta">
                {thread.unreadCount > 0 && <span className="unread-badge">{thread.unreadCount}</span>}
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
// UPDATES PAGE
// ============================================================================

function UpdatesPage() {
  const [updates, setUpdates] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => { loadUpdates() }, [filter])

  const loadUpdates = async () => {
    setLoading(true)
    try { const data = await api.updates.getAll(filter !== 'all' ? { type: filter } : {}); setUpdates(data.updates || data || []) } catch (err) { console.error('Failed to load updates:', err) }
    setLoading(false)
  }

  const handleMarkAllRead = async () => {
    try { await api.updates.markAllRead(); loadUpdates() } catch (err) { console.error('Failed:', err) }
  }

  const getIcon = (type) => {
    const icons = { new_event: '📅', event: '📅', stream: '📺', stream_starting: '📺', message: '💬', new_message: '💬', access: '⏰', access_expiring: '⏰', donation_ack: '🙏', support: '🙏' }
    return icons[type] || '🔔'
  }

  const filterLabels = { all: 'All', event: 'Events', stream: 'Streams', message: 'Messages', access: 'Access' }

  if (loading) return <div className="loading">Loading updates...</div>

  return (
    <div className="updates-page">
      <div className="updates-header">
        <h1>Updates</h1>
        <button className="btn btn-outline" onClick={handleMarkAllRead}>Mark all read</button>
      </div>
      <div className="updates-filters">
        {Object.entries(filterLabels).map(([key, label]) => (
          <button key={key} className={`filter-btn ${filter === key ? 'active' : ''}`} onClick={() => setFilter(key)}>{label}</button>
        ))}
      </div>
      {updates.length === 0 ? <div className="empty-state"><p>No updates yet</p><p className="text-secondary">Your community activity will appear here</p></div> : (
        <div className="updates-list">
          {updates.map(update => (
            <div key={update.id} className={`update-item ${!update.is_read ? 'unread' : ''}`} onClick={() => { if (!update.is_read) api.updates.markRead(update.id).then(loadUpdates) }}>
              <span className="update-icon">{getIcon(update.update_type || update.type)}</span>
              <div className="update-content">
                <div className="update-header"><strong>{update.title}</strong>{update.community_name && <span className="update-community">{update.community_name}</span>}</div>
                <p>{update.message}</p>
                <small>{new Date(update.created_at).toLocaleString()}</small>
              </div>
              {!update.is_read && <span className="unread-indicator"></span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// ACTIVITY PAGE (Support History + Access Status)
// ============================================================================

function ActivityPage() {
  const [payments, setPayments] = useState([])
  const [accessList, setAccessList] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSupport, setSelectedSupport] = useState(null)

  useEffect(() => { loadActivity() }, [])

  const loadActivity = async () => {
    try {
      const [paymentsData, accessData] = await Promise.all([api.access.getAllPayments(), api.access.getMyAccess()])
      setPayments(paymentsData); setAccessList(accessData)
    } catch (err) { console.error('Failed to load activity:', err) }
    setLoading(false)
  }

  if (loading) return <div className="loading">Loading activity...</div>

  return (
    <div className="activity-page">
      <h1>My Activity</h1>
      <p className="text-secondary">Your access status and support history</p>

      {accessList.length > 0 && (
        <section className="activity-section">
          <h2>Current Access</h2>
          <div className="access-status-grid">
            {accessList.map(a => (
              <div key={a.communityId} className="access-status-card">
                <div className="access-status-header">
                  <strong>{a.communityName}</strong>
                  <span className={`access-status-badge ${a.hasActiveAccess ? 'active' : 'expired'}`}>{a.hasActiveAccess ? 'Active' : 'Expired'}</span>
                </div>
                {a.hasActiveAccess ? (() => {
                  const expiresDate = new Date(a.expiresAt)
                  const startDate = new Date(expiresDate.getTime() - (a.daysRemaining * 24 * 60 * 60 * 1000) + (24 * 60 * 60 * 1000))
                  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  return (<div className="access-status-body"><span className="access-date-range">{fmt(startDate)} - {fmt(expiresDate)}</span><span>{a.daysRemaining} days remaining</span><span className="text-secondary">Access expires on {fmt(expiresDate)}. After this date, this community will move to View Only.</span></div>)
                })() : <div className="access-status-body"><span className="text-secondary">No active access — this community is in View Only mode</span></div>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="activity-section">
        <h2>Support History</h2>
        {payments.length === 0 ? <div className="empty-state"><p>No support payments yet</p><p className="text-secondary">Support a community to see your history here</p></div> : (
          <div className="support-history-table-wrap">
            <table className="support-history-table">
              <thead><tr><th>Date</th><th>Community</th><th>Method</th><th>Amount</th><th>Comment</th></tr></thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td className="support-date">{new Date(p.created_at).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                    <td><strong>{p.community_name}</strong></td>
                    <td><span className="support-method-badge">{p.donation_method === 'card' ? '💳' : '🏦'} {p.donation_method || 'card'}</span></td>
                    <td className="support-amount">${parseFloat(p.amount).toFixed(2)}</td>
                    <td className="support-comment-cell">{p.comment || <span className="text-secondary">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedSupport && (
        <div className="modal-overlay" onClick={() => setSelectedSupport(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>Thank You Messages</h2><button className="modal-close" onClick={() => setSelectedSupport(null)}>&times;</button></div>
            <div className="acknowledgments-list">
              {(selectedSupport.acknowledgments || []).map(ack => (
                <div key={ack.id} className="acknowledgment-item">
                  <p className="ack-message">"{ack.message}"</p>
                  <small>— {ack.sent_by_name}, {new Date(ack.created_at).toLocaleDateString()}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// MAIN APP
// ============================================================================

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    const token = getToken()
    if (token) { try { setUser(await api.auth.me()) } catch (err) { setToken(null) } }
    setLoading(false)
  }

  const handleLogin = (userData) => setUser(userData)
  const handleLogout = () => { setToken(null); setUser(null) }

  if (loading) return <div className="app-loading"><DakLogo size={64} /><p>Loading...</p></div>

  return (
    <div className="app">
      <TopNav user={user} onLogout={handleLogout} />
      <main className="main-content">
        <Routes>
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage onLogin={handleLogin} />} />
          <Route path="/join/:inviteLink" element={<RegisterPage onLogin={handleLogin} />} />
          <Route path="/" element={user ? <HomePage user={user} /> : <LandingPage />} />
          <Route path="/community" element={user ? <CommunityPage /> : <Navigate to="/login" />} />
          <Route path="/calendar" element={user ? <CalendarPage /> : <Navigate to="/login" />} />
          <Route path="/activity" element={user ? <ActivityPage /> : <Navigate to="/login" />} />
          <Route path="/messages" element={user ? <MessagesPage /> : <Navigate to="/login" />} />
          <Route path="/updates" element={user ? <UpdatesPage /> : <Navigate to="/login" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      {user && <MobileBottomNav />}
    </div>
  )
}

export default App
