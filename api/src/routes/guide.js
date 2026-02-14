const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Spiritual guidance responses based on faith tradition
const getGuideResponse = (communityType, guidePersona, userMessage, conversationHistory) => {
  // In production, this would call an AI API (OpenAI, Anthropic, etc.)
  // For POC, we provide thoughtful pre-crafted responses based on faith tradition

  const greetings = {
    jewish: 'Shalom',
    christian: 'Peace be with you',
    muslim: 'Assalamu Alaikum',
    hindu: 'Namaste',
    buddhist: 'May you be well'
  };

  const closings = {
    jewish: 'May Hashem bless you and keep you.',
    christian: 'May God bless you and keep you in His grace.',
    muslim: 'May Allah guide your path.',
    hindu: 'Om Shanti.',
    buddhist: 'May you find peace and liberation.'
  };

  const wisdomSources = {
    jewish: ['Torah', 'Talmud', 'Psalms', 'Proverbs', 'our Sages'],
    christian: ['Scripture', 'the Gospels', 'the teachings of Jesus', 'the Apostles'],
    muslim: ['the Quran', 'the Hadith', 'the Prophet (PBUH)', 'Islamic scholars'],
    hindu: ['the Vedas', 'the Bhagavad Gita', 'the Upanishads', 'Lord Krishna'],
    buddhist: ['the Buddha', 'the Dharma', 'the Four Noble Truths', 'the Eightfold Path']
  };

  const message = userMessage.toLowerCase();
  const greeting = greetings[communityType] || 'Hello';
  const closing = closings[communityType] || 'Be well.';
  const sources = wisdomSources[communityType] || ['ancient wisdom'];

  // Analyze the message and provide contextual response
  let response = '';

  if (message.includes('anxious') || message.includes('anxiety') || message.includes('worry') || message.includes('worried')) {
    const anxietyResponses = {
      jewish: `${greeting}, my dear friend. Anxiety is a burden many of us carry, but ${sources[0]} teaches us: "Cast your burden upon Hashem, and He will sustain you" (Psalm 55:23). The Talmud reminds us that excessive worry about tomorrow robs us of today's peace. I encourage you to try the practice of Hitbonenut - quiet contemplation. Take a few deep breaths, and repeat: "Gam zu l'tovah" - this too is for good. What specifically weighs on your heart?`,
      christian: `${greeting}. I sense the weight you carry, and I want you to know that our Lord understands. Jesus tells us in Matthew 6:34, "Therefore do not worry about tomorrow, for tomorrow will worry about itself." When anxiety grips your heart, remember that you can cast all your cares upon Him, for He cares for you (1 Peter 5:7). Would you like to pray together?`,
      muslim: `${greeting}. Know that Allah, the Most Merciful, is aware of your struggles. The Quran reminds us: "Verily, with hardship comes ease" (94:6). The Prophet (PBUH) taught us that no calamity befalls a Muslim but that Allah expiates some of his sins because of it. I encourage you to make dhikr - remembrance of Allah. Repeat "La hawla wa la quwwata illa billah" (There is no power nor strength except with Allah). What troubles your heart?`,
      hindu: `${greeting}. The Bhagavad Gita teaches us that the mind can be our greatest friend or our worst enemy. Lord Krishna tells Arjuna: "For one who has conquered the mind, the mind is the best of friends." Your anxiety is the mind in turbulence. Through pranayama (breath control) and meditation, we can calm these waters. Remember: "Yogastha kuru karmani" - be steadfast in yoga and perform your actions. What is causing this disturbance in your mind?`,
      buddhist: `${greeting}. The Buddha taught that suffering arises from attachment and craving, including our attachment to outcomes. Anxiety is often the mind grasping at a future that hasn't arrived. Through mindfulness, we can anchor ourselves in this present moment. Try this: breathe in, know you are breathing in; breathe out, know you are breathing out. This simple practice can calm the stormy mind. What thoughts are troubling you?`
    };
    response = anxietyResponses[communityType] || anxietyResponses.jewish;
  }
  else if (message.includes('sad') || message.includes('depressed') || message.includes('grief') || message.includes('loss') || message.includes('died')) {
    const griefResponses = {
      jewish: `${greeting}, dear soul. Grief is a sacred journey, not a problem to solve. In Judaism, we honor mourning through shiva, through sitting with our pain rather than running from it. King David, even in his deepest sorrow, wrote: "Weeping may endure for a night, but joy comes in the morning" (Psalm 30:5). May I ask what loss you are carrying? Sometimes speaking of those we love helps keep their memory as a blessing.`,
      christian: `${greeting}. "Blessed are those who mourn, for they shall be comforted" (Matthew 5:4). Jesus himself wept at the death of his friend Lazarus. Your sorrow is not weakness - it is love. God collects every tear you shed (Psalm 56:8). In this valley of shadow, remember that you do not walk alone. Would you like to share who you are grieving?`,
      muslim: `${greeting}. Indeed, we belong to Allah, and to Him we shall return. The Prophet (PBUH) said, "The eyes shed tears and the heart is grieved, but we do not say anything except what pleases our Lord." Grief is permitted in Islam; what is forbidden is losing faith in Allah's wisdom. Would you like to talk about your loss?`,
      hindu: `${greeting}. The Gita teaches us that the soul is eternal - it cannot be destroyed, it merely changes forms like we change clothes. "For the soul there is neither birth nor death. It is unborn, eternal, ever-existing, and primeval" (2:20). While this knowledge may not ease the pain of separation, may it bring some peace knowing that those we love continue their eternal journey.`,
      buddhist: `${greeting}. The Buddha taught that all conditioned things are impermanent. This includes our joys and our sorrows. Your grief shows the depth of your love and connection. May you hold space for this sadness while also remembering that the love you shared continues to ripple through existence. What would you like to share about your experience?`
    };
    response = griefResponses[communityType] || griefResponses.jewish;
  }
  else if (message.includes('thank') || message.includes('grateful') || message.includes('blessed')) {
    const gratitudeResponses = {
      jewish: `${greeting}! What a beautiful spirit of hakarat hatov - recognizing the good - you carry! The Talmud teaches that we should say 100 blessings each day, training our hearts to see abundance everywhere. "Ivdu et Hashem b'simcha" - serve God with joy! May this gratitude continue to illuminate your path. ${closing}`,
      christian: `${greeting}! "Give thanks in all circumstances; for this is the will of God in Christ Jesus for you" (1 Thessalonians 5:18). Your grateful heart is a beautiful offering to our Lord. Continue to count your blessings, for gratitude opens our eyes to see God's hand in everything. ${closing}`,
      muslim: `${greeting}! MashaAllah, what beautiful gratitude! The Quran tells us: "If you are grateful, I will surely increase you [in favor]" (14:7). Your thankfulness is itself an act of worship. Alhamdulillah - all praise is due to Allah! ${closing}`,
      hindu: `${greeting}! Gratitude is the highest form of dharma. As the Vedas teach, an attitude of thankfulness aligns us with the cosmic order. Your grateful heart attracts more blessings. Continue this beautiful practice. ${closing}`,
      buddhist: `${greeting}! Gratitude is a form of mindfulness - it brings us fully into appreciation of this moment. The Buddha taught that a mind filled with gratitude is a mind free from craving. May this appreciation continue to grow. ${closing}`
    };
    response = gratitudeResponses[communityType] || gratitudeResponses.jewish;
  }
  else if (message.includes('pray') || message.includes('prayer') || message.includes('meditat')) {
    const prayerResponses = {
      jewish: `${greeting}. Prayer - tefillah - is our direct line to Hashem. The Siddur provides structure, but know that God also treasures the prayers of your heart in your own words. Would you like me to share a prayer or meditation for your current situation? Perhaps from the Psalms, or a traditional blessing?`,
      christian: `${greeting}. "Pray without ceasing" (1 Thessalonians 5:17). Prayer is simply a conversation with our loving Father. Whether you follow the Lord's Prayer or speak from your heart, He hears you. Would you like me to guide you through a prayer or share Scripture for meditation?`,
      muslim: `${greeting}. Salah is the pillar of our faith, but remember also the power of du'a - personal supplication. The Prophet (PBUH) said, "Du'a is the essence of worship." Would you like me to share a du'a for your situation, or discuss how to deepen your connection through prayer?`,
      hindu: `${greeting}. Whether through mantra, puja, or silent dhyana, connecting with the Divine is the highest purpose of human life. Would you like me to share a mantra for your meditation, or discuss different practices that might suit your path?`,
      buddhist: `${greeting}. Meditation is the heart of Buddhist practice. Whether through samatha (calm abiding), vipassana (insight), or metta (loving-kindness), we train the mind toward liberation. Would you like guidance on a specific meditation practice?`
    };
    response = prayerResponses[communityType] || prayerResponses.jewish;
  }
  else if (message.includes('meaning') || message.includes('purpose') || message.includes('why am i')) {
    const purposeResponses = {
      jewish: `${greeting}, seeker of truth. The question of purpose is one our tradition takes seriously. The Talmud teaches that each person should say, "The world was created for me" - meaning we each have unique purpose. Rabbi Hillel asked: "If I am not for myself, who will be for me? If I am only for myself, what am I? And if not now, when?" Perhaps your purpose lies in the intersection of your gifts and the world's needs. What brings you alive?`,
      christian: `${greeting}. You were created with intention and purpose. "For we are God's handiwork, created in Christ Jesus to do good works, which God prepared in advance for us to do" (Ephesians 2:10). Your purpose is found in relationship with God and service to others. What gifts has God given you? What needs in the world break your heart?`,
      muslim: `${greeting}. Allah says in the Quran: "I did not create the jinn and humans except to worship Me" (51:56). But worship extends beyond ritual - it includes living a life of purpose and service. Your unique combination of talents is your amanah - your trust from Allah. How might you serve Allah's creation?`,
      hindu: `${greeting}, seeker. The Gita teaches us of svadharma - one's own duty. Your purpose is unique to you, determined by your nature and your karma. The key is to act without attachment to results, offering all to the Divine. What calling do you feel in your heart?`,
      buddhist: `${greeting}. The Buddha taught that we create meaning through our intentions and actions. Rather than searching for a fixed purpose, consider: How can you reduce suffering? How can you cultivate wisdom and compassion? Meaning emerges through mindful engagement with life.`
    };
    response = purposeResponses[communityType] || purposeResponses.jewish;
  }
  else {
    // Default welcoming response
    const defaultResponses = {
      jewish: `${greeting}, and thank you for reaching out. I am here to listen and offer guidance from our tradition. ${sources[0]} and ${sources[1]} hold wisdom for all of life's challenges. Please share what's on your heart, and together we can explore how our teachings might offer light on your path. ${closing}`,
      christian: `${greeting}! Thank you for reaching out. I'm here to walk alongside you with wisdom from ${sources[0]} and ${sources[1]}. Whatever you're facing, remember that God's love for you is unconditional and unchanging. Please share what's on your heart. ${closing}`,
      muslim: `${greeting}! Thank you for reaching out. I am here to offer guidance from ${sources[0]} and ${sources[1]}. Whatever challenge you face, remember that Allah is Al-Rahman, Al-Rahim - the Most Gracious, the Most Merciful. Please share what's troubling you. ${closing}`,
      hindu: `${greeting}! Thank you for seeking guidance. Drawing from ${sources[0]} and ${sources[1]}, I am here to help illuminate your path. Remember that the Divine dwells within you - "Tat tvam asi" - You are That. Please share what's on your mind. ${closing}`,
      buddhist: `${greeting}! Thank you for reaching out. Drawing from ${sources[0]} and ${sources[1]}, I am here to help you find clarity and peace. Remember that you have within you the capacity for wisdom and compassion. Please share what brings you here today. ${closing}`
    };
    response = defaultResponses[communityType] || defaultResponses.jewish;
  }

  return response;
};

