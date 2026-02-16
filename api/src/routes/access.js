// D.A.K MVP v3 - Active Community Access Routes
// Core business logic for payment → access duration + credit bucket

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// =============================================================================
// PAYMENT → ACCESS DURATION CONVERSION (Internal Logic - Section 7A)
// =============================================================================

function calculateAccessDays(amount) {
  // MVP v3 Access Conversion Table (7A)
  if (amount < 2) return 7;        // Grace tier
  if (amount < 5) return 14;       // Partial access
  if (amount < 10) return 30;      // 1 month
  if (amount < 15) return 60;      // 2 months
  if (amount < 20) return 90;      // Max active access
  return 90;                        // $20+ = 90 days (excess $ → credit bucket)
}

// Calculate dollar credit from payment (excess over $20 stored as credit)
function calculateCreditAmount(paymentAmount) {
  if (paymentAmount < 20) return 0;
  return parseFloat((paymentAmount - 20).toFixed(2));
}

// =============================================================================
// PLATFORM FEE SLIDING SCALE (Monthly Activity Based - Section 8A)
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
      `SELECT access_expires_at, credit_amount FROM active_community_access
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
      // Note: credit_amount is internal only, never exposed to user
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
    const paymentAmount = parseFloat(payment.amount);
    const daysGranted = payment.days_granted;

    // Update payment status
    await pool.query(
      `UPDATE payments SET status = 'completed', psp_transaction_id = $1 WHERE id = $2`,
      [`mock_${Date.now()}`, paymentId]
    );

    // Get or create active access record
    const existingAccess = await pool.query(
      `SELECT id, access_expires_at, credit_amount FROM active_community_access
       WHERE user_id = $1 AND community_id = $2`,
      [req.user.userId, payment.community_id]
    );

    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const maxExpiry = new Date(now.getTime() + (90 * msPerDay));
    let newExpiresAt;
    let totalCreditAmount;

    if (existingAccess.rows.length > 0) {
      const current = existingAccess.rows[0];
      const currentExpiry = new Date(current.access_expires_at);
      const currentCredit = parseFloat(current.credit_amount) || 0;

      // IMPORTANT: Always extend from current expiry (if future) OR today, whichever is later
      // This ensures users never lose days they paid for
      const baseDate = currentExpiry > now ? currentExpiry : now;
      const calculatedExpiry = new Date(baseDate.getTime() + (daysGranted * msPerDay));

      // Calculate days that would exceed the 90-day cap
      const daysFromNowToCalculated = Math.ceil((calculatedExpiry - now) / msPerDay);

      if (daysFromNowToCalculated > 90) {
        // Cap access at 90 days from now
        newExpiresAt = maxExpiry;

        // Convert excess days to dollar credit
        const excessDays = daysFromNowToCalculated - 90;
        const excessAmount = (excessDays / daysGranted) * paymentAmount;
        totalCreditAmount = parseFloat((currentCredit + excessAmount).toFixed(2));
      } else {
        // All paid days fit within 90-day cap
        newExpiresAt = calculatedExpiry;
        totalCreditAmount = currentCredit; // No excess, keep existing credit
      }

      await pool.query(
        `UPDATE active_community_access
         SET access_expires_at = $1, credit_amount = $2, updated_at = NOW()
         WHERE id = $3`,
        [newExpiresAt, totalCreditAmount, current.id]
      );
    } else {
      // New access record - start from today + granted days
      const calculatedExpiry = new Date(now.getTime() + (daysGranted * msPerDay));
      const daysFromNowToCalculated = Math.ceil((calculatedExpiry - now) / msPerDay);

      if (daysFromNowToCalculated > 90) {
        // Cap access at 90 days from now
        newExpiresAt = maxExpiry;

        // Convert excess days to dollar credit
        const excessDays = daysFromNowToCalculated - 90;
        const excessAmount = (excessDays / daysGranted) * paymentAmount;
        totalCreditAmount = parseFloat(excessAmount.toFixed(2));
      } else {
        // All paid days fit within 90-day cap
        newExpiresAt = calculatedExpiry;
        totalCreditAmount = 0; // No excess for first payment within cap
      }

      await pool.query(
        `INSERT INTO active_community_access (user_id, community_id, access_expires_at, credit_amount)
         VALUES ($1, $2, $3, $4)`,
        [req.user.userId, payment.community_id, newExpiresAt, totalCreditAmount]
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

// Auto-apply credit bucket (triggered when access < 2 days remaining)
// Deducts up to $20 from credit_amount and extends access per 7A table
router.post('/apply-credit/:communityId', authenticateToken, async (req, res) => {
  const { communityId } = req.params;
  const pool = req.app.locals.pool;

  try {
    const accessResult = await pool.query(
      `SELECT id, access_expires_at, credit_amount FROM active_community_access
       WHERE user_id = $1 AND community_id = $2 AND credit_amount > 0`,
      [req.user.userId, communityId]
    );

    if (accessResult.rows.length === 0) {
      return res.json({ message: 'No credit to apply' });
    }

    const access = accessResult.rows[0];
    const now = new Date();
    const currentExpiry = new Date(access.access_expires_at);
    const msPerDay = 24 * 60 * 60 * 1000;
    const currentDaysRemaining = Math.max(0, Math.ceil((currentExpiry - now) / msPerDay));
    const currentCredit = parseFloat(access.credit_amount);

    // Only auto-apply credit when access < 2 days remaining
    if (currentDaysRemaining >= 2) {
      return res.json({ message: 'Access has more than 2 days remaining. Credit will auto-apply when access is less than 2 days.' });
    }

    // Deduct up to $20 from credit bucket
    const amountToCharge = Math.min(currentCredit, 20);
    const daysToGrant = calculateAccessDays(amountToCharge);
    const remainingCredit = parseFloat((currentCredit - amountToCharge).toFixed(2));

    // Extend from current expiry (or now if expired)
    const baseDate = currentExpiry > now ? currentExpiry : now;
    let newExpiry = new Date(baseDate.getTime() + (daysToGrant * msPerDay));

    // Cap at 90 days from now
    const maxExpiry = new Date(now.getTime() + (90 * msPerDay));
    if (newExpiry > maxExpiry) {
      newExpiry = maxExpiry;
    }

    await pool.query(
      `UPDATE active_community_access
       SET access_expires_at = $1, credit_amount = $2, updated_at = NOW()
       WHERE id = $3`,
      [newExpiry, remainingCredit, access.id]
    );

    // Get community name for notification
    const communityResult = await pool.query(
      `SELECT name FROM communities WHERE id = $1`,
      [communityId]
    );
    const communityName = communityResult.rows[0]?.name || 'the community';

    // Create notification about auto-charge
    await pool.query(
      `INSERT INTO notifications (user_id, community_id, type, title, message)
       VALUES ($1, $2, 'access', 'Access Auto-Extended', $3)`,
      [req.user.userId, communityId,
       `Your access to ${communityName} has been extended by ${daysToGrant} days. $${amountToCharge.toFixed(2)} was applied from your credit balance. New expiry: ${newExpiry.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`]
    );

    const newDaysRemaining = Math.min(90, Math.ceil((newExpiry - now) / msPerDay));

    res.json({
      amountCharged: amountToCharge,
      daysGranted: daysToGrant,
      remainingCredit,
      newDaysRemaining,
      newExpiresAt: newExpiry,
      message: `Applied $${amountToCharge.toFixed(2)} from credit. Access extended by ${daysToGrant} days.`
    });
  } catch (err) {
    console.error('Apply credit error:', err);
    res.status(500).json({ error: 'Failed to apply credit' });
  }
});

module.exports = router;
