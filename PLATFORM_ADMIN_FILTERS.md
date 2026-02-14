# Platform Admin API Filters Documentation

This document describes all available filters for the Platform Admin dashboard API endpoints.

## 📊 Admin Endpoints with Filters

### 1. **GET /api/admin/communities**
Get all communities with comprehensive filtering options.

**Available Filters:**
- `status` - Filter by community status (active, pending, suspended)
- `communityType` - Filter by religion (judaism, christianity, islam, hinduism)
- `search` - Search by community name or country (case-insensitive, partial match)
- `adminEmail` - Filter by community admin email (case-insensitive, partial match)
- `startDate` - Filter communities created on or after this date (YYYY-MM-DD)
- `endDate` - Filter communities created before this date (YYYY-MM-DD)

**Example Requests:**
```
GET /api/admin/communities?search=temple
GET /api/admin/communities?status=active&communityType=judaism
GET /api/admin/communities?adminEmail=rabbi@temple.com
GET /api/admin/communities?startDate=2026-01-01&endDate=2026-02-28
```

**Response Fields:**
- id, name, communityType, country, status
- inviteLink, adminName, adminEmail, adminRole
- memberCount, subscriberCount, createdAt

---

### 2. **GET /api/admin/users**
Get all users with advanced filtering.

**Available Filters:**
- `role` - Filter by user role (user, community_admin)
- `communityType` - Filter by assigned community type (judaism, christianity, islam, hinduism)
- `search` - Search by user name or email (case-insensitive, partial match)
- `email` - Filter by email address (case-insensitive, partial match)
- `startDate` - Filter users created on or after this date (YYYY-MM-DD)
- `endDate` - Filter users created before this date (YYYY-MM-DD)

**Example Requests:**
```
GET /api/admin/users?search=sarah
GET /api/admin/users?role=community_admin
GET /api/admin/users?email=@example.com
GET /api/admin/users?communityType=judaism&role=user
```

**Response Fields:**
- id, email, name, role, communityType
- communityCount, activeAccessCount, createdAt

**Note:** Limited to 500 results, sorted by creation date (newest first)

---

### 3. **GET /api/admin/payments**
Get payment history with extensive search and filter options.

**Available Filters:**
- `communityId` - Filter by specific community ID
- `status` - Filter by payment status (pending, completed, failed, refunded)
- `search` - Search by user name, user email, or community name (case-insensitive, partial match)
- `userEmail` - Filter by user email (case-insensitive, partial match)
- `communityName` - Filter by community name (case-insensitive, partial match)
- `minAmount` - Minimum payment amount (numeric)
- `maxAmount` - Maximum payment amount (numeric)
- `startDate` - Filter payments on or after this date (YYYY-MM-DD)
- `endDate` - Filter payments before this date (YYYY-MM-DD)

**Example Requests:**
```
GET /api/admin/payments?search=sarah
GET /api/admin/payments?minAmount=50&maxAmount=200
GET /api/admin/payments?communityName=temple&status=completed
GET /api/admin/payments?userEmail=sarah@example.com
GET /api/admin/payments?startDate=2026-02-01&endDate=2026-02-28
```

**Response Fields:**
- id, userId, userName, userEmail
- communityId, communityName
- amount, currency, status
- daysGranted, platformFee, platformFeePercent
- pspTransactionId, createdAt

**Note:** Limited to 500 results, sorted by creation date (newest first)

---

### 4. **GET /api/admin/waiting-list**
Get waiting list entries with filtering.

**Available Filters:**
- `status` - Filter by status (pending, rejected) - excludes 'approved' by default
- `communityType` - Filter by religion (judaism, christianity, islam, hinduism)
- `search` - Search by email or recommended institution (case-insensitive, partial match)
- `email` - Filter by email address (case-insensitive, partial match)
- `startDate` - Filter entries created on or after this date (YYYY-MM-DD)
- `endDate` - Filter entries created before this date (YYYY-MM-DD)

**Example Requests:**
```
GET /api/admin/waiting-list?search=church
GET /api/admin/waiting-list?status=pending&communityType=christianity
GET /api/admin/waiting-list?email=applicant@example.com
GET /api/admin/waiting-list?startDate=2026-02-01
```

**Response Fields:**
- id, email, recommendedInstitution
- communityType, status, createdAt

---

## 🔧 Bug Fixes Implemented

### Community Admin Missing (Congregation Shalom)
**Issue:** New communities could be created without community admin entries.

**Fix Applied:**
1. ✅ Added Sarah Miller as community admin for Congregation Shalom
2. ✅ Updated waiting list approval process to always create community admin entry
3. ✅ Added fallback: If user doesn't exist, creates placeholder admin with email

**Prevention:** The system now ensures every community has admin information by:
- Using `ON CONFLICT DO UPDATE` instead of `DO NOTHING` for community_admins
- Creating placeholder admin entries even when user doesn't exist
- Auto-linking registered users as admins during waiting list approval

---

## 📝 Usage Tips

### Combining Filters
All filters can be combined for precise searches:
```
GET /api/admin/payments?
  communityName=temple&
  minAmount=100&
  status=completed&
  startDate=2026-01-01&
  endDate=2026-12-31
```

### Search vs Specific Filters
- Use `search` for general queries across multiple fields
- Use specific filters (`email`, `communityName`, etc.) for exact matches
- Combine both for powerful filtering

### Date Ranges
- `startDate` is inclusive (>=)
- `endDate` is exclusive (<)
- Use both together to create precise date ranges

### Case Sensitivity
All text searches are **case-insensitive** for better usability.

---

## 🔒 Security Notes

All admin endpoints require:
1. Valid authentication token (`Authorization: Bearer <token>`)
2. User role must be `platform_admin`
3. Unauthorized access returns `403 Forbidden`

---

**Last Updated:** February 14, 2026
