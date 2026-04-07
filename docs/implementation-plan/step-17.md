# Step 17 — Availability Endpoint

**Status:** Implemented ✅
**Date:** 2026-04-08
**Depends on:** Step 16 (Slot generation algorithm)
**Required by:** Step 18 (Calendar slot picker UI), Step 18b (WebSocket gateway)

---

## What Was Built

A public `GET /api/v1/doctors/:id/availability` endpoint that returns available appointment slots for a doctor, grouped by date. It orchestrates data from 3 modules, calls the pure slot generator (Step 16), and caches results in Redis for 30 seconds with event-based invalidation.

### Files created

| File | Purpose |
|------|---------|
| `apps/api/src/modules/appointments/infrastructure/appointments.repository.ts` | DB queries for existing appointments + active slot locks |
| `apps/api/src/modules/appointments/application/appointments-query.service.ts` | Cross-module service interface for appointment data |
| `apps/api/src/modules/scheduling/application/availability.service.ts` | Core orchestration: fetch data, generate slots, cache |
| `apps/api/src/modules/scheduling/application/availability-cache.listener.ts` | Event-based cache invalidation (SCAN, not KEYS) |
| `apps/api/src/modules/scheduling/api/availability.controller.ts` | HTTP endpoint with query param validation |
| `apps/api/src/modules/scheduling/application/dto/availability-query.dto.ts` | Validates start_date, end_date, facility_id? |
| `apps/api/src/modules/scheduling/application/availability.service.spec.ts` | 11 unit tests |

### Files modified

| File | Change |
|------|--------|
| `apps/api/src/modules/appointments/appointments.module.ts` | Wired AppointmentsRepository + AppointmentsQueryService |
| `apps/api/src/modules/doctors/application/doctors.service.ts` | Added `getMinAdvanceBookingHours()` |
| `apps/api/src/modules/scheduling/application/scheduling.service.ts` | Added `getSchedulingDataForAvailability()` |
| `apps/api/src/modules/scheduling/application/dto/index.ts` | Exported AvailabilityQueryDto |
| `apps/api/src/modules/scheduling/scheduling.module.ts` | Imported AppointmentsModule + DoctorsModule; added AvailabilityController, AvailabilityService, AvailabilityCacheListener |

---

## Endpoint Contract

```
GET /api/v1/doctors/:id/availability
  Query: start_date (YYYY-MM-DD, required)
         end_date   (YYYY-MM-DD, required)
         facility_id (UUID, optional)
  Auth:  None (public endpoint)
```

### Response

```json
{
  "2026-04-09": [
    {
      "startTime": "2026-04-09T06:00:00.000Z",
      "endTime": "2026-04-09T06:30:00.000Z",
      "appointmentType": "in_person",
      "isAvailable": true,
      "isEmergencyOnly": false,
      "facilityId": null
    }
  ],
  "2026-04-10": [...]
}
```

- All times are UTC ISO 8601.
- Dates with zero slots are omitted (not empty arrays).
- Dates are keyed in the doctor's local timezone (Indian/Antananarivo, UTC+3).

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Invalid date format, start > end, range > 31 days, past date, > 90 days ahead |
| 404 | Doctor not found |

---

## Architecture

```
SchedulingModule ──imports──> DoctorsModule
SchedulingModule ──imports──> AppointmentsModule
```

The `AvailabilityController` lives in the scheduling module with `@Controller('doctors')`. This avoids a circular dependency — DoctorsModule doesn't need to know about SchedulingModule.

### Data flow

```
Client request
  → AvailabilityController (parse + validate params)
  → AvailabilityService.getAvailability()
    → validateDateRange() — fail fast on bad input
    → tryReadCache() — Redis GET avail:{doctorId}:{start}:{end}
    → On cache miss: Promise.all([
        SchedulingService.getSchedulingDataForAvailability(),
        AppointmentsQueryService.getActiveAppointments(),
        AppointmentsQueryService.getActiveSlotLocks(),
        DoctorsService.getMinAdvanceBookingHours(),
      ])
    → Filter templates by facilityId (null + exact match)
    → generateAvailableSlots() (pure function from Step 16)
    → groupByDate() — group by local date, serialize Dates to ISO strings
    → tryWriteCache() — Redis SET with 30s TTL
  → Response
```

