// D.A.K MVP v3 - Platform Admin Portal
// Lean MVP Specification v1.4 FINAL

import { useState, useEffect } from 'react'
import api, { setToken, getToken } from './api'

// ============================================================================
// MAIN APP
// ============================================================================

function App() {
  const [user, setUser] = useState(null)
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
        if (userData.role !== 'platform_admin') {
          throw new Error('Not authorized')
        }
        setUser(userData)
      } catch (err) {
        setToken(null)
      }
    }
    setLoading(false)
  }

  const handleLogin = async (email, password) => {
    const result = await api.auth.login({ email, password })
    if (result.user.role !== 'platform_admin') {
      throw new Error('Access denied. Platform admin only.')
    }
    setToken(result.token)
    setUser(result.user)
  }

  const handleLogout = () => {
    setToken(null)
    setUser(null)
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

  return (
    <div className="app">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} onLogout={handleLogout} />
      <main className="main-content">
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'communities' && <CommunitiesTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'waiting-list' && <WaitingListTab />}
        {activeTab === 'payments' && <PaymentsTab />}
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
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotMsg, setForgotMsg] = useState('')

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
      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <h1>D.A.K</h1>
            <p>Reset Password</p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {forgotMsg && <div className="alert alert-success">{forgotMsg}</div>}

          {!forgotMsg && (
            <form onSubmit={handleForgot}>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="Enter your email address" required />
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          )}

          <p className="login-footer">
            <button className="btn-link" onClick={() => { setForgotMode(false); setError(''); setForgotMsg('') }}>
              Back to Sign In
            </button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1>D.A.K</h1>
          <p>Platform Admin</p>
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
      </div>
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
// SIDEBAR
// ============================================================================

function Sidebar({ activeTab, onTabChange, onLogout }) {
  const [showChangePassword, setShowChangePassword] = useState(false)

  const tabs = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'communities', icon: '🏛️', label: 'Communities' },
    { id: 'users', icon: '👥', label: 'Users' },
    { id: 'waiting-list', icon: '📋', label: 'Waiting List' },
    { id: 'payments', icon: '💳', label: 'Payments' }
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>D.A.K</h1>
        <span className="admin-badge">Platform Admin</span>
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
        <button className="btn btn-outline btn-block" onClick={() => setShowChangePassword(true)}>
          Change Password
        </button>
        <button className="btn btn-outline btn-block" onClick={onLogout} style={{ marginTop: 8 }}>
          Sign Out
        </button>
      </div>
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </aside>
  )
}

// ============================================================================
// DASHBOARD TAB
// ============================================================================

