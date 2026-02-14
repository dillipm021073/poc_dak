# D.A.K Documentation Index

## 📚 Documentation Overview

This index helps you find the right documentation for your needs.

---

## 🎯 Quick Navigation

### For New Developers (Start Here)
1. **READ FIRST**: `ARCHITECTURE_PRINCIPLES.md`
2. **BEFORE CODING**: `DEVELOPER_CHECKLIST.md`
3. **WHEN WORKING ON ROLES**: `ROLE_SEPARATION_PRINCIPLE.md`

### For Platform Admins
- `PLATFORM_ADMIN_FILTERS.md` - API filtering guide

### For Database Work
- `docker/init.sql` - Database schema
- `ARCHITECTURE_PRINCIPLES.md` - Section 5 (Data Integrity)

---

## 📖 Documentation Files

### 1. ARCHITECTURE_PRINCIPLES.md
**Purpose**: Core system architecture rules and principles

**Read This When**:
- Starting work on D.A.K platform
- Implementing new features
- Making architectural decisions
- Not sure if something violates a principle

**Contents**:
- Chinese Wall Principle (faith type isolation)
- Role Separation (admin vs devotee)
- Access Control & Subscription Model
- Membership Status Workflow
- Data Integrity Rules
- Common Anti-Patterns
- Validation Queries
- Past Mistakes & Lessons Learned

**Key Sections**:
- ✅ Section 1: Chinese Wall - ONE faith type per user
- ✅ Section 2: Role Separation - Admins ≠ Devotees
- ✅ Section 3: Access Control - Subscription model
- ✅ Section 6: Anti-Patterns - What NOT to do
- ✅ Section 8: Validation Queries - Check your work

---

### 2. DEVELOPER_CHECKLIST.md
**Purpose**: Quick reference checklist for developers

**Read This When**:
- Before committing code
- Implementing user/role features
- Adding membership functionality
- Creating communities
- Granting access/subscriptions

**Contents**:
- Pre-commit checklist
- Quick validation queries
- Common mistakes to avoid
- Code templates (copy-paste ready)
- Testing scenarios

**Key Features**:
- ✅ Copy-paste code templates
- ✅ Quick validation SQL queries
- ✅ Common mistake examples
- ✅ Before/after code comparisons

---

### 3. ROLE_SEPARATION_PRINCIPLE.md
**Purpose**: Detailed explanation of admin vs devotee separation

**Read This When**:
- Working with user roles
- Creating admin accounts
- Upgrading users to admins
- Managing community admins
- Confused about permissions

**Contents**:
- Admin vs Devotee definitions
- Why separation matters
- Correct implementation examples
- Incorrect implementation examples
- System safeguards
- Verification queries

**Key Concepts**:
- ✅ community_admin: Manages communities
- ✅ user: Participates in communities
- ✅ These roles NEVER overlap
- ✅ Separate accounts for separate roles

---

### 4. PLATFORM_ADMIN_FILTERS.md
**Purpose**: Platform admin API filtering documentation

**Read This When**:
- Building admin dashboards
- Implementing search/filter features
- Working with platform admin APIs
- Need to query communities/users/payments

**Contents**:
- All available API filters
- Example requests
- Response field descriptions
- Filter combination tips

**Endpoints Covered**:
- ✅ GET /api/admin/communities
- ✅ GET /api/admin/users
- ✅ GET /api/admin/payments
- ✅ GET /api/admin/waiting-list

---

## 🎓 Learning Paths

### Path 1: New Developer Onboarding
```
Day 1: Read ARCHITECTURE_PRINCIPLES.md (1-2 hours)
       Understand Chinese Wall & Role Separation

Day 2: Read DEVELOPER_CHECKLIST.md (30 min)
       Run validation queries on database
       Examine code templates

Day 3: Read ROLE_SEPARATION_PRINCIPLE.md (30 min)
       Review real examples in codebase
       Practice creating users/communities correctly

Ready to code!
```

### Path 2: Quick Reference (Experienced Developer)
```
Before coding: Scan DEVELOPER_CHECKLIST.md
During coding: Reference code templates
Before commit: Run validation queries
After commit: Verify no principle violations
```

### Path 3: Debugging Issues
```
Issue found → Check which principle violated
            → Read relevant section in ARCHITECTURE_PRINCIPLES.md
            → Check anti-patterns (Section 6)
            → Review past mistakes (Section 10)
            → Fix using code templates from DEVELOPER_CHECKLIST.md
```

---

## 🔍 Quick Lookup

### "How do I...?"

| Question | Document | Section |
|----------|----------|---------|
| Create a community correctly? | DEVELOPER_CHECKLIST.md | Code Templates |
| Check if my code violates principles? | DEVELOPER_CHECKLIST.md | Pre-Commit Checklist |
| Understand Chinese Wall? | ARCHITECTURE_PRINCIPLES.md | Section 1 |
| Understand role separation? | ROLE_SEPARATION_PRINCIPLE.md | Full document |
| Grant access to a user? | DEVELOPER_CHECKLIST.md | Code Templates |
| Validate data integrity? | ARCHITECTURE_PRINCIPLES.md | Section 8 |
| Filter admin data? | PLATFORM_ADMIN_FILTERS.md | Full document |
| Avoid common mistakes? | ARCHITECTURE_PRINCIPLES.md | Section 6 |
| See what went wrong before? | ARCHITECTURE_PRINCIPLES.md | Section 10 |

