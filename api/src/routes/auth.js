// D.A.K MVP v3 - Authentication Routes
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'dak-mvp-secret-key';

// Register via invite link (QR/Link only - no open signup)
router.post('/register', async (req, res) => {
  const { email, password, name, inviteLink } = req.body;
  const pool = req.app.locals.pool;

  try {
    // Validate invite link exists and get community
    const communityResult = await pool.query(
      `SELECT id, name, community_type, status FROM communities 
       WHERE invite_link = $1`,
      [inviteLink]
    );

    if (communityResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid invite link' });
    }

    const community = communityResult.rows[0];

    if (community.status !== 'active') {
      return res.status(400).json({ error: 'This community is not accepting new members' });
    }

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id, community_type FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      const existingCommunityType = existingUser.rows[0].community_type;
      
      // Chinese-wall: Users cannot cross community types
      if (existingCommunityType && existingCommunityType !== community.community_type) {
        return res.status(400).json({ 
          error: `You are already registered in the ${existingCommunityType} network. Users cannot join communities across different religious networks.` 
        });
      }
      
      return res.status(400).json({ error: 'Email already registered. Please login.' });
    }

    // Create user with community_type locked from invite
    const hashedPassword = await bcrypt.hash(password, 10);
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, community_type)
       VALUES ($1, $2, $3, 'user', $4)
       RETURNING id, email, name, role, community_type`,
      [email, hashedPassword, name, community.community_type]
    );

    const user = userResult.rows[0];

    // Create community membership (user starts in view-only state)
    await pool.query(
      `INSERT INTO community_memberships (community_id, user_id, joined_via)
       VALUES ($1, $2, 'link')`,
      [community.id, user.id]
    );

    // Create notification
    await pool.query(
      `INSERT INTO notifications (user_id, community_id, type, title, message)
       VALUES ($1, $2, 'welcome', 'Welcome!', $3)`,
      [user.id, community.id, `You're joining communities within the ${community.community_type} network on D.A.K`]
    );

    // Generate token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        communityType: user.community_type
      },
      community: {
        id: community.id,
        name: community.name,
        communityType: community.community_type
      },
      message: `You're joining communities within the ${community.community_type} network on D.A.K`
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const pool = req.app.locals.pool;

  try {
    const result = await pool.query(
      'SELECT id, email, password_hash, name, role, community_type FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        communityType: user.community_type
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;

  try {
    const result = await pool.query(
      'SELECT id, email, name, role, community_type, avatar_url FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      communityType: user.community_type,
      avatarUrl: user.avatar_url
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

module.exports = router;
