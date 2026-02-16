// D.A.K MVP v3 - Communities Routes
const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuth } = require('../middleware/auth');

// Get community by invite link (public - for QR/link onboarding)
router.get('/invite/:link', async (req, res) => {
  const { link } = req.params;
  const pool = req.app.locals.pool;

  try {
    const result = await pool.query(
      `SELECT id, name, community_type, short_description, logo_url, cover_image_url,
              head_of_institution, about_text, status
       FROM communities WHERE invite_link = $1`,
      [link]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Community not found' });
    }

    const community = result.rows[0];
    
    if (community.status !== 'active') {
      return res.status(400).json({ error: 'This community is not currently accepting new members' });
    }

    res.json({
      id: community.id,
      name: community.name,
      communityType: community.community_type,
      shortDescription: community.short_description,
      logoUrl: community.logo_url,
      coverImageUrl: community.cover_image_url,
      headOfInstitution: community.head_of_institution,
      aboutText: community.about_text,
      confirmationMessage: `You're joining communities within the ${community.community_type} network on D.A.K`
    });
  } catch (err) {
    console.error('Get invite error:', err);
    res.status(500).json({ error: 'Failed to get community' });
  }
});

// Get user's communities
router.get('/my', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;

  try {
    const result = await pool.query(
      `SELECT
        c.id, c.name, c.community_type, c.logo_url, c.cover_image_url,
        c.head_of_institution, c.message_of_day, c.short_description,
        cm.created_at as joined_at,
        cm.status as membership_status,
        aca.access_expires_at,
        CASE
          WHEN aca.access_expires_at > NOW() THEN TRUE
          ELSE FALSE
        END as has_active_access
      FROM community_memberships cm
      JOIN communities c ON c.id = cm.community_id
      LEFT JOIN active_community_access aca ON aca.community_id = c.id AND aca.user_id = cm.user_id
      WHERE cm.user_id = $1 AND c.status = 'active' AND cm.status != 'rejected'
      ORDER BY cm.created_at DESC`,
      [req.user.userId]
    );

    const communities = result.rows.map(row => {
      const now = new Date();
      const expiresAt = row.access_expires_at ? new Date(row.access_expires_at) : null;
      const msPerDay = 24 * 60 * 60 * 1000;
      let daysRemaining = expiresAt ? Math.ceil((expiresAt - now) / msPerDay) : 0;
      daysRemaining = Math.max(0, Math.min(90, daysRemaining));
      const isPending = row.membership_status === 'pending';

      return {
        id: row.id,
        name: row.name,
        communityType: row.community_type,
        logoUrl: row.logo_url,
        coverImageUrl: row.cover_image_url,
        headOfInstitution: row.head_of_institution,
        messageOfDay: row.message_of_day,
        shortDescription: row.short_description,
        joinedAt: row.joined_at,
        membershipStatus: row.membership_status,
        hasActiveAccess: isPending ? false : row.has_active_access,
        isViewOnly: isPending || !row.has_active_access,
        daysRemaining: isPending ? 0 : daysRemaining,
        expiresAt: row.access_expires_at || null
      };
    });

    res.json(communities);
  } catch (err) {
    console.error('Get my communities error:', err);
    res.status(500).json({ error: 'Failed to get communities' });
  }
});

