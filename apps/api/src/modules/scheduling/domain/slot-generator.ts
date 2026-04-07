import { DateTime } from 'luxon';
import type { WeeklyScheduleTemplate } from './weekly-schedule-template.interface';
import type { ScheduleException } from './schedule-exception.interface';
import type { TimeSlot } from './time-slot.interface';

// Default timezone for Madagascar (Indian Ocean Time, UTC+3).
const DEFAULT_TIMEZONE = 'Indian/Antananarivo';

/**
 * Converts a Luxon ISO weekday (1=Monday, 7=Sunday) to the JavaScript
 * Date convention (0=Sunday, 6=Saturday) used by WeeklyScheduleTemplate.dayOfWeek.
 *
 * Without this conversion, Sunday templates would never match (luxon reports
 * Sunday as 7, but the template stores it as 0).
 */
function toJsDayOfWeek(luxonWeekday: number): number {
  return luxonWeekday === 7 ? 0 : luxonWeekday;
}

/**
 * Extracts the calendar date string ('YYYY-MM-DD') from a Date object,
 * interpreting it in the given timezone.
 *
 * Used instead of raw timestamp comparison to avoid UTC-vs-local drift:
 * a DATE column stored as midnight UTC (e.g. 2025-01-06T00:00:00Z) is still
 * '2025-01-06' in EAT (UTC+3), and so is a datetime at 2025-01-06T02:00:00Z.
 * Comparing timestamps directly would incorrectly flag these as different days.
 */
function toLocalDate(date: Date, timezone: string): string {
  return DateTime.fromJSDate(date, { zone: 'utc' }).setZone(timezone).toISODate() as string;
}

/**
 * The core slot generation algorithm.
 *
 * Pure function with zero database calls. Takes all data as arguments and
 * returns a sorted array of bookable time windows. Called by the availability
 * endpoint (Step 17) after it fetches all required data from the database.
 *
 * @param templates         Active WeeklyScheduleTemplates for the doctor.
 * @param exceptions        ScheduleExceptions for the date range.
 * @param existingAppointments  Already-booked appointments (for overlap detection).
 * @param activeSlotLocks   Redis slot locks currently held. Each lock's slotTime
 *                          must be a UTC Date matching the slot's startTime.
 *                          ⚠️ Assumption: lock keys use slot.startTime.toISOString()
 *                          (UTC ISO 8601). Both sides of the comparison produce UTC
 *                          ISO strings — ensured by converting luxon datetimes via
 *                          .toUTC().toJSDate() before storing in the TimeSlot. Any
 *                          timezone drift in the lock key will cause locks to be missed.
 * @param dateRange         Inclusive calendar date range to generate slots for.
 * @param timezone          Doctor's local timezone. Defaults to 'Indian/Antananarivo'.
 * @param minAdvanceBookingHours  Minimum hours before a slot that a patient can book.
 *                          Pass DoctorProfile.minAdvanceBookingHours here.
 *                          Defaults to 2 (per spec §3.1.3).
 * @param now               Current time, injectable for testing. Defaults to new Date().
 *                          Injecting this makes the function fully deterministic in tests.
 */
