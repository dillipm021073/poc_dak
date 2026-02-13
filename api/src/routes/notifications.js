// D.A.K MVP v3 - Notifications Routes
// In-app notifications for events and updates

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Get user's notifications
router.get('/', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;
  const { unreadOnly } = req.query;

  try {
    let query = `
      SELECT n.*, c.name as community_name
      FROM notifications n
      LEFT JOIN communities c ON c.id = n.community_id
      WHERE n.user_id = $1
    `;
    
    if (unreadOnly === 'true') {
      query += ` AND n.is_read = FALSE`;
    }
    
    query += ` ORDER BY n.created_at DESC LIMIT 50`;

    const result = await pool.query(query, [req.user.userId]);

    res.json(result.rows.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      communityId: n.community_id,
      communityName: n.community_name,
      referenceType: n.reference_type,
      referenceId: n.reference_id,
      isRead: n.is_read,
      createdAt: n.created_at
    })));
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Get unread count
router.get('/unread-count', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;

  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM notifications 
       WHERE user_id = $1 AND is_read = FALSE`,
      [req.user.userId]
    );

    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    console.error('Get unread count error:', err);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// Mark notification as read
router.post('/:id/read', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const pool = req.app.locals.pool;

  try {
    await pool.query(
      `UPDATE notifications SET is_read = TRUE 
       WHERE id = $1 AND user_id = $2`,
      [id, req.user.userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all as read
router.post('/read-all', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;

  try {
    await pool.query(
      `UPDATE notifications SET is_read = TRUE 
       WHERE user_id = $1 AND is_read = FALSE`,
      [req.user.userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// Delete notification
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const pool = req.app.locals.pool;

  try {
    await pool.query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
      [id, req.user.userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Delete notification error:', err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

module.exports = router;