// Get single community (authenticated - must be member)
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const pool = req.app.locals.pool;

  try {
    // Check membership and status
    const membershipResult = await pool.query(
      `SELECT id, status FROM community_memberships
       WHERE community_id = $1 AND user_id = $2`,
      [id, req.user.userId]
    );

    const isMember = membershipResult.rows.length > 0;
    const membershipStatus = membershipResult.rows[0]?.status || null;
    const isPending = membershipStatus === 'pending';

    // Get community details
    const communityResult = await pool.query(
      `SELECT c.*, 
              ca.admin_name, ca.role_in_institution,
              (SELECT COUNT(*) FROM community_memberships WHERE community_id = c.id AND status = 'approved') as member_count
       FROM communities c
       LEFT JOIN community_admins ca ON ca.community_id = c.id
       WHERE c.id = $1`,
      [id]
    );

    if (communityResult.rows.length === 0) {
      return res.status(404).json({ error: 'Community not found' });
    }

    const community = communityResult.rows[0];

    // Check access status
    let hasActiveAccess = false;
    let daysRemaining = 0;

    if (isMember) {
      const accessResult = await pool.query(
        `SELECT access_expires_at FROM active_community_access 
         WHERE community_id = $1 AND user_id = $2`,
        [id, req.user.userId]
      );

      if (accessResult.rows.length > 0) {
        const now = new Date();
        const expiresAt = new Date(accessResult.rows[0].access_expires_at);
        hasActiveAccess = expiresAt > now;
        
        const msPerDay = 24 * 60 * 60 * 1000;
        daysRemaining = Math.ceil((expiresAt - now) / msPerDay);
        daysRemaining = Math.max(0, Math.min(90, daysRemaining));
      }
    }

    res.json({
      id: community.id,
      name: community.name,
      communityType: community.community_type,
      country: community.country,
      status: community.status,
      logoUrl: community.logo_url,
      coverImageUrl: community.cover_image_url,
      aboutText: community.about_text,
      headOfInstitution: community.head_of_institution,
      messageOfDay: community.message_of_day,
      shortDescription: community.short_description,
      officialWebsite: community.official_website,
      adminName: community.admin_name,
      adminRole: community.role_in_institution,
      memberCount: community.member_count,
      inviteLink: community.invite_link,
      isMember,
      membershipStatus,
      hasActiveAccess: isPending ? false : hasActiveAccess,
      isViewOnly: isPending || !hasActiveAccess,
      daysRemaining: isPending ? 0 : daysRemaining
    });
  } catch (err) {
    console.error('Get community error:', err);
    res.status(500).json({ error: 'Failed to get community' });
  }
});

// Join community via invite link
router.post('/join', authenticateToken, async (req, res) => {
  const { inviteLink } = req.body;
  const pool = req.app.locals.pool;

  try {
    // Get community
    const communityResult = await pool.query(
      `SELECT id, name, community_type, status FROM communities WHERE invite_link = $1`,
      [inviteLink]
    );

    if (communityResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid invite link' });
    }

    const community = communityResult.rows[0];

    if (community.status !== 'active') {
      return res.status(400).json({ error: 'This community is not accepting new members' });
    }

    // Check user's community type (Chinese-wall)
    const userResult = await pool.query(
      `SELECT community_type FROM users WHERE id = $1`,
      [req.user.userId]
    );

    const userCommunityType = userResult.rows[0]?.community_type;

    if (userCommunityType && userCommunityType !== community.community_type) {
      return res.status(400).json({
        error: `You are in the ${userCommunityType} network and cannot join communities in the ${community.community_type} network`
      });
    }

    // Update user's community type if not set
    if (!userCommunityType) {
      await pool.query(
        `UPDATE users SET community_type = $1, updated_at = NOW() WHERE id = $2`,
        [community.community_type, req.user.userId]
      );
    }

    // Check existing membership
    const existingMembership = await pool.query(
      `SELECT id FROM community_memberships WHERE community_id = $1 AND user_id = $2`,
      [community.id, req.user.userId]
    );

    if (existingMembership.rows.length > 0) {
      return res.status(400).json({ error: 'You are already a member of this community' });
    }

    // Create membership (pending approval by institute admin)
    await pool.query(
      `INSERT INTO community_memberships (community_id, user_id, joined_via, status)
       VALUES ($1, $2, 'link', 'pending')`,
      [community.id, req.user.userId]
    );

    // Create notification for user
    await pool.query(
      `INSERT INTO notifications (user_id, community_id, type, title, message)
       VALUES ($1, $2, 'welcome', 'Membership Pending', $3)`,
      [req.user.userId, community.id, `Your request to join ${community.name} is pending approval by the community administrator.`]
    );

    // Notify community admin about new pending member
    const adminResult = await pool.query(
      `SELECT user_id FROM community_admins WHERE community_id = $1`,
      [community.id]
    );
    if (adminResult.rows.length > 0) {
      const userName = (await pool.query('SELECT name FROM users WHERE id = $1', [req.user.userId])).rows[0]?.name || 'A new user';
      await pool.query(
        `INSERT INTO notifications (user_id, community_id, type, title, message)
         VALUES ($1, $2, 'welcome', 'New Member Request', $3)`,
        [adminResult.rows[0].user_id, community.id, `${userName} has requested to join your community and is awaiting your approval.`]
      );
    }

    res.json({
      success: true,
      community: {
        id: community.id,
        name: community.name,
        communityType: community.community_type
      },
      message: `Your request to join ${community.name} is pending approval by the community administrator.`,
      isViewOnly: true,
      membershipStatus: 'pending'
    });
  } catch (err) {
    console.error('Join community error:', err);
    res.status(500).json({ error: 'Failed to join community' });
  }
});

