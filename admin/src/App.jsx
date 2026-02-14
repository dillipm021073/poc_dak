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
// CSV EXPORT UTILITY
// ============================================================================

function exportToCSV(data, columns, filename) {
  if (!data || data.length === 0) { alert('No data to export'); return }
  const header = columns.map(c => c.label).join(',')
  const rows = data.map(row =>
    columns.map(c => {
      let val = typeof c.accessor === 'function' ? c.accessor(row) : row[c.accessor]
      if (val === null || val === undefined) val = ''
      val = String(val).replace(/"/g, '""')
      if (val.includes(',') || val.includes('"') || val.includes('\n')) val = `"${val}"`
      return val
    }).join(',')
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// ============================================================================
// DATE RANGE FILTER COMPONENT
// ============================================================================

function DateRangeFilter({ startDate, endDate, onStartChange, onEndChange, onApply, onClear }) {
  return (
    <div className="date-range-filter" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        type="date"
        value={startDate}
        onChange={(e) => onStartChange(e.target.value)}
        style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--gray-300, #d1d5db)', fontSize: '13px' }}
      />
      <span style={{ color: '#6b7280', fontSize: '13px' }}>to</span>
      <input
        type="date"
        value={endDate}
        onChange={(e) => onEndChange(e.target.value)}
        style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--gray-300, #d1d5db)', fontSize: '13px' }}
      />
      <button className="btn btn-sm btn-primary" onClick={onApply}>Apply</button>
      {(startDate || endDate) && (
        <button className="btn btn-sm btn-outline" onClick={onClear}>Clear</button>
      )}
    </div>
  )
}

// ============================================================================
// EXPORT BUTTON COMPONENT
// ============================================================================

function ExportButton({ onClick, disabled }) {
  return (
    <button
      className="btn btn-sm btn-outline"
      onClick={onClick}
      disabled={disabled}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
    >
      Export CSV
    </button>
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

  const handleExportDashboard = () => {
    const rows = [
      { metric: 'Total Communities', value: stats.communities.total },
      { metric: 'Active Communities', value: stats.communities.active },
      { metric: 'Pending Communities', value: stats.communities.pending },
      { metric: 'Suspended Communities', value: stats.communities.suspended },
      { metric: 'Total Users', value: stats.users.total },
      { metric: 'Members', value: stats.users.members },
      { metric: 'Community Admins', value: stats.users.communityAdmins },
      { metric: 'Active Subscribers', value: stats.activeSubscribers },
      { metric: 'Total GMV', value: '$' + stats.gmv.total.toFixed(2) },
      { metric: 'Monthly GMV', value: '$' + stats.gmv.monthlyGmv.toFixed(2) },
      { metric: 'Platform Revenue', value: '$' + stats.gmv.platformRevenue.toFixed(2) },
      ...Object.entries(stats.communitiesByType).map(([type, count]) => ({ metric: `Communities - ${type}`, value: count })),
      ...Object.entries(stats.waitingListByType).map(([type, count]) => ({ metric: `Waiting List - ${type}`, value: count }))
    ]
    exportToCSV(rows, [
      { label: 'Metric', accessor: 'metric' },
      { label: 'Value', accessor: 'value' }
    ], 'dak_dashboard_summary')
  }

  return (
    <div className="dashboard-tab">
      <div className="page-header">
        <div>
          <h1>Platform Dashboard</h1>
          <p>Overview of D.A.K platform metrics</p>
        </div>
        <ExportButton onClick={handleExportDashboard} />
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
  const [search, setSearch] = useState('')
  const [communityType, setCommunityType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [appliedFilters, setAppliedFilters] = useState({ startDate: '', endDate: '', search: '', communityType: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCommunities()
  }, [filter, appliedFilters])

  const loadCommunities = async () => {
    try {
      const params = {}
      if (filter) params.status = filter
      if (appliedFilters.startDate) params.startDate = appliedFilters.startDate
      if (appliedFilters.endDate) params.endDate = appliedFilters.endDate
      if (appliedFilters.search) params.search = appliedFilters.search
      if (appliedFilters.communityType) params.communityType = appliedFilters.communityType
      const data = await api.admin.getCommunities(params)
      setCommunities(data)
    } catch (err) {
      console.error('Failed to load communities:', err)
    }
    setLoading(false)
  }

  const applyFilters = () => setAppliedFilters({ startDate, endDate, search, communityType })
  const clearAllFilters = () => { setSearch(''); setCommunityType(''); setStartDate(''); setEndDate(''); setAppliedFilters({ startDate: '', endDate: '', search: '', communityType: '' }) }

  const handleExport = () => {
    exportToCSV(communities, [
      { label: 'Name', accessor: 'name' },
      { label: 'Type', accessor: 'communityType' },
      { label: 'Country', accessor: 'country' },
      { label: 'Status', accessor: 'status' },
      { label: 'Admin Name', accessor: 'adminName' },
      { label: 'Admin Email', accessor: 'adminEmail' },
      { label: 'Members', accessor: 'memberCount' },
      { label: 'Subscribers', accessor: 'subscriberCount' },
      { label: 'Created', accessor: (r) => new Date(r.createdAt).toLocaleDateString() }
    ], 'dak_communities')
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
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="filter-buttons">
            {['', 'pending', 'active', 'suspended'].map(s => (
              <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(s)}>
                {s || 'All'}
              </button>
            ))}
          </div>
          <ExportButton onClick={handleExport} disabled={communities.length === 0} />
        </div>
      </div>
      <div className="advanced-filters">
        <input
          type="text"
          placeholder="Search by name or admin email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
          className="filter-input"
        />
        <select value={communityType} onChange={(e) => setCommunityType(e.target.value)} className="filter-select">
          <option value="">All Networks</option>
          <option value="judaism">Judaism</option>
          <option value="christianity">Christianity</option>
          <option value="islam">Islam</option>
          <option value="hinduism">Hinduism</option>
        </select>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="filter-date" />
        <span className="filter-separator">to</span>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="filter-date" />
        <button className="btn btn-sm btn-primary" onClick={applyFilters}>Apply</button>
        {(search || communityType || startDate || endDate) && (
          <button className="btn btn-sm btn-outline" onClick={clearAllFilters}>Clear</button>
        )}
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
  const [roleFilter, setRoleFilter] = useState('')
  const [search, setSearch] = useState('')
  const [communityType, setCommunityType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [appliedFilters, setAppliedFilters] = useState({ startDate: '', endDate: '', search: '', communityType: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUsers()
  }, [roleFilter, appliedFilters])

  const loadUsers = async () => {
    try {
      const params = {}
      if (roleFilter) params.role = roleFilter
      if (appliedFilters.startDate) params.startDate = appliedFilters.startDate
      if (appliedFilters.endDate) params.endDate = appliedFilters.endDate
      if (appliedFilters.search) params.search = appliedFilters.search
      if (appliedFilters.communityType) params.communityType = appliedFilters.communityType
      const data = await api.admin.getUsers(params)
      setUsers(data)
    } catch (err) {
      console.error('Failed to load users:', err)
    }
    setLoading(false)
  }

  const applyFilters = () => setAppliedFilters({ startDate, endDate, search, communityType })
  const clearAllFilters = () => { setSearch(''); setCommunityType(''); setStartDate(''); setEndDate(''); setAppliedFilters({ startDate: '', endDate: '', search: '', communityType: '' }) }

  const handleExport = () => {
    exportToCSV(users, [
      { label: 'Name', accessor: (r) => r.name || 'Unnamed' },
      { label: 'Email', accessor: 'email' },
      { label: 'Role', accessor: (r) => r.role.replace('_', ' ') },
      { label: 'Network', accessor: (r) => r.communityType || '' },
      { label: 'Communities', accessor: 'communityCount' },
      { label: 'Active Access', accessor: 'activeAccessCount' },
      { label: 'Joined', accessor: (r) => new Date(r.createdAt).toLocaleDateString() }
    ], 'dak_users')
  }

  if (loading) return <div className="loading">Loading users...</div>

  return (
    <div className="users-tab">
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p>Platform user management</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="filter-buttons">
            {[['', 'All'], ['user', 'Devotees'], ['community_admin', 'Admins']].map(([val, label]) => (
              <button key={val} className={`btn btn-sm ${roleFilter === val ? 'btn-primary' : 'btn-outline'}`} onClick={() => setRoleFilter(val)}>
                {label}
              </button>
            ))}
          </div>
          <ExportButton onClick={handleExport} disabled={users.length === 0} />
        </div>
      </div>
      <div className="advanced-filters">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
          className="filter-input"
        />
        <select value={communityType} onChange={(e) => setCommunityType(e.target.value)} className="filter-select">
          <option value="">All Networks</option>
          <option value="judaism">Judaism</option>
          <option value="christianity">Christianity</option>
          <option value="islam">Islam</option>
          <option value="hinduism">Hinduism</option>
        </select>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="filter-date" />
        <span className="filter-separator">to</span>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="filter-date" />
        <button className="btn btn-sm btn-primary" onClick={applyFilters}>Apply</button>
        {(search || communityType || startDate || endDate) && (
          <button className="btn btn-sm btn-outline" onClick={clearAllFilters}>Clear</button>
        )}
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
  const [waitingList, setWaitingList] = useState([])
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [appliedFilters, setAppliedFilters] = useState({ startDate: '', endDate: '', search: '', status: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [filter, appliedFilters])

  const loadData = async () => {
    try {
      const params = {}
      if (filter) params.communityType = filter
      if (appliedFilters.startDate) params.startDate = appliedFilters.startDate
      if (appliedFilters.endDate) params.endDate = appliedFilters.endDate
      if (appliedFilters.search) params.search = appliedFilters.search
      if (appliedFilters.status) params.status = appliedFilters.status
      const data = await api.admin.getWaitingList(params)
      setWaitingList(Array.isArray(data) ? data : data.waitingList || [])
    } catch (err) {
      console.error('Failed to load waiting list:', err)
    }
    setLoading(false)
  }

  const applyFilters = () => setAppliedFilters({ startDate, endDate, search, status: statusFilter })
  const clearAllFilters = () => { setSearch(''); setStatusFilter(''); setStartDate(''); setEndDate(''); setAppliedFilters({ startDate: '', endDate: '', search: '', status: '' }) }

  const handleExport = () => {
    exportToCSV(waitingList, [
      { label: 'Email', accessor: 'email' },
      { label: 'Community Type', accessor: 'communityType' },
      { label: 'Recommended Institution', accessor: (r) => r.recommendedInstitution || '' },
      { label: 'Status', accessor: 'status' },
      { label: 'Date', accessor: (r) => new Date(r.createdAt).toLocaleDateString() }
    ], 'dak_waiting_list')
  }

  const handleApprove = async (id) => {
    try {
      const result = await api.admin.approveWaitingListEntry(id)
      alert(result.message)
      loadData()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleReject = async (id) => {
    if (!confirm('Reject this application?')) return
    try {
      await api.admin.rejectWaitingListEntry(id)
      loadData()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleRemove = async (id) => {
    if (!confirm('Remove this entry from the waiting list?')) return
    try {
      await api.admin.removeWaitingListEntry(id)
      loadData()
    } catch (err) {
      alert(err.message)
    }
  }

  const communityTypes = ['', 'islam', 'christianity', 'hinduism', 'judaism']

  if (loading) return <div className="loading">Loading waiting list...</div>

  return (
    <div className="waiting-list-tab">
      <div className="page-header">
        <div>
          <h1>Waiting List</h1>
          <p>Approve or reject institute applications</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
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
          <ExportButton onClick={handleExport} disabled={waitingList.length === 0} />
        </div>
      </div>
      <div className="advanced-filters">
        <input
          type="text"
          placeholder="Search by email or institution..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
          className="filter-input"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="filter-date" />
        <span className="filter-separator">to</span>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="filter-date" />
        <button className="btn btn-sm btn-primary" onClick={applyFilters}>Apply</button>
        {(search || statusFilter || startDate || endDate) && (
          <button className="btn btn-sm btn-outline" onClick={clearAllFilters}>Clear</button>
        )}
      </div>

      {waitingList.length === 0 ? (
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
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {waitingList.map(entry => (
                <tr key={entry.id}>
                  <td>{entry.email}</td>
                  <td className="capitalize">{entry.communityType}</td>
                  <td>{entry.recommendedInstitution || '—'}</td>
                  <td>{new Date(entry.createdAt).toLocaleDateString()}</td>
                  <td>
                    <span className={`status-badge ${entry.status}`}>
                      {entry.status}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      {entry.status === 'pending' && (
                        <>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleApprove(entry.id)}
                          >
                            Approve
                          </button>
                          <button
                            className="btn btn-sm btn-outline"
                            style={{ color: '#dc2626', borderColor: '#dc2626' }}
                            onClick={() => handleReject(entry.id)}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => handleRemove(entry.id)}
                        title="Remove from list"
                      >
                        Remove
                      </button>
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
// PAYMENTS TAB
// ============================================================================

function PaymentsTab() {
  const [payments, setPayments] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [communityName, setCommunityName] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [appliedFilters, setAppliedFilters] = useState({ startDate: '', endDate: '', search: '', communityName: '', minAmount: '', maxAmount: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPayments()
  }, [statusFilter, appliedFilters])

  const loadPayments = async () => {
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      if (appliedFilters.startDate) params.startDate = appliedFilters.startDate
      if (appliedFilters.endDate) params.endDate = appliedFilters.endDate
      if (appliedFilters.search) params.search = appliedFilters.search
      if (appliedFilters.communityName) params.communityName = appliedFilters.communityName
      if (appliedFilters.minAmount) params.minAmount = appliedFilters.minAmount
      if (appliedFilters.maxAmount) params.maxAmount = appliedFilters.maxAmount
      const data = await api.admin.getPayments(params)
      setPayments(data)
    } catch (err) {
      console.error('Failed to load payments:', err)
    }
    setLoading(false)
  }

  const applyFilters = () => setAppliedFilters({ startDate, endDate, search, communityName, minAmount, maxAmount })
  const clearAllFilters = () => { setSearch(''); setCommunityName(''); setMinAmount(''); setMaxAmount(''); setStartDate(''); setEndDate(''); setAppliedFilters({ startDate: '', endDate: '', search: '', communityName: '', minAmount: '', maxAmount: '' }) }

  const handleExport = () => {
    exportToCSV(payments, [
      { label: 'User', accessor: 'userName' },
      { label: 'Email', accessor: 'userEmail' },
      { label: 'Community', accessor: 'communityName' },
      { label: 'Amount ($)', accessor: (r) => r.amount.toFixed(2) },
      { label: 'Currency', accessor: 'currency' },
      { label: 'Days Granted', accessor: 'daysGranted' },
      { label: 'Platform Fee ($)', accessor: (r) => r.platformFee.toFixed(2) },
      { label: 'Fee %', accessor: 'platformFeePercent' },
      { label: 'Status', accessor: 'status' },
      { label: 'Transaction ID', accessor: (r) => r.pspTransactionId || '' },
      { label: 'Date', accessor: (r) => new Date(r.createdAt).toLocaleDateString() }
    ], 'dak_payments')
  }

  if (loading) return <div className="loading">Loading payments...</div>

  return (
    <div className="payments-tab">
      <div className="page-header">
        <div>
          <h1>Payments</h1>
          <p>Transaction history and platform fees</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="filter-buttons">
            {[['', 'All'], ['completed', 'Completed'], ['pending', 'Pending'], ['failed', 'Failed']].map(([val, label]) => (
              <button key={val} className={`btn btn-sm ${statusFilter === val ? 'btn-primary' : 'btn-outline'}`} onClick={() => setStatusFilter(val)}>
                {label}
              </button>
            ))}
          </div>
          <ExportButton onClick={handleExport} disabled={payments.length === 0} />
        </div>
      </div>
      <div className="advanced-filters">
        <input
          type="text"
          placeholder="Search by user name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
          className="filter-input"
        />
        <input
          type="text"
          placeholder="Institute name..."
          value={communityName}
          onChange={(e) => setCommunityName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
          className="filter-input"
          style={{ minWidth: 140 }}
        />
        <div className="filter-amount-group">
          <input type="number" placeholder="Min $" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} className="filter-amount" step="0.01" min="0" />
          <span className="filter-separator">—</span>
          <input type="number" placeholder="Max $" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} className="filter-amount" step="0.01" min="0" />
        </div>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="filter-date" />
        <span className="filter-separator">to</span>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="filter-date" />
        <button className="btn btn-sm btn-primary" onClick={applyFilters}>Apply</button>
        {(search || communityName || minAmount || maxAmount || startDate || endDate) && (
          <button className="btn btn-sm btn-outline" onClick={clearAllFilters}>Clear</button>
        )}
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
