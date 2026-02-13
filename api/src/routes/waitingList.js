// D.A.K MVP v3 - Waiting List Routes
// Public entry point - one waiting list per community type

const express = require('express');
const router = express.Router();

// Supported community types
const VALID_COMMUNITY_TYPES = ['islam', 'christianity', 'hinduism', 'judaism'];

// Join waiting list (public - no auth required)
router.post('/', async (req, res) => {
  const { email, recommendedInstitution, communityType } = req.body;
  const pool = req.app.locals.pool;

  try {
    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    // Validate community type
    if (!communityType || !VALID_COMMUNITY_TYPES.includes(communityType)) {
      return res.status(400).json({ 
        error: 'Valid community type is required',
        validTypes: VALID_COMMUNITY_TYPES
      });
    }

    // Check if already on waiting list for this community type
    const existing = await pool.query(
      `SELECT id FROM waiting_list WHERE email = $1 AND community_type = $2`,
      [email, communityType]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ 
        error: 'You are already on the waiting list for this community type'
      });
    }

    // Add to waiting list
    await pool.query(
      `INSERT INTO waiting_list (email, recommended_institution, community_type)
       VALUES ($1, $2, $3)`,
      [email, recommendedInstitution || null, communityType]
    );

    res.status(201).json({
      success: true,
      message: 'Thank you for your interest! We will notify you when communities in your area become available.',
      communityType
    });
  } catch (err) {
    console.error('Waiting list error:', err);
    res.status(500).json({ error: 'Failed to join waiting list' });
  }
});

// Get community types (public - for landing page dropdown)
router.get('/community-types', async (req, res) => {
  res.json({
    types: VALID_COMMUNITY_TYPES.map(type => ({
      value: type,
      label: type.charAt(0).toUpperCase() + type.slice(1)
    }))
  });
});

module.exports = router;
