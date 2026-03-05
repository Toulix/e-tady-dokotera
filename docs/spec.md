Healthcare Booking Platform - Technical Specification

## Madagascar Medical Appointment System

**Version:** 1.3 (Third Architect Review)

**Date:** March 2026

**Target Market:** Madagascar

> ⚠️ **Review Note (v1.3):** Third architect review. Corrections applied: (1) §3.1.3 concurrency section corrected — `SELECT FOR UPDATE` replaced with `INSERT ... ON CONFLICT DO NOTHING` (the roadmap's v1.1 fix was never reflected back in the spec); (2) §5.1 User and Facility entities corrected from `TIMESTAMP` to `TIMESTAMPTZ`; (3) §2.3 `payments` schema added to schema list; (4) §2.3 AWS instance type replaced with DigitalOcean equivalent; (5) §2.6 cost total corrected from ~$210–350 to ~$435–$1,035 (now consistent with §16.2); (6) §2.1 SMS provider "Yas" reverted to "Telma" (unexplained rename); (7) §8.1 Telma/Airtel providers marked as Phase 2 deferral; (8) §8.3 Google Calendar marked as Phase 2; (9) §3.2.4 EHR Lite marked as Phase 2; (10) §10.4 USSD roadmap entry confirmed added; (11) §13.2 Grafana Alloy named as the metrics/log collection agent.
>

> ⚠️ **Review Note (v1.2):** This document has been reviewed a second time to address cross-document inconsistencies with the Technical Roadmap. Three targeted corrections were made: (1) refresh token delivery mechanism clarified to mandate `Set-Cookie` header (never response body), (2) Prisma's incompatibility with native PostGIS `GEOMETRY` types documented with the required `Unsupported()` workaround, (3) WebSocket packages added to the technology stack. All other v1.1 content is retained unchanged.
> 

> ⚠️ **Review Note (v1.1):** This document has been reviewed and revised by a senior software architect. Changes are documented inline. Struck-through content has been removed; annotations explain each decision. The overall direction of v1.0 is sound — the key corrections are internal consistency fixes, a data model redesign for Availability, and removal of infrastructure contradictions.
> 

---

## 1. Executive Summary

### 1.1 Project Overview

A comprehensive healthcare appointment booking platform designed for the Madagascar market, enabling patients to find healthcare professionals, book appointments, and access online consultations. Healthcare providers gain tools for schedule management, patient communication, and telemedicine capabilities.

### 1.2 Key Objectives

- Improve healthcare accessibility across Madagascar's diverse geography
- Streamline appointment booking and reduce no-shows through SMS reminders
- Provide healthcare professionals with efficient practice management tools
- Enable remote consultations for underserved regions
- Support both urban and rural connectivity constraints

### 1.3 Target Users

- **Patients:** Urban and rural populations seeking medical care
- **Healthcare Professionals:** Doctors, specialists, dentists, nurses, physiotherapists
- **Medical Facilities:** Clinics, hospitals, diagnostic centers
- **Administrators:** Platform operators and support staff

---

## 2. System Architecture

### 2.0 Architectural Decision Record (ADR-001)

> **Decision:** Modular Monolith (revised from initial Microservices proposal)
> 

> **Status:** Accepted
> 

> **Date:** February 2026
> 

#### Context

The initial specification proposed a microservices architecture. After review, this was revised in favour of a **Modular Monolith** for the MVP and early-growth phases. This ADR documents the rationale.

#### Why NOT Microservices at this stage

**1. Team size mismatch** — Microservices require dedicated DevOps expertise per service, a service mesh, distributed tracing, and orchestration (Kubernetes). With a team of 7–8 people including a single DevOps engineer, this operational burden is disproportionate and will slow delivery.

**2. Cost is 3–4× higher for MVP** — Each microservice requires its own container, database, and load balancer. The microservices estimate was $2,000–5,000/month. A modular monolith runs at $300–500/month — a saving of $10,000–27,000 over the first 6 months. This is significant for a Madagascar market startup.

**3. Development velocity loss** — Cross-cutting features (e.g. "book for a family member") touch User, Appointment, and Notification concerns simultaneously. In microservices, this means coordinated multi-service deployments and API versioning. In a modular monolith, it is one deployment.

**4. Network reliability in Madagascar** — Microservices communicate over the network. In a country with variable connectivity, every inter-service HTTP call is a potential failure point and adds latency. In-process module calls have none of these issues.

**5. You don't have microservices problems yet** — Microservices solve problems that emerge at scale: independent team deployments, per-service scaling, polyglot persistence. None of these apply at 0 users. You are optimising for a problem you don't have.

#### Why Modular Monolith

- Single deployable unit — simple CI/CD, easy rollback
- In-process module calls — no network overhead, lower latency
- One PostgreSQL database — simpler transactions, no distributed saga patterns
- Clear module boundaries enforced by code — same separation of concerns, none of the operational complexity
- Proven migration path — extract microservices surgically when a specific bottleneck justifies it

#### Migration Triggers (when to extract a microservice)

Only extract when you hit a real, measured threshold:

| Trigger | Threshold | First candidate to extract |
| --- | --- | --- |
| Multiple teams working in parallel | 3+ teams | Notification Service |
| Specific service CPU/memory bottleneck | Sustained >80% | Video Consultation Service |
| Monthly appointments | >50,000/month | Search & Discovery Service |
| Deployment frequency conflict | >5 deploys/day blocked | Doctor Scheduling Module |

---

### 2.1 High-Level Architecture

**Architecture Pattern:** Modular Monolith → selective Microservices (only when justified by a measured trigger)

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                         │
│   PWA (React)        Mobile App (React Native)          │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS / WSS
┌───────────────────────▼─────────────────────────────────┐
│              REVERSE PROXY / CDN                        │
│         Nginx + Cloudflare (WAF, DDoS, CDN)             │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│           MODULAR MONOLITH APPLICATION                  │
│  ┌─────────────────────────────────────────────────┐   │
│  │               API Layer (REST)                  │   │
│  │  Auth Middleware │ Rate Limiting │ Validation    │   │
│  └──────────┬──────────────────────────────────────┘   │
│  ┌──────────▼──────────────────────────────────────┐   │
│  │             Application Modules                 │   │
│  │  Auth/Users  │  Doctor Management               │   │
│  │  Appointments │  Scheduling/Calendar            │   │
│  │  Notifications │  Video Consultation            │   │
│  │  Payments (Ph2) │  Analytics                   │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Shared Kernel                      │   │
│  │  Domain Events │ Auth │ Config │ Error handling  │   │
│  └─────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                   DATA LAYER                            │
│  PostgreSQL 16+          Redis 7+                       │
│  (schema-per-module)     (cache, sessions, job queues)  │
│  Object Storage (S3/DO)  Full-Text Search               │
│  (files, recordings)     (pg_trgm — Elasticsearch only  │
│                           when >100k doctors)           │
└─────────────────────────────────────────────────────────┘
```

> 🔧 **Architect note:** PostgreSQL version bumped to 16+ (released 2023, LTS support, improved query planner and logical replication). No material change to the design.
> 

**External Services (always decoupled via adapters):**

- SMS: Orange Madagascar / Telma / Airtel → Africa's Talking or Twilio fallback
- Video: Jitsi Meet (self-hosted) or [Daily.co](http://Daily.co) as managed fallback
- Maps: OpenStreetMap (Nominatim) primary; Google Maps if budget allows
- Email: Amazon SES (cost-effective) or SendGrid
- Payments (Phase 2): Orange Money, MVola, Airtel Money

> 🔧 **Architect note:** OpenStreetMap promoted to primary for maps — Google Maps API costs accumulate fast and OSM coverage of Madagascar is adequate for geocoding and distance search. Google Maps remains an option if the product team judges the UX difference worth the cost.
> 

### 2.2 Module Structure & Boundaries

**Source code layout (NestJS):**

```
src/
├── modules/
│   ├── auth/
│   │   ├── domain/          # User entity, value objects
│   │   ├── application/     # Use cases: RegisterUser, Login, VerifyOTP
│   │   ├── infrastructure/  # JWT, OTP provider, password hashing
│   │   └── api/             # REST controllers, DTOs
│   │
│   ├── doctors/
│   │   ├── domain/          # Doctor entity, Specialty, DoctorFacility
│   │   ├── application/     # SearchDoctors, UpdateProfile, ManageSchedule
│   │   ├── infrastructure/  # DB queries, search adapter (pg_trgm)
│   │   └── api/
│   │
│   ├── appointments/
│   │   ├── domain/          # Appointment entity, booking rules, slot locking
│   │   ├── application/     # BookAppointment, Cancel, Reschedule
│   │   ├── infrastructure/  # DB, atomic slot locking via INSERT ON CONFLICT DO NOTHING
│   │   └── api/
│   │
│   ├── scheduling/
│   │   ├── domain/          # WeeklyTemplate, ScheduleException, Slot
│   │   ├── application/     # SetWeeklyTemplate, AddException, GetAvailableSlots
│   │   ├── infrastructure/
│   │   └── api/
│   │
│   ├── notifications/
│   │   ├── domain/          # Notification, ReminderSchedule
│   │   ├── application/     # SendSMS, SendEmail, ScheduleReminders
│   │   ├── infrastructure/  # SMS gateway adapters, email adapter
│   │   └── api/
│   │
│   ├── video/
│   │   ├── domain/          # VideoSession, ConsentRecord
│   │   ├── application/     # StartConsultation, EndConsultation
│   │   ├── infrastructure/  # Jitsi adapter, Daily.co adapter
│   │   └── api/
│   │
│   ├── payments/            # Phase 2
│   │   ├── domain/
│   │   ├── application/
│   │   ├── infrastructure/  # Mobile Money adapters (Orange, MVola, Airtel)
│   │   └── api/
│   │
│   └── analytics/
│       ├── domain/
│       ├── application/     # GenerateReport, DashboardMetrics
│       └── infrastructure/  # Read from analytics schema, no writes to other schemas
│
├── shared/
│   ├── domain/              # Base entity, AggregateRoot, value objects
│   ├── events/              # Domain event definitions
│   ├── auth/                # Guards, decorators, RBAC policy
│   ├── database/            # DB connection, migrations, base repository
│   ├── config/              # Environment config, feature flags
│   └── utils/               # Date/time (GMT+3), pagination, error handling
│
└── main.ts
```

**Module communication rules:**

- ✅ Module A calls Module B only through its **public service interface**
- ✅ Cross-module side effects use **domain events** (e.g. `AppointmentBooked` → Notification module sends SMS)
- ✅ Analytics module reads from other schemas via **read-only reporting queries only**
- ❌ No direct cross-module database write access
- ❌ No circular module dependencies

**Domain events (loose coupling between modules):**

```
AppointmentBooked      → Notifications (send confirmation SMS)
AppointmentCancelled   → Notifications (send cancellation SMS) + Scheduling (free slot)
AppointmentCompleted   → Analytics (record) + Notifications (request review)
DoctorVerified         → Doctors (mark profile live)
VideoSessionStarted    → Analytics (record)
SlotLockExpired        → Appointments (release unconfirmed booking)
```

> 🔧 **Architect note:** Added `SlotLockExpired` event. The 10-minute slot lock on booking must be released via an event, not a polling cron job, to keep latency low for the next patient attempting to book.
> 

### 2.3 Database Strategy

**Single PostgreSQL 16+ instance with schema-per-module:**

```sql
-- Each module owns its schema — enforces boundaries at DB level
CREATE SCHEMA auth;          -- users, sessions, otp_codes
CREATE SCHEMA doctors;       -- profiles, specialties, facilities, doctor_facilities
CREATE SCHEMA appointments;  -- appointments, slot_locks, waitlist
CREATE SCHEMA scheduling;    -- weekly_templates, schedule_exceptions
CREATE SCHEMA notifications; -- notification_log, preferences
CREATE SCHEMA video;         -- sessions, consent_records
CREATE SCHEMA analytics;     -- events, aggregates (append-only)
CREATE SCHEMA payments;      -- payment_events, transactions (Phase 2)

-- Cross-schema joins: allowed ONLY for read-only reporting queries in analytics
-- Write operations always go through the owning module's service interface
```

**Scaling path for the database:**

- **Phase 1 (MVP):** Single primary instance (DigitalOcean `db-s-1vcpu-2gb`, ~$25/month)
- **Phase 2 (Growth):** Add read replica; analytics and reporting queries routed there
- **Phase 3 (Scale):** PgBouncer connection pooling; partition appointments table by `start_time` (range partitioning by month)
- **Phase 4 (Extract):** If a module becomes a bottleneck, its schema can be migrated to a standalone database when extracted as a microservice

### 2.4 Technology Stack

**Backend:**

- **Framework: NestJS (TypeScript)** — built-in module system maps directly to this architecture. ~~Django (Python) as alternative~~ — removed to eliminate ambiguity. Pick one stack and commit. NestJS is the right choice here: TypeScript across the full stack reduces context-switching, the built-in dependency injection supports clean module boundaries, and the ecosystem (Bull, Prisma/TypeORM, Passport) covers all requirements.
- **API:** RESTful (JSON). GraphQL is explicitly out of scope for MVP — adds complexity without proportionate benefit at this stage.
- **Real-time:** WebSocket via [Socket.io](http://Socket.io) for live availability updates and in-app notifications. Required packages: `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`. A dedicated `AvailabilityGateway` pushes `slot-locked` and `slot-released` events to connected patients in the same doctor's availability room, eliminating the need to poll the availability endpoint during the booking flow.
- Authentication:*- JWT access tokens (15 min expiry) + refresh tokens (7 days, rotated on use)
- Refresh token delivery: the API sets the refresh token exclusively via a `Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Strict` response header. It is **never** returned in the JSON response body. JavaScript (including the React frontend) cannot read or write `HttpOnly` cookies — this is the security property being exploited. The access token is returned in the response body and stored in Zustand memory state only (not localStorage, not sessionStorage).
- Refresh token server-side: stored in Redis (`refresh:{user_id}` key, TTL 7 days, rotated on every `/auth/refresh` call)
- **Background jobs:** BullMQ (Redis-backed) for SMS scheduling, appointment reminders, analytics event processing

  ## What it is:
  Bull Board is a web-based admin dashboard for BullMQ — a Redis-backed job queue library. It lets you:

  View all queues and their job counts (pending, active, completed, failed)
  Inspect individual jobs — their payload, status, retry count, error messages
  Manually retry failed jobs without code changes
  Monitor job performance — throughput, latency, failure rates
  Debug issues — see exactly why a job failed and what data caused it

  ## Why the project needs it
  In Phase 5 — Notifications Module, you'll have BullMQ queues handling:

  Queue	Job	Trigger
  sms-immediate	Send booking confirmation SMS	Patient books appointment
  sms-reminder	Send 72h / 24h / 2h reminder	AppointmentBooked event
  slot-lock	Clean up expired slot locks	10 minutes after lock created
  Without Bull Board, debugging a failed SMS would mean:

  ❌ Grep through logs hoping for error traces
  ❌ Write temporary test code to re-trigger jobs
  ❌ Manually query Redis to check job state
  With Bull Board, you can:

  ✅ Click a queue, see all 1000 failed SMS jobs
  ✅ Click one job, inspect the exact phone number and error ("Invalid format")
  ✅ Click "Retry" and watch it re-execute

  ## Bottom line
  It's a dev/ops tool. Not critical for functionality, but invaluable for production debugging when SMS doesn't arrive and you need to know if the job failed, succeeded, or never queued.

- **ORM:** Prisma — excellent TypeScript support, schema migrations, and type-safe queries

> 🔧 **Architect note:** BullMQ replaces Bull. BullMQ is the current maintained successor with better TypeScript support and improved concurrency handling. Bull is in maintenance mode.
> 

**Frontend:**

- **Framework:** React 18 with TypeScript.
- **Styling:** Tailwind CSS.
- **State Management:** Zustand — lightweight and sufficient. ~~Redux Toolkit~~ — removed as an option to eliminate ambiguity. Zustand has a fraction of the boilerplate and is adequate for this application's state complexity.
- **Mobile:** React Native (single codebase for iOS + Android). ~~Flutter~~ — removed. React Native is the correct choice given the team already uses React/TypeScript. Flutter would require learning Dart, splitting the team's mental model, and duplicating component logic.
- **Maps:** OpenStreetMap with react-leaflet (zero cost). Google Maps available as a swap via the adapter pattern if needed.

**Database & Cache:**

- **Primary DB:** PostgreSQL 16+ (schema-per-module)
- **Cache & queues:** Redis 7+ (sessions, rate limiting, BullMQ job queues, real-time slot locks)
- **Full-text search:** PostgreSQL `pg_trgm` extension for MVP. Migrate to Elasticsearch **only** when search volume exceeds 100k doctors or query latency exceeds 500ms. Do not pre-build the Elasticsearch integration.

**Infrastructure:**

- **Cloud:** DigitalOcean (MVP) → AWS (scale). DigitalOcean is simpler, cheaper, and has less configuration overhead at this stage. AWS migration path is straightforward as the app is containerised.
- **Compute:** Single Droplet/EC2 instance (vertical scaling first, as documented in ADR-001)
- **Containerisation:** Docker + Docker Compose. ~~Kubernetes~~ — explicitly deferred until 5+ independent services exist (see ADR-001 migration triggers)
- **CI/CD:** GitHub Actions
- **Monitoring:** Sentry (errors, free tier) + Grafana Cloud free tier (metrics) + structured JSON logging to stdout (ingested by Grafana Loki or CloudWatch)
- **Reverse proxy:** Nginx
- **CDN + WAF:** Cloudflare Free/Pro tier

**Video Consultation:**

- **Self-hosted Jitsi Meet** (cost-effective, full control, WebRTC, DTLS-SRTP)
- **Managed fallback:** [Daily.co](http://Daily.co) (simpler ops than Twilio Video, more competitive pricing, good WebRTC abstraction)
- Audio-only fallback for low-bandwidth connections (mandatory — critical for Madagascar rural use)

**SMS Providers (adapter pattern — swap without code changes):**

- Primary: Orange Madagascar API
- Secondary: Telma SMS Gateway
- Tertiary: Airtel Madagascar
- International fallback: Africa's Talking (preferred over Twilio for African markets — better local routes, lower cost)

### 2.5 Deployment Architecture (MVP)

```
┌──────────────────────────────────────────┐
│           Cloudflare                     │
│   CDN + WAF + DDoS Protection            │
└────────────────┬─────────────────────────┘
                 │
┌────────────────▼─────────────────────────┐
│         DigitalOcean (MVP)               │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  App Droplet (4 vCPU / 8 GB RAM)  │  │
│  │  Nginx → NestJS monolith           │  │
│  │  Redis (same box — MVP only)       │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  Managed PostgreSQL (DO DB)        │  │
│  │  (~$50/month, daily backups,       │  │
│  │   point-in-time recovery)          │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  Object Storage (DO Spaces / S3)   │  │
│  │  Prescriptions, profile photos,    │  │
│  │  lab results, video recordings     │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  Jitsi Meet Droplet (2 vCPU / 4GB)│  │
│  │  Video consultation only           │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

> 🔧 **Architect note:** App server spec increased to 4 vCPU / 8 GB. A t3.medium (2 vCPU / 4 GB) is undersized for a Node.js process running BullMQ workers, WebSocket connections, and HTTP handlers concurrently. The cost difference is ~$20/month and worth it from day one. Redis co-location on the app box is acceptable for MVP but must move to a dedicated instance before horizontal scaling is introduced.
> 

**Scaling path (add these as traffic grows — do not pre-build):**

1. Vertical scale app server (4 GB → 8 GB → 16 GB)
2. Add PostgreSQL read replica for analytics queries
3. Move Redis to dedicated managed instance
4. Add second app server + DigitalOcean Load Balancer for horizontal scaling
5. Extract first service (Notifications or Video) only when a measured bottleneck is confirmed
6. Introduce Kubernetes only when managing 5+ independent services

### 2.6 Infrastructure Cost Estimate (Corrected)

> 🔧 **Architect note:** Section 16.2 of v1.0 still listed microservices-era costs ($500 compute, $300 database, etc.) — a direct contradiction of ADR-001. The table below is the corrected, consistent estimate.
> 

| Component | Microservices (rejected) | Modular Monolith (adopted) |
| --- | --- | --- |
| Compute | ~$500 (8 containers) | ~$80 (1 Droplet, 4 vCPU/8 GB) |
| Database | ~$300 (multiple DBs) | ~$50 (1 Managed PostgreSQL) |
| Redis | ~$100 | ~$0 (co-located at MVP) |
| Kubernetes | ~$200 | $0 (not needed) |
| Load balancer | ~$200 | ~$0 (not needed at MVP) |
| Monitoring | ~$200 | ~$0 (Sentry free + Grafana free) |
| Video (Jitsi) | ~$200 | ~$40 (small Droplet) |
| Object Storage | — | ~$20 (DO Spaces) |
| CDN/WAF | ~$200 | ~$20 (Cloudflare Pro) |
| **Total/month** | **~$2,000–5,000** | **~$435–$1,035** |
| **6-month cost** | **~$12,000–30,000** | **~$2,600–$6,200** |

**Saving over 6-month MVP: ~$10,000–28,000** (see §16.2 for full breakdown)

> ⚠️ **v1.3 correction:** Previous versions showed ~$210–350/month total, which excluded SMS costs ($200–800/month volume-dependent) and understated the database cost. §16.2's detailed table (~$435–$1,035/month) is the correct figure.

---

## 3. Functional Requirements

### 3.1 Patient-Facing Features

#### 3.1.1 Doctor Search & Discovery

**Search Capabilities:**

- **By Name:** Autocomplete with fuzzy matching (pg_trgm `%` similarity operator)
- **By Specialty:** Predefined categories (Cardiology, Pediatrics, Dermatology, General Practice, etc.)
- **By Location:** Province/Region dropdown (Antananarivo, Toamasina, Mahajanga, etc.), District/City selection, GPS-based "Near Me" search using PostGIS `ST_DWithin`
- **By Availability:** Filter by available time slots (Today, Tomorrow, This Week, Custom Date)
- **Advanced Filters:** Languages spoken (Malagasy, French, English), gender preference, accepts new patients, consultation fee range, facility type

**Search Results Display:**

- Doctor profile photo and credentials
- Star rating and review count
- Next available appointment slot
- Distance from user location
- Consultation fee
- Languages spoken
- Facility address with map pin

**Performance Requirements:**

- Search results < 2 seconds
- Support for offline search caching (recently viewed doctors)
- Mobile-first responsive design

> 🔧 **Architect note:** GPS-based search requires PostGIS extension on PostgreSQL (free, standard). Add `CREATE EXTENSION postgis;` to the initial migration. This replaces any need for a separate geospatial service.
> 

#### 3.1.2 Doctor Profile Page

*(No changes from v1.0 — content is correct and complete.)*

#### 3.1.3 Appointment Booking Flow

**Step-by-Step Process:**

1. **Slot Selection** — Visual calendar (week view default on mobile), time slot picker (15–30 min intervals), instant availability check, lock selected slot for **10 minutes** during booking via Redis key with TTL
2. **Patient Information** — Pre-fill from profile if logged in; guest booking with phone verification; reason for visit
3. **Confirmation** — Summary with doctor, date/time, type, location, fee
4. **Payment (Phase 2)** — Mobile Money (Orange Money, MVola), cash at facility
5. **Booking confirmed** — Reference number, SMS confirmation, add-to-calendar link

**Booking Rules:**

- Maximum advance booking: 3 months
- Minimum advance booking: 2 hours (configurable per doctor)
- Cancellation allowed up to 24 hours before (configurable per doctor)
- Rescheduling allowed up to 48 hours before

**Concurrency & Locking:**

- Slot lock: Redis key `slot_lock:{doctor_id}:{slot_datetime_iso8601}` with 10-minute TTL (use `.toISOString()` for the datetime component — UTC ISO 8601 required to avoid key mismatches)
- Booking confirmation: `INSERT INTO appointments.slot_locks (...) ON CONFLICT (doctor_id, slot_time) DO NOTHING` — exactly one of two concurrent inserts wins; the loser receives a unique constraint error. This is the hard integrity guarantee.
- The lock-validation DELETE and appointment INSERT execute in a single `prisma.$transaction(async (tx) => { ... })` callback — the interactive transaction form guarantees both operations share the same PostgreSQL connection and serialization context.
- Slot lock expiry publishes `SlotLockExpired` domain event → Appointments module releases the hold

> ⚠️ **v1.3 correction:** Previous versions of this section said *"PostgreSQL `SELECT FOR UPDATE` on the target slot row."* That is wrong for two reasons: (1) it locks the doctor's entire schedule template row, serializing all concurrent bookings for that doctor; (2) `SELECT FOR UPDATE` on `scheduling.weekly_templates` does not prevent duplicate rows in `appointments.slot_locks`. The correct pattern — `INSERT ... ON CONFLICT DO NOTHING` with a `UNIQUE(doctor_id, slot_time)` constraint — was established in roadmap v1.1 but never reflected back here.
>

> 🔧 **Architect note:** Two-layer locking is correct: Redis is the UX hold ("slot reserved for 10 minutes"); PostgreSQL's unique constraint is the transactional integrity guarantee. Never rely on Redis alone for booking consistency — it can be evicted or fail.
> 

#### 3.1.4 Patient Dashboard

*(No changes from v1.0 — content is correct and complete.)*

#### 3.1.5 SMS Reminder System

**Reminder Schedule:**

- 72 hours before: First reminder with appointment details
- 24 hours before: Second reminder with confirm/cancel option
- 2 hours before: Final reminder with directions link

**SMS Template:**

```
Reminder: Appointment with Dr. [Name]
Date: [DD/MM/YYYY] at [HH:MM]
Location: [Clinic Name, Address]
Reply C to Cancel, OK to Confirm
Ref: [BOOKING_ID]
```

> 🔧 **Architect note:** Removed "Reply R to Reschedule" from the SMS template. Inbound SMS parsing for rescheduling requires a full conversational SMS flow (collect new date, confirm, etc.) which is a significant feature in itself. For MVP, the reschedule link should be a short URL to the web app. Add interactive reschedule SMS in Phase 2 if demand warrants it.
> 

**Delivery Tracking:**

- Monitor delivery status via provider webhooks
- Retry failed SMS up to 3 times with exponential backoff (via BullMQ job retry)
- Fallback to email if all SMS attempts fail and email is on file

**Same-day booking behaviour:** For appointments booked fewer than 2 hours before the start time, all three reminder offsets (72h, 24h, 2h) are in the past — no reminder jobs are queued. The booking confirmation SMS is the only notification in this case. This is by design and is logged at INFO level to distinguish from a bug.

**Compliance:**

- Opt-out via "Reply STOP"
- Respect quiet hours (8:00–20:00 local time, GMT+3)
- GDPR-principle data protection

---

### 3.2 Healthcare Professional Features

#### 3.2.1 Professional Dashboard

**Overview Panel:**

- Today's appointment count and list
- Upcoming week summary
- Revenue statistics (daily/weekly/monthly)
- New patient count
- Average rating and recent reviews
- Pending actions (confirmations, reschedule requests)

**Quick Actions:**

- Block time slots
- Add emergency appointment
- Cancel/reschedule appointments
- Update availability
- Send bulk SMS to patients

---

#### 3.2.2 Agenda & Schedule Management

**Calendar Features:**

- **Multiple Views:** Day, Week, Month, Agenda list
- **Working Hours Configuration:**
    - Set default hours per weekday
    - Support for multiple locations
    - Break and lunch time settings
    - Special holiday schedule
- **Appointment Types:**
    - In-person consultation
    - Video consultation
    - Follow-up (shorter duration)
    - Emergency slots
    - Custom appointment types

**Slot Management:**

- **Bulk Operations:**
    - Create recurring availability (e.g., "Every Monday 9 AM–12 PM, Every Friday 2 PM–6 PM")
    - Block dates for vacation/conferences
    - Copy week template to future weeks
- **Individual Slot Control:**
    - Override specific dates
    - Mark slots as "Emergency only"
    - Adjust slot duration (15, 30, 45, 60 min)
    - Buffer time between appointments

**Overbooking and Conflicts:**

- Warning system for double bookings
- Emergency overbooking with confirmation
- Automatic conflict detection
- Waitlist management for fully booked days

**Synchronization and Integration:**

- Two-way sync with Google Calendar, Outlook
- iCal format export
- Import external events (conferences, training)

> ⚠️ **v1.3 deferral:** Google Calendar two-way sync (OAuth 2.0) is **Phase 2**. No roadmap step implements it in Phase 0–10. See also §8.3. iCal export (client-side `.ics` generation) remains in Phase 1 MVP scope.

---

#### 3.2.3 Appointment Management

**Appointment Details View:**

- Patient information (name, age, contact, photo)
- Appointment history with this doctor
- Reason for visit
- Medical notes from previous visits
- Attachments (test results, referrals)

**Actions:**

- Confirm appointment
- Mark as completed
- Mark as no-show
- Request reschedule (sends notification to patient)
- Cancel with reason (refund if applicable)
- Add private notes (HIPAA/confidential)
- Generate prescription

**No-Show Management:**

- Track no-show rate per patient
- Auto-flag repeat no-shows
- Option to block future bookings for repeat offenders
- Charge no-show fee (if configured)

**Waitlist System:**

- Add patients to waitlist for fully booked dates
- Auto-notify when slot becomes available
- Priority system (urgent cases first)

---

#### 3.2.4 Patient Records (EHR Lite)

**Patient Profile:**

- Demographic data
- Contact information
- Medical history summary
- Visit history with this provider
- Prescriptions issued
- Lab results uploaded
- Attachments and documents

**Visit Notes:**

- SOAP format (Subjective, Objective, Assessment, Plan)
- Rich text editor with templates
- Voice-to-text transcription (future)
- ICD-10 code selection for diagnoses
- Procedure codes

**Privacy and Security:**

- Role-based access control
- Audit logs for all record accesses
- Encryption at rest and in transit
- Patient consent management

> ⚠️ **v1.3 deferral:** EHR Lite (SOAP notes, ICD-10, prescription generation, lab results) is **Phase 2**. No data model exists for `visit_notes` or `prescriptions` in the current spec §5 or roadmap. The `Appointment.notes: TEXT` field is a temporary placeholder. A `visit_notes` table with SOAP structure and `icd10_codes TEXT[]` must be designed before EHR Lite implementation begins.

---

#### 3.2.5 Practice Analytics

**Key Metrics:**

- Total appointments (completed, cancelled, no-shows)
- Revenue trends
- Average session duration
- Patient retention rate
- New vs returning patients
- Peak booking hours
- Most common reasons for visit

**Reports:**

- Daily/weekly/monthly summaries
- Patient demographic breakdown
- Revenue by consultation type
- Cancellation and no-show analysis
- Export to CSV/Excel

**Insights:**

- Optimal scheduling suggestions based on demand
- Underutilized time slots
- Patient return trends

---

### 3.3 Online Video Consultation (Telemedicine)

#### 3.3.1 Video Call Features

**Technical Requirements:**

- **WebRTC-based:** Peer-to-peer with server relay fallback
- **Minimum Bandwidth:** 512 kbps (quality adjustable)
- **Fallback:** Audio-only mode for low-bandwidth connections
- **Supported Devices:** Desktop (Chrome, Firefox, Safari), Mobile (iOS, Android)

**In-Call Features:**

- HD video (up to 720p) and audio
- Screen sharing (for reviewing documents/images)
- Chat messaging (text)
- File sharing (images, PDFs — encrypted)
- Virtual background (privacy)
- Mute/unmute audio and video
- Call recording (with consent, encrypted storage)

**Quality Adaptation:**

- Auto-adjust video quality based on bandwidth
- Connection quality indicator
- Option to switch to audio-only
- Reconnection handling

---

#### 3.3.2 Consultation Workflow

**Pre-Consultation:**

- Patient books video consultation slot
- Receives SMS/email with join link 15 minutes before
- Browser compatibility check and permission requests
- Waiting room interface (doctor joins when ready)

**During Consultation:**

- Doctor initiates call from dashboard
- Patient joins via SMS link or dashboard
- Timer showing consultation duration
- Note panel for doctor (private)
- Prescription generation tool
- End call button (either party can terminate)

**Post-Consultation:**

- Consultation summary saved
- Prescription sent to patient (PDF + SMS link)
- Follow-up booking suggestion
- Payment collection (if not prepaid)
- Request for feedback/rating

---

#### 3.3.3 Security and Compliance

**Data Protection:**

- End-to-end encryption for video/audio
- Encrypted storage for recordings
- Auto-delete recordings after 30 days (configurable)
- No third-party access to consultation data

**Consent Management:**

- Patient consent for recording
- Terms acceptance before first video call
- Telemedicine-specific privacy policy

**Audit Trail:**

- Log all consultations (start/end time, duration, participants)
- Access logs for recordings
- Compliance with medical record retention laws

---

#### 3.3.4 Madagascar-Specific Adaptations

**Connectivity Challenges:**

- Aggressive bandwidth optimization
- Pre-buffering video frames
- Fast fallback to audio
- SMS communication fallback channel

**Language Support:**

- Interface in Malagasy and French
- In-call translation subtitles (future enhancement)

**Mobile-First:**

- Most users on mobile devices
- Optimized mobile app experience
- Low-data mode

> 🔧 **Architect note on call recording:** Recording WebRTC calls in Jitsi requires the Jibri component (Jitsi Broadcasting Infrastructure). This is a non-trivial operational addition — it requires a dedicated VM, screen capture, and FFmpeg pipeline. For MVP, call recording should be **disabled by default** and scheduled as a Phase 2 feature. Document this constraint explicitly so the product team plans accordingly.
> 

> 🔧 **Architect note on call recording:** Recording WebRTC calls in Jitsi requires the Jibri component (Jitsi Broadcasting Infrastructure). This is a non-trivial operational addition — it requires a dedicated VM, screen capture, and FFmpeg pipeline. For MVP, call recording should be **disabled by default** and scheduled as a Phase 2 feature. Document this constraint explicitly so the product team plans accordingly.
> 

---

## 4. Non-Functional Requirements

### 4.1 Performance

**Response Time:**

- Page load: < 3 seconds on 3G connection
- API response: < 500ms for 95% of requests
- Search results: < 2 seconds
- Real-time slot availability: < 1 second (WebSocket push from server on booking events)

**Scalability Targets (MVP horizon):**

- 10,000 concurrent users
- 50,000 appointments/month (MVP ceiling before microservice extraction is considered)
- Database query response < 100ms (p95)

**Bandwidth Optimization:**

- Progressive Web App with service worker for offline functionality
- Image compression (WebP format, max 200 KB for profile photos)
- Lazy loading for images outside viewport
- Minified and code-split JS bundles
- CDN for all static assets

### 4.2 Reliability & Availability

**Uptime:** 99.9% SLA target (~8.7 hours downtime/year)

**Fault Tolerance:**

- Managed PostgreSQL with automated failover (DigitalOcean Managed DB provides this)
- Circuit breaker pattern for all external service calls (SMS, video, maps)
- Graceful degradation: if SMS fails → email; if video fails → in-app link with instructions

**Backup & Recovery:**

- Daily automated database backups (managed by DigitalOcean, retained 7 days)
- Point-in-time recovery capability
- RTO: 4 hours, RPO: 1 hour

### 4.3 Security

**Authentication:**

- MFA for all healthcare providers (SMS OTP mandatory)
- Phone number OTP for patients
- Social login (Google, Facebook) optional for patients — defer to Phase 2
- JWT access tokens (15 min) + refresh tokens (7 days, Redis-stored, rotated on use)
- Auto-logout after 30 minutes of inactivity

**Authorization — RBAC:**

| Role | Permissions |
| --- | --- |
| Patient | Own data, book, cancel, view own history |
| Doctor | Own schedule, own patients' records, own analytics |
| Facility Admin | Doctors at their facility, facility-level reports |
| Platform Admin | All data (every action audit-logged) |
| Support Agent | Read-only, requires patient consent token |

**Data Protection:**

- TLS 1.3 in transit
- AES-256 at rest (managed by cloud provider for DB and object storage)
- PII anonymized in application logs
- GDPR-principle compliance (right to deletion, portability)

**Infrastructure Security:**

- WAF via Cloudflare (OWASP rule set)
- Rate limiting: 100 requests/minute per IP (Nginx + Redis counter), stricter on auth endpoints (10/min)
- SSH key-based access only; no password-based SSH
- Secrets managed via environment variables + a secrets manager (DigitalOcean Secrets or AWS Secrets Manager — not hardcoded, not in git)

### 4.4 Usability

**User Interface:**

- Mobile-first responsive design
- WCAG 2.1 AA accessibility
- Minimum touch target: 44 × 44 px
- High-contrast mode

**Language Support:**

- Primary: Malagasy (Merina dialect)
- Secondary: French
- Future: English

**User Experience Targets:**

- Maximum 3 taps to complete a booking from the search results page
- Inline validation on all forms (no submit-then-error cycles)
- Progress indicators for all multi-step flows
- Plain-language error messages (no technical codes exposed to users)

### 4.5 Compatibility

**Browser Support:** Chrome 90+, Firefox 88+, Safari 14+, Edge 90+, iOS Safari, Chrome Android

**Device Support:** iOS 13+, Android 8+, desktop (Windows, macOS, Linux)

**Network Conditions:** Functional (degraded) on 2G/3G; optimized for 4G/WiFi; offline mode for cached appointment data

---

## 5. Data Models

### 5.1 Core Entities

#### User

```tsx
{
  id: UUID (PK)
  user_type: ENUM('patient', 'doctor', 'admin', 'support')
  phone_number: STRING (unique, indexed, E.164 format e.g. +261340000000)
  email: STRING | NULL (unique partial index WHERE email IS NOT NULL)
  password_hash: STRING
  first_name: STRING
  last_name: STRING
  date_of_birth: DATE | NULL
  gender: ENUM('male', 'female', 'other', 'prefer_not_to_say')
  profile_photo_url: STRING | NULL
  preferred_language: ENUM('malagasy', 'french', 'english') DEFAULT 'malagasy'
  is_active: BOOLEAN DEFAULT true
  is_verified: BOOLEAN DEFAULT false
  last_login_at: TIMESTAMPTZ | NULL
  created_at: TIMESTAMPTZ
  updated_at: TIMESTAMPTZ
}
```

#### DoctorProfile (1:1 with User where user_type = 'doctor')

```tsx
{
  user_id: UUID (PK, FK → auth.users)
  registration_number: STRING (unique — medical council number)
  specialties: TEXT[] (GIN indexed)
  sub_specialties: TEXT[] | NULL
  years_of_experience: INTEGER
  about: TEXT | NULL
  languages_spoken: TEXT[]
  consultation_fee_mga: INTEGER  // Ariary — store as integer (smallest unit), never DECIMAL for money
  consultation_duration_minutes: INTEGER DEFAULT 30
  accepts_new_patients: BOOLEAN DEFAULT true
  education: JSONB | NULL
  certifications: JSONB | NULL
  insurance_accepted: TEXT[] | NULL
  video_consultation_enabled: BOOLEAN DEFAULT false
  home_visit_enabled: BOOLEAN DEFAULT false
  is_profile_live: BOOLEAN DEFAULT false  // set true by DoctorVerified event
  average_rating: NUMERIC(3,2) | NULL  // updated by analytics module, read-only for doctor module
  total_reviews: INTEGER DEFAULT 0
  total_appointments: INTEGER DEFAULT 0
}
```

> 🔧 **Architect note:** Fees renamed to `consultation_fee_mga` and typed as `INTEGER`. Never store monetary values as `DECIMAL`/`FLOAT` — floating point errors in financial data are a serious bug class. Store Ariary as an integer (1 MGA = 1 unit). Display formatting is the UI's responsibility.
> 

#### Facility

```tsx
{
  id: UUID (PK)
  name: STRING
  type: ENUM('hospital', 'clinic', 'diagnostic_center', 'pharmacy')
  address: TEXT
  city: STRING
  region: STRING
  geolocation: GEOMETRY(Point, 4326)  // PostGIS — replaces separate lat/lng columns
  phone_number: STRING | NULL
  email: STRING | NULL
  website: STRING | NULL
  opening_hours: JSONB  // { monday: { open: "08:00", close: "18:00" }, ... }
  photos: TEXT[] | NULL
  is_verified: BOOLEAN DEFAULT false
  created_at: TIMESTAMPTZ
  updated_at: TIMESTAMPTZ
}
```

> 🔧 **Architect note (v1.1):** Replaced `latitude DECIMAL` + `longitude DECIMAL` with a PostGIS `GEOMETRY(Point, 4326)` column. This is the correct pattern — PostGIS provides `ST_DWithin`, `ST_Distance`, and spatial indexing (GIST) out of the box, which is what powers the "Near Me" search. Storing raw lat/lng and computing distances in application code is inefficient and fragile.
> 

> 🔧 **Architect note (v1.2 — Prisma limitation):** Prisma ORM does not natively support PostGIS `GEOMETRY` types. In the Prisma schema, the `geolocation` column must be declared with the `Unsupported()` type annotation:
> 

> `prisma
> 

> geolocation Unsupported("geometry(Point, 4326)")
> 

> `
> 

> Prisma will include the column in migrations but will not generate typed accessor methods for it. All geospatial queries (`ST_DWithin`, `ST_MakePoint`, `ST_Distance`) must be written as raw SQL using `prisma.$queryRaw` or `prisma.$executeRaw`. This is the only supported pattern for PostGIS with Prisma — it is a known limitation of the ORM. Encapsulate all raw geospatial queries in the `FacilityRepository` class so the rest of the codebase never touches raw SQL directly. This is the correct pattern — PostGIS provides `ST_DWithin`, `ST_Distance`, and spatial indexing (GIST) out of the box, which is what powers the "Near Me" search. Storing raw lat/lng and computing distances in application code is inefficient and fragile.
> 

#### Appointment

```tsx
{
  id: UUID (PK)
  booking_reference: STRING (unique, human-readable e.g. "APT-2026-XXXXX")
  patient_id: UUID (FK → auth.users)
  doctor_id: UUID (FK → auth.users)
  facility_id: UUID | NULL (FK → doctors.facilities)
  appointment_type: ENUM('in_person', 'video', 'home_visit')
  start_time: TIMESTAMPTZ  // always UTC, display in GMT+3
  end_time: TIMESTAMPTZ
  duration_minutes: INTEGER
  status: ENUM('pending_confirmation', 'confirmed', 'completed', 'cancelled', 'no_show')
  cancellation_reason: TEXT | NULL
  cancelled_by: ENUM('patient', 'doctor', 'system') | NULL
  reason_for_visit: TEXT | NULL
  is_first_visit: BOOLEAN DEFAULT false
  consultation_fee_mga: INTEGER | NULL  // captured at booking time, not recalculated later
  payment_status: ENUM('not_applicable', 'pending', 'paid', 'refunded') DEFAULT 'not_applicable'
  payment_method: ENUM('cash', 'mobile_money', 'card', 'insurance') | NULL
  notes: TEXT | NULL  // doctor's private notes
  prescription_storage_key: STRING | NULL  // S3/DO Spaces object key, not a full URL
  follow_up_required: BOOLEAN DEFAULT false
  created_at: TIMESTAMPTZ
  updated_at: TIMESTAMPTZ
}
```

> 🔧 **Architect note:** Three changes from v1.0: (1) All timestamps use `TIMESTAMPTZ` (timezone-aware) — critical for a system that must correctly handle Madagascar GMT+3. (2) `prescription_url` renamed to `prescription_storage_key` — store the object storage key, not a full URL. URLs are generated on-demand (pre-signed, time-limited) at the API layer for security. (3) Fee stored as INTEGER in MGA (same pattern as DoctorProfile).
> 

#### WeeklyScheduleTemplate (replaces the Availability entity — see note below)

```tsx
{
  id: UUID (PK)
  doctor_id: UUID (FK → auth.users)
  facility_id: UUID | NULL
  day_of_week: INTEGER  // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  start_time: TIME
  end_time: TIME
  appointment_type: ENUM('in_person', 'video', 'both')
  slot_duration_minutes: INTEGER DEFAULT 30
  buffer_minutes: INTEGER DEFAULT 0
  max_bookings_per_slot: INTEGER DEFAULT 1
  is_active: BOOLEAN DEFAULT true
  effective_from: DATE
  effective_until: DATE | NULL
}
```

#### ScheduleException (blocks or overrides template for specific dates)

```tsx
{
  id: UUID (PK)
  doctor_id: UUID (FK → auth.users)
  exception_date: DATE
  exception_type: ENUM('day_off', 'custom_hours', 'emergency_only')
  custom_start_time: TIME | NULL  // used when exception_type = 'custom_hours'
  custom_end_time: TIME | NULL
  reason: TEXT | NULL  // 'vacation', 'conference', 'public holiday'
  created_at: TIMESTAMPTZ
}
```

> 🔧 **Architect note — Availability entity redesigned:** The v1.0 `Availability` entity was a significant design problem. It mixed two fundamentally different concepts into one table: (1) the **recurring template** ("I work Mondays 9–12") and (2) **specific exceptions** ("I'm off on March 15"). Mixing these creates complex query logic, update anomalies, and makes it very difficult to generate slot availability for a future date. The correct pattern (used by Calendly, Doctolib, and similar platforms) is two separate tables: `WeeklyScheduleTemplate` (the rule) and `ScheduleException` (the override). The Scheduling module computes available slots on-demand by starting with the template, applying exceptions, then subtracting already-booked appointments. This is clean, efficient, and easy to reason about.
> 

### 5.2 Database Indexes

```sql
-- auth schema
CREATE UNIQUE INDEX users_phone_number_idx ON auth.users(phone_number);
CREATE UNIQUE INDEX users_email_idx ON auth.users(email) WHERE email IS NOT NULL;

-- doctors schema
CREATE INDEX doctors_specialties_gin_idx ON doctors.profiles USING GIN(specialties);
CREATE INDEX facilities_geolocation_gist_idx ON doctors.facilities USING GIST(geolocation);

-- appointments schema
CREATE INDEX appt_patient_time_idx ON appointments.appointments(patient_id, start_time DESC);
CREATE INDEX appt_doctor_time_idx ON appointments.appointments(doctor_id, start_time);
CREATE INDEX appt_status_time_idx ON appointments.appointments(status, start_time)
  WHERE status IN ('pending_confirmation', 'confirmed');  -- partial index, smaller footprint

-- scheduling schema
CREATE INDEX schedule_template_doctor_day_idx ON scheduling.weekly_templates(doctor_id, day_of_week);
CREATE INDEX schedule_exception_doctor_date_idx ON scheduling.exceptions(doctor_id, exception_date);
```

> 🔧 **Architect note:** Removed the Elasticsearch index specification from v1.0 section 5.2. Elasticsearch is not part of the MVP stack (pg_trgm handles text search at MVP scale). Specifying Elasticsearch indexes here created a false impression it was being built immediately, contradicting the stack decision. It will be added to the spec when the migration trigger is hit (>100k doctors or >500ms search latency).
> 

---

## 6. API Specifications

### 6.1 API Design Principles

- HTTP verbs: GET (read), POST (create), PATCH (partial update), DELETE (remove)
- Plural resource names: `/api/v1/appointments`
- URL-based versioning: `/api/v1/`, `/api/v2/`
- Backward compatibility maintained for minimum 12 months after a new version is released

**Standard Response Envelope:**

```json
{
  "success": true,
  "data": { },
  "meta": {
    "timestamp": "2026-02-17T10:30:00Z",
    "request_id": "uuid",
    "pagination": { "page": 1, "limit": 20, "total": 143 }
  },
  "error": null
}
```

**Error Response:**

```json
{
  "success": false,
  "data": null,
  "meta": { "timestamp": "2026-02-17T10:30:00Z", "request_id": "uuid" },
  "error": {
    "code": "SLOT_ALREADY_BOOKED",
    "message": "The selected time slot is no longer available."
  }
}
```

> 🔧 **Architect note:** Added a structured `error` object with a machine-readable `code` and human-readable `message`. The v1.0 spec had `"error": null` in the success response but didn't define the error structure. Frontend and mobile clients need the `code` field to display localised error messages.
> 

### 6.2 Key API Endpoints

#### Authentication

```
POST /api/v1/auth/register          Register patient or doctor, triggers OTP
POST /api/v1/auth/verify-otp        Verify phone OTP, returns tokens
POST /api/v1/auth/login             Phone/email + password → JWT + refresh token
POST /api/v1/auth/refresh           Rotate refresh token, return new access token
POST /api/v1/auth/logout            Invalidate refresh token in Redis
```

> 🔧 **Architect note:** Added `POST /auth/logout`. The v1.0 spec omitted this. Since refresh tokens are stored in Redis, logout must explicitly delete the Redis key — otherwise the refresh token remains valid until its 7-day expiry even after the user logs out.
> 

#### Doctor Search

```
GET /api/v1/doctors/search
  Query: q, specialty, region, city, lat, lng, radius_km,
         available_date, language, min_rating, consultation_type,
         page (default 1), limit (default 20, max 50)

GET /api/v1/doctors/:id
GET /api/v1/doctors/:id/availability?start_date=&end_date=&facility_id=
```

#### Appointments

```
POST   /api/v1/appointments              Book appointment
GET    /api/v1/appointments              List (filtered by authenticated user's role)
GET    /api/v1/appointments/:id          Get details
PATCH  /api/v1/appointments/:id          Reschedule or cancel
PATCH  /api/v1/appointments/:id/status   Doctor marks complete / no-show
```

#### Slot Locking

```
POST   /api/v1/slots/lock               Lock a slot for 10 minutes during booking flow
DELETE /api/v1/slots/lock/:lock_token   Release lock on booking cancellation or expiry
```

> 🔧 **Architect note:** Added explicit slot lock endpoints. The lock/release lifecycle needs to be a first-class API concept, not an implicit side effect of `POST /appointments`. This makes the booking flow stateful and debuggable.
> 

#### Video Consultation

```
POST /api/v1/consultations/:appointment_id/start   Doctor starts, room created
GET  /api/v1/consultations/:appointment_id/join    Patient gets time-limited join token
POST /api/v1/consultations/:appointment_id/end     End session, save metadata
```

---

## 7. User Workflows

*(Sections 7.1, 7.2, 7.3 retained from v1.0 without changes — the workflows are correctly described.)*

---

## 8. Integration Requirements

### 8.1 SMS Gateway Integration

**Provider hierarchy (adapter pattern — all implement the same `SmsProvider` interface):**

1. Orange Madagascar API *(Phase 1 MVP)*
2. Telma SMS Gateway *(Phase 2 — deferred; roadmap Step 23 implements Orange + Africa's Talking only)*
3. Airtel Madagascar *(Phase 2 — deferred)*
4. Africa's Talking (international fallback — preferred for African markets over Twilio) *(Phase 1 MVP)*

**Requirements:** Delivery webhooks, retry up to 3× with exponential backoff, Malagasy Unicode support, message batching for cost optimization.

### 8.2 Payment Gateway Integration (Phase 2)

Mobile Money: Orange Money, MVola (Telma), Airtel Money. All via adapter pattern. Card payments via Stripe as a secondary option for urban users with international cards.

### 8.3 Calendar Integration

Google Calendar two-way sync for doctors (OAuth 2.0). iCal export for patients. Microsoft Outlook/Exchange support deferred to Phase 2.

> ⚠️ **v1.3 deferral:** Google Calendar OAuth two-way sync is **Phase 2** — no roadmap step implements it. iCal export (client-side `.ics` file generation) is Phase 1 MVP scope.

### 8.4 Maps & Geolocation

OpenStreetMap (Nominatim) for geocoding and address autocomplete — zero cost, good Madagascar coverage. Google Maps as a drop-in swap via adapter if product decides to upgrade. PostGIS handles all distance calculations server-side.

### 8.5 File Storage

DigitalOcean Spaces (S3-compatible API) for MVP. Files are never served directly — access is via **pre-signed URLs** generated on-demand (15-minute expiry for patient document downloads, 1-minute expiry for video recordings). All buckets private.

---

## 9. Mobile Application Specifications

### 9.1 Platform Strategy

**React Native (TypeScript)** — single codebase for iOS and Android. This is the correct choice given the team's existing React/TypeScript skillset. ~~Flutter~~ is removed as an option — it would require Dart expertise the team doesn't have and would split the component model from the web frontend.

### 9.2 App Features

**Core (parity with PWA):** Doctor search, booking, dashboard, video consultation, profile management, push notifications.

**Mobile-specific:** GPS "Near Me", camera for photo upload, native calendar integration, push notifications via FCM (Android) + APNs (iOS), offline appointment cache, biometric login (Face ID / fingerprint).

### 9.3 Performance Targets

- App bundle size < 50 MB
- Cold start time < 3 seconds
- 60 FPS scroll performance
- Background sync for appointment reminders (even when app is backgrounded)

---

## 10. Madagascar Market Adaptations

*(Section retained from v1.0 — well-researched and appropriate. One addition below.)*

### 10.1 Localization

Primary UI: Malagasy (Merina dialect). Secondary: French. Date format: DD/MM/YYYY, 24-hour time. Currency: Ariary (MGA), formatted as "50 000 Ar".

### 10.2 Connectivity Optimization

PWA with service worker offline support. Aggressive caching of doctor profiles and upcoming appointments. Low-bandwidth mode (JPEG images capped at 80 KB). SMS as primary communication channel.

### 10.3 Payment Considerations

- Phase 1: Pay at facility (no online payment required)
- Phase 2: Orange Money + MVola integration
- Phase 3: Card payments for urban/international users

### 10.4 USSD Consideration (Added)

> 🔧 **Architect note:** The v1.0 Risk Analysis (section 17.3) correctly identifies low smartphone penetration in rural areas and mentions "USSD integration" as mitigation, but the spec never addresses USSD anywhere else. USSD (e.g. `*xxx#` menus) works on all feature phones with no internet. For Phase 3 rural expansion, a USSD booking flow should be formally specced as a separate interface module — it would use the same core booking service via an internal interface. This should be added to the Phase 3 roadmap, not left as an unaddressed risk item.
> 

---

## 11. Security & Compliance

*(Sections 11.1 through 11.4 retained from v1.0 with the following clarification.)*

> 🔧 **Architect note on HIPAA:** The spec references "HIPAA-inspired standards" throughout. HIPAA is US law and has no legal force in Madagascar. The correct framing is: "We adopt HIPAA-equivalent controls as industry best practice for medical data." This distinction matters for any legal or regulatory review. Madagascar's Law No. 2014-038 on personal data protection is the applicable local law — ensure the legal team has reviewed it specifically.
> 

---

## 12. Testing Strategy

### 12.1 Testing Types

**Unit Testing:** Jest (TypeScript/NestJS). Target 80% coverage on business logic (domain + application layers). Infrastructure and API layers are covered by integration tests, not unit tests.

**Integration Testing:** Supertest for API endpoints against a real PostgreSQL test database (Docker Compose in CI). SMS and video providers mocked via adapters.

**End-to-End Testing:** Playwright (preferred over Cypress for better mobile emulation and parallel execution). Focus on the critical paths: Search → Book → Confirm, and Doctor: Set Schedule → Receive Booking.

**Performance Testing:** k6 (preferred over JMeter — TypeScript-native, CI-friendly, lower resource usage). Baseline: 500 concurrent users on the booking endpoint; stress target: 2,000.

**Security Testing:** OWASP ZAP scan in CI on staging. Manual penetration test before public launch.

### 12.2 Test Environments

- **Local:** Docker Compose with mocked external services
- **Staging:** Production-identical config, real SMS to test numbers only, anonymised data copy
- **UAT:** Pre-production with real user testing
- **Production:** Blue-green deployment for zero-downtime releases

---

## 13. Deployment & DevOps

### 13.1 Deployment Architecture

**Cloud Provider:** DigitalOcean (MVP) — simpler, lower cost, adequate managed services. Migration to AWS when scale or specific AWS services justify it.

**Infrastructure as Code:** Terraform for DigitalOcean resource provisioning (Droplets, Managed DB, Spaces, firewall rules).

**Containerisation:** Docker + Docker Compose. ~~Kubernetes for production orchestration~~ — **explicitly removed**. This directly contradicts ADR-001. Kubernetes is introduced only when the microservice extraction triggers in ADR-001 are hit.

> 🔧 **Architect note:** Section 13.1 of v1.0 specified Kubernetes for production, which is a direct and significant contradiction of ADR-001. This is the most important correction in this review. A team that builds the deployment pipeline expecting Kubernetes will build different things than a team expecting Docker Compose + a load balancer. The spec must be unambiguous: Docker Compose now, scale vertically first, introduce a load balancer when a second app server is needed, and only introduce Kubernetes when managing 5+ independent services.
> 

**CI/CD Pipeline (GitHub Actions):**

```
On pull request:    lint → unit tests → integration tests → build Docker image
On merge to dev:    above + deploy to staging
On merge to main:   above + manual approval gate + blue-green deploy to production
```

### 13.2 Monitoring & Observability

**Stack (cost-optimised for MVP):**

- **Error tracking:** Sentry (free tier: 5,000 errors/month)
- **Metrics & dashboards:** Grafana Cloud free tier (10,000 series)
- **Metrics/log collection agent:** Grafana Alloy (successor to the deprecated Grafana Agent — use `grafana/alloy`, not the old `grafana/agent` package whose download URL returns 404)
- **Logs:** Structured JSON to stdout → Grafana Loki (included in Grafana Cloud free tier)
- **Uptime monitoring:** BetterUptime free tier (HTTP checks every 3 minutes)

~~New Relic / Datadog / ELK Stack / PagerDuty~~ — **removed from MVP spec**. These are enterprise-grade tools with enterprise-grade pricing ($200–$500+/month). The Grafana + Sentry stack covers all MVP monitoring needs for near zero cost. Revisit at Phase 2 if the free tiers are outgrown.

**Key Alerts:**

- API error rate > 5% for 5 consecutive minutes
- PostgreSQL connection pool > 80% utilised
- SMS delivery failure rate > 10%
- Disk usage > 80%
- Sentry error spike (5× above baseline)

**Business Metrics Dashboard (built into the app's analytics module):**

- Daily active users, appointments per day, search-to-booking conversion rate, doctor utilization rate

### 13.3 Backup & Disaster Recovery

- Automated daily PostgreSQL backups (DigitalOcean Managed DB, 7-day retention)
- Point-in-time recovery to 5-minute granularity
- Object storage versioning enabled (DigitalOcean Spaces)
- RTO: 4 hours, RPO: 1 hour
- Quarterly DR drill documented in runbook

---

## 14. Launch Strategy

*(Retained from v1.0 — well-structured and realistic.)*

### 14.1 Phased Rollout

- **Phase 1 (Months 1–3):** MVP in Antananarivo. Doctor search, booking, SMS reminders, basic dashboard. Target: 50–100 onboarded doctors.
- **Phase 2 (Months 4–6):** Video consultations, mobile apps, reviews, analytics, expanded to Toamasina and Antsirabe.
- **Phase 3 (Months 7–9):** Mobile Money payments, prescription management, Mahajanga and Fianarantsoa.
- **Phase 4 (Months 10–12):** National scale, USSD booking channel for rural users, potential AI features.

---

## 15. Future Enhancements (Roadmap)

*(Retained from v1.0 — appropriate and well-ordered.)*

---

## 16. Budget & Resource Estimates (Corrected)

### 16.1 Development Team (6-month MVP)

| Role | Count |
| --- | --- |
| Product Manager | 1 |
| UX/UI Designer | 1 |
| Frontend Developer (React + React Native) | 2 |
| Backend Developer (NestJS/TypeScript) | 2 |
| DevOps Engineer | 1 |
| QA Engineer | 1 |
| **Total** | **8** |

**Estimated development cost:** $150,000–$250,000 (6 months)

### 16.2 Infrastructure Costs (Monthly — Corrected)

> 🔧 **Architect note:** The v1.0 infrastructure cost table ($500 compute, $300 DB, $200 CDN, etc.) reflected microservices-era sizing and directly contradicted ADR-001. The corrected estimate is based on the adopted modular monolith architecture.
> 

| Component | Monthly Cost |
| --- | --- |
| App Droplet (4 vCPU / 8 GB) | ~$80 |
| Managed PostgreSQL (1 GB RAM) | ~$50 |
| Redis (co-located at MVP) | $0 |
| Jitsi VM (2 vCPU / 4 GB) | ~$40 |
| Object Storage (DO Spaces, 250 GB) | ~$20 |
| Cloudflare Pro | ~$20 |
| Sentry + Grafana (free tiers) | $0 |
| SMS (Orange/Telma/Africa's Talking) | $200–$800 (volume-dependent) |
| Email (Amazon SES) | ~$10 |
| Domain + misc | ~$15 |
| **Total/month** | **~$435–$1,035** |

**6-month MVP infrastructure cost: ~$2,600–$6,200** (vs. $12,000–$30,000 for microservices)

---

## 17. Risk Analysis & Mitigation

### 17.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
| --- | --- | --- | --- |
| Poor connectivity affects video calls | High | High | Bandwidth adaptation, mandatory audio-only fallback, SMS backup channel |
| SMS delivery failures | Medium | High | 4-provider hierarchy with adapter pattern, email fallback |
| Database performance degradation | Medium | High | Proper indexing (as specced), query monitoring, read replica at Phase 2 |
| Security breach / medical data leak | Low | Critical | Encryption at rest + in transit, RBAC, audit logs, pre-launch pen test |
| Redis failure (co-located, MVP) | Medium | Medium | Sessions re-authenticated (degraded UX, not data loss); move Redis to managed instance at Phase 2 |

> 🔧 **Architect note:** Added Redis single-point-of-failure risk. Co-locating Redis on the app server (MVP decision) means a Redis crash affects sessions and BullMQ job queues simultaneously. The mitigation is fast recovery (restart Redis, jobs re-queue) but the risk should be acknowledged. At Phase 2, move to DigitalOcean Managed Redis.
> 

### 17.2 Business Risks

*(Retained from v1.0.)*

### 17.3 Market Risks

*(Retained from v1.0, with USSD addressed in Section 10.4.)*

---

## 18. Success Criteria

### 18.1 MVP Success Metrics (First 6 Months)

- 20,000+ registered patients, 200+ active doctors, 5,000+ appointments/month
- <5% cancellation rate, <10% no-show rate, 4.2+ average doctor rating
- 30% search-to-booking conversion rate
- API p95 latency <500ms, 99.9% uptime

### 18.2 Long-Term Vision (2 Years)

- Market leader: #1 healthcare booking platform in Madagascar
- 100,000+ active patients, 1,500+ doctors, all 22 regions
- 50,000+ appointments/month
- Self-sustaining revenue model

---

## 19. Architecture Review Summary

> This section is new in v1.1. It summarises every change made during the architect review.
> 

### What was retained (sound decisions)

- Modular monolith decision (ADR-001) — excellent rationale, correct for this context
- Schema-per-module PostgreSQL pattern — right approach
- Domain events for cross-module communication — correct
- Redis + BullMQ for job queues — correct
- Adapter pattern for SMS, video, payments — correct
- Phased rollout strategy — realistic and well-ordered
- SMS-first communication for Madagascar — correct market insight
- PWA + offline support — correct for the connectivity context
- Mobile-first, Malagasy/French language support — correct
- Two-layer slot locking (Redis TTL NX + PostgreSQL INSERT ON CONFLICT DO NOTHING) — correct concurrency approach

### What was changed

| Area | v1.0 | v1.1 | Reason |
| --- | --- | --- | --- |
| Architecture contradiction | Section 13 specified Kubernetes | Kubernetes explicitly deferred; Docker Compose only until ADR-001 triggers are hit | Direct contradiction of ADR-001 |
| Infrastructure costs | Section 16.2 used microservices-era figures ($500 compute, $300 DB) | Corrected to match modular monolith (~$80 compute, ~$50 DB) | Contradicted ADR-001 cost savings |
| Availability entity | Single table mixing templates + exceptions | Split into WeeklyScheduleTemplate + ScheduleException | Design flaw: mixed concerns caused update anomalies |
| Monetary fields | DECIMAL type | INTEGER (Ariary as smallest unit) | Floating-point errors in financial data |
| Timestamps | TIMESTAMP | TIMESTAMPTZ | Timezone-awareness required for GMT+3 |
| File URLs | prescription_url (full URL stored) | prescription_storage_key (object key only; pre-signed URL generated on demand) | Security: full URLs are persistent; pre-signed URLs expire |
| Geolocation | lat DECIMAL + lng DECIMAL | GEOMETRY(Point, 4326) via PostGIS | Enables ST_DWithin spatial queries; replaces application-level distance math |
| Stack ambiguity | NestJS or Django | NestJS only | Teams must commit to one stack |
| Frontend state | Zustand or Redux Toolkit | Zustand only | Reduces ambiguity; Redux unnecessary at this scale |
| Mobile framework | React Native or Flutter | React Native only | Flutter requires Dart; team uses TypeScript |
| SMS fallback | Twilio | Africa's Talking | Better African market routing, lower cost |
| Video fallback | Twilio Video | [Daily.co](http://Daily.co) | Simpler ops, more competitive pricing |
| Monitoring stack | New Relic/Datadog/ELK/PagerDuty | Sentry + Grafana Cloud free tiers | $0 vs ~$500/month; adequate for MVP |
| Maps | Google Maps primary | OpenStreetMap primary | Cost; Google Maps as optional upgrade |
| Elasticsearch | Specified in index section (contradiction) | Deferred; use pg_trgm until >100k doctors | Contradicted stack decision |
| SMS rescheduling | "Reply R to Reschedule" | Removed from MVP | Requires complex inbound SMS parsing flow |
| Logout endpoint | Missing | Added POST /auth/logout | JWT refresh tokens must be invalidated on logout |
| Slot lock API | Implicit | Explicit POST /slots/lock + DELETE | First-class booking flow state |
| Redis co-location risk | Unacknowledged | Added to risk register | Single point of failure for sessions + queues |
| USSD | Mentioned in risks, not specced | Added to Section 10.4 and Phase 3 roadmap | Rural market access requires a concrete plan |
| Call recording (Jitsi) | Implied as MVP feature | Deferred to Phase 2 (requires Jibri component) | Significant operational complexity |
| SlotLockExpired event | Missing | Added to domain events | Required for clean slot release flow |

---

## 20. Conclusion

This specification describes a well-conceived healthcare booking platform for a market with specific and well-understood constraints. The v1.0 foundation is solid — the modular monolith decision, domain-driven module structure, SMS-first approach, and phased rollout are all correct calls.

The v1.1 review corrected internal consistency issues (primarily the Kubernetes/cost contradiction), redesigned the Availability data model to remove a structural flaw, and eliminated technology ambiguity by making single authoritative stack choices.

**The platform is ready for detailed design and implementation sprint planning.**

**Next Steps:**

1. Product team reviews v1.1 and confirms scope for Phase 1 sprint
2. Engineering lead sets up monorepo, NestJS scaffold, Docker Compose dev environment
3. Database schema DDL scripts generated from the data models in Section 5
4. OpenAPI/Swagger spec generated from the API endpoints in Section 6
5. UX wireframes validated against the 3-tap booking flow requirement
6. Legal review of Madagascar Law No. 2014-038 (data protection)
7. SMS provider accounts opened (Orange Madagascar, Africa's Talking as fallback)
8. Pilot launch in Antananarivo with 50–100 onboarded doctors

---

---

## 21. Architecture Review Summary — v1.2 Changes

> This section documents changes made in the v1.2 review. All v1.1 changes remain in Section 19.
> 

| Area | v1.1 | v1.2 | Reason |
| --- | --- | --- | --- |
| Refresh token delivery | "stored in Redis" (mechanism unspecified) | Explicitly: `Set-Cookie` header with `HttpOnly; Secure; SameSite=Strict`. Never in response body. | Roadmap Step 10 said "httpOnly cookie" but spec never mandated this at the API level — cross-document inconsistency |
| Prisma + PostGIS | `geolocation: GEOMETRY(Point, 4326)` shown as a normal column | Must use `Unsupported("geometry(Point, 4326)")` in Prisma schema; all geo queries via `$queryRaw` | Prisma does not natively support PostGIS types — would cause Prisma generate errors |
| WebSocket packages | "[Socket.io](http://Socket.io)" mentioned generically | `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io` listed explicitly with AvailabilityGateway described | Roadmap never installed these packages; would have been missed during implementation |

---

---

## 22. Architecture Review Summary — v1.3 Changes

> This section documents changes made in the v1.3 review (cross-referenced with Roadmap v1.2 corrections). All prior changes remain in Sections 19 and 21.
> 

| Area | v1.2 | v1.3 | Reason |
| --- | --- | --- | --- |
| Redis eviction policy | Not specified in spec (was `allkeys-lru` in roadmap `docker-compose.prod.yml`) | Mandated `noeviction` for all Redis instances used with BullMQ | `allkeys-lru` silently evicts BullMQ job data under memory pressure — appointments lose their SMS reminders with no error thrown. `noeviction` causes a hard OOM error instead, which is detectable and alertable. |
| Nginx WebSocket headers | Nginx config shown without WebSocket upgrade headers | All Nginx proxy configs must include `Upgrade`, `Connection: upgrade`, `proxy_http_version 1.1`, and idle timeout settings | Without these headers Nginx terminates WebSocket upgrade handshakes — [Socket.io](http://Socket.io) silently falls back to long-polling, breaking the real-time slot availability feature |
| Turborepo v2 | `turbo.json` used `"pipeline"` key (mentioned without version caveat) | Added explicit note: `"pipeline"` renamed to `"tasks"` in Turborepo v2 — a hard breaking change | Running `pnpm turbo build` with the wrong key produces an immediate startup error |
| `@types/socket.io` | Package listed as a dev dependency | Must NOT be installed; [Socket.io](http://Socket.io) v4+ ships its own types; this package targets v2 and creates type conflicts | Type errors would surface immediately on `tsc` — affects every file importing from `socket.io` |
| `@nestjs/throttler` Redis storage | `ThrottlerStorageRedisService` shown without install context | Requires separate `@nest-lab/throttler-storage-redis` package; `ttl` is milliseconds in v5+ | Wrong import causes runtime crash; wrong `ttl` unit creates a 60ms rate limit window instead of 60 seconds |
| Grafana Agent | Referenced as the metrics/log collector | Replaced by Grafana Alloy; old `grafana/agent` download URL is dead (returns 404) | New installations would fail at the curl step; Alloy is the supported successor |

---

> ⚠️ **Review Note (v1.3):** This review was conducted against Roadmap v1.2. The spec additions above are infrastructure-level requirements that must be enforced at the platform level, not left to individual implementers to discover.
> 

---

**Document Version:** 1.3 (Third Architect Review)  

**Original Version:** 1.0 (February 17, 2026)  

**Last revised:** February 2026  

**Status:** Approved for Implementation