// Create community (community admin onboarding)
router.post('/', authenticateToken, async (req, res) => {
  const { 
    name, country, communityType, 
    adminName, adminEmail, roleInInstitution,
    officialWebsite, officialIdentifier, shortDescription 
  } = req.body;
  const pool = req.app.locals.pool;

  try {
    // Validate community type
    const validTypes = ['islam', 'christianity', 'hinduism', 'judaism'];
    if (!validTypes.includes(communityType)) {
      return res.status(400).json({ error: 'Invalid community type' });
    }

    // Check for duplicate community name (case-insensitive)
    const duplicateCheck = await pool.query(
      `SELECT id FROM communities WHERE LOWER(name) = LOWER($1)`,
      [name]
    );
    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({ error: 'A community with this name already exists. Please choose a different name.' });
    }

    // Generate invite link
    const inviteLink = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36);

    // Create community (pending approval)
    const communityResult = await pool.query(
      `INSERT INTO communities (name, country, community_type, invite_link, 
                                official_website, official_identifier, short_description, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING id`,
      [name, country, communityType, inviteLink, officialWebsite, officialIdentifier, shortDescription]
    );

    const communityId = communityResult.rows[0].id;

    // Update requesting user's role and community type
    await pool.query(
      `UPDATE users SET role = 'community_admin', community_type = $1, updated_at = NOW() 
       WHERE id = $2`,
      [communityType, req.user.userId]
    );

    // Create admin record
    await pool.query(
      `INSERT INTO community_admins (community_id, user_id, admin_name, admin_email, role_in_institution)
       VALUES ($1, $2, $3, $4, $5)`,
      [communityId, req.user.userId, adminName, adminEmail, roleInInstitution]
    );

    // Create membership for admin (auto-approved)
    await pool.query(
      `INSERT INTO community_memberships (community_id, user_id, joined_via, status)
       VALUES ($1, $2, 'admin', 'approved')`,
      [communityId, req.user.userId]
    );

    res.status(201).json({
      id: communityId,
      name,
      communityType,
      inviteLink,
      status: 'pending',
      message: 'Community created and pending approval'
    });
  } catch (err) {
    console.error('Create community error:', err);
    res.status(500).json({ error: 'Failed to create community' });
  }
});

// Update community (admin CMS)
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { logoUrl, coverImageUrl, aboutText, headOfInstitution, messageOfDay } = req.body;
  const pool = req.app.locals.pool;

  try {
    // Verify admin
    const adminCheck = await pool.query(
      `SELECT id FROM community_admins WHERE community_id = $1 AND user_id = $2`,
      [id, req.user.userId]
    );

    if (adminCheck.rows.length === 0 && req.user.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await pool.query(
      `UPDATE communities SET 
        logo_url = COALESCE($1, logo_url),
        cover_image_url = COALESCE($2, cover_image_url),
        about_text = COALESCE($3, about_text),
        head_of_institution = COALESCE($4, head_of_institution),
        message_of_day = COALESCE($5, message_of_day),
        updated_at = NOW()
       WHERE id = $6`,
      [logoUrl, coverImageUrl, aboutText, headOfInstitution, messageOfDay, id]
    );

    res.json({ success: true, message: 'Community updated' });
  } catch (err) {
    console.error('Update community error:', err);
    res.status(500).json({ error: 'Failed to update community' });
  }
});

