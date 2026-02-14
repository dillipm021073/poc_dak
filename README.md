# D.A.K MVP v3 - Lean MVP Specification

Digital Access Key — A faith-community platform with controlled access, PSP-based payments, and privacy-first design.

## Overview

D.A.K is a community-first, trust-driven platform enabling religious institutions to connect with their members through:
- **Controlled Access**: QR/Invite-only user onboarding
- **Active Community Access**: Time-bound access unlocking participation capabilities
- **Live Streaming**: Up to 2 streams/week with 40% viewer capacity
- **Private Messaging**: User ↔ Admin threaded inbox
- **PSP-Led Payments**: Stripe integration with sliding platform fee

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Docker Compose                          │
├─────────────┬─────────────┬─────────────┬─────────────┬────────┤
│  PostgreSQL │     API     │    Admin    │  Institute  │  User  │
│    :5432    │    :3000    │    :3001    │    :3002    │  :3003 │
└─────────────┴─────────────┴─────────────┴─────────────┴────────┘
```

## Quick Start

```bash
# Start all services
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

## Portals

| Portal | URL | Purpose |
|--------|-----|---------|
| **Admin** | http://localhost:3001 | Platform admin — approve communities, view GMV, manage users |
| **Institute** | http://localhost:3002 | Community admin — manage page, events, streams, messages |
| **User** | http://localhost:3003 | End user — join communities, activate access, view events |

## Default Credentials

### Platform Admin
- Email: `admin@dak.com`
- Password: `admin123`

### Community Admins (Demo)
- Rabbi: `rabbi@temple.com` / `admin123`
- Pastor: `pastor@stmary.com` / `admin123`
- Imam: `imam@islamic.com` / `admin123`
- Pandit: `pandit@temple.com` / `admin123`

### Test Users
- Sarah: `sarah@example.com` / `admin123`
- David: `david@example.com` / `admin123`

## MVP v3 Key Features

### Community Types (Chinese-Wall Isolated)
- Judaism, Christianity, Islam, Hinduism
- Users cannot cross community types
- Feature set identical across all types

### Active Community Access
Time-bound state unlocking:
- Message the institution (user ↔ admin)
- View community calendar
- View upcoming events
- Watch live streams (subject to limits)
- Playback gated recordings

### Payment → Access Duration
| Payment Amount | Access Granted |
|----------------|----------------|
| < $2 | 7 days |
| $2 - $4.99 | 14 days |
| $5 - $9.99 | 30 days |
| $10 - $14.99 | 60 days |
| $15 - $19.99 | 90 days |
| $20+ | 90 days + credit |

- Rolling extension (never resets)
- 90-day cap with credit auto-applied
- Credit balances hidden from users

### Platform Fee (Sliding Scale)
| Monthly Activity | Platform Fee |
|------------------|--------------|
| $0 - $300 | 25% |
| $300 - $600 | 20% |
| $600 - $1,000 | 12% |
| $1,000+ | 7% |

### Streaming Limits
- Maximum 2 live streams per week
- Maximum 60 minutes per stream
- 40% concurrent viewer cap
- 1 recording included (gated behind Active Access)

## API Endpoints

### Auth
- `POST /api/auth/register` — Register via invite link
- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Get current user

### Communities
- `GET /api/communities/invite/:link` — Get community by invite
- `GET /api/communities/my` — User's communities
- `GET /api/communities/:id` — Single community
- `POST /api/communities/join` — Join via invite

### Active Access
- `GET /api/access/status/:communityId` — Access status
- `GET /api/access/my-access` — All access statuses
- `POST /api/access/activate` — Initiate payment
- `GET /api/access/payments/:communityId` — Payment history

### Events
- `GET /api/events/community/:id` — Community events
- `GET /api/events/calendar/my` — Aggregated calendar
- `POST /api/events` — Create event (admin)
- `GET /api/events/:id/ics` — Export ICS

### Streams
- `GET /api/streams/community/:id` — Community streams
- `GET /api/streams/community/:id/live` — Get live stream
- `POST /api/streams` — Create stream (admin)
- `POST /api/streams/:id/start` — Go live
- `POST /api/streams/:id/end` — End stream

### Messages
- `GET /api/messages/threads` — User's threads
- `GET /api/messages/threads/:id` — Thread messages
- `POST /api/messages/start` — Start new thread
- `POST /api/messages/threads/:id/block` — Block user (admin)

### Admin (Platform)
- `GET /api/admin/stats` — Platform stats (GMV, users, etc.)
- `GET /api/admin/communities` — All communities
- `POST /api/admin/communities/:id/approve` — Approve
- `POST /api/admin/communities/:id/suspend` — Suspend
- `GET /api/admin/waiting-list` — Waiting list

### Waiting List (Public)
- `POST /api/waiting-list` — Join waiting list
- `GET /api/waiting-list/community-types` — Get types

## Terminology (Enforced)

**Approved Terms:**
- Community (not Institution externally)
- Community Type (religious vertical)
- Active Community Access (time-bound access)
- Platform Fee (infrastructure usage fee)

**Banned Terms (must not appear):**
- ~~Donation~~
- ~~Donor~~
- ~~Support~~ (as noun for payment)
- ~~Contributor~~
- ~~Fundraising~~
- ~~Entitlement~~

## 📚 Documentation (MUST READ)

**⚠️ Before writing any code, read these documents to understand system principles:**

### Core Principles
1. **[DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)** - Start here! Navigation guide for all documentation
2. **[ARCHITECTURE_PRINCIPLES.md](./ARCHITECTURE_PRINCIPLES.md)** - Core system architecture rules (Chinese Wall, Role Separation, Data Integrity)
3. **[DEVELOPER_CHECKLIST.md](./DEVELOPER_CHECKLIST.md)** - Pre-commit checklist and code templates
4. **[ROLE_SEPARATION_PRINCIPLE.md](./ROLE_SEPARATION_PRINCIPLE.md)** - Admin vs Devotee separation rules

### Admin Reference
5. **[PLATFORM_ADMIN_FILTERS.md](./PLATFORM_ADMIN_FILTERS.md)** - Platform admin API filtering guide

### Critical Rules (Never Violate)
- ✅ **Chinese Wall**: Users belong to ONE faith type only (Judaism, Christianity, Islam, or Hinduism)
- ✅ **Role Separation**: Admins manage communities, devotees participate - NEVER both for same user
- ✅ **Community Integrity**: Every community MUST have a community_admins entry
- ✅ **Membership Status**: Only 'pending' or 'approved' are valid (not 'active')
- ✅ **Access History**: Never delete subscriptions - filter by expiry instead

**📖 New developers**: Read `DOCUMENTATION_INDEX.md` first for guided learning path

---

## Project Structure

```
DAK/
├── docker-compose.yml
├── docker/
│   └── init.sql          # Database schema + seed data
├── api/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── middleware/
│       └── routes/
├── admin/                 # Platform admin portal
├── institute/             # Community admin portal
├── user/                  # End user dashboard
├── shared/                # Shared assets
└── *.md                   # 📚 PRINCIPLE DOCUMENTATION (READ FIRST!)
```

## Success Criteria (MVP)

✅ Institutes onboard  
✅ Communities stream  
✅ Users activate access  
✅ Revenue flows compliantly  
✅ Costs remain controlled  

---

**D.A.K MVP v3** — Lean MVP Specification v1.4 FINAL