function DashboardTab() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const data = await api.admin.getStats()
      setStats(data)
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
    setLoading(false)
  }

  if (loading) return <div className="loading">Loading dashboard...</div>
  if (!stats) return <div className="error">Failed to load stats</div>

  return (
    <div className="dashboard-tab">
      <div className="page-header">
        <h1>Platform Dashboard</h1>
        <p>Overview of D.A.K platform metrics</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon">🏛️</span>
          <div className="stat-content">
            <span className="stat-value">{stats.communities.total}</span>
            <span className="stat-label">Total Communities</span>
          </div>
          <div className="stat-breakdown">
            <span className="active">{stats.communities.active} active</span>
            <span className="pending">{stats.communities.pending} pending</span>
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-icon">👥</span>
          <div className="stat-content">
            <span className="stat-value">{stats.users.total}</span>
            <span className="stat-label">Total Users</span>
          </div>
        </div>

        <div className="stat-card highlight">
          <span className="stat-icon">✨</span>
          <div className="stat-content">
            <span className="stat-value">{stats.activeSubscribers}</span>
            <span className="stat-label">Active Subscribers</span>
          </div>
        </div>

        <div className="stat-card money">
          <span className="stat-icon">💰</span>
          <div className="stat-content">
            <span className="stat-value">${stats.gmv.total.toFixed(2)}</span>
            <span className="stat-label">Total GMV</span>
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-icon">📈</span>
          <div className="stat-content">
            <span className="stat-value">${stats.gmv.monthlyGmv.toFixed(2)}</span>
            <span className="stat-label">Monthly GMV</span>
          </div>
        </div>

        <div className="stat-card revenue">
          <span className="stat-icon">🏦</span>
          <div className="stat-content">
            <span className="stat-value">${stats.gmv.platformRevenue.toFixed(2)}</span>
            <span className="stat-label">Platform Revenue</span>
          </div>
        </div>
      </div>

      <div className="breakdown-section">
        <div className="breakdown-card">
          <h3>Communities by Type</h3>
          <div className="breakdown-list">
            {Object.entries(stats.communitiesByType).map(([type, count]) => (
              <div key={type} className="breakdown-item">
                <span className="type-name">{type}</span>
                <span className="type-count">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="breakdown-card">
          <h3>Waiting List by Type</h3>
          <div className="breakdown-list">
            {Object.entries(stats.waitingListByType).map(([type, count]) => (
              <div key={type} className="breakdown-item">
                <span className="type-name">{type}</span>
                <span className="type-count">{count}</span>
              </div>
            ))}
            {Object.keys(stats.waitingListByType).length === 0 && (
              <p className="text-secondary">No entries yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// COMMUNITIES TAB
// ============================================================================

function CommunitiesTab() {
  const [communities, setCommunities] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCommunities()
  }, [filter])

  const loadCommunities = async () => {
    try {
      const data = await api.admin.getCommunities(filter)
      setCommunities(data)
    } catch (err) {
      console.error('Failed to load communities:', err)
    }
    setLoading(false)
  }

  const handleApprove = async (id) => {
    try {
      await api.admin.approveCommunity(id)
      loadCommunities()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleSuspend = async (id) => {
    const reason = prompt('Reason for suspension:')
    if (reason === null) return
    try {
      await api.admin.suspendCommunity(id, reason)
      loadCommunities()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleReactivate = async (id) => {
    try {
      await api.admin.reactivateCommunity(id)
      loadCommunities()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <div className="loading">Loading communities...</div>

  return (
    <div className="communities-tab">
      <div className="page-header">
        <div>
          <h1>Communities</h1>
          <p>Manage platform communities</p>
        </div>
        <div className="filter-buttons">
          <button 
            className={`btn btn-sm ${filter === '' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter('')}
          >
            All
          </button>
          <button 
            className={`btn btn-sm ${filter === 'pending' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter('pending')}
          >
            Pending
          </button>
          <button 
            className={`btn btn-sm ${filter === 'active' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter('active')}
          >
            Active
          </button>
          <button 
            className={`btn btn-sm ${filter === 'suspended' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter('suspended')}
          >
            Suspended
          </button>
        </div>
      </div>

      {communities.length === 0 ? (
        <div className="empty-state">No communities found</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Community</th>
                <th>Type</th>
                <th>Admin</th>
                <th>Members</th>
                <th>Subscribers</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {communities.map(community => (
                <tr key={community.id}>
                  <td>
                    <div className="community-cell">
                      <strong>{community.name}</strong>
                      <span className="text-secondary">{community.country}</span>
                    </div>
                  </td>
                  <td className="capitalize">{community.communityType}</td>
                  <td>
                    <div className="admin-cell">
                      <span>{community.adminName}</span>
                      <span className="text-secondary">{community.adminEmail}</span>
                    </div>
                  </td>
                  <td>{community.memberCount}</td>
                  <td>{community.subscriberCount}</td>
                  <td>
                    <span className={`status-badge ${community.status}`}>
                      {community.status}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      {community.status === 'pending' && (
                        <button 
                          className="btn btn-sm btn-primary"
                          onClick={() => handleApprove(community.id)}
                        >
                          Approve
                        </button>
                      )}
                      {community.status === 'active' && (
                        <button 
                          className="btn btn-sm btn-outline"
                          onClick={() => handleSuspend(community.id)}
                        >
                          Suspend
                        </button>
                      )}
                      {community.status === 'suspended' && (
                        <button 
                          className="btn btn-sm btn-outline"
                          onClick={() => handleReactivate(community.id)}
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// USERS TAB
// ============================================================================

function UsersTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const data = await api.admin.getUsers()
      setUsers(data)
    } catch (err) {
      console.error('Failed to load users:', err)
    }
    setLoading(false)
  }

  if (loading) return <div className="loading">Loading users...</div>

  return (
    <div className="users-tab">
      <div className="page-header">
        <h1>Users</h1>
        <p>Platform user management</p>
      </div>

      {users.length === 0 ? (
        <div className="empty-state">No users found</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Network</th>
                <th>Role</th>
                <th>Communities</th>
                <th>Active Access</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>
                    <div className="user-cell">
                      <strong>{user.name || 'Unnamed'}</strong>
                      <span className="text-secondary">{user.email}</span>
                    </div>
                  </td>
                  <td className="capitalize">{user.communityType || '—'}</td>
                  <td>
                    <span className={`role-badge ${user.role}`}>
                      {user.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td>{user.communityCount}</td>
                  <td>{user.activeAccessCount}</td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// WAITING LIST TAB
// ============================================================================

function WaitingListTab() {
  const [entries, setEntries] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadWaitingList()
  }, [filter])

  const loadWaitingList = async () => {
    try {
      const data = await api.admin.getWaitingList(filter)
      setEntries(data)
    } catch (err) {
      console.error('Failed to load waiting list:', err)
    }
    setLoading(false)
  }

  const communityTypes = ['', 'islam', 'christianity', 'hinduism', 'judaism']

  if (loading) return <div className="loading">Loading waiting list...</div>

  return (
    <div className="waiting-list-tab">
      <div className="page-header">
        <div>
          <h1>Waiting List</h1>
          <p>Users waiting for community access</p>
        </div>
        <div className="filter-buttons">
          {communityTypes.map(type => (
            <button 
              key={type}
              className={`btn btn-sm ${filter === type ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFilter(type)}
            >
              {type || 'All'}
            </button>
          ))}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">No waiting list entries</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Community Type</th>
                <th>Recommended Institution</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id}>
                  <td>{entry.email}</td>
                  <td className="capitalize">{entry.communityType}</td>
                  <td>{entry.recommendedInstitution || '—'}</td>
                  <td>{new Date(entry.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// PAYMENTS TAB
// ============================================================================

function PaymentsTab() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPayments()
  }, [])

  const loadPayments = async () => {
    try {
      const data = await api.admin.getPayments()
      setPayments(data)
    } catch (err) {
      console.error('Failed to load payments:', err)
    }
    setLoading(false)
  }

  if (loading) return <div className="loading">Loading payments...</div>

  return (
    <div className="payments-tab">
      <div className="page-header">
        <h1>Payments</h1>
        <p>Transaction history and platform fees</p>
      </div>

      {payments.length === 0 ? (
        <div className="empty-state">No payments yet</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Community</th>
                <th>Amount</th>
                <th>Days Granted</th>
                <th>Platform Fee</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(payment => (
                <tr key={payment.id}>
                  <td>
                    <div className="user-cell">
                      <strong>{payment.userName}</strong>
                      <span className="text-secondary">{payment.userEmail}</span>
                    </div>
                  </td>
                  <td>{payment.communityName}</td>
                  <td className="amount">${payment.amount.toFixed(2)}</td>
                  <td>{payment.daysGranted} days</td>
                  <td className="fee">
                    ${payment.platformFee.toFixed(2)}
                    <span className="fee-percent">({payment.platformFeePercent}%)</span>
                  </td>
                  <td>
                    <span className={`status-badge ${payment.status}`}>
                      {payment.status}
                    </span>
                  </td>
                  <td>{new Date(payment.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default App
