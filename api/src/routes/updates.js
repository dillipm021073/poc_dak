const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Get updates feed for user
router.get('/', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;
  const { communityId, type, limit = 50 } = req.query;

  try {
    let query = `
      SELECT u.*, c.name as community_name, c.community_type
      FROM updates u
      JOIN communities c ON u.community_id = c.id
      WHERE u.user_id = $1
    `;
    const params = [req.user.id];
    let paramCount = 1;

    if (communityId) {
      paramCount++;
      params.push(communityId);
      query += ` AND u.community_id = $${paramCount}`;
    }

    if (type) {
      paramCount++;
      params.push(type);
      query += ` AND u.update_type = $${paramCount}`;
    }

    query += ` ORDER BY u.created_at DESC LIMIT $${paramCount + 1}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    // Get unread count
    const unreadResult = await pool.query(
      'SELECT COUNT(*) FROM updates WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );

    res.json({
      updates: result.rows,
      unread_count: parseInt(unreadResult.rows[0].count)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch updates' });
  }
});

// Mark update as read
router.put('/:id/read', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;

  try {
    await pool.query(
      'UPDATE updates SET is_read = true WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// Mark all updates as read
router.put('/read-all', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;
  const { communityId } = req.body;

  try {
    let query = 'UPDATE updates SET is_read = true WHERE user_id = $1';
    const params = [req.user.id];

    if (communityId) {
      query += ' AND community_id = $2';
      params.push(communityId);
    }

    await pool.query(query, params);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// Create update (internal helper - called by other routes)
const createUpdate = async (pool, { communityId, userIds, updateType, title, message, referenceType, referenceId }) => {
  // If userIds is empty, send to all community subscribers
  let targetUsers = userIds;
  
  if (!targetUsers || targetUsers.length === 0) {
    const subscribers = await pool.query(
      'SELECT user_id FROM community_subscriptions WHERE community_id = $1',
      [communityId]
    );
    targetUsers = subscribers.rows.map(s => s.user_id);
  }

  // Create update for each user
  for (const userId of targetUsers) {
    await pool.query(`
      INSERT INTO updates (community_id, user_id, update_type, title, message, reference_type, reference_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [communityId, userId, updateType, title, message, referenceType, referenceId]);
  }
};

module.exports = router;
module.exports.createUpdate = createUpdate;
