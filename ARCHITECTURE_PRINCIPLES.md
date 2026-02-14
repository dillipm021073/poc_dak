# D.A.K System Architecture Principles

## 🏛️ Core Design Principles

This document outlines the fundamental architectural principles that govern the D.A.K (Devotion, Access, Knowledge) platform. **These principles must be followed at all times to maintain system integrity.**

---

## 1. 🧱 Chinese Wall Principle (Faith Type Isolation)

### Definition
**Each user belongs to exactly ONE community type (faith tradition) and can NEVER cross to another.**

### Supported Community Types
- `judaism` - Jewish communities
- `christianity` - Christian communities
- `islam` - Islamic communities
- `hinduism` - Hindu communities

### Rules

#### ✅ ALLOWED
```javascript
// User can join MULTIPLE communities within SAME faith type
User: Sarah Miller
- community_type: 'judaism'
- Communities: [Temple Beth Israel, Congregation Shalom, Beth Shalom Synagogue]
✓ All communities are Judaism - VALID
```

#### ❌ FORBIDDEN
```javascript
// User CANNOT join communities of DIFFERENT faith types
User: John Doe
- community_type: 'judaism'
- Communities: [Temple Beth Israel, St. Mary Cathedral]
✗ Mixed Judaism + Christianity - INVALID
```

### Implementation

```javascript
// Database constraint
users.community_type -> ENUM('judaism', 'christianity', 'islam', 'hinduism')

// Validation on join
if (community.community_type !== user.community_type) {
  throw new Error('Cannot join community of different faith type');
}
```

### Why It Matters
- **Religious integrity**: Each faith has unique practices and teachings
- **Content relevance**: Users only see content relevant to their faith
- **Privacy**: Prevents cross-faith data leakage
- **Cultural sensitivity**: Respects religious boundaries

---

## 2. 👤 Role Separation Principle (Admin vs Devotee)

### Definition
**Community administrators and regular devotees are separate, mutually exclusive roles.**

### Role Types

#### Community Admin (`community_admin`)
- **Purpose**: Manage and administrate ONE community
- **Can**: Configure settings, create events, manage members, view analytics
- **Cannot**: Be a member/devotee, have subscriptions, participate as regular user

#### Regular User/Devotee (`user`)
- **Purpose**: Participate in community spiritual activities
- **Can**: Join communities, subscribe, attend events, engage in discussions
- **Cannot**: Manage communities, create admin content

#### Platform Admin (`platform_admin`)
- **Purpose**: Oversee entire platform
- **Can**: View all data, approve communities, manage system
- **Cannot**: Be admin or member of specific communities

### Rules

#### ✅ CORRECT
```javascript
// Dedicated admin account
Admin: Rabbi David Cohen
- Email: rabbi@temple.com
- Role: community_admin
- Community: Temple Beth Israel
- Memberships: 0
- Subscriptions: 0
✓ Admin only - no devotee activity

// Separate devotee account
Devotee: Sarah Miller
- Email: sarah@example.com
- Role: user
- Communities: [Temple Beth Israel, Congregation Shalom]
- Memberships: 2
- Subscriptions: 2
✓ Devotee only - no admin responsibilities
```

#### ❌ FORBIDDEN
```javascript
// Same person with dual roles
Person: Sarah Miller
- Admin Email: sarah@example.com
- Manages: Congregation Shalom (community_admin)
- Member of: Temple Beth Israel (user)
✗ VIOLATION - Cannot be both admin AND devotee
```

### Implementation Safeguards

```javascript
// Check before upgrading to admin
const hasDevoteeActivity = await checkUserActivity(userId);
if (hasDevoteeActivity.memberships > 0 || hasDevoteeActivity.subscriptions > 0) {
  throw new Error('User has devotee activity - cannot become admin');
}

// Database check
SELECT COUNT(*)
FROM users u
WHERE u.role = 'community_admin'
  AND (
    EXISTS(SELECT 1 FROM community_memberships WHERE user_id = u.id)
    OR EXISTS(SELECT 1 FROM active_community_access WHERE user_id = u.id)
  );
-- Should return 0
```

### Why It Matters
- **Data integrity**: Clear separation of management vs participation data
- **Permission clarity**: No ambiguous access rights
- **Analytics accuracy**: Member counts don't include admins
- **Audit trails**: Clear attribution of actions

