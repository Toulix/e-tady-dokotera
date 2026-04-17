# Step 16 — Slot Generation Algorithm

**Status:** Implemented ✅
**Date:** 2026-04-01
**Depends on:** Step 15 (WeeklyScheduleTemplate + ScheduleException APIs)
**Required by:** Step 17 (Availability endpoint)

---

## What Was Built

A pure function `generateAvailableSlots` that takes a doctor's schedule data and returns bookable time slots. Zero database calls — all data is fetched by the caller (Step 17) and passed as arguments.

### Files created

| File | Purpose |
|------|---------|
| `apps/api/src/modules/scheduling/domain/slot-generator.ts` | Core algorithm |
| `apps/api/src/modules/scheduling/domain/slot-generator.spec.ts` | 14 unit tests |
| `apps/api/src/modules/scheduling/domain/time-slot.interface.ts` | Return type |

### Files modified

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Added `minAdvanceBookingHours` to `DoctorProfile` |
| `apps/api/src/modules/scheduling/application/dto/create-weekly-template.dto.ts` | `@Max(10)` → `@Max(3)` on `max_bookings_per_slot` |
| `docs/spec.md` | Added `min_advance_booking_hours` to §5.1 DoctorProfile; MVP note on `max_bookings_per_slot` |
| `docs/roadmap.md` | Updated Step 16 function signature; added Step 4 note for new DoctorProfile field |

---

## Function Contract

```typescript
export function generateAvailableSlots(
  templates: WeeklyScheduleTemplate[],
  exceptions: ScheduleException[],
  existingAppointments: { startTime: Date; durationMinutes: number }[],
  activeSlotLocks: { slotTime: Date }[],
  dateRange: { from: Date; to: Date },          // both ends inclusive
  timezone: string = 'Indian/Antananarivo',
  minAdvanceBookingHours: number = 2,           // pass DoctorProfile.minAdvanceBookingHours
  now?: Date,                                   // injectable for testing; defaults to new Date()
): TimeSlot[]
```

**Returns:** Flat array of `TimeSlot` objects sorted ascending by `startTime`. Only slots that passed all 3 filters are included (`isAvailable` is always `true`).

---

## Algorithm

For each calendar date in `[from, to]` inclusive:

1. **Exception check** — find a `ScheduleException` where `exceptionDate` matches the local calendar date (compared as `YYYY-MM-DD` strings, not timestamps):
   - `day_off` → skip entire date
   - `custom_hours` → replace template window with `[customStartTime, customEndTime]`
   - `emergency_only` → set `isEmergencyOnly = true` on all slots for the day

2. **Template match** — keep templates where:
   - `isActive = true`
   - `dayOfWeek === jsDay` (see Weekday Conversion below)
   - `effectiveFrom ≤ date ≤ effectiveUntil` (compared as `YYYY-MM-DD` strings)

3. **Slot generation** — for each matching template:
   - `step = slotDurationMinutes + bufferMinutes`
   - Generate while `slotEnd ≤ windowEnd`

4. **Per-slot filters** (any fail → skip):
   - `slotStart < now + minAdvanceBookingHours`
   - Any existing appointment overlaps the slot time window
   - The slot's `startTime.toISOString()` is in the active slot lock set

5. **Return** flat array sorted by `startTime` ASC.

---

## Key Design Decisions

### Q1 — `min_advance_booking_hours` lives on `DoctorProfile`

The spec (§3.1.3) says "minimum advance booking: 2 hours, configurable per doctor." No field existed in the data model. Added `minAdvanceBookingHours Int @default(2)` to `DoctorProfile`. The Step 17 caller fetches the doctor profile and passes this value to the generator.

### Q2 — MVP single-booking rule

`max_bookings_per_slot` is validated at 1–3 (down from 10) and stored in the data model, but the slot generator uses a simple boolean overlap check — any overlapping appointment removes the slot. Multi-booking (group consultations) is Phase 2.

### Q3 — Luxon ISO weekday vs JavaScript `dayOfWeek`

`DateTime.weekday` in Luxon is ISO 8601: Monday=1, Sunday=7.
`WeeklyScheduleTemplate.dayOfWeek` follows JavaScript: Sunday=0, Saturday=6.
Conversion: `luxonWeekday === 7 ? 0 : luxonWeekday`
Without this, Sunday templates silently never match.

### Q4 — Date comparisons via `.toISODate()` strings

Prisma DATE columns arrive as `Date` objects at UTC midnight. Comparing with `<=` / `>=` on JS timestamps fails at timezone boundaries (e.g. `2025-01-06T00:00:00Z` = `2025-01-05` in UTC, but `2025-01-06` in EAT). All `effectiveFrom`, `effectiveUntil`, and `exceptionDate` comparisons use `DateTime.fromJSDate(...).setZone(tz).toISODate()` string comparison.

### Q5 — Slot lock UTC ISO assumption

Active slot locks are compared as UTC ISO strings: `lock.slotTime.toISOString() === slot.startTime.toISOString()`. Both sides must be UTC `Date` objects. The generator ensures this by always converting luxon datetimes with `.toUTC().toJSDate()` before writing to `TimeSlot`. Documented inline in the function signature JSDoc.

### `now` as injectable parameter

The generator computes the advance-booking boundary relative to "now". To make the function fully deterministic in tests (no time-dependent flakiness), `now` is an optional parameter defaulting to `new Date()`. In production, callers omit it.

---

## Test Matrix

| # | Test | Key assertion |
|---|------|---------------|
| 1 | Standard working day, 30min slots, no buffer | 6 slots at expected UTC times |
| 2 | `day_off` exception | `[]` |
| 3 | `custom_hours` exception | Slots inside custom window only |
| 4 | Appointment overlaps slot | Booked slot absent; next slot present |
| 5 | `minAdvanceBookingHours=2`, now=09:00 EAT | Only 11:00 and 11:30 EAT slots returned |
| 6 | Buffer=15min → step=45min | 4 slots at correct 45-min intervals |
| 7 | Sun template, Fri–Mon range | Only 2 Sunday slots; correct UTC times |
| 8 | Active slot lock on 09:00 | 09:00 absent; 09:30 present |
| 9 | `emergency_only` exception | All slots present, `isEmergencyOnly=true` |
| 10 | No template for the day | `[]` |
| 11 | `isActive=false` | `[]` |
| 12 | `effectiveUntil` before date | `[]` |
| 13 | Morning + afternoon templates | 4 slots merged, sorted by startTime |
| 14 | `maxBookingsPerSlot=2`, 1 existing booking | Slot removed (MVP rule) |

Run: `cd apps/api && npx jest --testPathPatterns="slot-generator"`

---

## Phase 2 — Multi-booking support

When enabling `max_bookings_per_slot > 1`, replace the boolean overlap check with a count:

```typescript
// Replace this MVP check:
const hasBookingConflict = existingAppointments.some(appt => overlaps(appt, slot));

// With this Phase 2 check:
const overlapCount = existingAppointments.filter(appt => overlaps(appt, slot)).length;
if (overlapCount >= template.maxBookingsPerSlot) { /* skip */ }
```

The DTO already validates `max_bookings_per_slot` at 1–3 and the database column exists. No schema migration is needed for Phase 2.

---

## Migration Note

After merging, run:
```bash
npx prisma migrate dev --name add_min_advance_booking_hours_to_doctor_profile
npx prisma generate
```

This adds `min_advance_booking_hours INT DEFAULT 2` to the `doctors.profiles` table.
