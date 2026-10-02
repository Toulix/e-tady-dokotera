# Explorer Agent — Example Queries

Use these as templates for navigating the codebase before implementing features.

---

## Category 1: File Discovery

### "Where should I implement X?"

```
User: "I need to add SMS confirmation for appointment reminders.
       Where does this code go?"

Expected Agent Response:
├── Affected Modules: scheduling, notifications
├── Primary Files:
│   ├── apps/api/src/modules/scheduling/application/slot-reminder.service.ts
│   ├── apps/api/src/modules/notifications/application/reminder.queue.ts
│   └── apps/api/src/shared/events/ReminderDueEvent.ts
└── Next: Read the slot-reminder service to understand current flow
```

### "Show me where API endpoints live"

```
User: "Show me all appointment endpoints"

Expected Agent Response:
├── apps/api/src/modules/appointments/api/appointment.controller.ts
│   ├── POST /appointments (line 45)
│   ├── PATCH /appointments/:id (line 80)
│   ├── DELETE /appointments/:id (line 120)
│   └── GET /appointments/:id (line 140)
└── Request the full controller to see DTOs and error handling
```

### "Where are the database models?"

```
User: "Find the Appointment entity definition"

Expected Agent Response:
├── Primary: apps/api/src/modules/appointments/domain/appointment.entity.ts
├── Repository: apps/api/src/modules/appointments/infrastructure/appointment.repository.ts
├── Prisma Schema: apps/api/prisma/schema.prisma (search "model Appointment")
└── Line X: Schema shows @db.Timestamptz usage
```

---

## Category 2: Documentation Search

### "Where's X documented?"

```
User: "Where is the refresh token strategy documented?"

Expected Agent Response:
├── Primary: docs/spec.md §2.2 "Authentication" (lines 120-180)
│   └── Covers JWT structure, refresh token rotation, HttpOnly cookie strategy
├── Implementation Guide: docs/roadmap.md Step 8 (lines 280-340)
│   └── Shows how to add RefreshTokenService
├── Code Reference: apps/api/src/modules/auth/application/auth.service.ts (line 200+)
│   └── Implements the pattern described in spec
└── Also check: CLAUDE.md "Refresh token: Set-Cookie header only, never in response body"
```

### "Find all references to topic X"

```
User: "Find all mentions of slot locking in docs"

Expected Agent Response:
├── spec.md §3.1 "Slot Locking Strategy" (lines 240-280)
│   └── 2-layer approach: Redis TTL + PostgreSQL unique constraint
├── roadmap.md Step 12 (lines 420-460)
│   └── Implementation checklist for slot locker
├── Code Examples:
│   ├── SlotLockService (apps/api/src/modules/appointments/application/slot-locker.service.ts line 50)
│   └── Repository method (apps/api/src/modules/appointments/infrastructure/appointment.repository.ts line 180)
└── Critical Rule: MUST use noeviction Redis policy (CLAUDE.md line 5)
```

### "Show me the edge cases for feature X"

```
User: "What edge cases are documented for appointment cancellation?"

Expected Agent Response:
├── spec.md §3.2 "Cancellation Rules" (lines 300-340)
│   ├── Can only cancel if >24h before appointment
│   ├── Refund depends on cancellation timing (handled in Phase 2)
│   └── Must notify doctor AND patient
├── Roadmap Step 15 "Cancellation Testing" (lines 310-360)
│   ├── Test: cancel within 24h (should fail)
│   ├── Test: cancel 24h+ before (should succeed)
│   └── Test: verify notifications sent
└── No Test: Refund logic (Phase 2 deferral)
```

---

## Category 3: Feature Flow Tracing

### "Show me the end-to-end flow for X"

