// D.A.K MVP v3 - Messaging Routes
// Private threaded inbox: User ↔ Institution Admin only
// Requires Active Access to message

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Get user's message threads
router.get('/threads', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;

  try {
    let query;
    let params;

    if (req.user.role === 'community_admin' || req.user.role === 'platform_admin') {
      // Admin: Get all threads for their communities
      query = `
        SELECT 
          mt.id, mt.community_id, mt.user_id, mt.status, mt.is_blocked,
          mt.last_message_at, mt.unread_count_admin as unread_count,
          c.name as community_name,
          u.name as user_name, u.email as user_email,
          (SELECT content FROM messages WHERE thread_id = mt.id ORDER BY created_at DESC LIMIT 1) as last_message
        FROM message_threads mt
        JOIN communities c ON c.id = mt.community_id
        JOIN users u ON u.id = mt.user_id
        JOIN community_admins ca ON ca.community_id = mt.community_id
        WHERE ca.user_id = $1
        ORDER BY mt.last_message_at DESC
      `;
      params = [req.user.userId];
    } else {
      // User: Get their threads
      query = `
        SELECT 
          mt.id, mt.community_id, mt.user_id, mt.status, mt.is_blocked,
          mt.last_message_at, mt.unread_count_user as unread_count,
          c.name as community_name,
          (SELECT content FROM messages WHERE thread_id = mt.id ORDER BY created_at DESC LIMIT 1) as last_message
        FROM message_threads mt
        JOIN communities c ON c.id = mt.community_id
        WHERE mt.user_id = $1
        ORDER BY mt.last_message_at DESC
      `;
      params = [req.user.userId];
    }

    const result = await pool.query(query, params);

    res.json(result.rows.map(thread => ({
      id: thread.id,
      communityId: thread.community_id,
      communityName: thread.community_name,
      userId: thread.user_id,
      userName: thread.user_name,
      userEmail: thread.user_email,
      status: thread.status,
      isBlocked: thread.is_blocked,
      lastMessageAt: thread.last_message_at,
      lastMessage: thread.last_message,
      unreadCount: thread.unread_count
    })));
  } catch (err) {
    console.error('Get threads error:', err);
    res.status(500).json({ error: 'Failed to get threads' });
  }
});

