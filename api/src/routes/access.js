// D.A.K MVP v3 - Active Community Access Routes
// Core business logic for payment → access duration

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// =============================================================================
// PAYMENT → ACCESS DURATION CONVERSION (Internal Logic)
// =============================================================================

function calculateAccessDays(amount) {
  // MVP v3 Access Conversion Table
  if (amount < 2) return 7;        // Grace tier
  if (amount < 5) return 14;       // Partial access
  if (amount < 10) return 30;      // 1 month
  if (amount < 15) return 60;      // 2 months
  if (amount < 20) return 90;      // Max active access
  return 90;                        // $20+ = 90 days + credit
}

function calculateCreditDays(amount) {
  // Any payment $20+ grants 90 days visible + credit stored
  if (amount < 20) return 0;
  
  // Excess stored as credit (internal only)
  // $5 = 30 days base, so calculate excess
  const baseDaysPerFive = 30;
  const totalDaysValue = Math.floor(amount / 5) * baseDaysPerFive;
  const creditDays = Math.max(0, totalDaysValue - 90);
  return creditDays;
}

// =============================================================================
// PLATFORM FEE SLIDING SCALE (Monthly Activity Based)
// =============================================================================

async function calculatePlatformFee(pool, communityId, amount) {
  // Get current month's activity
  const yearMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  
  const activityResult = await pool.query(
    `SELECT total_collected FROM monthly_community_activity 
     WHERE community_id = $1 AND year_month = $2`,
    [communityId, yearMonth]
  );

  const currentActivity = activityResult.rows[0]?.total_collected || 0;
  const projectedTotal = parseFloat(currentActivity) + parseFloat(amount);

  // Sliding scale based on monthly activity
  let feePercent;
  if (projectedTotal <= 300) {
    feePercent = 25;
  } else if (projectedTotal <= 600) {
    feePercent = 20;
  } else if (projectedTotal <= 1000) {
    feePercent = 12;
  } else {
    feePercent = 7;
  }

  return {
    feePercent,
    feeAmount: (amount * feePercent) / 100
  };
}

// =============================================================================
// ROUTES
// =============================================================================

// Get user's access status for a community
router.get('/status/:communityId', authenticateToken, async (req, res) => {
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
      return res.json({
        isMember: false,
        hasActiveAccess: false,
        isViewOnly: true
      });
    }

    // Check active access
    const accessResult = await pool.query(
      `SELECT access_expires_at, credit_days FROM active_community_access 
       WHERE community_id = $1 AND user_id = $2`,
      [communityId, req.user.userId]
    );

    if (accessResult.rows.length === 0) {
      return res.json({
        isMember: true,
        hasActiveAccess: false,
        isViewOnly: true,
        daysRemaining: 0
      });
    }

    const access = accessResult.rows[0];
    const now = new Date();
    const expiresAt = new Date(access.access_expires_at);
    const hasActiveAccess = expiresAt > now;
    
    // Calculate days remaining (max shown to user: 90)
    const msPerDay = 24 * 60 * 60 * 1000;
    let daysRemaining = Math.ceil((expiresAt - now) / msPerDay);
    daysRemaining = Math.max(0, Math.min(90, daysRemaining)); // Cap at 90 for display

    res.json({
      isMember: true,
      hasActiveAccess,
      isViewOnly: !hasActiveAccess,
      daysRemaining,
      expiresAt: access.access_expires_at
      // Note: credit_days is internal only, never exposed to user
    });
  } catch (err) {
    console.error('Get access status error:', err);
    res.status(500).json({ error: 'Failed to get access status' });
  }
});

// Get all user's community access statuses
router.get('/my-access', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;

  try {
    const result = await pool.query(
      `SELECT 
        c.id as community_id,
        c.name as community_name,
        c.community_type,
        cm.created_at as joined_at,
        aca.access_expires_at,
        CASE 
          WHEN aca.access_expires_at > NOW() THEN TRUE 
          ELSE FALSE 
        END as has_active_access
      FROM community_memberships cm
      JOIN communities c ON c.id = cm.community_id
      LEFT JOIN active_community_access aca ON aca.community_id = c.id AND aca.user_id = cm.user_id
      WHERE cm.user_id = $1
      ORDER BY c.name`,
      [req.user.userId]
    );

    const communities = result.rows.map(row => {
      const now = new Date();
      const expiresAt = row.access_expires_at ? new Date(row.access_expires_at) : null;
      const msPerDay = 24 * 60 * 60 * 1000;
      let daysRemaining = expiresAt ? Math.ceil((expiresAt - now) / msPerDay) : 0;
      daysRemaining = Math.max(0, Math.min(90, daysRemaining));

      return {
        communityId: row.community_id,
        communityName: row.community_name,
        communityType: row.community_type,
        joinedAt: row.joined_at,
        hasActiveAccess: row.has_active_access,
        isViewOnly: !row.has_active_access,
        daysRemaining,
        expiresAt: row.access_expires_at
      };
    });

    res.json(communities);
  } catch (err) {
    console.error('Get my access error:', err);
    res.status(500).json({ error: 'Failed to get access' });
  }
});

