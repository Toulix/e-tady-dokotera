# API & Application Logic Review — e-tady-dokotera

**Reviewer:** Senior Backend Engineer (NestJS / REST API)
**Date:** 2026-03-03
**Documents reviewed:** `docs/spec.md` (v1.3), `docs/roadmap.md` (v1.4)
**Implementation sync:** 2026-03-05 — all 17 findings written back to `docs/spec.md` and `docs/roadmap.md` (v1.5)

**17 findings: 2 Critical, 5 High, 5 Medium, 5 Low — all resolved ✅**

---

## ISSUE-01 — CRITICAL: Self-Registration as Admin via `user_type` Field

**Location:** `POST /api/v1/auth/register` (Spec §6.2, Roadmap Step 8)

**Problem:** The endpoint body includes `user_type` with no allowlist. The User enum includes `admin` and `support`. Any anonymous caller can POST `{ "user_type": "admin" }` and gain full platform access. Neither `RegisterDto` nor `AuthRepository.createUser()` restricts which user types are self-registrable.

**Fix:**
```typescript
// register.dto.ts
export class RegisterDto {
  @IsIn(['patient'])  // ONLY 'patient' allowed via public endpoint
  user_type: 'patient';
}
```
Doctor accounts go through an admin-initiated invite flow. Admin/support accounts via internal tooling only.

---

## ISSUE-02 — CRITICAL: Spec/Roadmap Inconsistency on Slot Locking Layer 2

**Location:** Spec Section 3.1.3; Roadmap Step 19

**Problem:** The spec (Section 3.1.3) says "PostgreSQL `SELECT FOR UPDATE` on the target slot row." The roadmap (Step 19, v1.1 fix) correctly replaces this with `INSERT ... ON CONFLICT DO NOTHING`. The spec was never updated. An engineer reading only the spec will implement the wrong pattern — `SELECT FOR UPDATE` requires an existing row and creates serialization bottlenecks.

**Fix:** Update spec Section 3.1.3. See cross-doc FINDING-2.

---

## ISSUE-03 — HIGH: k6 Script Syntax Error — Load Test Never Runs

**Location:** Roadmap Step 35, `infra/k6/booking-flow.js`

**Problem:** The `http.post()` call has an unclosed `headers` object literal:
```javascript
{
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  { tags: { name: 'slot-lock' } },   // ← BUG: headers never closed
```
k6 fails to parse the script and exits with code 1. The entire performance baseline is broken.

**Fix:**
```javascript
{
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  tags: { name: 'slot-lock' },
},
```

---

## ISSUE-04 — HIGH: `ignoreErrors: true` With No Mandatory Error Logging Pattern

**Location:** Roadmap Step 3b, `EventEmitterModule.forRoot`

**Problem:** `ignoreErrors: true` correctly prevents notification failures from crashing the booking process. But errors in `@OnEvent` handlers are completely silently swallowed — no log, no Sentry capture. On a healthcare platform, a failed SMS with no trace is operationally dangerous.

**Fix:** Document a mandatory pattern for ALL `@OnEvent` handlers:
```typescript
@OnEvent('appointment.booked')
async handle(event: AppointmentBookedEvent): Promise<void> {
  try {
    await this.notificationService.sendConfirmation(event.appointmentId);
  } catch (err) {
    this.logger.error('Failed to send booking confirmation', { err, event });
    Sentry.captureException(err, { extra: event });
  }
}
```

---

## ISSUE-05 — HIGH: Reminder Jobs Silently Skipped for Same-Day Appointments

**Location:** Roadmap Step 25, `handleAppointmentBooked`

**Problem:** The guard `if (msUntilAppt > offset)` correctly prevents scheduling past-due reminders. But for an appointment booked 1.5 hours ahead, ALL three guards (72h, 24h, 2h) are false — no reminders are queued at all, with no log and no documentation. Patients who book same-day get no reminders.

**Fix:** Add explicit logging and spec documentation:
```typescript
let queuedCount = 0;
for (const offset of [72 * 3600_000, 24 * 3600_000, 2 * 3600_000]) {
  if (msUntilAppt > offset) {
    await this.smsReminderQueue.add(...);
    queuedCount++;
  }
}
if (queuedCount === 0) {
  this.logger.log(`No reminders queued for appointment ${event.appointmentId} (less than 2h away)`);
}
```
Document in spec Section 3.1.5: "For appointments booked fewer than 2 hours in advance, reminders are skipped — the confirmation SMS is the only notification."

---

## ISSUE-06 — HIGH: Cookie `path` Is a Hardcoded String Literal

**Location:** Roadmap Step 8, `setRefreshCookie()` in `auth.controller.ts`