// Get messages in thread
router.get('/threads/:threadId', authenticateToken, async (req, res) => {
  const { threadId } = req.params;
  const pool = req.app.locals.pool;

  try {
    // Get thread and verify access
    const threadResult = await pool.query(
      `SELECT mt.*, c.name as community_name 
       FROM message_threads mt
       JOIN communities c ON c.id = mt.community_id
       WHERE mt.id = $1`,
      [threadId]
    );

    if (threadResult.rows.length === 0) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const thread = threadResult.rows[0];

    // Check access (user or admin of the community)
    const isUser = thread.user_id === req.user.userId;
    const isAdmin = req.user.role === 'platform_admin';
    
    if (!isUser && !isAdmin) {
      const adminCheck = await pool.query(
        `SELECT id FROM community_admins WHERE community_id = $1 AND user_id = $2`,
        [thread.community_id, req.user.userId]
      );
      if (adminCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Not authorized' });
      }
    }

    // Get messages
    const messagesResult = await pool.query(
      `SELECT m.id, m.content, m.is_from_admin, m.is_read, m.created_at,
              u.name as sender_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.thread_id = $1
       ORDER BY m.created_at ASC`,
      [threadId]
    );

    // Mark messages as read
    if (isUser) {
      await pool.query(
        `UPDATE messages SET is_read = TRUE, read_at = NOW() 
         WHERE thread_id = $1 AND is_from_admin = TRUE AND is_read = FALSE`,
        [threadId]
      );
      await pool.query(
        `UPDATE message_threads SET unread_count_user = 0 WHERE id = $1`,
        [threadId]
      );
    } else {
      await pool.query(
        `UPDATE messages SET is_read = TRUE, read_at = NOW() 
         WHERE thread_id = $1 AND is_from_admin = FALSE AND is_read = FALSE`,
        [threadId]
      );
      await pool.query(
        `UPDATE message_threads SET unread_count_admin = 0 WHERE id = $1`,
        [threadId]
      );
    }

    res.json({
      thread: {
        id: thread.id,
        communityId: thread.community_id,
        communityName: thread.community_name,
        isBlocked: thread.is_blocked,
        status: thread.status
      },
      messages: messagesResult.rows.map(msg => ({
        id: msg.id,
        content: msg.content,
        isFromAdmin: msg.is_from_admin,
        isRead: msg.is_read,
        senderName: msg.sender_name,
        createdAt: msg.created_at
      }))
    });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Send message in thread
router.post('/threads/:threadId', authenticateToken, async (req, res) => {
  const { threadId } = req.params;
  const { content } = req.body;
  const pool = req.app.locals.pool;

  try {
    // Get thread
    const threadResult = await pool.query(
      `SELECT * FROM message_threads WHERE id = $1`,
      [threadId]
    );

    if (threadResult.rows.length === 0) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const thread = threadResult.rows[0];

    if (thread.is_blocked) {
      return res.status(403).json({ error: 'This conversation has been blocked' });
    }

    // Check access
    const isUser = thread.user_id === req.user.userId;
    let isAdmin = req.user.role === 'platform_admin';
    
    if (!isUser && !isAdmin) {
      const adminCheck = await pool.query(
        `SELECT id FROM community_admins WHERE community_id = $1 AND user_id = $2`,
        [thread.community_id, req.user.userId]
      );
      if (adminCheck.rows.length > 0) {
        isAdmin = true;
      }
    }

    if (!isUser && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // If user, check Active Access
    if (isUser) {
      const accessResult = await pool.query(
        `SELECT access_expires_at FROM active_community_access 
         WHERE community_id = $1 AND user_id = $2`,
        [thread.community_id, req.user.userId]
      );

      const hasActiveAccess = accessResult.rows.length > 0 && 
        new Date(accessResult.rows[0].access_expires_at) > new Date();

      if (!hasActiveAccess) {
        return res.status(403).json({ 
          error: 'Active Access required to send messages',
          isViewOnly: true
        });
      }
    }

    // Insert message
    const messageResult = await pool.query(
      `INSERT INTO messages (thread_id, sender_id, content, is_from_admin)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [threadId, req.user.userId, content, isAdmin]
    );

    // Update thread
    const unreadField = isAdmin ? 'unread_count_user' : 'unread_count_admin';
    await pool.query(
      `UPDATE message_threads 
       SET last_message_at = NOW(), ${unreadField} = ${unreadField} + 1
       WHERE id = $1`,
      [threadId]
    );

    // Notify recipient
    const recipientId = isAdmin ? thread.user_id : null;
    if (recipientId) {
      await pool.query(
        `INSERT INTO notifications (user_id, community_id, type, title, message, reference_type, reference_id)
         VALUES ($1, $2, 'message', 'New Message', 'You have a new message from the community', 'thread', $3)`,
        [recipientId, thread.community_id, threadId]
      );
    }

    res.status(201).json({
      id: messageResult.rows[0].id,
      content,
      isFromAdmin: isAdmin,
      createdAt: messageResult.rows[0].created_at
    });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Start new thread (user only)
router.post('/start', authenticateToken, async (req, res) => {
  const { communityId, content } = req.body;
  const pool = req.app.locals.pool;

  try {
    // Check membership
    const membershipResult = await pool.query(
      `SELECT id FROM community_memberships 
       WHERE community_id = $1 AND user_id = $2`,
      [communityId, req.user.userId]
    );

    if (membershipResult.rows.length === 0) {
      return res.status(403).json({ error: 'You must be a member to message this community' });
    }

    // Check Active Access
    const accessResult = await pool.query(
      `SELECT access_expires_at FROM active_community_access 
       WHERE community_id = $1 AND user_id = $2`,
      [communityId, req.user.userId]
    );

    const hasActiveAccess = accessResult.rows.length > 0 && 
      new Date(accessResult.rows[0].access_expires_at) > new Date();

    if (!hasActiveAccess) {
      return res.status(403).json({ 
        error: 'Active Access required to message the community',
        isViewOnly: true
      });
    }

    // Check for existing thread
    const existingThread = await pool.query(
      `SELECT id FROM message_threads WHERE community_id = $1 AND user_id = $2`,
      [communityId, req.user.userId]
    );

    let threadId;

    if (existingThread.rows.length > 0) {
      threadId = existingThread.rows[0].id;
      
      // Check if blocked
      const threadCheck = await pool.query(
        `SELECT is_blocked FROM message_threads WHERE id = $1`,
        [threadId]
      );
      
      if (threadCheck.rows[0].is_blocked) {
        return res.status(403).json({ error: 'This conversation has been blocked' });
      }
    } else {
      // Create new thread
      const threadResult = await pool.query(
        `INSERT INTO message_threads (community_id, user_id)
         VALUES ($1, $2)
         RETURNING id`,
        [communityId, req.user.userId]
      );
      threadId = threadResult.rows[0].id;
    }

    // Send first message
    const messageResult = await pool.query(
      `INSERT INTO messages (thread_id, sender_id, content, is_from_admin)
       VALUES ($1, $2, $3, FALSE)
       RETURNING id, created_at`,
      [threadId, req.user.userId, content]
    );

    // Update thread
    await pool.query(
      `UPDATE message_threads 
       SET last_message_at = NOW(), unread_count_admin = unread_count_admin + 1
       WHERE id = $1`,
      [threadId]
    );

    res.status(201).json({
      threadId,
      message: {
        id: messageResult.rows[0].id,
        content,
        createdAt: messageResult.rows[0].created_at
      }
    });
  } catch (err) {
    console.error('Start thread error:', err);
    res.status(500).json({ error: 'Failed to start conversation' });
  }
});

// Block user (admin only)
router.post('/threads/:threadId/block', authenticateToken, async (req, res) => {
  const { threadId } = req.params;
  const pool = req.app.locals.pool;

  try {
    // Get thread
    const threadResult = await pool.query(
      `SELECT community_id FROM message_threads WHERE id = $1`,
      [threadId]
    );

    if (threadResult.rows.length === 0) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Verify admin
    const adminCheck = await pool.query(
      `SELECT id FROM community_admins WHERE community_id = $1 AND user_id = $2`,
      [threadResult.rows[0].community_id, req.user.userId]
    );

    if (adminCheck.rows.length === 0 && req.user.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await pool.query(
      `UPDATE message_threads SET is_blocked = TRUE, status = 'blocked' WHERE id = $1`,
      [threadId]
    );

    res.json({ success: true, message: 'User blocked from messaging' });
  } catch (err) {
    console.error('Block user error:', err);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// Unblock user (admin only)
router.post('/threads/:threadId/unblock', authenticateToken, async (req, res) => {
  const { threadId } = req.params;
  const pool = req.app.locals.pool;

  try {
    // Get thread
    const threadResult = await pool.query(
      `SELECT community_id FROM message_threads WHERE id = $1`,
      [threadId]
    );

    if (threadResult.rows.length === 0) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Verify admin
    const adminCheck = await pool.query(
      `SELECT id FROM community_admins WHERE community_id = $1 AND user_id = $2`,
      [threadResult.rows[0].community_id, req.user.userId]
    );

    if (adminCheck.rows.length === 0 && req.user.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await pool.query(
      `UPDATE message_threads SET is_blocked = FALSE, status = 'active' WHERE id = $1`,
      [threadId]
    );

    res.json({ success: true, message: 'User unblocked' });
  } catch (err) {
    console.error('Unblock user error:', err);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

module.exports = router;
