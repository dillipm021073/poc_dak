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
        aca.access_expires_at,
        CASE 
          WHEN aca.access_expires_at > NOW() THEN TRUE 
          ELSE FALSE 
        END as has_active_access
      FROM community_memberships cm
      JOIN communities c ON c.id = cm.community_id
      LEFT JOIN active_community_access aca ON aca.community_id = c.id AND aca.user_id = cm.user_id
      WHERE cm.user_id = $1 AND c.status = 'active'
      ORDER BY cm.created_at DESC`,
      [req.user.userId]
    );

    const communities = result.rows.map(row => {
      const now = new Date();
      const expiresAt = row.access_expires_at ? new Date(row.access_expires_at) : null;
      const msPerDay = 24 * 60 * 60 * 1000;
      let daysRemaining = expiresAt ? Math.ceil((expiresAt - now) / msPerDay) : 0;
      daysRemaining = Math.max(0, Math.min(90, daysRemaining));

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
        hasActiveAccess: row.has_active_access,
        isViewOnly: !row.has_active_access,
        daysRemaining
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
    // Check membership
    const membershipResult = await pool.query(
      `SELECT id FROM community_memberships 
       WHERE community_id = $1 AND user_id = $2`,
      [id, req.user.userId]
    );

    const isMember = membershipResult.rows.length > 0;

    // Get community details
    const communityResult = await pool.query(
      `SELECT c.*, 
              ca.admin_name, ca.role_in_institution,
              (SELECT COUNT(*) FROM community_memberships WHERE community_id = c.id) as member_count
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
      hasActiveAccess,
      isViewOnly: !hasActiveAccess,
      daysRemaining
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

    // Create membership (user starts in view-only state)
    await pool.query(
      `INSERT INTO community_memberships (community_id, user_id, joined_via)
       VALUES ($1, $2, 'link')`,
      [community.id, req.user.userId]
    );

    // Create welcome notification
    await pool.query(
      `INSERT INTO notifications (user_id, community_id, type, title, message)
       VALUES ($1, $2, 'welcome', 'Welcome!', $3)`,
      [req.user.userId, community.id, `You're joining communities within the ${community.community_type} network on D.A.K`]
    );

    res.json({
      success: true,
      community: {
        id: community.id,
        name: community.name,
        communityType: community.community_type
      },
      message: `You're joining communities within the ${community.community_type} network on D.A.K`,
      isViewOnly: true
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

    // Create membership for admin
    await pool.query(
      `INSERT INTO community_memberships (community_id, user_id, joined_via)
       VALUES ($1, $2, 'admin')`,
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
      `SELECT COUNT(*) as count FROM community_memberships WHERE community_id = $1`,
      [id]
    );

    // Get monthly activity
    const yearMonth = new Date().toISOString().slice(0, 7);
    const activityResult = await pool.query(
      `SELECT total_collected, platform_fee_total FROM monthly_community_activity 
       WHERE community_id = $1 AND year_month = $2`,
      [id, yearMonth]
    );

    // Get recent analytics
    const analyticsResult = await pool.query(
      `SELECT * FROM community_analytics 
       WHERE community_id = $1 
       ORDER BY date DESC LIMIT 30`,
      [id]
    );

    res.json({
      activeSubscribers: parseInt(subscriberResult.rows[0].count),
      totalMembers: parseInt(memberResult.rows[0].count),
      monthlyActivity: activityResult.rows[0] || { total_collected: 0, platform_fee_total: 0 },
      recentAnalytics: analyticsResult.rows
    });
  } catch (err) {
    console.error('Get analytics error:', err);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

module.exports = router;
