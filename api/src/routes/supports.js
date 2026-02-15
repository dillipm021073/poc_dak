const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Get user's support history
router.get('/my-history', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;

  try {
    const result = await pool.query(`
      SELECT s.*, 
             c.name as community_name,
             c.community_type,
             (SELECT json_agg(json_build_object(
               'id', da.id,
               'message', da.message,
               'sent_by_name', u.name,
               'created_at', da.created_at
             ))
             FROM donation_acknowledgments da
             LEFT JOIN users u ON da.sent_by = u.id
             WHERE da.support_id = s.id
             ) as acknowledgments
      FROM supports s
      JOIN communities c ON s.community_id = c.id
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC
    `, [req.user.id]);

    // Calculate totals
    const totalDonated = result.rows
      .filter(s => s.status === 'completed')
      .reduce((sum, s) => sum + parseFloat(s.amount), 0);

    const recurringActive = result.rows.filter(
      s => s.support_type === 'recurring' && s.status === 'completed'
    ).length;

    res.json({
      donations: result.rows,
      summary: {
        total_donated: totalDonated.toFixed(2),
        total_transactions: result.rows.length,
        active_recurring: recurringActive
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch support history' });
  }
});

// Get support payments for a community (admin only)
router.get('/community/:communityId', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;
  const { communityId } = req.params;

  try {
    // Check if admin
    const adminCheck = await pool.query(
      'SELECT * FROM community_admins WHERE community_id = $1 AND user_id = $2',
      [communityId, req.user.userId]
    );

    if (adminCheck.rows.length === 0 && req.user.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = await pool.query(`
      SELECT p.id,
             p.amount,
             p.currency,
             p.status,
             p.days_granted,
             p.donation_method,
             p.comment as note,
             p.platform_fee,
             p.platform_fee_percent,
             p.created_at,
             u.name as donor_name,
             u.email as donor_email,
             0 as ack_count
      FROM payments p
      JOIN users u ON p.user_id = u.id
      WHERE p.community_id = $1
      ORDER BY p.created_at DESC
    `, [communityId]);

    // Calculate summary
    const completed = result.rows.filter(s => s.status === 'completed');
    const totalAmount = completed.reduce((sum, s) => sum + parseFloat(s.amount), 0);
    const totalPlatformFees = completed.reduce((sum, s) => sum + parseFloat(s.platform_fee || 0), 0);
    const netAmount = totalAmount - totalPlatformFees;

    res.json({
      donations: result.rows,
      summary: {
        total_donations: completed.length,
        total_amount: totalAmount.toFixed(2),
        net_amount: netAmount.toFixed(2),
        platform_fees: totalPlatformFees.toFixed(2)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch support payments' });
  }
});

// Get single support payment with details
router.get('/:id', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;

  try {
    const result = await pool.query(`
      SELECT s.*, 
             c.name as community_name,
             c.community_type,
             u.name as donor_name,
             u.email as donor_email
      FROM supports s
      JOIN communities c ON s.community_id = c.id
      JOIN users u ON s.user_id = u.id
      WHERE s.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Support payment not found' });
    }

    // Check authorization (supporter or community admin)
    const donation = result.rows[0];
    if (donation.user_id !== req.user.id) {
      const adminCheck = await pool.query(
        'SELECT * FROM community_admins WHERE community_id = $1 AND user_id = $2',
        [donation.community_id, req.user.id]
      );
      if (adminCheck.rows.length === 0 && req.user.role !== 'platform_admin') {
        return res.status(403).json({ error: 'Not authorized' });
      }
    }

    // Get acknowledgments
    const acks = await pool.query(`
      SELECT da.*, u.name as sent_by_name
      FROM donation_acknowledgments da
      LEFT JOIN users u ON da.sent_by = u.id
      WHERE da.support_id = $1
      ORDER BY da.created_at DESC
    `, [id]);

    res.json({
      donation,
      acknowledgments: acks.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch support payment' });
  }
});

// Create support (donate)
router.post('/', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;
  const { communityId, amount, supportType, currency = 'USD', note } = req.body;
  
  try {
    // Verify user is a member of this community
    const memberCheck = await pool.query(
      `SELECT 1 FROM community_memberships WHERE community_id = $1 AND user_id = $2 AND status = 'approved'
       UNION
       SELECT 1 FROM community_admins WHERE community_id = $1 AND user_id = $2`,
      [communityId, req.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You must be a member of this community' });
    }

    // Calculate platform fee (5%)
    const platformFee = (parseFloat(amount) * 0.05).toFixed(2);
    
    // Mock PSP transaction ID
    const pspTransactionId = 'psp_' + uuidv4();

    // Create support record
    const supportResult = await pool.query(`
      INSERT INTO supports (user_id, community_id, amount, currency, support_type, status, psp_transaction_id, platform_fee, note)
      VALUES ($1, $2, $3, $4, $5, 'completed', $6, $7, $8)
      RETURNING *
    `, [req.user.id, communityId, amount, currency, supportType, pspTransactionId, platformFee, note]);

    const support = supportResult.rows[0];

    // Create entitlement (1 month access)
    const endsAt = new Date();
    endsAt.setMonth(endsAt.getMonth() + 1);

    await pool.query(`
      INSERT INTO entitlements (user_id, community_id, ends_at, support_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, community_id) 
      DO UPDATE SET ends_at = GREATEST(entitlements.ends_at, $3), status = 'active'
    `, [req.user.id, communityId, endsAt, support.id]);

    // Get community name for response
    const comm = await pool.query('SELECT name FROM communities WHERE id = $1', [communityId]);

    res.status(201).json({
      support: {
        ...support,
        community_name: comm.rows[0]?.name
      },
      entitlement: {
        endsAt,
        message: 'Full access granted for 1 month'
      },
      gatingPopup: "This space is part of the active community. By supporting the community, you'll be included in updates, events, and conversations for the coming month."
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Support failed' });
  }
});

// Send acknowledgment (admin only)
router.post('/:id/acknowledge', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;
  const { message } = req.body;

  try {
    // Get support record
    const donation = await pool.query('SELECT * FROM supports WHERE id = $1', [id]);
    if (donation.rows.length === 0) {
      return res.status(404).json({ error: 'Support record not found' });
    }

    // Check if admin
    const adminCheck = await pool.query(
      'SELECT * FROM community_admins WHERE community_id = $1 AND user_id = $2',
      [donation.rows[0].community_id, req.user.id]
    );

    if (adminCheck.rows.length === 0 && req.user.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Only community admins can send acknowledgments' });
    }

    // Create acknowledgment
    const ackResult = await pool.query(`
      INSERT INTO donation_acknowledgments (support_id, message, sent_by)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [id, message, req.user.id]);

    // Create notification for supporter
    await pool.query(`
      INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
      VALUES ($1, 'donation_ack', 'Thank You for Your Support!', $2, 'support', $3)
    `, [donation.rows[0].user_id, `${req.user.name} sent you a thank you message for your support.`, id]);

    res.status(201).json({
      acknowledgment: {
        ...ackResult.rows[0],
        sent_by_name: req.user.name
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send acknowledgment' });
  }
});

// Cancel recurring support
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;
  
  try {
    const result = await pool.query(`
      UPDATE supports 
      SET status = 'cancelled' 
      WHERE id = $1 AND user_id = $2 AND support_type = 'recurring'
      RETURNING *
    `, [req.params.id, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Support not found or not recurring' });
    }

    res.json({
      support: result.rows[0],
      message: 'Recurring support cancelled. Access remains until end of paid period.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Cancellation failed' });
  }
});

module.exports = router;
