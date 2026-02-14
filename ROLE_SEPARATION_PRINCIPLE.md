# D.A.K Role Separation Principle

## 🎯 Core Principle: Admin vs Devotee Separation

**Important:** In the D.A.K system, there is a strict separation between community administrators and regular devotee users.

### Role Definitions

#### Community Admin (`community_admin`)
- **Purpose**: Manages and administrates a community
- **Responsibilities**:
  - Configure community settings
  - Create events and streams
  - Manage members
  - View analytics
- **Restrictions**:
  - ❌ Cannot be a regular devotee/member of communities
  - ❌ Cannot have active access subscriptions as a devotee
  - ❌ Cannot participate as a regular member

#### Regular User / Devotee (`user`)
- **Purpose**: Participates in community activities
- **Capabilities**:
  - Join multiple communities (within same faith type)
  - Subscribe for active access
  - Attend events and streams
  - Engage in discussions
- **Restrictions**:
  - ❌ Cannot manage communities
  - ❌ Cannot create events or streams
  - ✅ Can only join communities of their assigned faith type (Chinese wall)

---

## 🚫 Why Role Separation Matters

### Data Integrity
- Prevents conflicting permissions and access patterns
- Maintains clear audit trails (who did what)
- Separates management actions from user activities

### Business Logic
- **Admins manage** - they run the community infrastructure
- **Devotees participate** - they engage in spiritual activities
- These are fundamentally different use cases

### Analytics & Reporting
- Clear distinction between admin actions and user engagement
- Accurate member counts (don't include admins as members)
- Proper revenue attribution (admin vs user payments)

---

## ✅ Correct Implementation

### Example 1: Temple Beth Israel
```
Community: Temple Beth Israel (Judaism)
Admin: Rabbi David Cohen (rabbi@temple.com)
  - Role: community_admin
  - Manages the community
  - NOT a member/devotee

Regular User: Sarah Miller (sarah@example.com)
  - Role: user
  - Member of Temple Beth Israel
  - Has active access subscription
  - Participates in community activities
```

### Example 2: Congregation Shalom
```
Community: Congregation Shalom (Judaism)
Admin: Rabbi David Goldstein (rabbi.goldstein@congregation-shalom.org)
  - Role: community_admin
  - Manages the community
  - NOT a member/devotee

Regular User: Sarah Miller (sarah@example.com)
  - Role: user
  - Member of Congregation Shalom
  - Has active access subscription
  - Participates in community activities
```

---

## ❌ Incorrect Implementation (Avoided)

### Anti-Pattern: Dual Role
```
❌ WRONG:
User: Sarah Miller (sarah@example.com)
  - Role: community_admin (for Congregation Shalom)
  - Role: user (for Temple Beth Israel)
  - Has memberships and subscriptions

This violates role separation!
```

**Why it's wrong:**
- Sarah cannot be both an admin (manager) and a devotee (participant)
- Creates confusion about permissions and access
- Breaks the separation of concerns principle
- Leads to inconsistent data (0 members but 1 subscriber)

---

## 🛡️ System Safeguards

### Automated Validation (Added)

The system now includes checks to prevent role mixing:

```javascript
// When approving waiting list entries:
1. Check if applicant email already exists as a user
2. Check if that user has existing devotee activity:
   - Community memberships
   - Active access subscriptions
3. If YES: Don't upgrade to admin
   - Create placeholder admin entry
   - Alert platform admin to create separate admin account
4. If NO: Safe to upgrade to community_admin
```

### Warning Messages

Platform admins will see warnings like:
```
⚠️ Approved and created community "Congregation Shalom".
Note: sarah@example.com is already an active devotee user.
Please create a separate admin account for this community.
```

---

## 📋 Best Practices

### Creating New Communities

1. **New Admin Account**: Always create a dedicated admin account
   - Use institutional email (rabbi@temple.com)
   - Separate from personal devotee accounts
   - Set role to `community_admin`

2. **Separate Identities**: If same person needs both roles
   - Admin account: rabbi@temple.com (manages community)
   - Personal account: rabbi.personal@gmail.com (participates as devotee)

3. **Check Before Approval**: Platform admins should verify
   - Is the applicant email already in the system?
   - Do they have existing memberships/subscriptions?
   - If yes, create a new dedicated admin account

### Data Consistency

```sql
-- Admins should NOT appear in these tables as regular users:
- community_memberships (as members)
- active_community_access (as subscribers)

-- Admins ONLY appear in:
- users (with role = 'community_admin')
- community_admins (linked to their community)
```

---

## 🔍 Verification Queries

### Check Role Separation Compliance

```sql
-- Find users who are both admins and have devotee activity (violations)
SELECT
  u.email,
  u.role,
  (SELECT COUNT(*) FROM community_memberships WHERE user_id = u.id) as memberships,
  (SELECT COUNT(*) FROM active_community_access WHERE user_id = u.id) as accesses
FROM users u
WHERE u.role = 'community_admin'
  AND (
    (SELECT COUNT(*) FROM community_memberships WHERE user_id = u.id) > 0
    OR (SELECT COUNT(*) FROM active_community_access WHERE user_id = u.id) > 0
  );

-- Should return 0 rows for proper separation
```

### Verify Community Admin Structure

```sql
-- All communities should have dedicated admin accounts
SELECT
  c.name,
  ca.admin_email,
  u.role,
  CASE
    WHEN u.role = 'community_admin' THEN '✓ Correct'
    ELSE '✗ Issue - Admin should have community_admin role'
  END as status
FROM communities c
LEFT JOIN community_admins ca ON ca.community_id = c.id
LEFT JOIN users u ON u.id = ca.user_id;
```

---

## 📝 Summary

**Golden Rule:**
> Community admins manage communities.
> Regular devotees participate in communities.
> These roles must NEVER overlap.

This separation ensures:
- ✅ Clean data architecture
- ✅ Clear permissions model
- ✅ Accurate analytics
- ✅ Proper business logic
- ✅ Chinese wall integrity (within faith types)

---

**Implemented:** February 14, 2026
**Status:** ✅ Active enforcement with automated validation