// Initiate payment (redirect to PSP - Stripe)
router.post('/activate', authenticateToken, async (req, res) => {
  const { communityId, amount, donationMethod, comment } = req.body;
  const pool = req.app.locals.pool;

  try {
    // Validate amount
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Check membership
    const membershipResult = await pool.query(
      `SELECT cm.id, c.community_type
       FROM community_memberships cm
       JOIN communities c ON c.id = cm.community_id
       WHERE cm.community_id = $1 AND cm.user_id = $2`,
      [communityId, req.user.userId]
    );

    if (membershipResult.rows.length === 0) {
      return res.status(400).json({ error: 'You must join this community first' });
    }

    // Calculate access days and platform fee
    const daysGranted = calculateAccessDays(paymentAmount);
    const { feePercent, feeAmount } = await calculatePlatformFee(pool, communityId, paymentAmount);

    // Create pending payment record
    const method = donationMethod || 'card';
    const trimmedComment = comment ? comment.trim().slice(0, 500) : null;
    const paymentResult = await pool.query(
      `INSERT INTO payments (user_id, community_id, amount, days_granted, donation_method, comment, platform_fee, platform_fee_percent, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
       RETURNING id`,
      [req.user.userId, communityId, paymentAmount, daysGranted, method, trimmedComment, feeAmount, feePercent]
    );

    const paymentId = paymentResult.rows[0].id;

    // In production: Create Stripe checkout session
    // For MVP demo: Mock PSP flow
    const mockCheckoutUrl = `/api/access/mock-complete/${paymentId}`;

    res.json({
      paymentId,
      amount: paymentAmount,
      daysGranted,
      platformFee: feeAmount,
      checkoutUrl: mockCheckoutUrl,
      message: `This payment will grant ${daysGranted} days of Active Access`
    });
  } catch (err) {
    console.error('Activate access error:', err);
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
});

// Mock PSP completion (for demo - replace with Stripe webhook in production)
router.post('/mock-complete/:paymentId', authenticateToken, async (req, res) => {
  const { paymentId } = req.params;
  const pool = req.app.locals.pool;

  try {
    // Get payment details
    const paymentResult = await pool.query(
      `SELECT * FROM payments WHERE id = $1 AND user_id = $2 AND status = 'pending'`,
      [paymentId, req.user.userId]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found or already processed' });
    }

    const payment = paymentResult.rows[0];
    const daysGranted = payment.days_granted;
    const creditDays = calculateCreditDays(payment.amount);

    // Update payment status
    await pool.query(
      `UPDATE payments SET status = 'completed', psp_transaction_id = $1 WHERE id = $2`,
      [`mock_${Date.now()}`, paymentId]
    );

    // Get or create active access record
    const existingAccess = await pool.query(
      `SELECT id, access_expires_at, credit_days FROM active_community_access 
       WHERE user_id = $1 AND community_id = $2`,
      [req.user.userId, payment.community_id]
    );

    let newExpiresAt;
    let totalCreditDays;

    if (existingAccess.rows.length > 0) {
      // Rolling extension - add days to current expiry (if not expired) or from now
      const current = existingAccess.rows[0];
      const currentExpiry = new Date(current.access_expires_at);
      const now = new Date();
      const baseDate = currentExpiry > now ? currentExpiry : now;
      
      newExpiresAt = new Date(baseDate.getTime() + (daysGranted * 24 * 60 * 60 * 1000));
      totalCreditDays = (current.credit_days || 0) + creditDays;

      // Apply credit if needed (90-day cap logic)
      const maxExpiry = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000));
      if (newExpiresAt > maxExpiry) {
        const excessMs = newExpiresAt - maxExpiry;
        const excessDays = Math.floor(excessMs / (24 * 60 * 60 * 1000));
        totalCreditDays += excessDays;
        newExpiresAt = maxExpiry;
      }

      await pool.query(
        `UPDATE active_community_access 
         SET access_expires_at = $1, credit_days = $2, updated_at = NOW()
         WHERE id = $3`,
        [newExpiresAt, totalCreditDays, current.id]
      );
    } else {
      // New access record
      newExpiresAt = new Date(Date.now() + (daysGranted * 24 * 60 * 60 * 1000));
      totalCreditDays = creditDays;

      // Apply 90-day cap
      const maxExpiry = new Date(Date.now() + (90 * 24 * 60 * 60 * 1000));
      if (newExpiresAt > maxExpiry) {
        const excessMs = newExpiresAt - maxExpiry;
        const excessDays = Math.floor(excessMs / (24 * 60 * 60 * 1000));
        totalCreditDays += excessDays;
        newExpiresAt = maxExpiry;
      }

      await pool.query(
        `INSERT INTO active_community_access (user_id, community_id, access_expires_at, credit_days)
         VALUES ($1, $2, $3, $4)`,
        [req.user.userId, payment.community_id, newExpiresAt, totalCreditDays]
      );
    }

    // Update monthly activity tracking
    const yearMonth = new Date().toISOString().slice(0, 7);
    await pool.query(
      `INSERT INTO monthly_community_activity (community_id, year_month, total_collected, platform_fee_total)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (community_id, year_month) 
       DO UPDATE SET 
         total_collected = monthly_community_activity.total_collected + $3,
         platform_fee_total = monthly_community_activity.platform_fee_total + $4,
         updated_at = NOW()`,
      [payment.community_id, yearMonth, payment.amount, payment.platform_fee]
    );

    // Create notification
    await pool.query(
      `INSERT INTO notifications (user_id, community_id, type, title, message)
       VALUES ($1, $2, 'access', 'Active Access Activated', $3)`,
      [req.user.userId, payment.community_id, `You now have Active Access for ${daysGranted} days!`]
    );

    // Calculate display days (capped at 90)
    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    let displayDays = Math.ceil((newExpiresAt - now) / msPerDay);
    displayDays = Math.min(90, displayDays);

    res.json({
      success: true,
      daysGranted,
      daysRemaining: displayDays,
      expiresAt: newExpiresAt,
      message: `Active Access activated! You have ${displayDays} days remaining.`
    });
  } catch (err) {
    console.error('Complete payment error:', err);
    res.status(500).json({ error: 'Failed to complete payment' });
  }
});