```
User: "Show me the flow when a patient books an appointment"

Expected Agent Response:

## Request Path
1. **Frontend**: pages/AppointmentBookingPage.tsx
   └── Calls api/appointments.ts → POST /appointments

2. **API**: apps/api/src/modules/appointments/api/appointment.controller.ts (line 45)
   └── @Post() createAppointment(createDto: CreateAppointmentDto)

3. **Service**: apps/api/src/modules/appointments/application/appointment.service.ts (line 80)
   └── validateSlot() → lockSlot() → createAppointment()

4. **Slot Locker**: apps/api/src/modules/appointments/application/slot-locker.service.ts (line 120)
   └── Step 1: Try Redis lock (5 min TTL)
   └── Step 2: Verify PostgreSQL unique constraint

5. **Repository**: apps/api/src/modules/appointments/infrastructure/appointment.repository.ts (line 200)
   └── INSERT into appointments table

6. **Event**: Domain event AppointmentBookedEvent fires (line 50)
   └── Type definition: apps/api/src/shared/events/AppointmentBooked.event.ts

7. **Listener**: apps/api/src/modules/notifications/application/notification.service.ts (line 150)
   └── @OnEvent('appointment.booked')
   └── Enqueues SMS job to BullMQ

8. **Job Queue**: apps/api/src/modules/notifications/application/sms.queue.ts
   └── @QueueAction() sendSms() with Orange Madagascar adapter

## Database Changes
- appointments table: new row with createdAt, updatedAt timestamps (TIMESTAMPTZ)
- slot_locks table: temporary lock entry (expires after 5 min if not committed)

## Caching
- Doctor's available slots cache invalidated (Redis key: doctor:{id}:slots)

## Edge Cases Handled
- [ ] Slot already booked (constraint violation caught)
- [ ] Patient already has appointment (business rule in appointment.rules.ts)
- [ ] SMS fails (retry via BullMQ 3 times with exponential backoff)
- [ ] Slot doesn't exist (validate against scheduling module)

## Performance Notes
- Slot locking is optimistic first, pessimistic second (see spec.md §3.1)
- Search for "SELECT FOR UPDATE" in spec — docs now recommend unique constraint instead
- No N+1 queries: doctor profile preloaded (Prisma select optimization)
```

### "How does X interact with Y?"

```
User: "How do scheduling and appointments modules interact?"

Expected Agent Response:

## Cross-Module Calls
1. Appointments → Scheduling (sync call, no event)
   - Appointment.service.ts calls SchedulingService.validateSlotExists()
   - Checks if doctor has availability for requested time
   - Returns: boolean | throws NotFoundException

2. Scheduling → Appointments (read-only via Repository)
   - Slot generator queries appointment table to avoid booking conflicts
   - Query: SELECT * FROM appointments WHERE doctor_id = X AND status != 'CANCELLED'

## Database Relationships
- Appointment.doctorId (foreign key) → Doctor.id
- Appointment.slotId (soft reference) → scheduling_slots (no FK, derived from template)

## Events
- Scheduling fires: ScheduleUpdatedEvent (when doctor adds/modifies template)
- Appointments listens: None (but SchedulingService reads appointments)
- No circular dependency ✓

## If Scheduling Changes...
- Doctor's available slots recalculated
- Appointments MUST validate new availability before allowing reschedule
- See appointment.rules.ts for validation logic (line 120)
```

---

## Category 4: Module-Level Questions

### "What's in module X?"

```
User: "Tell me about the notifications module"

Expected Agent Response:

## Notifications Module Overview

### Purpose
Asynchronous notification delivery via SMS and email, event-driven, BullMQ-backed.

### Files & Responsibilities
- **Domain**
  - notification-log.entity.ts: audit trail of sent notifications
  - sms-opt-out.entity.ts: user preferences for SMS suppression

- **Application**
  - notification.service.ts: orchestrator, creates/logs notifications
  - sms.queue.ts: BullMQ processor for SMS jobs
  - email.queue.ts: BullMQ processor for email jobs

- **Infrastructure**
  - sms.adapter.ts: Orange Madagascar provider integration
  - email.adapter.ts: SendGrid or similar
  - notification.repository.ts: log persistence

- **API**
  - notifications.controller.ts: rarely called directly
  - Only exposes GET /notifications/history (for admin)

### Event Subscriptions
- Listens to: AppointmentBooked, AppointmentCancelled, AppointmentRescheduled, ReminderDue
- Each triggers specific SMS/email templates

### Dependencies
- Redis (BullMQ storage)
- PostgreSQL (notification logs)
- External SMS provider (Orange Madagascar)

### Critical Constraints
- Redis noeviction policy required (if evicted, jobs are lost silently)
- Retry: 3 attempts with exponential backoff
- No sync SMS (all async via BullMQ)

### Performance Notes
- Intentional delay: 1-2s between job enqueue and send (allows for transaction rollback)
- Batching: multiple events in same second are sent in parallel

### Files to Read First
1. notification.service.ts (line 1-50) — see @OnEvent pattern
2. sms.queue.ts (line 60-120) — see how job is processed
3. sms.adapter.ts (line 1-40) — see provider abstraction
```