**Problem:** `path: '/api/v1/auth/refresh'` is hardcoded. If `app.setGlobalPrefix()` changes, the cookie path and actual endpoint path diverge — the browser never sends the cookie to the refresh endpoint.

**Fix:**
```typescript
private setRefreshCookie(response: Response, token: string): void {
  const prefix = this.config.get('API_PREFIX', 'api/v1');
  response.cookie('refresh_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: `/${prefix}/auth/refresh`,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}
```

---

## ISSUE-07 — HIGH: Refresh Token Redis Storage Format Never Specified

**Location:** Spec §6.2; Roadmap Step 8

**Problem:** Both documents say refresh tokens are "stored in Redis" with key `refresh:{user_id}` — but neither specifies whether the value is the raw JWT string or a hash. Raw token storage means a Redis compromise exposes all active sessions.

**Fix:** Roadmap Step 8 must specify:
```typescript
// Store hash, never the raw token:
const tokenHash = await bcrypt.hash(refreshToken, 10);
await this.redis.set(`refresh:${userId}`, tokenHash, 'EX', 7 * 24 * 3600);

// On rotation in /auth/refresh:
const stored = await this.redis.get(`refresh:${userId}`);
const valid = await bcrypt.compare(incomingToken, stored);
```

---

## ISSUE-08 — MEDIUM: `PATCH /appointments/:id` Overloads Cancel and Reschedule

**Location:** Spec §6.2, Roadmap Step 20

**Problem:** Cancel and reschedule have different: authorization rules (24h vs 48h), request body shapes, and domain event chains. Routing both through a single PATCH forces a discriminator field and internal branching.

**Fix:** Replace with named action endpoints:
```
POST /api/v1/appointments/:id/cancel      { reason? }
POST /api/v1/appointments/:id/reschedule  { new_start_time, lock_token }
```

---

## ISSUE-09 — MEDIUM: Missing Endpoints Implied by the Spec

**Location:** Spec §3.2.3, §3.1.5, §3.2.1; Roadmap Steps 11–22

Missing MVP-scope endpoints:
- `POST /api/v1/doctors/profile` — initial creation (only PATCH is defined)
- `POST /api/v1/appointments/:id/confirm` — doctor confirmation (status enum has `pending_confirmation` but no confirmation endpoint)
- `POST /api/v1/appointments/:id/review` + `GET /api/v1/doctors/:id/reviews` — implied by rating display and review-request SMS
- `PATCH /api/v1/scheduling/templates/:id` — update existing template
- Waitlist endpoints — Section 3.2.3 defines full Waitlist System

---

## ISSUE-10 — MEDIUM: Domain Event Classes Never Defined

**Location:** Roadmap Step 17 (`@OnEvent` handlers), Step 25

`AppointmentBookedEvent`, `AppointmentCancelledEvent`, `ScheduleTemplateUpdatedEvent` are referenced throughout but never defined. The `shared/events/` directory is created in Step 3 but never populated.

**Fix:** Add event class definitions to the roadmap. Example:
```typescript
// shared/events/appointment-booked.event.ts
export class AppointmentBookedEvent {
  constructor(
    public readonly appointmentId: string,
    public readonly doctorId: string,
    public readonly patientId: string,
    public readonly startTime: Date,
  ) {}
}
```

---

## ISSUE-11 — MEDIUM: Slot Generator Missing Timezone Arithmetic for TIME + DATE Combination

**Location:** Roadmap Step 16, `generateAvailableSlots`

**Problem:** `WeeklyScheduleTemplate` stores `start_time` as `TIME` (no timezone). Combining a calendar date with a local time-of-day to produce a UTC timestamp requires explicit GMT+3 arithmetic. Without it: (1) boundary-day slots will have wrong day-of-week attribution, (2) the "2h minimum advance booking" check will be 3 hours off.

**Fix:** Use luxon for timezone-aware datetime construction:
```typescript
import { DateTime } from 'luxon';

const slotStart = DateTime.fromObject(
  { year: date.year, month: date.month, day: date.day,
    hour: template.startTime.hour, minute: template.startTime.minute },
  { zone: timezone }
).toUTC();
```

---

## ISSUE-12 — MEDIUM: WebSocket Gateway CORS Uses `process.env` Directly

**Location:** Roadmap Step 18b, `@WebSocketGateway` decorator

**Problem:** `cors: { origin: process.env.FRONTEND_URL }` — the decorator is evaluated at class decoration time before DI is available. If `FRONTEND_URL` is undefined, Socket.io treats `origin: undefined` as `origin: '*'`.

**Fix:** Add a validation note — the value is read at module load time (acceptable, env vars are loaded before NestJS bootstraps), but add a startup check:
```typescript
// In AvailabilityGateway.afterInit():
afterInit() {
  if (!process.env.FRONTEND_URL) {
    throw new Error('FRONTEND_URL env var is required for WebSocket CORS');
  }
}
```

