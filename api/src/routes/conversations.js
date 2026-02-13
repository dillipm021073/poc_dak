const express = require('express');
const router = express.Router();
const { authenticateToken, isCommunityAdmin } = require('../middleware/auth');

// Get conversations for a community
router.get('/community/:communityId', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;
  const { communityId } = req.params;
  const { status, type } = req.query;

  try {
    let query = `
      SELECT c.*, 
             u.name as author_name,
             u.email as author_email,
             (SELECT COUNT(*) FROM comments WHERE conversation_id = c.id AND is_hidden = false) as comment_count,
             (SELECT json_agg(json_build_object('emoji', emoji, 'count', cnt))
              FROM (SELECT emoji, COUNT(*) as cnt FROM reactions WHERE conversation_id = c.id GROUP BY emoji) r
             ) as reactions
      FROM conversations c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.community_id = $1
    `;
    const params = [communityId];

    if (status) {
      params.push(status);
      query += ` AND c.status = $${params.length}`;
    }

    if (type) {
      params.push(type);
      query += ` AND c.conversation_type = $${params.length}`;
    }

    query += ` ORDER BY c.is_pinned DESC, c.created_at DESC`;

    const result = await pool.query(query, params);
    res.json({ conversations: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get single conversation with comments
router.get('/:id', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;

  try {
    // Get conversation
    const convResult = await pool.query(`
      SELECT c.*, 
             u.name as author_name,
             u.email as author_email
      FROM conversations c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.id = $1
    `, [id]);

    if (convResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const conversation = convResult.rows[0];

    // Increment view count
    await pool.query('UPDATE conversations SET view_count = view_count + 1 WHERE id = $1', [id]);

    // Get reactions
    const reactionsResult = await pool.query(`
      SELECT emoji, COUNT(*) as count,
             json_agg(json_build_object('user_id', user_id, 'user_name', u.name)) as users
      FROM reactions r
      JOIN users u ON r.user_id = u.id
      WHERE r.conversation_id = $1
      GROUP BY emoji
    `, [id]);

    // Check if current user has reacted
    const userReactionsResult = await pool.query(
      'SELECT emoji FROM reactions WHERE conversation_id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    // Get comments with nested replies
    const commentsResult = await pool.query(`
      SELECT c.*, 
             u.name as user_name,
             u.email as user_email,
             (SELECT json_agg(json_build_object('emoji', emoji, 'count', cnt))
              FROM (SELECT emoji, COUNT(*) as cnt FROM reactions WHERE comment_id = c.id GROUP BY emoji) r
             ) as reactions
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.conversation_id = $1 AND c.is_hidden = false
      ORDER BY c.created_at ASC
    `, [id]);

    // Build nested structure
    const commentsMap = {};
    const topLevelComments = [];

    commentsResult.rows.forEach(comment => {
      comment.replies = [];
      commentsMap[comment.id] = comment;
    });

    commentsResult.rows.forEach(comment => {
      if (comment.parent_id) {
        if (commentsMap[comment.parent_id]) {
          commentsMap[comment.parent_id].replies.push(comment);
        }
      } else {
        topLevelComments.push(comment);
      }
    });

    res.json({
      conversation: {
        ...conversation,
        reactions: reactionsResult.rows,
        user_reactions: userReactionsResult.rows.map(r => r.emoji)
      },
      comments: topLevelComments
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// Create conversation (admin only)
router.post('/', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;
  const { communityId, title, content, conversationType, allowComments, isPinned } = req.body;

  try {
    // Check if user is admin of this community
    const adminCheck = await pool.query(
      'SELECT * FROM community_admins WHERE community_id = $1 AND user_id = $2',
      [communityId, req.user.id]
    );

    if (adminCheck.rows.length === 0 && req.user.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Only community admins can create conversations' });
    }

    const result = await pool.query(`
      INSERT INTO conversations (community_id, created_by, title, content, conversation_type, allow_comments, is_pinned)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [communityId, req.user.id, title, content, conversationType || 'discussion', allowComments !== false, isPinned || false]);

    res.status(201).json({ conversation: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Update conversation (admin only)
router.put('/:id', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;
  const { title, content, status, allowComments, isPinned } = req.body;

  try {
    // Get conversation and check ownership
    const conv = await pool.query('SELECT * FROM conversations WHERE id = $1', [id]);
    if (conv.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Check if user is admin
    const adminCheck = await pool.query(
      'SELECT * FROM community_admins WHERE community_id = $1 AND user_id = $2',
      [conv.rows[0].community_id, req.user.id]
    );

    if (adminCheck.rows.length === 0 && req.user.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Only community admins can update conversations' });
    }

    const result = await pool.query(`
      UPDATE conversations SET
        title = COALESCE($1, title),
        content = COALESCE($2, content),
        status = COALESCE($3, status),
        allow_comments = COALESCE($4, allow_comments),
        is_pinned = COALESCE($5, is_pinned),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `, [title, content, status, allowComments, isPinned, id]);

    res.json({ conversation: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

// Delete conversation (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;

  try {
    const conv = await pool.query('SELECT * FROM conversations WHERE id = $1', [id]);
    if (conv.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const adminCheck = await pool.query(
      'SELECT * FROM community_admins WHERE community_id = $1 AND user_id = $2',
      [conv.rows[0].community_id, req.user.id]
    );

    if (adminCheck.rows.length === 0 && req.user.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Only community admins can delete conversations' });
    }

    await pool.query('DELETE FROM conversations WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// Add comment to conversation
router.post('/:id/comments', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;
  const { content, parentId } = req.body;

  try {
    // Check if conversation allows comments
    const conv = await pool.query('SELECT * FROM conversations WHERE id = $1', [id]);
    if (conv.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (!conv.rows[0].allow_comments) {
      return res.status(403).json({ error: 'Comments are disabled for this conversation' });
    }

    if (conv.rows[0].status !== 'active') {
      return res.status(403).json({ error: 'This conversation is closed' });
    }

    // Check user is subscribed to community
    const subCheck = await pool.query(
      'SELECT * FROM community_subscriptions WHERE community_id = $1 AND user_id = $2',
      [conv.rows[0].community_id, req.user.id]
    );

    // Allow admins to comment even without subscription
    const adminCheck = await pool.query(
      'SELECT * FROM community_admins WHERE community_id = $1 AND user_id = $2',
      [conv.rows[0].community_id, req.user.id]
    );

    if (subCheck.rows.length === 0 && adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You must be a member to comment' });
    }

    const result = await pool.query(`
      INSERT INTO comments (conversation_id, user_id, parent_id, content)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [id, req.user.id, parentId || null, content]);

    // Get user info
    const comment = result.rows[0];
    comment.user_name = req.user.name;
    comment.user_email = req.user.email;
    comment.replies = [];

    // Notify the conversation author or parent comment author
    if (parentId) {
      const parentComment = await pool.query('SELECT user_id FROM comments WHERE id = $1', [parentId]);
      if (parentComment.rows.length > 0 && parentComment.rows[0].user_id !== req.user.id) {
        await pool.query(`
          INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
          VALUES ($1, 'new_reply', 'New Reply to Your Comment', $2, 'comment', $3)
        `, [parentComment.rows[0].user_id, `${req.user.name} replied to your comment`, comment.id]);
      }
    }

    res.status(201).json({ comment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Edit comment
router.put('/comments/:commentId', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;
  const { commentId } = req.params;
  const { content } = req.body;

  try {
    const comment = await pool.query('SELECT * FROM comments WHERE id = $1', [commentId]);
    if (comment.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own comments' });
    }

    const result = await pool.query(`
      UPDATE comments SET content = $1, is_edited = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [content, commentId]);

    res.json({ comment: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

// Delete/hide comment (owner or admin)
router.delete('/comments/:commentId', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;
  const { commentId } = req.params;

  try {
    const comment = await pool.query(`
      SELECT c.*, conv.community_id 
      FROM comments c 
      JOIN conversations conv ON c.conversation_id = conv.id 
      WHERE c.id = $1
    `, [commentId]);

    if (comment.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const isOwner = comment.rows[0].user_id === req.user.id;
    const adminCheck = await pool.query(
      'SELECT * FROM community_admins WHERE community_id = $1 AND user_id = $2',
      [comment.rows[0].community_id, req.user.id]
    );

    if (!isOwner && adminCheck.rows.length === 0 && req.user.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    // Soft delete (hide)
    await pool.query('UPDATE comments SET is_hidden = true WHERE id = $1', [commentId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// Add reaction to conversation
router.post('/:id/reactions', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;
  const { emoji } = req.body;

  const allowedEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏', '👋', '🎉'];
  if (!allowedEmojis.includes(emoji)) {
    return res.status(400).json({ error: 'Invalid emoji' });
  }

  try {
    // Check if already reacted with this emoji
    const existing = await pool.query(
      'SELECT * FROM reactions WHERE conversation_id = $1 AND user_id = $2 AND emoji = $3',
      [id, req.user.id, emoji]
    );

    if (existing.rows.length > 0) {
      // Remove reaction (toggle off)
      await pool.query(
        'DELETE FROM reactions WHERE conversation_id = $1 AND user_id = $2 AND emoji = $3',
        [id, req.user.id, emoji]
      );
      return res.json({ action: 'removed', emoji });
    }

    // Add reaction
    await pool.query(
      'INSERT INTO reactions (conversation_id, user_id, emoji) VALUES ($1, $2, $3)',
      [id, req.user.id, emoji]
    );
    res.json({ action: 'added', emoji });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// Add reaction to comment
router.post('/comments/:commentId/reactions', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;
  const { commentId } = req.params;
  const { emoji } = req.body;

  const allowedEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏', '👋', '🎉'];
  if (!allowedEmojis.includes(emoji)) {
    return res.status(400).json({ error: 'Invalid emoji' });
  }

  try {
    const existing = await pool.query(
      'SELECT * FROM reactions WHERE comment_id = $1 AND user_id = $2 AND emoji = $3',
      [commentId, req.user.id, emoji]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        'DELETE FROM reactions WHERE comment_id = $1 AND user_id = $2 AND emoji = $3',
        [commentId, req.user.id, emoji]
      );
      return res.json({ action: 'removed', emoji });
    }

    await pool.query(
      'INSERT INTO reactions (comment_id, user_id, emoji) VALUES ($1, $2, $3)',
      [commentId, req.user.id, emoji]
    );
    res.json({ action: 'added', emoji });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

module.exports = router;