### "What does module X depend on?"

```
User: "What other modules depend on appointments?"

Expected Agent Response:

## Modules Depending on Appointments

1. **notifications** (strong dependency)
   - Listens to AppointmentBooked, AppointmentCancelled events
   - Queries appointment data when building SMS templates
   - Can function independently (graceful degradation if appointments down)

2. **video** (medium dependency)
   - Reads appointment.slotTime to validate consultation timing
   - Creates consultation record linked to appointment
   - VideoService.startConsultation() requires valid appointment first

3. **scheduling** (weak, read-only)
   - Queries appointment table to check for booking conflicts
   - Generates slots aware of existing appointments
   - No event dependency, just queries

4. **analytics** (weak, read-only)
   - Aggregates appointment counts, trends, revenue
   - Cannot modify appointment data
   - Can lag behind live appointments (eventual consistency OK)

5. **doctors** (weak, read-only)
   - No direct dependency
   - Appointment validates doctor exists before booking

## Reverse: What Appointments Depends On

1. **scheduling** (check slot exists)
2. **doctors** (validate doctor available)
3. **auth** (verify user identity)
4. **shared** (Redis, Database, Events)

## If Appointments Schema Changes...
- All listeners (notifications, video) must adapt
- Backwards compatibility: only ADD columns, never REMOVE
- Deprecated fields can be left NULL (see spec.md schema versioning)
```

---

## Category 5: Constraint & Error Handling

### "What validation happens for X?"

```
User: "What validation occurs when booking an appointment?"

Expected Agent Response:

## Appointment Booking Validation Chain

### Request Validation (DTO level)
File: apps/api/src/modules/appointments/api/dtos/create-appointment.request.dto.ts
- [ ] doctorId: required, must be UUID
- [ ] slotTime: required, must be ISO 8601 datetime
- [ ] reason: required, string 10-500 chars
- [ ] patientNotes: optional, max 1000 chars

### Business Logic Validation (Service level)
File: apps/api/src/modules/appointments/domain/appointment.rules.ts
- [ ] Doctor exists (queries doctors module)
- [ ] Doctor is active/verified
- [ ] Slot exists in scheduling (queries scheduling module)
- [ ] Slot is not in the past
- [ ] Patient not already booked for that time
- [ ] Patient not already has appointment with that doctor today
- [ ] Doctor has max N appointments per day (from config)

### Concurrency Validation (Repository level)
File: apps/api/src/modules/appointments/infrastructure/appointment.repository.ts
- [ ] Redis lock acquired successfully (5 min TTL)
- [ ] PostgreSQL unique constraint not violated (hard guarantee)
- [ ] Slot lock not already held by another patient

### If Validation Fails
- Return: 400 Bad Request or 409 Conflict
- Error format: { success: false, error: { code: 'SLOT_UNAVAILABLE', message: '...' } }
- No partial state (transaction rolls back)

### Edge Cases Tested
- See roadmap.md Step 14 "Appointment Booking Tests" (lines 480-520)
```

---

## Category 6: Performance & Optimization

### "What are the performance implications of feature X?"

```
User: "I'm adding a 'notes' field to appointments. Any performance impact?"

Expected Agent Response:

## Performance Impact Analysis

### Database
- Appointment table gets new VARCHAR column
- No index needed (not a filter/sort key)
- SELECT queries: use Prisma select to exclude notes if not needed
- Migration: ADD COLUMN with DEFAULT NULL (fast, non-blocking)

### Query Impact
- SELECT * queries now return longer rows (minimal impact)
- Search/filtering: no change (notes not searchable)
- Recommended: Explicitly select fields in repository (line 150)
  ```ts
  // Before
  const appt = await prisma.appointment.findUnique({ where: { id } });

  // After (faster, more explicit)
  const appt = await prisma.appointment.findUnique({
    where: { id },
    select: { id: true, doctorId: true, notes: true, ... }
  });
  ```

### API Response Impact
- Response size increases by ~200 bytes per appointment
- If returning 100 appointments, +20KB response size
- Frontend caching not affected (same endpoint)

### Recommendation
- ✓ Safe to add
- Use select to avoid leaking internal fields
- Reference: CLAUDE.md "Prisma select vs include"
```

