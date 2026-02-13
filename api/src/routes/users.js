const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// Get user profile
router.get('/profile', authenticate, async (req, res) => {
  const pool = req.app.locals.pool;
  
  try {
    const result = await pool.query(
      'SELECT id, email, name, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Update user profile
router.put('/profile', authenticate, async (req, res) => {
  const pool = req.app.locals.pool;
  const { name } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, name, role',
      [name, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get user's entitlements
router.get('/entitlements', authenticate, async (req, res) => {
  const pool = req.app.locals.pool;
  
  try {
    const result = await pool.query(`
      SELECT e.*, c.name as community_name, c.community_type
      FROM entitlements e
      JOIN communities c ON e.community_id = c.id
      WHERE e.user_id = $1 AND e.status = 'active' AND e.ends_at > NOW()
    `, [req.user.id]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get user's support history
router.get('/supports', authenticate, async (req, res) => {
  const pool = req.app.locals.pool;
  
  try {
    const result = await pool.query(`
      SELECT s.*, c.name as community_name
      FROM supports s
      JOIN communities c ON s.community_id = c.id
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC
    `, [req.user.id]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