---

## Key Design Decisions

### D1 — Availability controller in the scheduling module

The endpoint URL is `GET /doctors/:id/availability` but it lives in the scheduling module, not doctors. This is because:
- The scheduling module owns the slot generator, templates, and exceptions
- Putting it in DoctorsModule would require importing SchedulingModule → circular dependency
- NestJS allows multiple controllers with the same route prefix across modules

### D2 — Minimal AppointmentsRepository

The AppointmentsModule was an empty stub. We created a minimal repository with only 2 read queries (`findActiveByDoctorAndRange`, `findActiveLocksByDoctor`) instead of a full CRUD repository. This gives the availability endpoint complete end-to-end functionality without building the full booking flow.

### D3 — DB SlotLock table (not Redis)

The slot generator needs active slot locks. We query the `SlotLock` database table with `WHERE expiresAt > now()` instead of scanning Redis keys. The DB table is persistent, already modeled in Prisma, and has proper indexes. Redis-based locks can be layered in during the booking step.

### D4 — facility_id includes null templates

When filtering by `facility_id`, templates with `facilityId=null` (available everywhere) are included alongside exact matches. This lets doctors set up facility-agnostic templates that appear regardless of which facility the patient is browsing.

### D5 — Omit empty dates

Dates with zero available slots are omitted from the response. This keeps the JSON compact (a 7-day query with 2 active days returns 2 keys, not 7). The frontend can infer "no slots" from a missing key.

### D6 — Graceful Redis degradation

Cache read/write errors are caught and logged. The endpoint never fails because Redis is down — it falls back to computing availability from the database every time. The worst case is higher latency, not an error.

### D7 — Non-cancelled = slot-blocking

`findActiveByDoctorAndRange` uses `status NOT IN ('cancelled')`. This means `completed` and `no_show` appointments still block slots. A doctor who had a no_show at 10:00 shouldn't have that slot re-offered — the doctor has already allocated that time.

---

## Cache Strategy

- **Key:** `avail:{doctorId}:{startDate}:{endDate}:{facilityId|all}` — the facility suffix prevents a request filtered by facility A from returning cached results computed for facility B (or no filter)
- **TTL:** 30 seconds
- **Invalidation:** Event-driven via `@OnEvent` handlers
  - `appointment.booked` → invalidate all cached ranges for the doctor
  - `appointment.cancelled` → same
  - `schedule.template.updated` → same
- **SCAN not KEYS:** Cache invalidation uses Redis `SCAN` (cursor-based, non-blocking) instead of `KEYS` (blocking, scans entire keyspace). Safety valve: max 1000 SCAN iterations.
- **Serialization:** `JSON.stringify` — Date objects become ISO strings naturally. On cache hit, the response is returned as-is (already serialized).

---

## Test Matrix

| # | Test | Key assertion |
|---|------|---------------|
| 1 | Valid date range, Monday template | 6 slots grouped under Monday date key, correct shape |
| 2 | Cache hit | Returns cached data, no DB queries made |
| 3 | Cache write | Redis SET called with correct key + 30s TTL |
| 4 | Doctor not found | NotFoundException (404) |
| 5 | start_date > end_date | BadRequestException (400) |
| 6 | Range > 31 days | BadRequestException (400) |
| 7 | end_date > 90 days ahead | BadRequestException (400) |
| 8 | start_date in the past | BadRequestException (400) |
| 9 | facility_id filter | Includes null + matched, excludes other facilities |
| 10 | Redis failure | Returns computed data, doesn't throw |
| 11 | No matching templates | Returns empty object `{}` |

Run: `cd apps/api && npx jest --testPathPatterns="availability"`

---

## Validation Rules

| Parameter | Rule |
|-----------|------|
| `start_date` | Required, YYYY-MM-DD, >= today |
| `end_date` | Required, YYYY-MM-DD, >= start_date, <= today + 90 days |
| `end_date - start_date` | <= 31 days |
| `facility_id` | Optional, valid UUID |
| `:id` (path) | Valid UUID (ParseUUIDPipe) |