export function generateAvailableSlots(
  templates: WeeklyScheduleTemplate[],
  exceptions: ScheduleException[],
  existingAppointments: { startTime: Date; durationMinutes: number }[],
  activeSlotLocks: { slotTime: Date }[],
  dateRange: { from: Date; to: Date },
  timezone: string = DEFAULT_TIMEZONE,
  minAdvanceBookingHours: number = 2,
  now: Date = new Date(),
): TimeSlot[] {
  const result: TimeSlot[] = [];

  // Pre-compute the earliest bookable moment once — avoids re-computing per slot.
  const minBookableTime = DateTime.fromJSDate(now, { zone: timezone }).plus({
    hours: minAdvanceBookingHours,
  });

  // Build a Set for O(1) slot lock lookup. Both the lock slotTime and the
  // slot's startTime are UTC Date objects, so .toISOString() produces a stable key.
  const lockSet = new Set<string>(activeSlotLocks.map((l) => l.slotTime.toISOString()));

  // Iterate each calendar date in [from, to] inclusive.
  // Start of day is computed in the doctor's timezone to avoid midnight boundary issues.
  let cursor = DateTime.fromJSDate(dateRange.from, { zone: 'utc' })
    .setZone(timezone)
    .startOf('day');
  const endCursor = DateTime.fromJSDate(dateRange.to, { zone: 'utc' })
    .setZone(timezone)
    .startOf('day');

  while (cursor <= endCursor) {
    const localDateStr = cursor.toISODate() as string; // 'YYYY-MM-DD' in the doctor's timezone
    const jsDay = toJsDayOfWeek(cursor.weekday);

    // ── 1. Exception check ─────────────────────────────────────────────────────
    // Compare dates as 'YYYY-MM-DD' strings (not timestamps) to avoid UTC drift.
    const exception = exceptions.find(
      (e) => toLocalDate(e.exceptionDate, timezone) === localDateStr,
    );

    if (exception?.exceptionType === 'day_off') {
      cursor = cursor.plus({ days: 1 });
      continue;
    }

    const isEmergencyOnly = exception?.exceptionType === 'emergency_only';

    // ── 2. Template matching ───────────────────────────────────────────────────
    const dayTemplates = templates.filter((t) => {
      if (!t.isActive) return false;
      if (t.dayOfWeek !== jsDay) return false;

      // Effective date range: compare as local date strings to avoid UTC drift.
      // effectiveFrom and effectiveUntil are DATE columns → stored as UTC midnight.
      const effectiveFromStr = toLocalDate(t.effectiveFrom, timezone);
      if (localDateStr < effectiveFromStr) return false;

      if (t.effectiveUntil) {
        const effectiveUntilStr = toLocalDate(t.effectiveUntil, timezone);
        if (localDateStr > effectiveUntilStr) return false;
      }

      return true;
    });

    // ── 3. Slot generation ─────────────────────────────────────────────────────
    for (const template of dayTemplates) {
      // Determine the working window for this day.
      // For 'custom_hours' exceptions, override the template's window with the exception times —
      // but only if the template's original window overlaps with the custom window.
      // Without this check, a custom_hours exception (e.g. 10:00–11:00) would apply to ALL
      // templates on that day, causing an afternoon template (14:00–17:00) to also generate
      // 10:00–11:00 slots (duplicates).
      // TIME columns are stored as Date objects anchored to 1970-01-01 UTC — extract
      // hours/minutes via getUTCHours()/getUTCMinutes() to avoid local timezone interference.
      let windowStartH: number;
      let windowStartM: number;
      let windowEndH: number;
      let windowEndM: number;

      if (
        exception?.exceptionType === 'custom_hours' &&
        exception.customStartTime &&
        exception.customEndTime
      ) {
        // Compare template window vs custom window using minutes-since-midnight
        // to determine overlap. Two ranges [a1,a2] and [b1,b2] overlap when a1 < b2 AND a2 > b1.
        const tplStartMin =
          template.startTime.getUTCHours() * 60 + template.startTime.getUTCMinutes();
        const tplEndMin = template.endTime.getUTCHours() * 60 + template.endTime.getUTCMinutes();
        const excStartMin =
          exception.customStartTime.getUTCHours() * 60 +
          exception.customStartTime.getUTCMinutes();
        const excEndMin =
          exception.customEndTime.getUTCHours() * 60 + exception.customEndTime.getUTCMinutes();

        if (tplStartMin >= excEndMin || tplEndMin <= excStartMin) {
          // Template's original window doesn't overlap with the custom hours —
          // skip this template entirely (doctor is not available in this window today).
          continue;
        }

        windowStartH = exception.customStartTime.getUTCHours();
        windowStartM = exception.customStartTime.getUTCMinutes();
        windowEndH = exception.customEndTime.getUTCHours();
        windowEndM = exception.customEndTime.getUTCMinutes();
      } else {
        windowStartH = template.startTime.getUTCHours();
        windowStartM = template.startTime.getUTCMinutes();
        windowEndH = template.endTime.getUTCHours();
        windowEndM = template.endTime.getUTCMinutes();
      }

      // Build window boundaries as luxon DateTimes in the doctor's timezone.
      // This is the key step that ties a calendar date to a local time-of-day
      // correctly for the GMT+3 boundary (fixes the v1.5 timezone arithmetic bug).
      const windowEnd = cursor.set({
        hour: windowEndH,
        minute: windowEndM,
        second: 0,
        millisecond: 0,
      });

      const step = template.slotDurationMinutes + template.bufferMinutes;
      let slotStart = cursor.set({
        hour: windowStartH,
        minute: windowStartM,
        second: 0,
        millisecond: 0,
      });

      while (true) {
        const slotEnd = slotStart.plus({ minutes: template.slotDurationMinutes });

        // Slot must fit entirely within the working window.
        if (slotEnd > windowEnd) break;

        // Convert to UTC JS Date objects once — all downstream comparisons use UTC.
        const slotStartUtc = slotStart.toUTC().toJSDate();
        const slotEndUtc = slotEnd.toUTC().toJSDate();

        // ── Filter 1: advance booking window ──────────────────────────────────
        // Slot starts before the minimum bookable time → patient can't book this soon.
        if (slotStart < minBookableTime) {
          slotStart = slotStart.plus({ minutes: step });
          continue;
        }

        // ── Filter 2: existing appointment overlap ────────────────────────────
        // ⚠️ MVP simplification: any overlapping appointment removes the slot,
        // regardless of max_bookings_per_slot. Multi-booking (up to 3) is Phase 2.
        const hasBookingConflict = existingAppointments.some((appt) => {
          const apptEndMs = appt.startTime.getTime() + appt.durationMinutes * 60_000;
          // Two intervals [a1,a2] and [b1,b2] overlap when a1 < b2 AND a2 > b1.
          return appt.startTime < slotEndUtc && apptEndMs > slotStartUtc.getTime();
        });

        if (hasBookingConflict) {
          slotStart = slotStart.plus({ minutes: step });
          continue;
        }

        // ── Filter 3: active slot lock ────────────────────────────────────────
        // Uses exact UTC ISO string match — see the ⚠️ Assumption in JSDoc above.
        if (lockSet.has(slotStartUtc.toISOString())) {
          slotStart = slotStart.plus({ minutes: step });
          continue;
        }

        result.push({
          startTime: slotStartUtc,
          endTime: slotEndUtc,
          appointmentType: template.appointmentType,
          isAvailable: true,
          isEmergencyOnly,
          facilityId: template.facilityId,
        });

        slotStart = slotStart.plus({ minutes: step });
      }
    }

    cursor = cursor.plus({ days: 1 });
  }

  // Sort ascending by startTime — multiple templates on the same day produce
  // interleaved results that need to be merged into chronological order.
  return result.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}