// Get community members (admin only)
router.get('/:id/members', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const pool = req.app.locals.pool;

  try {
    // Verify admin
    const adminCheck = await pool.query(
      `SELECT id FROM community_admins WHERE community_id = $1 AND user_id = $2`,
      [id, req.user.userId]
    );

    if (adminCheck.rows.length === 0 && req.user.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.created_at as user_created_at,
              cm.joined_via, cm.created_at as joined_at, cm.status as membership_status,
              aca.access_expires_at,
              aca.credit_amount,
              CASE
                WHEN aca.access_expires_at > NOW() THEN true
                ELSE false
              END as has_active_access
       FROM community_memberships cm
       JOIN users u ON u.id = cm.user_id
       LEFT JOIN active_community_access aca ON aca.user_id = u.id AND aca.community_id = cm.community_id
       WHERE cm.community_id = $1 AND u.role = 'user'
       ORDER BY cm.status ASC, cm.created_at DESC`,
      [id]
    );

    const members = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      joinedAt: row.joined_at,
      joinedVia: row.joined_via,
      membershipStatus: row.membership_status || 'approved',
      hasActiveAccess: row.membership_status === 'approved' ? row.has_active_access : false,
      accessExpiresAt: row.access_expires_at,
      creditAmount: row.credit_amount ? parseFloat(row.credit_amount) : 0
    }));

    res.json(members);
  } catch (err) {
    console.error('Get members error:', err);
    res.status(500).json({ error: 'Failed to get members' });
  }
});

// Get community analytics (admin only)
router.get('/:id/analytics', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const pool = req.app.locals.pool;

  try {
    // Verify admin
    const adminCheck = await pool.query(
      `SELECT id FROM community_admins WHERE community_id = $1 AND user_id = $2`,
      [id, req.user.userId]
    );

    if (adminCheck.rows.length === 0 && req.user.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get subscriber count (users with Active Access)
    const subscriberResult = await pool.query(
      `SELECT COUNT(*) as count FROM active_community_access 
       WHERE community_id = $1 AND access_expires_at > NOW()`,
      [id]
    );

    // Get member count
    const memberResult = await pool.query(
      `SELECT COUNT(*) as count FROM community_memberships WHERE community_id = $1 AND status = 'approved'`,
      [id]
    );

    // Get monthly activity - calculate from payments table for current month
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    console.log('Analytics query params:', {
      communityId: id,
      firstDayOfMonth: firstDayOfMonth.toISOString(),
      firstDayNextMonth: firstDayNextMonth.toISOString()
    });

    const monthlyPaymentsResult = await pool.query(
      `SELECT
         COALESCE(SUM(amount), 0) as total_collected,
         COALESCE(SUM(platform_fee), 0) as platform_fee_total,
         COUNT(*) as payment_count
       FROM payments
       WHERE community_id = $1
         AND status = 'completed'
         AND created_at >= $2
         AND created_at < $3`,
      [id, firstDayOfMonth, firstDayNextMonth]
    );

    console.log('Monthly payments result:', monthlyPaymentsResult.rows[0]);

    // Get recent analytics
    const analyticsResult = await pool.query(
      `SELECT * FROM community_analytics
       WHERE community_id = $1
       ORDER BY date DESC LIMIT 30`,
      [id]
    );

    const monthlyActivity = monthlyPaymentsResult.rows[0] || { total_collected: 0, platform_fee_total: 0 };

    res.json({
      activeSubscribers: parseInt(subscriberResult.rows[0].count),
      totalMembers: parseInt(memberResult.rows[0].count),
      monthlyActivity: {
        total_collected: parseFloat(monthlyActivity.total_collected).toFixed(2),
        platform_fee_total: parseFloat(monthlyActivity.platform_fee_total).toFixed(2)
      },
      recentAnalytics: analyticsResult.rows
    });
  } catch (err) {
    console.error('Get analytics error:', err);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// Approve member (institute admin only)
router.post('/:id/members/:userId/approve', authenticateToken, async (req, res) => {
  const { id, userId } = req.params;
  const pool = req.app.locals.pool;

  try {
    // Verify admin
    const adminCheck = await pool.query(
      `SELECT id FROM community_admins WHERE community_id = $1 AND user_id = $2`,
      [id, req.user.userId]
    );

    if (adminCheck.rows.length === 0 && req.user.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = await pool.query(
      `UPDATE community_memberships SET status = 'approved'
       WHERE community_id = $1 AND user_id = $2 AND status = 'pending'
       RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pending membership not found' });
    }

    // Get community name for notification
    const community = await pool.query(`SELECT name FROM communities WHERE id = $1`, [id]);

    // Notify the user
    await pool.query(
      `INSERT INTO notifications (user_id, community_id, type, title, message)
       VALUES ($1, $2, 'approval', 'Membership Approved!', $3)`,
      [userId, id, `Your membership to ${community.rows[0]?.name || 'the community'} has been approved. Welcome!`]
    );

    res.json({ success: true, message: 'Member approved successfully' });
  } catch (err) {
    console.error('Approve member error:', err);
    res.status(500).json({ error: 'Failed to approve member' });
  }
});

