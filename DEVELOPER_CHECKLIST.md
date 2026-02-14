# D.A.K Developer Checklist

## 🚀 Quick Reference for Developers

Use this checklist before committing any code that touches user roles, memberships, or access control.

---

## ✅ Pre-Commit Checklist

### Chinese Wall Enforcement
- [ ] Users can only join communities of their `community_type`
- [ ] No cross-faith data queries or displays
- [ ] Community type is set on user registration and never changes
- [ ] All community joins validate: `user.community_type === community.community_type`

### Role Separation
- [ ] Admin users (`community_admin`) have NO memberships
- [ ] Admin users have NO subscriptions/active access
- [ ] Regular users (`user`) have NO admin privileges
- [ ] Platform admins (`platform_admin`) don't manage specific communities
- [ ] Each role has clearly defined permissions

### Community Integrity
- [ ] Every community has a `community_admins` entry
- [ ] Admin email and name are populated
- [ ] Admin user (if linked) has `role = 'community_admin'`
- [ ] Creating community automatically creates admin entry

### Membership Status
- [ ] Only use `pending` or `approved` for status
- [ ] Never use `active`, `suspended`, or other values
- [ ] Approved members can have View Only or Active Access
- [ ] Pending members cannot access anything

### Access Control
- [ ] Active access checked with: `access_expires_at > NOW()`
- [ ] Expired access = View Only (don't delete subscription)
- [ ] Access granted based on payment: $1 = 1 day
- [ ] Platform fee calculated per payment
- [ ] Both membership AND active access needed for full access

---

## 🔍 Quick Validation Queries

### Run Before Pushing Code

```sql
-- 1. Check for Chinese Wall violations (should return 0)
SELECT COUNT(*) FROM community_memberships cm
JOIN users u ON u.id = cm.user_id
JOIN communities c ON c.id = cm.community_id
WHERE u.community_type != c.community_type;

-- 2. Check for role separation violations (should return 0)
SELECT COUNT(*) FROM users u
WHERE u.role = 'community_admin'
AND (
  EXISTS(SELECT 1 FROM community_memberships WHERE user_id = u.id)
  OR EXISTS(SELECT 1 FROM active_community_access WHERE user_id = u.id)
);

-- 3. Check for communities without admins (should return 0)
SELECT COUNT(*) FROM communities c
LEFT JOIN community_admins ca ON ca.community_id = c.id
WHERE ca.id IS NULL;

-- 4. Check for invalid membership status (should return 0)
SELECT COUNT(*) FROM community_memberships
WHERE status NOT IN ('pending', 'approved');
```

---

## ❌ Common Mistakes to Avoid

### Mistake 1: Using Wrong Status
```javascript
// ❌ WRONG
UPDATE community_memberships SET status = 'active';

// ✅ CORRECT
UPDATE community_memberships SET status = 'approved';
```

### Mistake 2: Mixing Roles
```javascript
// ❌ WRONG
const user = await createUser({
  role: 'community_admin',
  memberships: [community1, community2] // Admins shouldn't have memberships!
});

// ✅ CORRECT - Admin
const admin = await createUser({
  role: 'community_admin',
  // No memberships or subscriptions
});

// ✅ CORRECT - Devotee
const devotee = await createUser({
  role: 'user',
  memberships: [community1, community2]
});
```

### Mistake 3: Creating Community Without Admin
```javascript
// ❌ WRONG
await pool.query('INSERT INTO communities (...) RETURNING id');
// Missing admin entry!

// ✅ CORRECT
const result = await pool.query('INSERT INTO communities (...) RETURNING id');
const communityId = result.rows[0].id;
await pool.query(
  'INSERT INTO community_admins (community_id, user_id, admin_name, admin_email) VALUES ($1,$2,$3,$4)',
  [communityId, adminUserId, adminName, adminEmail]
);
```

### Mistake 4: Deleting Subscription History
```javascript
// ❌ WRONG - Loses payment history
DELETE FROM active_community_access WHERE access_expires_at < NOW();

// ✅ CORRECT - Keep history, filter in queries
SELECT * FROM active_community_access
WHERE user_id = $1 AND access_expires_at > NOW();
```

### Mistake 5: Allowing Cross-Faith Access
```javascript
// ❌ WRONG - No validation
async function joinCommunity(userId, communityId) {
  await pool.query('INSERT INTO community_memberships ...');
}

// ✅ CORRECT - Validate faith type match
async function joinCommunity(userId, communityId) {
  const user = await getUser(userId);
  const community = await getCommunity(communityId);

  if (user.community_type !== community.community_type) {
    throw new Error('Cannot join community of different faith type');
  }

  await pool.query('INSERT INTO community_memberships ...');
}
```

---

## 🛠️ Code Templates

### Creating a Community with Admin

```javascript
async function createCommunityWithAdmin(communityData, adminData) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create community
    const communityResult = await client.query(
      `INSERT INTO communities (name, community_type, country, status)
       VALUES ($1, $2, $3, 'active') RETURNING id`,
      [communityData.name, communityData.type, communityData.country]
    );
    const communityId = communityResult.rows[0].id;

    // 2. ALWAYS create admin entry
    await client.query(
      `INSERT INTO community_admins (community_id, user_id, admin_name, admin_email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (community_id) DO UPDATE
       SET admin_name = EXCLUDED.admin_name, admin_email = EXCLUDED.admin_email`,
      [communityId, adminData.userId, adminData.name, adminData.email]
    );

    await client.query('COMMIT');
    return communityId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

### Validating User Role Before Upgrade

```javascript
async function upgradeToAdmin(userId, communityId) {
  // Check for existing devotee activity
  const activityCheck = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM community_memberships WHERE user_id = $1) as memberships,
       (SELECT COUNT(*) FROM active_community_access WHERE user_id = $1) as accesses`,
    [userId]
  );

  if (activityCheck.rows[0].memberships > 0 || activityCheck.rows[0].accesses > 0) {
    throw new Error(
      'User has existing devotee activity. Cannot upgrade to admin. ' +
      'Please create a separate admin account.'
    );
  }

  // Safe to upgrade
  await pool.query(
    `UPDATE users SET role = 'community_admin' WHERE id = $1`,
    [userId]
  );
}
```

### Granting Access with Membership

```javascript
async function grantAccess(userId, communityId, paymentAmount) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Ensure membership exists (create if not)
    await client.query(
      `INSERT INTO community_memberships (user_id, community_id, status, joined_via)
       VALUES ($1, $2, 'approved', 'payment')
       ON CONFLICT (community_id, user_id) DO UPDATE
       SET status = 'approved'`,
      [userId, communityId]
    );

    // 2. Grant or extend access
    const daysGranted = Math.floor(paymentAmount);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + daysGranted);

    await client.query(
      `INSERT INTO active_community_access (user_id, community_id, access_expires_at, credit_amount)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, community_id) DO UPDATE
       SET access_expires_at = GREATEST(active_community_access.access_expires_at, EXCLUDED.access_expires_at),
           credit_amount = active_community_access.credit_amount + EXCLUDED.credit_amount`,
      [userId, communityId, expiresAt, paymentAmount]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

---

## 🎯 Key Principles Summary

### 1. Chinese Wall
**One faith, one user** - Users locked to single community type forever

### 2. Role Separation
**Admins manage, devotees participate** - Never both for same user

### 3. Data Integrity
**Every community has admin** - Always create admin with community

### 4. Status Values
**pending → approved** - Only valid membership states

### 5. Access History
**Never delete, filter by expiry** - Keep subscription history

---

## 📞 When in Doubt

1. Check `ARCHITECTURE_PRINCIPLES.md` for detailed explanations
2. Check `ROLE_SEPARATION_PRINCIPLE.md` for role-specific rules
3. Run validation queries to verify data integrity
4. Ask for code review if implementing critical features
5. Test with multiple scenarios (admin, devotee, expired access, etc.)

---

## 🎓 Testing Scenarios

Before marking feature as complete, test these scenarios:

- [ ] Regular user joining community of same faith
- [ ] Regular user trying to join community of different faith (should fail)
- [ ] Admin managing their community
- [ ] Admin trying to join community as member (should fail)
- [ ] User with active access seeing full content
- [ ] User with expired access seeing limited content (View Only)
- [ ] Pending membership waiting for approval
- [ ] Approved membership with and without active access
- [ ] Creating new community automatically creates admin
- [ ] Upgrading user with devotee activity to admin (should fail with warning)

---

**Remember**:
> When you're not sure if your code violates a principle, it probably does.
> Read the principles, validate your assumptions, then code.

---

**Version**: 1.0
**Last Updated**: February 14, 2026
**Must Read Before**: Every commit touching users, roles, memberships, or access