---

## 3. 💰 Access Control & Subscription Model

### Definition
**Active Access is a time-based subscription that unlocks premium community features.**

### Access States

#### View Only (Default)
- Can see: Community name, basic info, public posts
- Cannot: See events, streams, detailed content, participate

#### Active Access (Paid Subscription)
- Can see: All community content, events, streams, discussions
- Can: Participate fully, message, attend events
- Duration: Based on payment amount (1 day = $1)

### Rules

#### Membership vs Access
```javascript
// Membership = User is linked to community (may be pending/approved)
community_memberships {
  user_id, community_id, status, joined_via
}

// Active Access = User has paid subscription (time-limited)
active_community_access {
  user_id, community_id, access_expires_at, credit_amount
}

// User can be member WITHOUT active access (View Only)
// User SHOULD NOT have access WITHOUT membership (data integrity)
```

#### Access Expiry
```javascript
// Access is time-based
if (access.access_expires_at > NOW()) {
  // User has Active Access
  showFullContent();
} else {
  // Access expired - View Only
  showLimitedContent();
}

// After expiry: Move to "View Only" - DO NOT delete membership
```

### Payment Formula
```javascript
// Simple 1:1 ratio
const daysGranted = Math.floor(paymentAmount / 1); // $1 = 1 day

// Access period
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + daysGranted);

// Store both credit amount and expiry
active_community_access {
  credit_amount: paymentAmount,
  access_expires_at: expiresAt
}
```

### Platform Fee Structure
```javascript
// Sliding scale based on monthly GMV per community
const feeStructure = [
  { minGMV: 0,    maxGMV: 300,  feePercent: 25 },
  { minGMV: 300,  maxGMV: 600,  feePercent: 20 },
  { minGMV: 600,  maxGMV: 1000, feePercent: 12 },
  { minGMV: 1000, maxGMV: null, feePercent: 7  }
];

// Calculate on EACH payment
const platformFee = paymentAmount * (feePercent / 100);
const communityRevenue = paymentAmount - platformFee;
```

### Why It Matters
- **Sustainable revenue**: Communities funded by engaged devotees
- **Fair pricing**: Simple $1/day model
- **Clear value**: Users know exactly what they're paying for
- **Graceful degradation**: Expired access → View Only (not deleted)

---

## 4. 🔒 Membership Status Workflow

### Definition
**Community membership follows a defined approval workflow.**

### Status Flow

```
pending → approved (normal flow)
pending → rejected (denied by admin)
approved → approved (remains forever)
```

### Status Definitions

#### `pending`
- User joined via QR/link but not yet approved
- Can: See community exists
- Cannot: Access any content or participate
- Admin action required: Approve or reject

#### `approved`
- Admin approved the membership
- User is official member (may have View Only or Active Access)
- Can: Access based on subscription status
- Permanent: Once approved, stays approved

#### Status Values
```javascript
// CORRECT values from community_memberships
status IN ('pending', 'approved')

// NOT valid
status = 'active' // ✗ Wrong - use 'approved'
status = 'suspended' // ✗ Wrong - delete membership instead
```

### Implementation
```javascript
// Join community
INSERT INTO community_memberships (user_id, community_id, status, joined_via)
VALUES (userId, communityId, 'pending', 'qr');

// Admin approves
UPDATE community_memberships
SET status = 'approved'
WHERE id = membershipId AND status = 'pending';

// Query approved members
SELECT COUNT(*) FROM community_memberships
WHERE community_id = ? AND status = 'approved';
```

### Why It Matters
- **Admin control**: Communities control who joins
- **Safety**: Prevents spam/inappropriate users
- **Clear states**: No ambiguous membership status
- **Data consistency**: Standard status values

---

## 5. 📊 Data Integrity Principles

### Definition
**All related data must remain consistent and accurate.**

### Critical Relationships

#### Every Community MUST Have Admin
```javascript
// ALWAYS true
SELECT c.id, c.name, ca.admin_email
FROM communities c
LEFT JOIN community_admins ca ON ca.community_id = c.id
WHERE ca.admin_email IS NULL;
-- Should return 0 rows

// When creating community, ALWAYS create admin
INSERT INTO communities (...) RETURNING id;
INSERT INTO community_admins (community_id, user_id, admin_name, admin_email)
VALUES (communityId, adminUserId, name, email);
```