// Get all payment history for user (across all communities)
router.get('/payments', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;

  try {
    const result = await pool.query(
      `SELECT p.id, p.amount, p.currency, p.status, p.days_granted,
              p.donation_method, p.comment, p.created_at,
              c.name as community_name, c.id as community_id
       FROM payments p
       JOIN communities c ON c.id = p.community_id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC
       LIMIT 50`,
      [req.user.userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get all payments error:', err);
    res.status(500).json({ error: 'Failed to get payments' });
  }
});

// Get payment history for a specific community
router.get('/payments/:communityId', authenticateToken, async (req, res) => {
  const { communityId } = req.params;
  const pool = req.app.locals.pool;

  try {
    const result = await pool.query(
      `SELECT id, amount, currency, status, days_granted, created_at
       FROM payments
       WHERE user_id = $1 AND community_id = $2
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.user.userId, communityId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get payments error:', err);
    res.status(500).json({ error: 'Failed to get payments' });
  }
});

// Apply credit days (internal - called by cron or when access drops below 90 days)
router.post('/apply-credit/:communityId', authenticateToken, async (req, res) => {
  const { communityId } = req.params;
  const pool = req.app.locals.pool;

  try {
    const accessResult = await pool.query(
      `SELECT id, access_expires_at, credit_days FROM active_community_access
       WHERE user_id = $1 AND community_id = $2 AND credit_days > 0`,
      [req.user.userId, communityId]
    );

    if (accessResult.rows.length === 0) {
      return res.json({ message: 'No credit to apply' });
    }

    const access = accessResult.rows[0];
    const now = new Date();
    const currentExpiry = new Date(access.access_expires_at);
    const msPerDay = 24 * 60 * 60 * 1000;
    const currentDaysRemaining = Math.ceil((currentExpiry - now) / msPerDay);

    // Only apply credit if access < 90 days
    if (currentDaysRemaining >= 90) {
      return res.json({ message: 'Access is already at maximum (90 days)' });
    }

    const daysNeeded = 90 - currentDaysRemaining;
    const daysToApply = Math.min(daysNeeded, access.credit_days);
    const newExpiry = new Date(currentExpiry.getTime() + (daysToApply * msPerDay));
    const remainingCredit = access.credit_days - daysToApply;

    await pool.query(
      `UPDATE active_community_access 
       SET access_expires_at = $1, credit_days = $2, updated_at = NOW()
       WHERE id = $3`,
      [newExpiry, remainingCredit, access.id]
    );

    res.json({
      daysApplied: daysToApply,
      newDaysRemaining: Math.min(90, currentDaysRemaining + daysToApply),
      message: `Applied ${daysToApply} credit days to your access`
    });
  } catch (err) {
    console.error('Apply credit error:', err);
    res.status(500).json({ error: 'Failed to apply credit' });
  }
});

module.exports = router;