---

## ISSUE-13 — LOW: `DELETE /slots/lock/:token` Should Return 204

**Location:** Roadmap Step 20

DELETE with no response body should return **204 No Content**, not 200. Update both spec and roadmap.

---

## ISSUE-14 — LOW: `PATCH /appointments/:id/status` Missing Ownership Check

**Location:** Spec §6.2, Roadmap Step 20

`RolesGuard` checking `user_type === 'doctor'` allows any doctor to mark any appointment complete. The service must verify `appointment.doctorId === requestingUser.id`.

---

## ISSUE-15 — LOW: `HttpExceptionFilter` Implementation Never Shown

**Location:** Roadmap Step 3, `main.ts`

The filter is applied globally but never implemented. Without it, error responses may not match the spec's envelope format `{ success: false, data: null, meta: {...}, error: { code, message } }`.

---

## ISSUE-16 — LOW: `request_id` in Response Envelope — Source Never Defined

**Location:** Spec §6.1

The spec envelope includes `"request_id": "uuid"` in meta. Neither document specifies whether this is generated by the API or read from `X-Request-ID`. Without a `RequestIdMiddleware`, Sentry/Loki request correlation breaks.

**Fix:** Add `RequestIdMiddleware` that reads `X-Request-ID` header or generates a UUID, attaches it to `req.requestId`, and sets it in the response header. `ResponseEnvelopeInterceptor` reads it from request.

---

## ISSUE-17 — LOW: `Two Redis Connections Undocumented

**Location:** Roadmap Step 3b

BullMQ requires its own dedicated Redis connections (uses blocking commands). The `REDIS_CLIENT` and BullMQ connections are separate — correct, but undocumented. Add a comment in `app.module.ts` to prevent developers from attempting to share them.

---

## What Is Correctly Designed

1. Modular monolith (ADR-001) — correct for team size, cost, Madagascar network
2. Schema-per-module PostgreSQL — enforces boundaries at DDL level
3. WeeklyScheduleTemplate + ScheduleException split — correct calendar pattern
4. INT for money, Timestamptz for timestamps — critical correctness decisions
5. prescription_storage_key (key not URL) + pre-signed URLs — correct security
6. Unsupported("geometry(Point, 4326)") + $queryRaw in Repository — correct Prisma/PostGIS
7. Access token in body; refresh token in Set-Cookie: HttpOnly only — correct
8. Refresh token rotation on every /auth/refresh — correct
9. ignoreErrors: true on EventEmitter — correct for healthcare (notification must not crash booking)
10. Two-layer slot locking (Redis NX + INSERT ON CONFLICT + prisma.$transaction) — correct
11. BullMQ noeviction Redis policy in all environments — correct
12. SMS adapter pattern with config-driven factory — correct OCP application
13. i18n templates in JSON files — correct separation
14. @Global() RedisModule with named REDIS_CLIENT — correct
15. Repository pattern (no Prisma in services/controllers) — correct layering
16. Explicit POST /slots/lock and DELETE /slots/lock/:token endpoints — correct first-class state
17. @UseGuards(JwtAuthGuard) on /auth/logout — correct
18. All object storage via pre-signed URLs — correct security pattern

---

## Summary Table

| # | Severity | Issue |
|---|---|---|
| 01 | Critical | Self-registration as admin via unvalidated `user_type` field |
| 02 | Critical | Spec endorses SELECT FOR UPDATE; roadmap correctly uses INSERT ON CONFLICT — spec never updated |
| 03 | High | k6 script syntax error — unclosed object literal, load test never runs |
| 04 | High | ignoreErrors:true with no mandatory error logging — failed SMS notifications disappear silently |
| 05 | High | Reminder jobs silently skipped for same-day appointments with no log |
| 06 | High | Cookie `path` hardcoded — breaks if global prefix changes |
| 07 | High | Refresh token Redis storage format unspecified — raw JWT or hash? |
| 08 | Medium | PATCH /appointments/:id overloads cancel and reschedule |
| 09 | Medium | Missing MVP endpoints: doctor profile create, appointment confirm, reviews, reschedule |
| 10 | Medium | Domain event classes never defined in shared/events/ |
| 11 | Medium | Slot generator missing timezone arithmetic for TIME + DATE combination |
| 12 | Medium | WebSocket CORS via process.env — undefined opens all origins |
| 13 | Low | DELETE /slots/lock/:token should return 204, not 200 |
| 14 | Low | PATCH /appointments/:id/status missing doctor ownership check |
| 15 | Low | HttpExceptionFilter implementation never shown |
| 16 | Low | request_id source undefined — breaks Sentry/Loki correlation |
| 17 | Low | Two Redis connections undocumented — developers may try to share them |