#### Subscriptions Require Memberships
```javascript
// User with active_community_access SHOULD have membership
// (Though membership might be pending - that's OK for transition)

// Good practice: Create membership BEFORE granting access
INSERT INTO community_memberships (...);
INSERT INTO active_community_access (...);
```

#### Soft Deletes for User Data
```javascript
// DON'T delete user data - it's valuable history
// Instead: Mark as inactive or move to archive

// ✗ Bad
DELETE FROM users WHERE id = userId;

// ✓ Good
UPDATE users SET status = 'inactive', updated_at = NOW()
WHERE id = userId;

// Or move to archive table
INSERT INTO users_archive SELECT * FROM users WHERE id = userId;
DELETE FROM users WHERE id = userId;
```

### Cascading Rules

```sql
-- Communities → cascade deletes
ON DELETE CASCADE
  - community_admins
  - community_memberships
  - events
  - streams
  - conversations

-- Users → prevent deletion if dependencies exist
ON DELETE RESTRICT/CASCADE (careful!)
  - Check memberships first
  - Check payments first
  - Archive before delete
```

### Why It Matters
- **No orphaned data**: Every record has valid references
- **Audit trail**: Can track history and changes
- **Reporting accuracy**: Counts and analytics are correct
- **User trust**: Data is preserved and consistent

---

## 6. 🚨 Common Anti-Patterns (DON'T DO THIS)

### ❌ Anti-Pattern 1: Mixing Admin and Devotee Roles
```javascript
// ✗ WRONG
const user = {
  email: 'sarah@example.com',
  role: 'community_admin', // Admin role
  memberships: [communityA, communityB], // But also member!
  subscriptions: [accessA, accessB] // And has subscriptions!
};
// VIOLATION: Cannot be both admin and devotee
```

**Fix**: Create separate accounts for admin and devotee

### ❌ Anti-Pattern 2: Cross-Faith Memberships
```javascript
// ✗ WRONG
const user = {
  community_type: 'judaism',
  memberships: [
    { community: 'Temple Beth Israel', type: 'judaism' }, // OK
    { community: 'St. Mary Cathedral', type: 'christianity' } // VIOLATION!
  ]
};
// VIOLATION: Cannot join communities of different faiths
```

**Fix**: Validate community_type matches user.community_type

### ❌ Anti-Pattern 3: Creating Communities Without Admins
```javascript
// ✗ WRONG
await createCommunity({ name: 'New Temple', type: 'judaism' });
// Missing: community_admins entry!
```

**Fix**: Always create community_admins entry when creating community

### ❌ Anti-Pattern 4: Using Wrong Membership Status
```javascript
// ✗ WRONG
UPDATE community_memberships SET status = 'active';
// Wrong status value!

// ✓ CORRECT
UPDATE community_memberships SET status = 'approved';
```

### ❌ Anti-Pattern 5: Deleting Access Instead of Expiring
```javascript
// ✗ WRONG - Loses payment history
DELETE FROM active_community_access WHERE access_expires_at < NOW();

// ✓ CORRECT - Keep history, check expiry in queries
SELECT * FROM active_community_access
WHERE user_id = ? AND access_expires_at > NOW();
```

### ❌ Anti-Pattern 6: Hardcoded User IDs
```javascript
// ✗ WRONG
const sarahId = 'a0000000-0000-0000-0000-000000000003';

// ✓ CORRECT
const user = await getUserByEmail('sarah@example.com');
const userId = user.id;
```

---

## 7. ✅ Design Checklist

### Before Creating a New Feature

- [ ] Does it respect the Chinese wall (single faith type)?
- [ ] Does it maintain admin/devotee separation?
- [ ] Does it handle Access expiry correctly?
- [ ] Does it validate membership status properly?
- [ ] Does it create required relationships (e.g., admin for community)?
- [ ] Does it handle edge cases (expired access, pending membership)?
- [ ] Does it preserve data (soft delete if needed)?
- [ ] Does it log changes for audit trail?

### Before Approving Code