---

## ⚠️ Critical Rules (Must Know)

### Rule 1: Chinese Wall
**One user = One faith type (forever)**
```
✓ User with judaism → Can join Jewish communities
✗ User with judaism → Cannot join Christian communities
```
📖 Details: `ARCHITECTURE_PRINCIPLES.md` Section 1

### Rule 2: Role Separation
**Admins manage, devotees participate (never both)**
```
✓ Admin user → Manages community, no memberships
✓ Devotee user → Has memberships, not admin
✗ Same user → Both admin AND has memberships
```
📖 Details: `ROLE_SEPARATION_PRINCIPLE.md`

### Rule 3: Community Integrity
**Every community must have an admin**
```
✓ Create community → Create admin entry (same transaction)
✗ Create community → Forget admin entry
```
📖 Details: `ARCHITECTURE_PRINCIPLES.md` Section 4

### Rule 4: Membership Status
**Only 'pending' or 'approved' are valid**
```
✓ status = 'pending' or status = 'approved'
✗ status = 'active' (wrong value!)
```
📖 Details: `ARCHITECTURE_PRINCIPLES.md` Section 4

### Rule 5: Access History
**Never delete subscriptions, filter by expiry**
```
✓ WHERE access_expires_at > NOW() (filter expired)
✗ DELETE WHERE access_expires_at < NOW() (loses history)
```
📖 Details: `ARCHITECTURE_PRINCIPLES.md` Section 3

---

## 🛠️ Development Workflow

### Standard Feature Implementation

```
1. Read Requirements
   ↓
2. Check ARCHITECTURE_PRINCIPLES.md
   - Which principles apply?
   - Any constraints to consider?
   ↓
3. Design Solution
   - Does it respect Chinese Wall?
   - Does it maintain role separation?
   - Does it preserve data integrity?
   ↓
4. Code Implementation
   - Use templates from DEVELOPER_CHECKLIST.md
   - Follow code patterns
   ↓
5. Pre-Commit Validation
   - Run checklist from DEVELOPER_CHECKLIST.md
   - Run validation queries
   - Test scenarios
   ↓
6. Code Review
   - Reviewer checks principles compliance
   - Validates data integrity
   ↓
7. Commit & Deploy
   ✓ Principles maintained
```

---

## 🚨 Violation Response

### If You Find a Principle Violation

1. **Stop** - Don't make it worse
2. **Identify** - Which principle was violated?
3. **Read** - Review the relevant documentation
4. **Fix** - Follow the documented solution
5. **Validate** - Run validation queries
6. **Document** - Add to "Past Mistakes" if significant

### Example Violation Response

```
Found: User is both admin and devotee
      ↓
Read: ROLE_SEPARATION_PRINCIPLE.md
      ↓
Understand: Admins and devotees must be separate
      ↓
Fix: Create separate admin account
     Keep original user as devotee only
      ↓
Validate: Run role separation validation query
      ↓
Document: Added to lessons learned
```

---

## 📊 Documentation Maintenance

### When to Update Docs

- ✏️ New principle identified → Add to ARCHITECTURE_PRINCIPLES.md
- ✏️ Common mistake found → Add to anti-patterns
- ✏️ New API endpoint → Update PLATFORM_ADMIN_FILTERS.md
- ✏️ Better code pattern → Add template to DEVELOPER_CHECKLIST.md
- ✏️ Major violation fixed → Add to "Past Mistakes"

### Documentation Version Control

All documentation files are in git:
- Track changes like code
- Review documentation updates
- Keep docs in sync with code

---

## 💡 Best Practices

### Do's ✅
- ✅ Read principles before implementing new features
- ✅ Use checklists before committing
- ✅ Run validation queries regularly
- ✅ Reference code templates
- ✅ Ask questions when unsure

### Don'ts ❌
- ❌ Code first, read principles later
- ❌ Skip validation queries
- ❌ Assume you know the rules
- ❌ Ignore documentation updates
- ❌ Violate principles "just this once"

---

## 🆘 Getting Help

### Stuck on a Principle?

1. Read the full section in ARCHITECTURE_PRINCIPLES.md
2. Check examples in ROLE_SEPARATION_PRINCIPLE.md
3. Look at code templates in DEVELOPER_CHECKLIST.md
4. Ask team lead or senior developer
5. If still unclear, schedule architecture review

### Reporting Issues

Found a problem with documentation?
- Open issue describing the confusion
- Suggest improvement
- Help keep docs accurate and helpful

---

## 📅 Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-14 | 1.0 | Initial documentation set created |
|  |  | - ARCHITECTURE_PRINCIPLES.md |
|  |  | - DEVELOPER_CHECKLIST.md |
|  |  | - ROLE_SEPARATION_PRINCIPLE.md |
|  |  | - PLATFORM_ADMIN_FILTERS.md |
|  |  | - DOCUMENTATION_INDEX.md |

---

## 🎯 Success Metrics

### Documentation is Working When:
- ✅ New developers understand principles in < 1 day
- ✅ Zero principle violations in code reviews
- ✅ All validation queries return 0 violations
- ✅ Developers reference docs before asking questions
- ✅ Code follows documented patterns consistently

---

**Remember**:
> Documentation is not just for reference - it's your guide to maintaining system integrity. Read it, follow it, update it.

---

**Maintained By**: Development Team
**Last Updated**: February 14, 2026
**Status**: 🟢 Active & Required Reading