// Reject member (institute admin only)
router.post('/:id/members/:userId/reject', authenticateToken, async (req, res) => {
  const { id, userId } = req.params;
  const pool = req.app.locals.pool;

  try {
    // Verify admin
    const adminCheck = await pool.query(
      `SELECT id FROM community_admins WHERE community_id = $1 AND user_id = $2`,
      [id, req.user.userId]
    );

    if (adminCheck.rows.length === 0 && req.user.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = await pool.query(
      `UPDATE community_memberships SET status = 'rejected'
       WHERE community_id = $1 AND user_id = $2 AND status = 'pending'
       RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pending membership not found' });
    }

    // Get community name for notification
    const community = await pool.query(`SELECT name FROM communities WHERE id = $1`, [id]);

    // Notify the user
    await pool.query(
      `INSERT INTO notifications (user_id, community_id, type, title, message)
       VALUES ($1, $2, 'approval', 'Membership Request Declined', $3)`,
      [userId, id, `Your membership request to ${community.rows[0]?.name || 'the community'} was not approved.`]
    );

    res.json({ success: true, message: 'Member rejected' });
  } catch (err) {
    console.error('Reject member error:', err);
    res.status(500).json({ error: 'Failed to reject member' });
  }
});

// Set/extend member access (institute admin only)
router.post('/:id/members/:userId/set-access', authenticateToken, async (req, res) => {
  const { id, userId } = req.params;
  const { accessUntil, daysToGrant } = req.body;
  const pool = req.app.locals.pool;

  try {
    // Verify admin
    const adminCheck = await pool.query(
      `SELECT id FROM community_admins WHERE community_id = $1 AND user_id = $2`,
      [id, req.user.userId]
    );

    if (adminCheck.rows.length === 0 && req.user.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Verify target user is an approved member
    const memberCheck = await pool.query(
      `SELECT id FROM community_memberships WHERE community_id = $1 AND user_id = $2 AND status = 'approved'`,
      [id, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Approved member not found' });
    }

    // Calculate new expiry date
    let newExpiresAt;

    if (accessUntil) {
      newExpiresAt = new Date(accessUntil);
      if (isNaN(newExpiresAt.getTime()) || newExpiresAt <= new Date()) {
        return res.status(400).json({ error: 'accessUntil must be a valid future date' });
      }
    } else if (daysToGrant && Number.isInteger(daysToGrant) && daysToGrant > 0 && daysToGrant <= 365) {
      // Rolling extension: add days to current expiry if not expired, otherwise from now
      const existing = await pool.query(
        `SELECT access_expires_at FROM active_community_access WHERE user_id = $1 AND community_id = $2`,
        [userId, id]
      );
      const now = new Date();
      let baseDate = now;
      if (existing.rows.length > 0) {
        const currentExpiry = new Date(existing.rows[0].access_expires_at);
        if (currentExpiry > now) {
          baseDate = currentExpiry;
        }
      }
      newExpiresAt = new Date(baseDate.getTime() + (daysToGrant * 24 * 60 * 60 * 1000));
    } else {
      return res.status(400).json({ error: 'Provide accessUntil (ISO date) or daysToGrant (1-365)' });
    }

    // Upsert access record (preserve existing credit_amount)
    const existing = await pool.query(
      `SELECT id FROM active_community_access WHERE user_id = $1 AND community_id = $2`,
      [userId, id]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE active_community_access SET access_expires_at = $1, updated_at = NOW() WHERE user_id = $2 AND community_id = $3`,
        [newExpiresAt, userId, id]
      );
    } else {
      await pool.query(
        `INSERT INTO active_community_access (user_id, community_id, access_expires_at, credit_amount) VALUES ($1, $2, $3, 0)`,
        [userId, id, newExpiresAt]
      );
    }

    // Notify user
    const community = await pool.query(`SELECT name FROM communities WHERE id = $1`, [id]);
    const communityName = community.rows[0]?.name || 'the community';
    await pool.query(
      `INSERT INTO notifications (user_id, community_id, type, title, message) VALUES ($1, $2, 'access', 'Access Updated', $3)`,
      [userId, id, `Your access to ${communityName} has been updated. Active until ${newExpiresAt.toLocaleDateString()}.`]
    );

    res.json({
      success: true,
      accessExpiresAt: newExpiresAt,
      message: `Access updated until ${newExpiresAt.toLocaleDateString()}`
    });
  } catch (err) {
    console.error('Set member access error:', err);
    res.status(500).json({ error: 'Failed to set member access' });
  }
});

