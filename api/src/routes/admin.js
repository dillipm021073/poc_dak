// D.A.K MVP v3 - Platform Admin Routes
// Analytics: Total communities, total users, GMV (admin-only)

const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');

// Middleware: Platform admin only
const platformAdminOnly = (req, res, next) => {
  if (req.user.role !== 'platform_admin') {
    return res.status(403).json({ error: 'Platform admin access required' });
  }
  next();
};

// Get platform stats
router.get('/stats', authenticateToken, platformAdminOnly, async (req, res) => {
  const pool = req.app.locals.pool;

  try {
    // Total communities
    const communitiesResult = await pool.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'suspended') as suspended
       FROM communities`
    );

    // Total users
    const usersResult = await pool.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE role = 'user') as users,
        COUNT(*) FILTER (WHERE role = 'community_admin') as community_admins
       FROM users WHERE role != 'platform_admin'`
    );

    // Active subscribers (users with Active Access)
    const subscribersResult = await pool.query(
      `SELECT COUNT(DISTINCT user_id) as count FROM active_community_access 
       WHERE access_expires_at > NOW()`
    );

    // GMV (total payments completed)
    const gmvResult = await pool.query(
      `SELECT 
        COALESCE(SUM(amount), 0) as total_gmv,
        COALESCE(SUM(platform_fee), 0) as total_platform_revenue
       FROM payments WHERE status = 'completed'`
    );

    // Monthly GMV
    const yearMonth = new Date().toISOString().slice(0, 7);
    const monthlyGmvResult = await pool.query(
      `SELECT 
        COALESCE(SUM(amount), 0) as monthly_gmv,
        COALESCE(SUM(platform_fee), 0) as monthly_revenue
       FROM payments 
       WHERE status = 'completed' AND TO_CHAR(created_at, 'YYYY-MM') = $1`,
      [yearMonth]
    );

    // Waiting list by community type
    const waitingListResult = await pool.query(
      `SELECT community_type, COUNT(*) as count 
       FROM waiting_list 
       GROUP BY community_type`
    );

    // Communities by type
    const communitiesByTypeResult = await pool.query(
      `SELECT community_type, COUNT(*) as count 
       FROM communities WHERE status = 'active'
       GROUP BY community_type`
    );

    res.json({
      communities: {
        total: parseInt(communitiesResult.rows[0].total),
        active: parseInt(communitiesResult.rows[0].active),
        pending: parseInt(communitiesResult.rows[0].pending),
        suspended: parseInt(communitiesResult.rows[0].suspended)
      },
      users: {
        total: parseInt(usersResult.rows[0].total),
        members: parseInt(usersResult.rows[0].users),
        communityAdmins: parseInt(usersResult.rows[0].community_admins)
      },
      activeSubscribers: parseInt(subscribersResult.rows[0].count),
      gmv: {
        total: parseFloat(gmvResult.rows[0].total_gmv),
        platformRevenue: parseFloat(gmvResult.rows[0].total_platform_revenue),
        monthlyGmv: parseFloat(monthlyGmvResult.rows[0].monthly_gmv),
        monthlyRevenue: parseFloat(monthlyGmvResult.rows[0].monthly_revenue)
      },
      waitingListByType: waitingListResult.rows.reduce((acc, row) => {
        acc[row.community_type] = parseInt(row.count);
        return acc;
      }, {}),
      communitiesByType: communitiesByTypeResult.rows.reduce((acc, row) => {
        acc[row.community_type] = parseInt(row.count);
        return acc;
      }, {})
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Get all communities
router.get('/communities', authenticateToken, platformAdminOnly, async (req, res) => {
  const { status } = req.query;
  const pool = req.app.locals.pool;

  try {
    let query = `
      SELECT c.*, 
             ca.admin_name, ca.admin_email, ca.role_in_institution,
             (SELECT COUNT(*) FROM community_memberships WHERE community_id = c.id) as member_count,
             (SELECT COUNT(*) FROM active_community_access WHERE community_id = c.id AND access_expires_at > NOW()) as subscriber_count
      FROM communities c
      LEFT JOIN community_admins ca ON ca.community_id = c.id
    `;
    
    const params = [];
    if (status) {
      query += ` WHERE c.status = $1`;
      params.push(status);
    }
    
    query += ` ORDER BY c.created_at DESC`;

    const result = await pool.query(query, params);

    res.json(result.rows.map(c => ({
      id: c.id,
      name: c.name,
      communityType: c.community_type,
      country: c.country,
      status: c.status,
      inviteLink: c.invite_link,
      adminName: c.admin_name,
      adminEmail: c.admin_email,
      adminRole: c.role_in_institution,
      memberCount: parseInt(c.member_count),
      subscriberCount: parseInt(c.subscriber_count),
      createdAt: c.created_at
    })));
  } catch (err) {
    console.error('Get communities error:', err);
    res.status(500).json({ error: 'Failed to get communities' });
  }
});

// Approve community
router.post('/communities/:id/approve', authenticateToken, platformAdminOnly, async (req, res) => {
  const { id } = req.params;
  const pool = req.app.locals.pool;

  try {
    const result = await pool.query(
      `UPDATE communities SET status = 'active', updated_at = NOW() 
       WHERE id = $1 AND status = 'pending'
       RETURNING name`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Community not found or already approved' });
    }

    // Notify admin
    const adminResult = await pool.query(
      `SELECT user_id FROM community_admins WHERE community_id = $1`,
      [id]
    );

    if (adminResult.rows.length > 0) {
      await pool.query(
        `INSERT INTO notifications (user_id, community_id, type, title, message)
         VALUES ($1, $2, 'approval', 'Community Approved!', 'Your community has been approved and is now live.')`,
        [adminResult.rows[0].user_id, id]
      );
    }

    res.json({ success: true, message: `${result.rows[0].name} has been approved` });
  } catch (err) {
    console.error('Approve community error:', err);
    res.status(500).json({ error: 'Failed to approve community' });
  }
});

// Suspend community
router.post('/communities/:id/suspend', authenticateToken, platformAdminOnly, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const pool = req.app.locals.pool;

  try {
    const result = await pool.query(
      `UPDATE communities SET status = 'suspended', updated_at = NOW() 
       WHERE id = $1
       RETURNING name`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Community not found' });
    }

    // Notify admin
    const adminResult = await pool.query(
      `SELECT user_id FROM community_admins WHERE community_id = $1`,
      [id]
    );

    if (adminResult.rows.length > 0) {
      await pool.query(
        `INSERT INTO notifications (user_id, community_id, type, title, message)
         VALUES ($1, $2, 'suspension', 'Community Suspended', $3)`,
        [adminResult.rows[0].user_id, id, reason || 'Your community has been suspended.']
      );
    }

    res.json({ success: true, message: `${result.rows[0].name} has been suspended` });
  } catch (err) {
    console.error('Suspend community error:', err);
    res.status(500).json({ error: 'Failed to suspend community' });
  }
});

// Reactivate community
router.post('/communities/:id/reactivate', authenticateToken, platformAdminOnly, async (req, res) => {
  const { id } = req.params;
  const pool = req.app.locals.pool;

  try {
    const result = await pool.query(
      `UPDATE communities SET status = 'active', updated_at = NOW() 
       WHERE id = $1 AND status = 'suspended'
       RETURNING name`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Community not found or not suspended' });
    }

    res.json({ success: true, message: `${result.rows[0].name} has been reactivated` });
  } catch (err) {
    console.error('Reactivate community error:', err);
    res.status(500).json({ error: 'Failed to reactivate community' });
  }
});

// Get all users
router.get('/users', authenticateToken, platformAdminOnly, async (req, res) => {
  const pool = req.app.locals.pool;

  try {
    const result = await pool.query(
      `SELECT 
        u.id, u.email, u.name, u.role, u.community_type, u.created_at,
        (SELECT COUNT(*) FROM community_memberships WHERE user_id = u.id) as community_count,
        (SELECT COUNT(*) FROM active_community_access WHERE user_id = u.id AND access_expires_at > NOW()) as active_access_count
       FROM users u
       WHERE u.role != 'platform_admin'
       ORDER BY u.created_at DESC
       LIMIT 100`
    );

    res.json(result.rows.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      communityType: user.community_type,
      communityCount: parseInt(user.community_count),
      activeAccessCount: parseInt(user.active_access_count),
      createdAt: user.created_at
    })));
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Get waiting list
router.get('/waiting-list', authenticateToken, platformAdminOnly, async (req, res) => {
  const { communityType } = req.query;
  const pool = req.app.locals.pool;

  try {
    let query = `SELECT * FROM waiting_list`;
    const params = [];
    
    if (communityType) {
      query += ` WHERE community_type = $1`;
      params.push(communityType);
    }
    
    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, params);

    res.json(result.rows.map(entry => ({
      id: entry.id,
      email: entry.email,
      recommendedInstitution: entry.recommended_institution,
      communityType: entry.community_type,
      createdAt: entry.created_at
    })));
  } catch (err) {
    console.error('Get waiting list error:', err);
    res.status(500).json({ error: 'Failed to get waiting list' });
  }
});

// Get payment history (for reporting)
router.get('/payments', authenticateToken, platformAdminOnly, async (req, res) => {
  const { communityId, status } = req.query;
  const pool = req.app.locals.pool;

  try {
    let query = `
      SELECT p.*, c.name as community_name, u.name as user_name, u.email as user_email
      FROM payments p
      JOIN communities c ON c.id = p.community_id
      JOIN users u ON u.id = p.user_id
    `;
    
    const conditions = [];
    const params = [];
    
    if (communityId) {
      params.push(communityId);
      conditions.push(`p.community_id = $${params.length}`);
    }
    
    if (status) {
      params.push(status);
      conditions.push(`p.status = $${params.length}`);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY p.created_at DESC LIMIT 100`;

    const result = await pool.query(query, params);

    res.json(result.rows.map(payment => ({
      id: payment.id,
      userId: payment.user_id,
      userName: payment.user_name,
      userEmail: payment.user_email,
      communityId: payment.community_id,
      communityName: payment.community_name,
      amount: parseFloat(payment.amount),
      currency: payment.currency,
      status: payment.status,
      daysGranted: payment.days_granted,
      platformFee: parseFloat(payment.platform_fee),
      platformFeePercent: parseFloat(payment.platform_fee_percent),
      pspTransactionId: payment.psp_transaction_id,
      createdAt: payment.created_at
    })));
  } catch (err) {
    console.error('Get payments error:', err);
    res.status(500).json({ error: 'Failed to get payments' });
  }
});

// Platform fee configuration (read-only for MVP)
router.get('/fee-structure', authenticateToken, platformAdminOnly, async (req, res) => {
  res.json({
    slidingScale: [
      { minActivity: 0, maxActivity: 300, feePercent: 25 },
      { minActivity: 300, maxActivity: 600, feePercent: 20 },
      { minActivity: 600, maxActivity: 1000, feePercent: 12 },
      { minActivity: 1000, maxActivity: null, feePercent: 7 }
    ],
    note: 'Platform fee is calculated monthly per community based on total payments collected'
  });
});

module.exports = router;