// Get user's guide sessions
router.get('/sessions', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;

  try {
    const result = await pool.query(`
      SELECT gs.*, c.name as community_name, c.community_type,
             (SELECT content FROM guide_messages WHERE session_id = gs.id ORDER BY created_at DESC LIMIT 1) as last_message
      FROM guide_sessions gs
      JOIN communities c ON gs.community_id = c.id
      WHERE gs.user_id = $1
      ORDER BY gs.updated_at DESC
    `, [req.user.id]);

    res.json({ sessions: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get session messages
router.get('/sessions/:sessionId', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;
  const { sessionId } = req.params;

  try {
    // Verify ownership
    const session = await pool.query(
      'SELECT * FROM guide_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, req.user.id]
    );

    if (session.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const messages = await pool.query(
      'SELECT * FROM guide_messages WHERE session_id = $1 ORDER BY created_at ASC',
      [sessionId]
    );

    res.json({
      session: session.rows[0],
      messages: messages.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Start new session
router.post('/sessions', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;
  const { communityId, initialMessage } = req.body;

  try {
    // Get community info
    const community = await pool.query(
      'SELECT * FROM communities WHERE id = $1',
      [communityId]
    );

    if (community.rows.length === 0) {
      return res.status(404).json({ error: 'Community not found' });
    }

    const comm = community.rows[0];

    // Create session
    const sessionResult = await pool.query(`
      INSERT INTO guide_sessions (user_id, community_id, title)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [req.user.id, communityId, initialMessage?.substring(0, 50) || 'New conversation']);

    const session = sessionResult.rows[0];

    // Add user's initial message
    await pool.query(`
      INSERT INTO guide_messages (session_id, role, content)
      VALUES ($1, 'user', $2)
    `, [session.id, initialMessage]);

    // Generate guide response
    const guideResponse = getGuideResponse(
      comm.community_type,
      comm.guide_persona,
      initialMessage,
      []
    );

    // Add guide's response
    await pool.query(`
      INSERT INTO guide_messages (session_id, role, content)
      VALUES ($1, 'guide', $2)
    `, [session.id, guideResponse]);

    // Get all messages
    const messages = await pool.query(
      'SELECT * FROM guide_messages WHERE session_id = $1 ORDER BY created_at ASC',
      [session.id]
    );

    res.status(201).json({
      session,
      messages: messages.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// Send message to guide
router.post('/sessions/:sessionId/messages', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;
  const { sessionId } = req.params;
  const { content } = req.body;

  try {
    // Get session with community info
    const sessionResult = await pool.query(`
      SELECT gs.*, c.community_type, c.guide_persona
      FROM guide_sessions gs
      JOIN communities c ON gs.community_id = c.id
      WHERE gs.id = $1 AND gs.user_id = $2
    `, [sessionId, req.user.id]);

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    // Get conversation history
    const history = await pool.query(
      'SELECT role, content FROM guide_messages WHERE session_id = $1 ORDER BY created_at ASC',
      [sessionId]
    );

    // Add user message
    await pool.query(`
      INSERT INTO guide_messages (session_id, role, content)
      VALUES ($1, 'user', $2)
    `, [sessionId, content]);

    // Generate guide response
    const guideResponse = getGuideResponse(
      session.community_type,
      session.guide_persona,
      content,
      history.rows
    );

    // Add guide response
    const guideMessageResult = await pool.query(`
      INSERT INTO guide_messages (session_id, role, content)
      VALUES ($1, 'guide', $2)
      RETURNING *
    `, [sessionId, guideResponse]);

    // Update session
    await pool.query(
      'UPDATE guide_sessions SET updated_at = CURRENT_TIMESTAMP, title = COALESCE(NULLIF(title, \'New conversation\'), $1) WHERE id = $2',
      [content.substring(0, 50), sessionId]
    );

    res.json({
      userMessage: { role: 'user', content },
      guideMessage: guideMessageResult.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get daily inspiration
router.get('/inspiration/:communityType', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;
  const { communityType } = req.params;

  try {
    const result = await pool.query(`
      SELECT * FROM daily_inspirations
      WHERE community_type = $1
      ORDER BY RANDOM()
      LIMIT 1
    `, [communityType]);

    if (result.rows.length === 0) {
      return res.json({
        inspiration: {
          content: 'May peace and blessings be upon you today.',
          source: 'Traditional blessing'
        }
      });
    }

    res.json({ inspiration: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch inspiration' });
  }
});

module.exports = router;