// ============================================================================
// WAITING LIST ENDPOINTS (Community Admin)
// ============================================================================

// Get waiting list entries for this community (community admin only)
router.get('/:id/waiting-list', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const pool = req.app.locals.pool;

  try {
    // Verify user is admin of this community
    const adminCheck = await pool.query(
      `SELECT id FROM community_admins WHERE community_id = $1 AND user_id = $2`,
      [id, req.user.userId]
    );

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Only community administrators can access the waiting list' });
    }

    // Get community name for matching
    const communityResult = await pool.query(
      `SELECT name, community_type FROM communities WHERE id = $1`,
      [id]
    );

    if (communityResult.rows.length === 0) {
      return res.status(404).json({ error: 'Community not found' });
    }

    const community = communityResult.rows[0];

    // Get waiting list entries that match this community
    // Match by: same community_type AND recommended_institution contains community name
    const waitingListResult = await pool.query(
      `SELECT id, email, recommended_institution, community_type, status, created_at
       FROM waiting_list
       WHERE community_type = $1
         AND status = 'pending'
         AND (
           LOWER(recommended_institution) LIKE LOWER($2)
           OR LOWER($3) LIKE LOWER('%' || recommended_institution || '%')
         )
       ORDER BY created_at ASC`,
      [community.community_type, `%${community.name}%`, community.name]
    );

    res.json(waitingListResult.rows.map(entry => ({
      id: entry.id,
      email: entry.email,
      recommendedInstitution: entry.recommended_institution,
      communityType: entry.community_type,
      status: entry.status,
      createdAt: entry.created_at
    })));
  } catch (err) {
    console.error('Get community waiting list error:', err);
    res.status(500).json({ error: 'Failed to get waiting list' });
  }
});

