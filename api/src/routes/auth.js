// D.A.K MVP v3 - Authentication Routes
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
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

// Register institute admin (no invite link needed)
router.post('/register-admin', async (req, res) => {
  const { email, password, name } = req.body;
  const pool = req.app.locals.pool;

  try {
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered. Please login.' });
    }

    // Create user with 'user' role (will be upgraded to community_admin on community creation)
    const hashedPassword = await bcrypt.hash(password, 10);
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, 'user')
       RETURNING id, email, name, role, community_type`,
      [email, hashedPassword, name]
    );

    const user = userResult.rows[0];

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
    console.error('Register admin error:', err);
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

// Change password (authenticated)
router.post('/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const pool = req.app.locals.pool;

  try {
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const validPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hashedPassword, req.user.userId]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Forgot password (unauthenticated)
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const pool = req.app.locals.pool;

  try {
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await pool.query(
      'SELECT id, email FROM users WHERE email = $1',
      [email]
    );

    // Always return success to prevent email enumeration
    if (result.rows.length === 0) {
      return res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
      [token, expires, result.rows[0].id]
    );

    // In production: send email with reset link
    // For MVP demo: log the token so it can be used for testing
    console.log(`[PASSWORD RESET] Token for ${email}: ${token}`);

    res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Reset password (unauthenticated, uses token)
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  const pool = req.app.locals.pool;

  try {
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const result = await pool.query(
      'SELECT id FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW()',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL, updated_at = NOW() WHERE id = $2',
      [hashedPassword, result.rows[0].id]
    );

    res.json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