- [ ] No cross-faith data access
- [ ] No admin users with memberships/subscriptions
- [ ] All communities have admins
- [ ] All subscriptions have corresponding memberships
- [ ] Status values match defined enums
- [ ] No hardcoded IDs or assumptions
- [ ] Cascading deletes are intentional
- [ ] Error messages are helpful

---

## 8. 🔍 Validation Queries

### Check Chinese Wall Violations
```sql
-- Find users with cross-faith memberships
SELECT
  u.email,
  u.community_type,
  c.name,
  c.community_type
FROM community_memberships cm
JOIN users u ON u.id = cm.user_id
JOIN communities c ON c.id = cm.community_id
WHERE u.community_type != c.community_type;
-- Should return 0 rows
```

### Check Role Separation Violations
```sql
-- Find admins with devotee activity
SELECT
  u.email,
  u.role,
  COUNT(DISTINCT cm.id) as memberships,
  COUNT(DISTINCT aca.id) as subscriptions
FROM users u
LEFT JOIN community_memberships cm ON cm.user_id = u.id
LEFT JOIN active_community_access aca ON aca.user_id = u.id AND aca.access_expires_at > NOW()
WHERE u.role = 'community_admin'
GROUP BY u.id, u.email, u.role
HAVING COUNT(DISTINCT cm.id) > 0 OR COUNT(DISTINCT aca.id) > 0;
-- Should return 0 rows
```

### Check Communities Without Admins
```sql
-- Find communities missing admin entries
SELECT c.id, c.name, c.community_type
FROM communities c
LEFT JOIN community_admins ca ON ca.community_id = c.id
WHERE ca.id IS NULL;
-- Should return 0 rows
```

### Check Invalid Membership Status
```sql
-- Find memberships with wrong status values
SELECT *
FROM community_memberships
WHERE status NOT IN ('pending', 'approved');
-- Should return 0 rows
```

---

## 9. 📖 Quick Reference

### DO's ✅
- ✅ Keep admin and devotee roles separate
- ✅ Enforce Chinese wall (single faith type per user)
- ✅ Always create community_admins when creating communities
- ✅ Use 'pending' and 'approved' for membership status
- ✅ Keep expired subscriptions for history (check expiry in queries)
- ✅ Validate all user inputs and relationships
- ✅ Log significant changes for audit

### DON'Ts ❌
- ❌ Never mix admin and devotee roles for same user
- ❌ Never allow cross-faith memberships
- ❌ Never create communities without admins
- ❌ Never use 'active' as membership status (use 'approved')
- ❌ Never delete payment/subscription history
- ❌ Never hardcode user IDs or make assumptions
- ❌ Never skip validation checks

---

## 10. 🎓 Learning from Past Mistakes

### Mistake 1: Sarah as Both Admin and Devotee
**What happened**: Sarah was set as community_admin for Congregation Shalom while also being a regular devotee user with memberships.

**Why it was wrong**: Violated role separation principle - admins manage, devotees participate, never both.

**Fix applied**: Created dedicated admin (Rabbi David Goldstein), kept Sarah as devotee only.

**Prevention**: Added validation to check for existing devotee activity before upgrading to admin role.

### Mistake 2: Missing Community Admin Entry
**What happened**: Congregation Shalom was created without a community_admins entry.

**Why it was wrong**: Every community must have an admin for management and contact.

**Fix applied**: Created admin entry with proper user linkage.

**Prevention**: Updated code to always create admin entry with community, added `ON CONFLICT DO UPDATE`.

### Mistake 3: Wrong Membership Status
**What happened**: Used 'active' instead of 'approved' for membership status.

**Why it was wrong**: Status should be 'pending' or 'approved' - 'active' is not a valid state.

**Fix applied**: Updated to 'approved' status.

**Prevention**: Document valid status values, add database constraints if possible.

---

## 📚 Related Documentation

- `ROLE_SEPARATION_PRINCIPLE.md` - Detailed role separation rules
- `PLATFORM_ADMIN_FILTERS.md` - Admin API filtering documentation
- `docker/init.sql` - Database schema with constraints
- `api/src/routes/admin.js` - Platform admin implementation

---

**Version**: 1.0
**Last Updated**: February 14, 2026
**Status**: 🟢 Active - Must be followed for all development

---

> **Remember**: These principles exist to maintain data integrity, user trust, and system reliability. When in doubt, refer to this document or ask for clarification before implementing.
