// D.A.K MVP v3 - Streaming Routes
// Limits: 2 streams/week, 60 min max, 40% concurrent viewer cap

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Stream limits (MVP)
const MAX_STREAMS_PER_WEEK = 2;
const MAX_STREAM_MINUTES = 60;
const VIEWER_CAP_PERCENT = 0.40; // 40% of members

// Helper: Get ISO week number
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Get community streams (authenticated - must be member)
router.get('/community/:communityId', authenticateToken, async (req, res) => {
  const { communityId } = req.params;
  const pool = req.app.locals.pool;

  try {
    // Check membership
    const membershipResult = await pool.query(
      `SELECT id FROM community_memberships 
       WHERE community_id = $1 AND user_id = $2`,
      [communityId, req.user.userId]
    );

    if (membershipResult.rows.length === 0) {
      return res.status(403).json({ error: 'You must be a member to view streams' });
    }

    // Check user's access level
    const accessResult = await pool.query(
      `SELECT access_expires_at FROM active_community_access 
       WHERE community_id = $1 AND user_id = $2`,
      [communityId, req.user.userId]
    );

    const hasActiveAccess = accessResult.rows.length > 0 && 
      new Date(accessResult.rows[0].access_expires_at) > new Date();

    // Get streams
    const streamsResult = await pool.query(
      `SELECT id, title, description, scheduled_for, started_at, ended_at,
              is_live, duration_minutes, current_viewers, total_view_count,
              recording_url, recording_teaser_url, created_at
       FROM streams 
       WHERE community_id = $1
       ORDER BY 
         CASE WHEN is_live THEN 0 ELSE 1 END,
         COALESCE(scheduled_for, created_at) DESC
       LIMIT 20`,
      [communityId]
    );

    const streams = streamsResult.rows.map(stream => ({
      id: stream.id,
      title: stream.title,
      description: stream.description,
      scheduledFor: stream.scheduled_for,
      startedAt: stream.started_at,
      endedAt: stream.ended_at,
      isLive: stream.is_live,
      durationMinutes: stream.duration_minutes,
      currentViewers: stream.current_viewers,
      totalViewCount: stream.total_view_count,
      // Recording access gated behind Active Access
      recordingUrl: hasActiveAccess ? stream.recording_url : null,
      recordingTeaserUrl: stream.recording_teaser_url, // Teaser always visible
      canWatchRecording: hasActiveAccess,
      isViewOnly: !hasActiveAccess
    }));

    res.json(streams);
  } catch (err) {
    console.error('Get streams error:', err);
    res.status(500).json({ error: 'Failed to get streams' });
  }
});

// Get live stream for community
router.get('/community/:communityId/live', authenticateToken, async (req, res) => {
  const { communityId } = req.params;
  const pool = req.app.locals.pool;

  try {
    // Check membership
    const membershipResult = await pool.query(
      `SELECT id FROM community_memberships 
       WHERE community_id = $1 AND user_id = $2`,
      [communityId, req.user.userId]
    );

    if (membershipResult.rows.length === 0) {
      return res.status(403).json({ error: 'You must be a member to view streams' });
    }

    // Get member count for capacity calculation
    const memberCountResult = await pool.query(
      `SELECT COUNT(*) as count FROM community_memberships WHERE community_id = $1`,
      [communityId]
    );
    const memberCount = parseInt(memberCountResult.rows[0].count);
    const viewerCap = Math.floor(memberCount * VIEWER_CAP_PERCENT);

    // Get live stream
    const streamResult = await pool.query(
      `SELECT id, title, description, started_at, duration_minutes, current_viewers
       FROM streams 
       WHERE community_id = $1 AND is_live = TRUE
       LIMIT 1`,
      [communityId]
    );

    if (streamResult.rows.length === 0) {
      return res.json({ isLive: false });
    }

    const stream = streamResult.rows[0];

    // Check viewer capacity
    const currentViewers = stream.current_viewers || 0;
    const canJoin = currentViewers < viewerCap;

    if (!canJoin) {
      return res.json({
        isLive: true,
        stream: {
          id: stream.id,
          title: stream.title
        },
        canJoin: false,
        message: 'Stream is at capacity. Please try again later.',
        currentViewers,
        viewerCap
      });
    }

    // Check if user already viewing
    const viewerResult = await pool.query(
      `SELECT id FROM stream_viewers 
       WHERE stream_id = $1 AND user_id = $2 AND left_at IS NULL`,
      [stream.id, req.user.userId]
    );

    if (viewerResult.rows.length === 0) {
      // Add viewer
      await pool.query(
        `INSERT INTO stream_viewers (stream_id, user_id) VALUES ($1, $2)`,
        [stream.id, req.user.userId]
      );

      // Update viewer count
      await pool.query(
        `UPDATE streams SET current_viewers = current_viewers + 1, 
                           total_view_count = total_view_count + 1
         WHERE id = $1`,
        [stream.id]
      );
    }

    res.json({
      isLive: true,
      stream: {
        id: stream.id,
        title: stream.title,
        description: stream.description,
        startedAt: stream.started_at,
        durationMinutes: stream.duration_minutes,
        currentViewers: currentViewers + 1,
        viewerCap
      },
      canJoin: true
    });
  } catch (err) {
    console.error('Get live stream error:', err);
    res.status(500).json({ error: 'Failed to get live stream' });
  }
});