// Approve waiting list entry (community admin only) - creates user and adds to community
router.post('/:id/waiting-list/:waitingListId/approve', authenticateToken, async (req, res) => {
  const { id: communityId, waitingListId } = req.params;
  const pool = req.app.locals.pool;
  const { sendMail } = require('../utils/email');
  const bcrypt = require('bcryptjs');
  const crypto = require('crypto');

  try {
    // Verify user is admin of this community
    const adminCheck = await pool.query(
      `SELECT ca.admin_name, u.name as admin_user_name
       FROM community_admins ca
       LEFT JOIN users u ON u.id = ca.user_id
       WHERE ca.community_id = $1 AND ca.user_id = $2`,
      [communityId, req.user.userId]
    );

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Only community administrators can approve waiting list entries' });
    }

    const adminName = adminCheck.rows[0].admin_user_name || adminCheck.rows[0].admin_name;

    // Get waiting list entry
    const waitingListResult = await pool.query(
      `SELECT email, recommended_institution, community_type, status
       FROM waiting_list
       WHERE id = $1`,
      [waitingListId]
    );

    if (waitingListResult.rows.length === 0) {
      return res.status(404).json({ error: 'Waiting list entry not found' });
    }

    const entry = waitingListResult.rows[0];

    if (entry.status !== 'pending') {
      return res.status(400).json({ error: 'This entry has already been processed' });
    }

    // Get community details
    const communityResult = await pool.query(
      `SELECT name, community_type, invite_link FROM communities WHERE id = $1`,
      [communityId]
    );

    if (communityResult.rows.length === 0) {
      return res.status(404).json({ error: 'Community not found' });
    }

    const community = communityResult.rows[0];

    // Verify community type matches
    if (entry.community_type !== community.community_type) {
      return res.status(400).json({
        error: 'Community type mismatch. This entry is for a different religious network.'
      });
    }

    // Check if user already exists
    const existingUserResult = await pool.query(
      `SELECT id, role, community_type FROM users WHERE email = $1`,
      [entry.email]
    );

    if (existingUserResult.rows.length > 0) {
      return res.status(400).json({
        error: 'This email is already registered. They can login directly and join your community via the invite link.'
      });
    }

    // Generate secure random password (12 characters, base64url-safe)
    const tempPassword = crypto.randomBytes(9).toString('base64url');

    // Hash password
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Create user account
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, community_type)
       VALUES ($1, $2, $3, 'user', $4)
       RETURNING id, email, name`,
      [entry.email, hashedPassword, entry.email.split('@')[0], entry.community_type]
    );

    const newUser = userResult.rows[0];

    // Create community membership (auto-approved)
    await pool.query(
      `INSERT INTO community_memberships (community_id, user_id, joined_via, status)
       VALUES ($1, $2, 'waiting_list', 'approved')`,
      [communityId, newUser.id]
    );

    // Mark waiting list entry as approved
    await pool.query(
      `UPDATE waiting_list SET status = 'approved' WHERE id = $1`,
      [waitingListId]
    );

    // Create notification for new user
    await pool.query(
      `INSERT INTO notifications (user_id, community_id, type, title, message)
       VALUES ($1, $2, 'welcome', $3, $4)`,
      [newUser.id, communityId, `Welcome to ${community.name}!`, `Your request to join has been approved. Please check your email for login credentials.`]
    );

    // Send welcome email with credentials
    const loginUrl = process.env.DEVOTEE_APP_URL || 'http://localhost:3003';

    try {
      await sendMail({
        to: entry.email,
        subject: `Welcome to ${community.name} - Your Account Details`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #10b981; padding: 20px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0; color: white; font-size: 24px;">Welcome to ${community.name}!</h2>
            </div>

            <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 20px; color: #111827; font-size: 16px;">
                Your request to join <strong>${community.name}</strong> has been approved${adminName ? ` by ${adminName}` : ''}.
              </p>

              <div style="background: white; padding: 20px; border-radius: 8px; border: 2px solid #10b981; margin: 20px 0;">
                <h3 style="margin: 0 0 16px; color: #111827;">Your Login Credentials</h3>
                <p style="margin: 8px 0; color: #6b7280; font-size: 14px;">
                  <strong>Email:</strong> ${entry.email}
                </p>
                <p style="margin: 8px 0; color: #6b7280; font-size: 14px;">
                  <strong>Temporary Password:</strong><br/>
                  <code style="background: #f3f4f6; padding: 8px 12px; border-radius: 4px; font-size: 16px; color: #111827; display: inline-block; margin-top: 4px;">${tempPassword}</code>
                </p>
              </div>

              <div style="margin: 24px 0; text-align: center;">
                <a href="${loginUrl}" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                  Login to Your Account
                </a>
              </div>

              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin: 20px 0;">
                <p style="margin: 0; color: #78350f; font-size: 14px;">
                  <strong>Important:</strong> For security, please change your password after logging in for the first time.
                </p>
              </div>

              <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                If you have any questions, please contact the community administrator.
              </p>
            </div>

            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
              This is an automated message from D.A.K Platform
            </p>
          </div>
        `
      });
    } catch (emailError) {
      // Log error but don't fail the approval
      console.error('Failed to send welcome email:', emailError);

      // Create fallback notification
      await pool.query(
        `INSERT INTO notifications (user_id, community_id, type, title, message)
         VALUES ($1, $2, 'system', 'Account Created - Email Delivery Failed', $3)`,
        [newUser.id, communityId, `Your account has been created but we couldn't send your password via email. Please contact the community administrator for assistance. Email: ${entry.email}`]
      );
    }

    res.json({
      success: true,
      message: `Approved ${entry.email} and created their account. They will receive an email with login instructions.`,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name
      }
    });
  } catch (err) {
    console.error('Approve waiting list entry error:', err);
    res.status(500).json({ error: 'Failed to approve waiting list entry' });
  }
});

module.exports = router;
