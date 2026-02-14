// D.A.K MVP v3 - Events Routes
// Events viewable by users with Active Access only

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { sendEventCancellation } = require('../utils/email');

// Get community events (requires Active Access or admin role to view)
router.get('/community/:communityId', authenticateToken, async (req, res) => {
  const { communityId } = req.params;
  const pool = req.app.locals.pool;

  try {
    // Check if user is community admin
    const adminCheck = await pool.query(
      `SELECT id FROM community_admins WHERE community_id = $1 AND user_id = $2`,
      [communityId, req.user.userId]
    );
    const isAdmin = adminCheck.rows.length > 0 || req.user.role === 'platform_admin';

    if (!isAdmin) {
      // Check membership
      const membershipResult = await pool.query(
        `SELECT id FROM community_memberships
         WHERE community_id = $1 AND user_id = $2`,
        [communityId, req.user.userId]
      );

      if (membershipResult.rows.length === 0) {
        return res.status(403).json({ error: 'You must be a member to view events' });
      }

      // Check Active Access
      const accessResult = await pool.query(
        `SELECT access_expires_at FROM active_community_access
         WHERE community_id = $1 AND user_id = $2`,
        [communityId, req.user.userId]
      );

      const hasActiveAccess = accessResult.rows.length > 0 &&
        new Date(accessResult.rows[0].access_expires_at) > new Date();

      // View-only users cannot see calendar/events
      if (!hasActiveAccess) {
        return res.json({
          events: [],
          isViewOnly: true,
          message: 'Activate Active Access to view the community calendar and events'
        });
      }
    }

    // Get upcoming events
    const eventsResult = await pool.query(
      `SELECT id, title, description, starts_at, ends_at, location, is_virtual
       FROM events 
       WHERE community_id = $1 AND starts_at >= NOW()
       ORDER BY starts_at ASC
       LIMIT 50`,
      [communityId]
    );

    res.json({
      events: eventsResult.rows.map(event => ({
        id: event.id,
        title: event.title,
        description: event.description,
        startsAt: event.starts_at,
        endsAt: event.ends_at,
        location: event.location,
        isVirtual: event.is_virtual
      })),
      isViewOnly: false
    });
  } catch (err) {
    console.error('Get events error:', err);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

// Get single event
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const pool = req.app.locals.pool;

  try {
    const eventResult = await pool.query(
      `SELECT e.*, c.name as community_name
       FROM events e
       JOIN communities c ON c.id = e.community_id
       WHERE e.id = $1`,
      [id]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventResult.rows[0];

    // Check membership or admin for this specific community
    const memberCheck = await pool.query(
      `SELECT 1 FROM community_memberships WHERE community_id = $1 AND user_id = $2 AND status = 'approved'
       UNION
       SELECT 1 FROM community_admins WHERE community_id = $1 AND user_id = $2`,
      [event.community_id, req.user.userId]
    );

    if (memberCheck.rows.length === 0 && req.user.role !== 'platform_admin') {
      return res.status(403).json({ error: 'You must be a member to view this event' });
    }

    // Check Active Access
    const accessResult = await pool.query(
      `SELECT access_expires_at FROM active_community_access
       WHERE community_id = $1 AND user_id = $2`,
      [event.community_id, req.user.userId]
    );

    const hasActiveAccess = accessResult.rows.length > 0 &&
      new Date(accessResult.rows[0].access_expires_at) > new Date();

    if (!hasActiveAccess) {
      return res.status(403).json({
        error: 'Active Access required to view event details',
        isViewOnly: true
      });
    }

    res.json({
      id: event.id,
      title: event.title,
      description: event.description,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      location: event.location,
      isVirtual: event.is_virtual,
      communityId: event.community_id,
      communityName: event.community_name
    });
  } catch (err) {
    console.error('Get event error:', err);
    res.status(500).json({ error: 'Failed to get event' });
  }
});

// Get aggregated calendar (all user's communities)
router.get('/calendar/my', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;

  try {
    // Get events from communities where user has Active Access
    const result = await pool.query(
      `SELECT e.id, e.title, e.description, e.starts_at, e.ends_at, 
              e.location, e.is_virtual, c.id as community_id, c.name as community_name
       FROM events e
       JOIN communities c ON c.id = e.community_id
       JOIN active_community_access aca ON aca.community_id = e.community_id
       WHERE aca.user_id = $1 
         AND aca.access_expires_at > NOW()
         AND e.starts_at >= NOW()
       ORDER BY e.starts_at ASC
       LIMIT 100`,
      [req.user.userId]
    );

    res.json(result.rows.map(event => ({
      id: event.id,
      title: event.title,
      description: event.description,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      location: event.location,
      isVirtual: event.is_virtual,
      communityId: event.community_id,
      communityName: event.community_name
    })));
  } catch (err) {
    console.error('Get calendar error:', err);
    res.status(500).json({ error: 'Failed to get calendar' });
  }
});

// Create event (admin only)
router.post('/', authenticateToken, async (req, res) => {
  const { communityId, title, description, startsAt, endsAt, location, isVirtual } = req.body;
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

    const result = await pool.query(
      `INSERT INTO events (community_id, title, description, starts_at, ends_at, location, is_virtual)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [communityId, title, description, startsAt, endsAt, location, isVirtual || false]
    );

    // Notify users with Active Access
    await pool.query(
      `INSERT INTO notifications (user_id, community_id, type, title, message, reference_type, reference_id)
       SELECT aca.user_id, $1, 'event', 'New Event', $2, 'event', $3
       FROM active_community_access aca
       WHERE aca.community_id = $1 AND aca.access_expires_at > NOW()`,
      [communityId, `${title} has been scheduled`, result.rows[0].id]
    );

    res.status(201).json({
      id: result.rows[0].id,
      title,
      startsAt,
      message: 'Event created'
    });
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Update event (admin only)
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { title, description, startsAt, endsAt, location, isVirtual } = req.body;
  const pool = req.app.locals.pool;

  try {
    // Get event and verify admin
    const eventResult = await pool.query(
      `SELECT e.community_id FROM events e WHERE e.id = $1`,
      [id]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const adminCheck = await pool.query(
      `SELECT id FROM community_admins WHERE community_id = $1 AND user_id = $2`,
      [eventResult.rows[0].community_id, req.user.userId]
    );

    if (adminCheck.rows.length === 0 && req.user.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await pool.query(
      `UPDATE events SET 
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        starts_at = COALESCE($3, starts_at),
        ends_at = COALESCE($4, ends_at),
        location = COALESCE($5, location),
        is_virtual = COALESCE($6, is_virtual),
        updated_at = NOW()
       WHERE id = $7`,
      [title, description, startsAt, endsAt, location, isVirtual, id]
    );

    res.json({ success: true, message: 'Event updated' });
  } catch (err) {
    console.error('Update event error:', err);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Delete event (admin only) - sends cancellation email + ICS to all users with Active Access
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const pool = req.app.locals.pool;

  try {
    // Get full event details + community name before deleting
    const eventResult = await pool.query(
      `SELECT e.*, c.name as community_name
       FROM events e
       JOIN communities c ON c.id = e.community_id
       WHERE e.id = $1`,
      [id]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventResult.rows[0];

    const adminCheck = await pool.query(
      `SELECT id FROM community_admins WHERE community_id = $1 AND user_id = $2`,
      [event.community_id, req.user.userId]
    );

    if (adminCheck.rows.length === 0 && req.user.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get all users with Active Access to notify them
    const usersResult = await pool.query(
      `SELECT u.id, u.email, u.name
       FROM active_community_access aca
       JOIN users u ON u.id = aca.user_id
       WHERE aca.community_id = $1 AND aca.access_expires_at > NOW()`,
      [event.community_id]
    );

    // Create in-app cancellation notifications for all active users
    if (usersResult.rows.length > 0) {
      await pool.query(
        `INSERT INTO notifications (user_id, community_id, type, title, message, reference_type, reference_id)
         SELECT aca.user_id, $1, 'event_cancelled', 'Event Cancelled',
                $2, 'event', $3
         FROM active_community_access aca
         WHERE aca.community_id = $1 AND aca.access_expires_at > NOW()`,
        [event.community_id, `"${event.title}" scheduled by ${event.community_name} has been cancelled`, event.id]
      );
    }

    // Delete the event
    await pool.query(`DELETE FROM events WHERE id = $1`, [id]);

    // Send cancellation emails with ICS attachment (async, don't block response)
    for (const user of usersResult.rows) {
      sendEventCancellation({ to: user.email, event })
        .catch(err => console.error(`Failed to send cancellation email to ${user.email}:`, err));
    }

    res.json({ success: true, message: 'Event deleted and cancellation notifications sent' });
  } catch (err) {
    console.error('Delete event error:', err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Export ICS calendar
router.get('/:id/ics', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const pool = req.app.locals.pool;

  try {
    const eventResult = await pool.query(
      `SELECT e.*, c.name as community_name 
       FROM events e 
       JOIN communities c ON c.id = e.community_id
       WHERE e.id = $1`,
      [id]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventResult.rows[0];

    // Check membership or admin for this specific community
    const memberCheck = await pool.query(
      `SELECT 1 FROM community_memberships WHERE community_id = $1 AND user_id = $2 AND status = 'approved'
       UNION
       SELECT 1 FROM community_admins WHERE community_id = $1 AND user_id = $2`,
      [event.community_id, req.user.userId]
    );

    if (memberCheck.rows.length === 0 && req.user.role !== 'platform_admin') {
      return res.status(403).json({ error: 'You must be a member to export this event' });
    }

    // Check Active Access
    const accessResult = await pool.query(
      `SELECT access_expires_at FROM active_community_access
       WHERE community_id = $1 AND user_id = $2`,
      [event.community_id, req.user.userId]
    );

    const hasActiveAccess = accessResult.rows.length > 0 &&
      new Date(accessResult.rows[0].access_expires_at) > new Date();

    if (!hasActiveAccess) {
      return res.status(403).json({ error: 'Active Access required' });
    }

    // Generate ICS
    const formatDate = (date) => new Date(date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const escapeIcs = (str) => (str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

    const description = `${escapeIcs(event.community_name)}${event.description ? '\\n\\n' + escapeIcs(event.description) : ''}`;

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//D.A.K//Community Events//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${event.id}@dak.com`,
      `DTSTART:${formatDate(event.starts_at)}`,
      `DTEND:${formatDate(event.ends_at || event.starts_at)}`,
      `SUMMARY:${escapeIcs(event.title)} (${escapeIcs(event.community_name)})`,
      `DESCRIPTION:${description}`,
      `LOCATION:${escapeIcs(event.location || (event.is_virtual ? 'Virtual' : ''))}`,
      `ORGANIZER;CN=${escapeIcs(event.community_name)}:mailto:noreply@dak.com`,
      `CATEGORIES:${escapeIcs(event.community_name)}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', `attachment; filename="${event.title.replace(/[^a-z0-9]/gi, '_')}.ics"`);
    res.send(ics);
  } catch (err) {
    console.error('Export ICS error:', err);
    res.status(500).json({ error: 'Failed to export calendar' });
  }
});

module.exports = router;
