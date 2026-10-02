# e-tady-dokotera Module Map & Quick Reference

## Module Dependency Graph

```
                    ┌─── shared (Redis, DB, Events)
                    │
                auth ├─→ doctors
                    │    │
                    └───→ appointments ──→ scheduling ──→ notifications
                                  │
                                  └──→ video

                    analytics (read-only from all)
```

## All 8 Modules: Structure & Key Files

### 1. auth
**Path:** `apps/api/src/modules/auth/`

| Layer | Key Files |
|-------|-----------|
| **domain/** | user.entity.ts, otp.entity.ts |
| **application/** | auth.service.ts, otp.service.ts, jwt.strategy.ts |
| **infrastructure/** | user.repository.ts, auth.adapter.ts (SMS provider) |
| **api/** | auth.controller.ts (POST /register, POST /login, POST /refresh) |

**Primary Entities:** User, Session, OTP
**Key Logic:** JWT (access + refresh), OTP verification, bcrypt hashing
**Events:** RegisteredEvent, LoggedInEvent
**No Dependencies:** (only used by other modules, doesn't call them)

---

### 2. doctors
**Path:** `apps/api/src/modules/doctors/`

| Layer | Key Files |
|-------|-----------|
| **domain/** | doctor.entity.ts, specialty.entity.ts, doctor-facility.entity.ts |
| **application/** | doctor-search.service.ts, doctor.service.ts |
| **infrastructure/** | doctor.repository.ts (pg_trgm fuzzy search) |
| **api/** | doctor.controller.ts (GET /doctors, GET /doctors/:id, GET /doctors/search) |

**Primary Entities:** Doctor, Specialty, DoctorFacility
**Key Logic:** pg_trgm fuzzy matching, distance-based location search, profile visibility
**Events:** DoctorProfileUpdatedEvent
**Depends On:** None (read-only, no events triggered by appointments)
**Used By:** Appointments, Analytics

---

### 3. appointments
**Path:** `apps/api/src/modules/appointments/`

| Layer | Key Files |
|-------|-----------|
| **domain/** | appointment.entity.ts, appointment.rules.ts, slot-lock.entity.ts |
| **application/** | appointment.service.ts, slot-locker.service.ts |
| **infrastructure/** | appointment.repository.ts, slot-lock.repository.ts |
| **api/** | appointment.controller.ts (POST /appointments, PATCH /appointments/:id, DELETE /appointments/:id) |

**Primary Entities:** Appointment, SlotLock
**Key Logic:** 2-layer slot locking (Redis TTL + PostgreSQL FOR UPDATE), business rule validation
**Events:** **AppointmentBookedEvent**, AppointmentCancelledEvent, AppointmentRescheduledEvent
**Depends On:** Doctors (check availability), Scheduling (validate slot exists)
**Used By:** Notifications, Video, Analytics

**Critical:** Slot locking prevents overbooking
- Redis holds short-term lock (5 min TTL during booking flow)
- PostgreSQL unique constraint is the hard guarantee

---

### 4. scheduling
**Path:** `apps/api/src/modules/scheduling/`

| Layer | Key Files |
|-------|-----------|
| **domain/** | weekly-schedule-template.entity.ts, schedule-exception.entity.ts |
| **application/** | scheduling.service.ts, slot-generator.service.ts |
| **infrastructure/** | scheduling.repository.ts, slot-generator.repository.ts |
| **api/** | scheduling.controller.ts (POST /schedules, GET /schedules/:doctorId, POST /schedules/exceptions) |

**Primary Entities:** WeeklyScheduleTemplate, ScheduleException
**Key Logic:** Weekly templates + exceptions, slot generation for availability windows
**Events:** ScheduleUpdatedEvent
**Depends On:** None directly (reads from Appointments to check conflicts)
**Used By:** Appointments (validate slot), Notifications (send reminders)

**Critical:** Slot generation must be deterministic
- 30-min slots (configurable)
- Respects doctor's working hours and days off

---

### 5. notifications
**Path:** `apps/api/src/modules/notifications/`

| Layer | Key Files |
|-------|-----------|
| **domain/** | notification-log.entity.ts, sms-opt-out.entity.ts |
| **application/** | notification.service.ts, sms.queue.ts, email.queue.ts |
| **infrastructure/** | sms.adapter.ts (Orange Madagascar), email.adapter.ts, notification.repository.ts |
| **api/** | notifications.controller.ts (rarely called directly; mostly event-driven) |

**Primary Entities:** NotificationLog, SmsOptOut
**Key Logic:** BullMQ job queue, SMS + email delivery, retry strategy, provider abstraction
**Events:** **Listens to** AppointmentBookedEvent, AppointmentCancelledEvent, ReminderDueEvent
**Depends On:** Nothing (reads logs, doesn't modify other modules)
**Used By:** None (fully event-driven)

**Critical:** BullMQ must use `noeviction` Redis policy
- Retry: 3 attempts with exponential backoff
- SMS primary (Orange Madagascar), email fallback

---

### 6. video
**Path:** `apps/api/src/modules/video/`

| Layer | Key Files |
|-------|-----------|
| **domain/** | consultation.entity.ts, jitsi-session.entity.ts |
| **application/** | video.service.ts, jitsi.adapter.ts (JWT token generation) |
| **infrastructure/** | consultation.repository.ts |
| **api/** | video.controller.ts (POST /consultations/:id/token, GET /consultations/:id/token-refresh) |

**Primary Entities:** Consultation, JitsiSession
**Key Logic:** Jitsi Meet integration, JWT token generation (2h expiry, 4h max), WebRTC + audio fallback
**Events:** ConsultationStartedEvent, ConsultationEndedEvent
**Depends On:** Appointments (validate consultation slot exists)
**Used By:** None directly (stores consultation state)

**Critical:** Token expiry strategy
- 2h initial token (matches Jitsi session timeout)
- Token refresh endpoint for long consultations

---

### 7. analytics
**Path:** `apps/api/src/modules/analytics/`

| Layer | Key Files |
|-------|-----------|
| **domain/** | report.entity.ts |
| **application/** | analytics.service.ts |
| **infrastructure/** | analytics.repository.ts (cross-schema queries via $queryRaw) |
| **api/** | analytics.controller.ts (GET /analytics/doctor-stats, GET /analytics/appointment-trends) |

**Primary Entities:** ReportSnapshot
**Key Logic:** Read-only aggregates across all schemas, time-series data
**Events:** Never fires events, never listens
**Depends On:** Read-only access to all schemas
**Used By:** Admin dashboard

**Critical:** All queries must use `$queryRaw` with explicit schema qualification

---

### 8. shared
**Path:** `apps/api/src/shared/`

| Layer | Files |
|-------|-------|
| **redis/** | redis.module.ts, redis.service.ts |
| **database/** | database.module.ts, prisma.service.ts |
| **middleware/** | request-id.middleware.ts, auth.middleware.ts |
| **events/** | domain events (AppointmentBooked, etc.) |
| **guards/** | jwt.guard.ts, roles.guard.ts, phone-throttler.guard.ts |
| **filters/** | http-exception.filter.ts |

**Never depends on feature modules** (reverse direction only)

---

## Frontend Structure at a Glance

```
apps/web/src/
├── pages/
│   ├── DoctorSearchPage.tsx       (doctor list + filters + map)
│   ├── AppointmentBookingPage.tsx (slot selection + confirm)
│   ├── DoctorProfilePage.tsx      (public doctor profile)
│   ├── DashboardPage.tsx          (user appointments + reschedule/cancel)
│   └── ...
├── components/
│   ├── DoctorCard.tsx         (doctor listing card)
│   ├── TimeSlotPicker.tsx     (slot selection widget)
│   ├── ConfirmationModal.tsx  (2-step booking confirmation)
│   └── ...
├── hooks/
│   ├── useAuth.ts             (Zustand auth state)
│   ├── useSearch.ts           (doctor search + filters)
│   ├── useIdleLogout.ts       (PWA session timeout)
│   └── ...
├── stores/
│   ├── authStore.ts           (Zustand: user, accessToken, isLoggedIn)
│   └── ...
└── api/
    ├── doctors.ts             (GET /doctors/search)
    ├── appointments.ts        (POST /appointments, PATCH, DELETE)
    └── ...
```

---

## Common Feature Implementation Checklist

### "I need to implement feature X" — what do I touch?

| Feature | Modules | Layers | Events |
|---------|---------|--------|--------|
| Doctor registration | doctors, auth, notifications | domain + application + infrastructure + api | DoctorRegisteredEvent |
| Doctor search | doctors, video (lazy-load map) | application + infrastructure + api | None |
| Book appointment | appointments, scheduling, doctors, notifications | all 4 layers | AppointmentBookedEvent → SMS |
| Cancel appointment | appointments, notifications, scheduling | all 4 layers | AppointmentCancelledEvent → SMS |
| Reschedule appointment | appointments, scheduling, notifications | all 4 layers | AppointmentRescheduledEvent → SMS |
| Send reminder | scheduling, notifications | application + infrastructure | ReminderDueEvent (via scheduler/cron) |
| Start video call | video, appointments | application + infrastructure + api | ConsultationStartedEvent |
| View appointment history | appointments, analytics | application + infrastructure | None (read-only) |

---

## Documentation File Roadmap

| Doc | Size | Use When | Key Sections |
|-----|------|----------|--------------|
| **spec.md** (v1.6, 97 KB) | Full spec | Questions about "why this design?" | §2 Architecture, §3 Modules, §5 Data Model |
| **roadmap.md** (v1.7, 165 KB) | Implementation steps | Questions about "what's the next step?" | Steps 1-40, Phase 2 deferral |
| **decisions.md** (37 KB) | ADRs | Questions about "why NOT that approach?" | Past rejected ideas, rationale |
| **DESIGN.md** (5.7 KB) | UI rules | Questions about colors, spacing, typography | No-Line Rule, ROUND_FULL, surface hierarchy |
| **tech-stack-wiki.md** (62 KB) | Tech deep-dives | Questions about "how does NestJS do X?" | NestJS patterns, Prisma tips, React rules |
| **CLAUDE.md** (~3 KB) | Coding rules | Questions about "how should I structure this?" | SOLID, @db.Timestamptz, event patterns |

---

## Critical Constraints to Remember

### Database
- **All timestamps:** `@db.Timestamptz` (not `@db.Timestamp`)
- **All money:** Integer (Ariary), never Decimal/Float
- **All IDs:** String @id @default(uuid())
- **Foreign keys:** No direct cross-schema writes (use domain events)

### Authentication
- **Access token:** Zustand memory only, NEVER localStorage
- **Refresh token:** HttpOnly cookie only, NEVER response body
- **OTP:** Rate-limited per phone (PhoneThrottlerGuard)

### Performance
- **Redis:** MUST use `noeviction` policy (BullMQ fails silently on other policies)
- **Slot locking:** Redis TTL (UX hold) + PostgreSQL unique constraint (guarantee)
- **Search:** pg_trgm fuzzy matching (indexes on specialty columns)

### Module Communication
- **No circular dependencies**
- **No direct cross-schema DB writes**
- **All side effects via domain events** (@OnEvent with try/catch + Sentry)
- **Cross-module calls via public service interfaces only**

### Error Handling
- **All @OnEvent handlers must have try/catch + Sentry**
- **Services return consistent error shape:** `{ success: false, error: { code, message } }`
- **No swallowing errors** — either handle or propagate with context

---

## Grep Shortcuts for Quick Navigation

```bash
# Find all domain events
grep -r "export class.*Event" apps/api/src/shared/events/

# Find all repositories
find apps/api/src/modules -name "*.repository.ts"

# Find all controllers (API endpoints)
find apps/api/src/modules -name "*.controller.ts"

# Find all services
find apps/api/src/modules -name "*service.ts"

# Find Redis usage
grep -r "this.redis\|REDIS" apps/api/src/

# Find BullMQ job definitions
grep -r "@Processor\|@QueueAction" apps/api/src/modules/notifications/

# Find domain events listeners
grep -r "@OnEvent" apps/api/src/modules/

# Find TypeORM/Prisma queries outside repositories (bad pattern)
grep -r "prisma\." apps/api/src/modules --exclude="*.repository.ts"
```

---

## File Path Template

Every feature follows this pattern:

```
apps/api/src/modules/[MODULE_NAME]/
├── domain/
│   ├── [entity].entity.ts
│   └── [entity].rules.ts (or .spec.ts)
├── application/
│   ├── [feature].service.ts
│   └── [feature].factory.ts
├── infrastructure/
│   ├── [entity].repository.ts
│   ├── [external].adapter.ts
│   └── [feature].queue.ts
└── api/
    ├── [feature].controller.ts
    └── dtos/
        ├── [feature].request.dto.ts
        └── [feature].response.dto.ts
```

**Golden rule:** No Prisma outside `infrastructure/` repositories.

---

## Quick Links to Key Code

| What | Where | Line |
|------|-------|------|
| Module registration | apps/api/src/app.module.ts | 68-75 |
| Domain events definition | apps/api/src/shared/events/ | various |
| Event listener pattern | app.module.ts or any service | See @OnEvent example |
| Auth guard usage | Any controller | See @UseGuards |
| Error handling filter | apps/api/src/shared/filters/ | See HttpExceptionFilter |
| Prisma schema path | apps/api/prisma/schema.prisma | 1 |
| Frontend auth store | apps/web/src/stores/authStore.ts | 1 |