---

## Category 7: Testing Questions

### "What tests exist for feature X?"

```
User: "Show me the tests for slot locking"

Expected Agent Response:

## Slot Locking Tests

### Location
- Primary: apps/api/src/modules/appointments/tests/slot-locker.spec.ts
- Integration: apps/api/src/tests/integration/appointment-booking.e2e.ts

### Test Cases (unit)
1. ✓ Lock acquired successfully (happy path)
2. ✓ Lock released on commit
3. ✓ Lock expires after TTL
4. ✓ Concurrent lock attempt blocked
5. ✓ Redis unavailable, falls back to PostgreSQL constraint

### Test Cases (integration)
1. ✓ Two patients try to book same slot simultaneously
   - First succeeds, second gets 409 Conflict
   - See e2e.ts line 200

2. ✓ Lock held but transaction rolls back
   - Lock should release
   - Slot should become available again

3. ✓ Patient spam-books (10 rapid requests)
   - Only first lock succeeds
   - Others queued/rejected

### Known Gaps (from roadmap.md Step 14)
- [ ] Redis connection loss during lock (not tested)
- [ ] Millisecond-level race condition (very rare)
```

---

## Category 8: Architecture Decision Questions

### "Why was X designed this way?"

```
User: "Why do we use Redis + PostgreSQL for slot locking?
       Why not just PostgreSQL?"

Expected Agent Response:

## Slot Locking: Design Rationale

### The Problem
- Two patients click "book" simultaneously for the last slot
- Both should not get the same slot

### Solution: Two-Layer Locking
1. **Redis (UX layer)**: Fast, short-term hold (5 min TTL)
   - Prevents repeated booking attempts
   - Gives patient time to confirm and pay
   - Expires automatically (doesn't require cleanup)

2. **PostgreSQL (Safety layer)**: Hard guarantee
   - Unique constraint `(doctor_id, slot_time)` with `WHERE status != 'CANCELLED'`
   - Even if Redis is down or lock expires, constraint catches duplicates
   - Final arbiter of truth

### Why Not Just PostgreSQL?
- ✗ SELECT FOR UPDATE is slow (row-level lock, synchronous)
- ✗ Would block all other doctors' bookings (lock contention)
- ✗ Doesn't provide good UX (patient sees "locked" for 5+ seconds)

### Why Not Just Redis?
- ✗ Jobs can be evicted if Redis memory full (with wrong policy)
- ✗ No durability (server crash = lost locks)
- ✗ Application must handle cleanup (complexity)

### Evidence
- See spec.md §3.1 "Concurrency Model" (lines 240-280)
- See roadmap.md Step 12 (implementation checklist)
- Research: PostgreSQL advisory locks vs. unique constraints (tech-stack-wiki.md)

### Conclusion
Two-layer approach is the standard for booking systems (Uber, Airbnb, Amazon).
```

---

## How to Use This Explorer Agent

### Before Implementing ANY Feature:

1. **Run a discovery query:**
   ```
   "I'm adding [feature X]. Show me:
    - Affected modules
    - Files I'll need to modify
    - Where tests go
    - What docs to read first"
   ```

2. **Read the docs first:**
   ```
   "Find documentation for [feature X] with line numbers"
   ```

3. **Trace the flow:**
   ```
   "Show me the end-to-end flow for [feature X]"
   ```

4. **Understand constraints:**
   ```
   "What edge cases and validation does [feature X] need?"
   ```

5. **Then start coding:**
   - Create files in the right layer
   - Follow the patterns you saw
   - Add tests before implementation

### If You Get Stuck:

1. **"I don't know which module this belongs in"**
   → Ask: "Show me the module dependency graph and explain which modules affect [my feature]"

2. **"I don't know if this pattern already exists"**
   → Ask: "Where can I find examples of [pattern X] in the codebase?"

3. **"I'm not sure about the database schema"**
   → Ask: "Show me the data model for [entity X] with field types"

4. **"I need to understand how X calls Y"**
   → Ask: "How do [module A] and [module B] interact?"