// Leave stream (update viewer count)
router.post('/:streamId/leave', authenticateToken, async (req, res) => {
  const { streamId } = req.params;
  const pool = req.app.locals.pool;

  try {
    // Update viewer record
    const result = await pool.query(
      `UPDATE stream_viewers SET left_at = NOW() 
       WHERE stream_id = $1 AND user_id = $2 AND left_at IS NULL
       RETURNING id`,
      [streamId, req.user.userId]
    );

    if (result.rows.length > 0) {
      // Decrement viewer count
      await pool.query(
        `UPDATE streams SET current_viewers = GREATEST(0, current_viewers - 1)
         WHERE id = $1`,
        [streamId]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Leave stream error:', err);
    res.status(500).json({ error: 'Failed to leave stream' });
  }
});

// Create stream (admin only)
router.post('/', authenticateToken, async (req, res) => {
  const { communityId, title, description, scheduledFor } = req.body;
  const pool = req.app.locals.pool;

  try {
    // Verify admin
    const adminCheck = await pool.query(
      `SELECT id FROM community_admins WHERE community_id = $1 AND user_id = $2`,
      [communityId, req.user.userId]
    );

    if (adminCheck.rows.length === 0 && req.user.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Check weekly stream limit
    const now = new Date();
    const weekNumber = getWeekNumber(now);
    const weekYear = now.getFullYear();

    const weeklyCount = await pool.query(
      `SELECT COUNT(*) as count FROM streams 
       WHERE community_id = $1 AND week_year = $2 AND week_number = $3`,
      [communityId, weekYear, weekNumber]
    );

    if (parseInt(weeklyCount.rows[0].count) >= MAX_STREAMS_PER_WEEK) {
      return res.status(400).json({ 
        error: `Maximum of ${MAX_STREAMS_PER_WEEK} streams per week reached`,
        limit: MAX_STREAMS_PER_WEEK,
        current: parseInt(weeklyCount.rows[0].count)
      });
    }

    // Create stream
    const result = await pool.query(
      `INSERT INTO streams (community_id, title, description, scheduled_for, week_number, week_year)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [communityId, title, description, scheduledFor, weekNumber, weekYear]
    );

    res.status(201).json({
      id: result.rows[0].id,
      title,
      scheduledFor,
      maxDurationMinutes: MAX_STREAM_MINUTES,
      message: `Stream created. Maximum duration: ${MAX_STREAM_MINUTES} minutes.`
    });
  } catch (err) {
    console.error('Create stream error:', err);
    res.status(500).json({ error: 'Failed to create stream' });
  }
});

// Start stream (go live - admin only)
router.post('/:id/start', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const pool = req.app.locals.pool;

  try {
    // Get stream and verify admin
    const streamResult = await pool.query(
      `SELECT s.*, ca.user_id as admin_id FROM streams s
       JOIN community_admins ca ON ca.community_id = s.community_id
       WHERE s.id = $1`,
      [id]
    );

    if (streamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    const stream = streamResult.rows[0];

    if (stream.admin_id !== req.user.userId && req.user.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (stream.is_live) {
      return res.status(400).json({ error: 'Stream is already live' });
    }

    if (stream.ended_at) {
      return res.status(400).json({ error: 'Stream has already ended' });
    }

    // Check for existing live stream in this community
    const existingLive = await pool.query(
      `SELECT id FROM streams WHERE community_id = $1 AND is_live = TRUE AND id != $2`,
      [stream.community_id, id]
    );

    if (existingLive.rows.length > 0) {
      return res.status(400).json({ error: 'Another stream is already live in this community' });
    }

    // Start stream
    await pool.query(
      `UPDATE streams SET is_live = TRUE, started_at = NOW(), current_viewers = 0
       WHERE id = $1`,
      [id]
    );

    // Notify members with Active Access
    await pool.query(
      `INSERT INTO notifications (user_id, community_id, type, title, message, reference_type, reference_id)
       SELECT aca.user_id, s.community_id, 'stream', 'Live Stream Started', $1, 'stream', $2
       FROM active_community_access aca
       JOIN streams s ON s.community_id = aca.community_id
       WHERE s.id = $2 AND aca.access_expires_at > NOW()`,
      [`${stream.title} is now live!`, id]
    );

    res.json({ 
      success: true, 
      message: 'Stream is now live',
      maxDurationMinutes: MAX_STREAM_MINUTES
    });
  } catch (err) {
    console.error('Start stream error:', err);
    res.status(500).json({ error: 'Failed to start stream' });
  }
});

// End stream (admin only)
router.post('/:id/end', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { recordingUrl, recordingTeaserUrl } = req.body;
  const pool = req.app.locals.pool;

  try {
    // Get stream and verify admin
    const streamResult = await pool.query(
      `SELECT s.*, ca.user_id as admin_id FROM streams s
       JOIN community_admins ca ON ca.community_id = s.community_id
       WHERE s.id = $1`,
      [id]
    );

    if (streamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    const stream = streamResult.rows[0];

    if (stream.admin_id !== req.user.userId && req.user.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (!stream.is_live) {
      return res.status(400).json({ error: 'Stream is not live' });
    }

    // Calculate duration
    const startedAt = new Date(stream.started_at);
    const now = new Date();
    const durationMinutes = Math.round((now - startedAt) / (1000 * 60));

    // End stream
    await pool.query(
      `UPDATE streams SET 
        is_live = FALSE, 
        ended_at = NOW(), 
        duration_minutes = $1,
        current_viewers = 0,
        recording_url = $2,
        recording_teaser_url = $3
       WHERE id = $4`,
      [durationMinutes, recordingUrl, recordingTeaserUrl, id]
    );

    // Mark all viewers as left
    await pool.query(
      `UPDATE stream_viewers SET left_at = NOW() 
       WHERE stream_id = $1 AND left_at IS NULL`,
      [id]
    );

    res.json({ 
      success: true, 
      durationMinutes,
      message: 'Stream ended'
    });
  } catch (err) {
    console.error('End stream error:', err);
    res.status(500).json({ error: 'Failed to end stream' });
  }
});

// Get weekly stream status (admin)
router.get('/community/:communityId/status', authenticateToken, async (req, res) => {
  const { communityId } = req.params;
  const pool = req.app.locals.pool;

  try {
    // Verify admin
    const adminCheck = await pool.query(
      `SELECT id FROM community_admins WHERE community_id = $1 AND user_id = $2`,
      [communityId, req.user.userId]
    );

    if (adminCheck.rows.length === 0 && req.user.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const now = new Date();
    const weekNumber = getWeekNumber(now);
    const weekYear = now.getFullYear();

    const result = await pool.query(
      `SELECT COUNT(*) as count FROM streams 
       WHERE community_id = $1 AND week_year = $2 AND week_number = $3`,
      [communityId, weekYear, weekNumber]
    );

    const usedThisWeek = parseInt(result.rows[0].count);

    res.json({
      maxStreamsPerWeek: MAX_STREAMS_PER_WEEK,
      usedThisWeek,
      remainingThisWeek: MAX_STREAMS_PER_WEEK - usedThisWeek,
      maxDurationMinutes: MAX_STREAM_MINUTES,
      viewerCapPercent: VIEWER_CAP_PERCENT * 100
    });
  } catch (err) {
    console.error('Get stream status error:', err);
    res.status(500).json({ error: 'Failed to get stream status' });
  }
});

module.exports = router;
