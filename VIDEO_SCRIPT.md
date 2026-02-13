# D.A.K MVP - Video Narration Script

**Duration:** ~5 minutes  
**Style:** Professional, clear, feature-focused

---

## INTRO (0:00 - 0:30)

> "Welcome to D.A.K — Digital Access Key — a faith-community platform designed with privacy-first principles and controlled onboarding.
> 
> This MVP demonstrates the core functionality: communities, memberships, payments, and content access — all built with an Apple-like, calm user experience."

---

## SLIDE 2: CORE PRINCIPLES (0:30 - 1:00)

> "D.A.K is built on six core principles:
> 
> **Community-First** — We don't frame this as donations. Support is about belonging to a community.
> 
> **Privacy by Design** — This is faith-sensitive. No donor names are ever exposed.
> 
> **Controlled Funnel** — Users can only join via QR code or direct invite link. No open signup.
> 
> **Apple-like UX** — Calm, minimal, no pressure. Clean design that lets content breathe.
> 
> **PSP-First** — Payments go through Stripe or Adyen for compliance and security.
> 
> **Multi-Community** — Users can belong to multiple communities across different faith traditions."

---

## SLIDE 3: ARCHITECTURE (1:00 - 1:30)

> "The system is built as three separate portals:
> 
> **Platform Admin on port 3001** — Where the platform operator approves communities, views stats, and manages users.
> 
> **Institute Portal on port 3002** — Where community administrators manage their streams, events, and messages.
> 
> **User Dashboard on port 3003** — Where members view their communities and access content.
> 
> Under the hood, we're running PostgreSQL, Node.js with Express, React with Vite, all orchestrated with Docker Compose."

---

## SLIDE 4: USER ONBOARDING (1:30 - 2:00)

> "Let's walk through user onboarding.
> 
> A user scans a QR code or clicks an invite link. They create an account with email and password. They're automatically subscribed to that community. And they land on the community home page.
> 
> The key message they see: 'You're joining Jewish communities on D.A.K' — or whatever community type they're joining. This keeps the experience focused and intentional."

---

## SLIDE 5: WAITING LIST (2:00 - 2:20)

> "What about users without a QR code?
> 
> They see a waiting list form where they can enter their name, email, and — critically — the institution they want to join. This is required.
> 
> When that institution joins D.A.K, we notify the waiting users. No open signup. Ever."

---

## SLIDE 6: ENTITLEMENTS (2:20 - 2:50)

> "Access is controlled through entitlements.
> 
> **Subscribers** are free. They can watch streams and see limited info, but premium features are gated.
> 
> **Contributors** — anyone who supports the community — get full access for one month. Events, chat, updates — everything unlocked.
> 
> The gating popup is carefully worded: 'This space is part of the active community. By supporting, you'll be included in updates, events, and conversations for the coming month.' No donation guilt. Just clear value."

---

## SLIDE 7: PAYMENTS (2:50 - 3:20)

> "Payments are handled through a PSP — Payment Service Provider.
> 
> The platform takes a 5% fee. Users can enter any custom amount. Support can be one-time or recurring monthly.
> 
> When a payment completes, the user immediately gets their entitlement. The PSP transaction ID is stored, but no card data touches our servers.
> 
> In this POC, we're using a mock PSP that returns fake transaction IDs. Production will wire up Stripe or Adyen."

---

## SLIDE 8: FEATURES BUILT (3:20 - 3:50)

> "Here's everything implemented in this MVP:
> 
> - QR and link-only registration
> - Waiting list for users without invites
> - Multi-community membership
> - Subscriber versus contributor entitlements
> - Mock payments with 5% platform fee
> - Threaded private messaging between users and admins
> - Events management
> - Stream management with placeholders
> - Community analytics showing aggregated data only
> - And a full platform admin dashboard"

---

## SLIDE 9: ADMIN PORTAL (3:50 - 4:10)

> "The Platform Admin portal shows the dashboard with key stats: total users, active communities, pending approvals, support volume, and platform fees.
> 
> Admins can approve or suspend communities, view all users, check the waiting list, and monitor PSP status.
> 
> Login is admin@dak.com, password admin123."

---

## SLIDE 10-11: PORTALS (4:10 - 4:30)

> "The Institute Portal gives community admins everything they need: stream management to go live, event creation, private messaging with members, and aggregated analytics — subscriber counts, support totals, views. No individual donor information.
> 
> The User Dashboard is intentionally simple. Members see their communities, can watch streams, support with a tap, and access events once they're contributors."

---

## SLIDE 12: TEST RESULTS (4:30 - 4:50)

> "We ran 20 automated tests covering API health, authentication, admin functions, user functions, and security.
> 
> All 20 passed. 100% success rate. All five services are running and healthy."

---

## SLIDE 13-14: NEXT STEPS & CLOSE (4:50 - 5:00)

> "For production, we'll add OAuth with Google and Apple, integrate real Stripe payments, add actual streaming, and generate real QR codes.
> 
> But the core is ready. D.A.K MVP — ready for review.
> 
> Thank you."

---

## RECORDING INSTRUCTIONS

1. **Open the presentation:**
   ```
   Open in browser: file:///mnt/c/Projects/DAK/DEMO_PRESENTATION.html
   Or: C:\Projects\DAK\DEMO_PRESENTATION.html
   ```

2. **Use keyboard navigation:**
   - `→` or `Space` = Next slide
   - `←` = Previous slide

3. **Screen record at 1080p or higher**

4. **On slides 9 and 11**, the actual portals are embedded — you can interact with them live

5. **Optional:** Open portals in separate tabs to show real functionality:
   - http://localhost:3001 (Admin)
   - http://localhost:3002 (Institute)  
   - http://localhost:3003 (User)

---

## PORTAL DEMO FLOW (if showing live)

### Admin Portal Demo
1. Login with admin@dak.com / admin123
2. Show dashboard stats
3. Go to Communities → Show pending "Islamic Center"
4. Click Approve → Show it move to Active
5. Show Waiting List entries

### User Portal Demo
1. Go to http://localhost:3003/join/temple-beth-israel
2. Register a new account
3. Show auto-subscription to community
4. Click Support → Enter $25 → Complete
5. Show entitlement granted message

---

*Total runtime: approximately 5 minutes*
