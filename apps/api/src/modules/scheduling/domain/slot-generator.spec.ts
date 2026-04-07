import { generateAvailableSlots } from './slot-generator';
import type { WeeklyScheduleTemplate } from './weekly-schedule-template.interface';
import type { ScheduleException } from './schedule-exception.interface';
import type { ScheduleAppointmentType, ExceptionType } from '../../../generated/prisma/enums';

// ─── Test fixtures ────────────────────────────────────────────────────────────

// All tests use a fixed Monday in Madagascar time (EAT, GMT+3):
// FIXED_NOW = 2025-01-06T06:00:00Z = 09:00 EAT Monday — used to control the advance-booking filter.
// MONDAY_DATE = 2025-01-06 UTC midnight (represents Monday in EAT as well).
const FIXED_NOW = new Date('2025-01-06T06:00:00Z');
const MONDAY_DATE = new Date('2025-01-06T00:00:00Z');

// Prisma TIME columns are stored as Date objects with only the UTC hours/minutes set,
// anchored to 1970-01-01. The slot generator reads .getUTCHours() / .getUTCMinutes().
function timeOf(hour: number, minute: number = 0): Date {
  return new Date(Date.UTC(1970, 0, 1, hour, minute, 0, 0));
}

// Prisma DATE columns are stored as UTC midnight Date objects.
function dateOf(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function makeTemplate(overrides: Partial<WeeklyScheduleTemplate> = {}): WeeklyScheduleTemplate {
  return {
    id: 'template-1',
    doctorId: 'doctor-1',
    facilityId: null,
    dayOfWeek: 1, // Monday (JS convention: 0=Sun, 6=Sat)
    startTime: timeOf(9),
    endTime: timeOf(12),
    appointmentType: 'in_person' as ScheduleAppointmentType,
    slotDurationMinutes: 30,
    bufferMinutes: 0,
    maxBookingsPerSlot: 1,
    isActive: true,
    effectiveFrom: dateOf(2020, 1, 1),
    effectiveUntil: null,
    ...overrides,
  };
}

function makeException(overrides: Partial<ScheduleException> = {}): ScheduleException {
  return {
    id: 'exception-1',
    doctorId: 'doctor-1',
    exceptionDate: MONDAY_DATE,
    exceptionType: 'day_off' as ExceptionType,
    customStartTime: null,
    customEndTime: null,
    reason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('generateAvailableSlots', () => {
  // Test 1: Happy path — standard working day
  it('returns the correct slots for a standard working day', () => {
    // Mon 09:00–12:00, 30min slots, no buffer = 6 slots
    const template = makeTemplate();
    const slots = generateAvailableSlots(
      [template],
      [],
      [],
      [],
      { from: MONDAY_DATE, to: MONDAY_DATE },
      'Indian/Antananarivo',
      0, // no advance-booking filter for this test
      FIXED_NOW,
    );

    // 09:00, 09:30, 10:00, 10:30, 11:00, 11:30 EAT = 06:00..08:30 UTC
    expect(slots).toHaveLength(6);
    expect(slots[0].startTime.toISOString()).toBe('2025-01-06T06:00:00.000Z');
    expect(slots[5].startTime.toISOString()).toBe('2025-01-06T08:30:00.000Z');

    // All slots should be available and not emergency-only
    expect(slots.every(s => s.isAvailable)).toBe(true);
    expect(slots.every(s => !s.isEmergencyOnly)).toBe(true);
    expect(slots.every(s => s.appointmentType === 'in_person')).toBe(true);
  });

  // Test 2: day_off exception → no slots
  it('returns an empty array when exception_type is day_off', () => {
    const slots = generateAvailableSlots(
      [makeTemplate()],
      [makeException({ exceptionType: 'day_off' as ExceptionType })],
      [],
      [],
      { from: MONDAY_DATE, to: MONDAY_DATE },
      'Indian/Antananarivo',
      0,
      FIXED_NOW,
    );

    expect(slots).toHaveLength(0);
  });

  // Test 3: custom_hours exception → uses custom window, not the template window
  it('uses custom hours when exception_type is custom_hours', () => {
    // Template is 09:00–17:00 but exception narrows it to 10:00–12:00 → 4 slots
    const exception = makeException({
      exceptionType: 'custom_hours' as ExceptionType,
      customStartTime: timeOf(10),
      customEndTime: timeOf(12),
    });

    const slots = generateAvailableSlots(
      [makeTemplate({ startTime: timeOf(9), endTime: timeOf(17) })],
      [exception],
      [],
      [],
      { from: MONDAY_DATE, to: MONDAY_DATE },
      'Indian/Antananarivo',
      0,
      FIXED_NOW,
    );

    expect(slots).toHaveLength(4);
    // First slot is 10:00 EAT = 07:00 UTC
    expect(slots[0].startTime.toISOString()).toBe('2025-01-06T07:00:00.000Z');
    // Last slot is 11:30 EAT = 08:30 UTC
    expect(slots[3].startTime.toISOString()).toBe('2025-01-06T08:30:00.000Z');
  });

  // Test 4: existing appointment overlap → that slot excluded, others remain
  it('excludes slots that overlap with existing appointments', () => {
    // Appointment occupies the 09:00–09:30 EAT window
    const existingAppointments = [
      { startTime: new Date('2025-01-06T06:00:00Z'), durationMinutes: 30 },
    ];

    const slots = generateAvailableSlots(
      [makeTemplate()],
      [],
      existingAppointments,
      [],
      { from: MONDAY_DATE, to: MONDAY_DATE },
      'Indian/Antananarivo',
      0,
      FIXED_NOW,
    );

    // 09:00 slot removed, remaining 5 slots (09:30–11:30)
    expect(slots).toHaveLength(5);
    expect(slots[0].startTime.toISOString()).toBe('2025-01-06T06:30:00.000Z'); // 09:30 EAT
  });

  // Test 5: advance booking window — slots too close to 'now' are filtered out
  it('excludes slots within the min_advance_booking window', () => {
    // FIXED_NOW = 09:00 EAT. With 2h advance, minBookableTime = 11:00 EAT (08:00Z).
    // Slots 09:00, 09:30, 10:00, 10:30 EAT are too soon → 4 removed.
    // 11:00 and 11:30 EAT pass (11:00 ≥ minBookableTime).
    const slots = generateAvailableSlots(
      [makeTemplate()],
      [],
      [],
      [],
      { from: MONDAY_DATE, to: MONDAY_DATE },
      'Indian/Antananarivo',
      2, // 2-hour advance booking window
      FIXED_NOW,
    );

    expect(slots).toHaveLength(2);
    expect(slots[0].startTime.toISOString()).toBe('2025-01-06T08:00:00.000Z'); // 11:00 EAT
    expect(slots[1].startTime.toISOString()).toBe('2025-01-06T08:30:00.000Z'); // 11:30 EAT
  });

  // Test 6: buffer time — step = slotDuration + buffer
  it('handles buffer time between slots correctly', () => {
    // 30min slot + 15min buffer = 45min step
    // Slots: 09:00, 09:45, 10:30, 11:15 → ends at 11:45 ≤ 12:00 ✓
    // Next would start at 12:00, end at 12:30 > 12:00 → stop
    const template = makeTemplate({ slotDurationMinutes: 30, bufferMinutes: 15 });

    const slots = generateAvailableSlots(
      [template],
      [],
      [],
      [],
      { from: MONDAY_DATE, to: MONDAY_DATE },
      'Indian/Antananarivo',
      0,
      FIXED_NOW,
    );

    expect(slots).toHaveLength(4);
    expect(slots[0].startTime.toISOString()).toBe('2025-01-06T06:00:00.000Z'); // 09:00 EAT
    expect(slots[1].startTime.toISOString()).toBe('2025-01-06T06:45:00.000Z'); // 09:45 EAT
    expect(slots[2].startTime.toISOString()).toBe('2025-01-06T07:30:00.000Z'); // 10:30 EAT
    expect(slots[3].startTime.toISOString()).toBe('2025-01-06T08:15:00.000Z'); // 11:15 EAT
  });

  // Test 7: week boundary — verify Sunday (dayOfWeek=0) is handled via Luxon conversion
  it('handles a date range spanning a week boundary and correctly identifies Sunday', () => {
    // Template only for Sunday (dayOfWeek=0 in JS = luxon weekday 7)
    // Range: Friday 2025-01-03 → Monday 2025-01-06
    // Only Sunday 2025-01-05 should produce slots.
    //
    // 'now' is set to Friday morning (before the Sunday slots) so the advance-booking
    // filter does not remove the future Sunday slots. Using FIXED_NOW (Monday) would
    // place all Sunday slots in the past and the filter would remove them all.
    const FRIDAY_NOW = new Date('2025-01-03T00:00:00Z');

    const sundayTemplate = makeTemplate({
      dayOfWeek: 0, // Sunday
      startTime: timeOf(9),
      endTime: timeOf(10), // 2 slots: 09:00 and 09:30
    });

    const slots = generateAvailableSlots(
      [sundayTemplate],
      [],
      [],
      [],
      { from: dateOf(2025, 1, 3), to: dateOf(2025, 1, 6) },
      'Indian/Antananarivo',
      0,
      FRIDAY_NOW,
    );

    expect(slots).toHaveLength(2);
    // Both slots should be on Sunday 2025-01-05 EAT = 06:00 and 06:30 UTC
    expect(slots[0].startTime.toISOString()).toBe('2025-01-05T06:00:00.000Z'); // 09:00 EAT Sun
    expect(slots[1].startTime.toISOString()).toBe('2025-01-05T06:30:00.000Z'); // 09:30 EAT Sun
  });

  // Test 8: active slot lock → slot excluded
  it('excludes slots covered by an active slot lock', () => {
    // Lock on the 09:00 EAT slot (06:00Z)
    // ⚠️ Slot lock keys must use UTC ISO 8601 strings — same format the generator uses for comparison.
    const activeSlotLocks = [{ slotTime: new Date('2025-01-06T06:00:00.000Z') }];

    const slots = generateAvailableSlots(
      [makeTemplate()],
      [],
      [],
      activeSlotLocks,
      { from: MONDAY_DATE, to: MONDAY_DATE },
      'Indian/Antananarivo',
      0,
      FIXED_NOW,
    );

    // 09:00 slot locked → 5 remaining
    expect(slots).toHaveLength(5);
    expect(slots[0].startTime.toISOString()).toBe('2025-01-06T06:30:00.000Z'); // 09:30 EAT
  });

  // Test 9: emergency_only → slots generated but flagged
  it('marks isEmergencyOnly=true on all slots when exception_type is emergency_only', () => {
    const exception = makeException({
      exceptionType: 'emergency_only' as ExceptionType,
    });

    const slots = generateAvailableSlots(
      [makeTemplate()],
      [exception],
      [],
      [],
      { from: MONDAY_DATE, to: MONDAY_DATE },
      'Indian/Antananarivo',
      0,
      FIXED_NOW,
    );

    // Slots are still generated (emergency_only doesn't block the day)
    expect(slots).toHaveLength(6);
    expect(slots.every(s => s.isEmergencyOnly)).toBe(true);
    expect(slots.every(s => s.isAvailable)).toBe(true);
  });

  // Test 10: no template for the day_of_week in the date range → empty
  it('returns no slots for dates where no template matches the day_of_week', () => {
    // Tuesday template, but date range is only Monday
    const tuesdayTemplate = makeTemplate({ dayOfWeek: 2 }); // Tuesday

    const slots = generateAvailableSlots(
      [tuesdayTemplate],
      [],
      [],
      [],
      { from: MONDAY_DATE, to: MONDAY_DATE },
      'Indian/Antananarivo',
      0,
      FIXED_NOW,
    );

    expect(slots).toHaveLength(0);
  });

  // Test 11: inactive template → ignored
  it('ignores templates where isActive is false', () => {
    const inactiveTemplate = makeTemplate({ isActive: false });

    const slots = generateAvailableSlots(
      [inactiveTemplate],
      [],
      [],
      [],
      { from: MONDAY_DATE, to: MONDAY_DATE },
      'Indian/Antananarivo',
      0,
      FIXED_NOW,
    );

    expect(slots).toHaveLength(0);
  });

  // Test 12: effectiveUntil before the date → template ignored
  it('ignores templates whose effective date range does not cover the date', () => {
    // Template expired before our test date (2025-01-06)
    const expiredTemplate = makeTemplate({
      effectiveFrom: dateOf(2020, 1, 1),
      effectiveUntil: dateOf(2024, 12, 31),
    });

    const slots = generateAvailableSlots(
      [expiredTemplate],
      [],
      [],
      [],
      { from: MONDAY_DATE, to: MONDAY_DATE },
      'Indian/Antananarivo',
      0,
      FIXED_NOW,
    );

    expect(slots).toHaveLength(0);
  });

  // Test 13: two templates on the same day → slots from both are merged and sorted
  it('merges and sorts slots from two templates on the same day', () => {
    // Morning: 09:00–10:00 = 2 slots. Afternoon: 14:00–15:00 = 2 slots.
    const morning = makeTemplate({ id: 'morning', startTime: timeOf(9), endTime: timeOf(10) });
    const afternoon = makeTemplate({ id: 'afternoon', startTime: timeOf(14), endTime: timeOf(15) });

    const slots = generateAvailableSlots(
      [morning, afternoon],
      [],
      [],
      [],
      { from: MONDAY_DATE, to: MONDAY_DATE },
      'Indian/Antananarivo',
      0,
      FIXED_NOW,
    );

    expect(slots).toHaveLength(4);
    // Sorted ascending by startTime
    expect(slots[0].startTime.toISOString()).toBe('2025-01-06T06:00:00.000Z'); // 09:00 EAT
    expect(slots[1].startTime.toISOString()).toBe('2025-01-06T06:30:00.000Z'); // 09:30 EAT
    expect(slots[2].startTime.toISOString()).toBe('2025-01-06T11:00:00.000Z'); // 14:00 EAT
    expect(slots[3].startTime.toISOString()).toBe('2025-01-06T11:30:00.000Z'); // 14:30 EAT
  });

  // Test 14: MVP single-booking rule — max_bookings_per_slot is ignored, any overlap removes the slot
  it('removes a slot with max_bookings_per_slot=2 if 1 existing booking exists (MVP rule)', () => {
    // Template allows 2 bookings per slot, but MVP rule treats it as 1.
    const template = makeTemplate({ maxBookingsPerSlot: 2 });
    const existingAppointments = [
      { startTime: new Date('2025-01-06T06:00:00Z'), durationMinutes: 30 }, // 09:00 EAT
    ];

    const slots = generateAvailableSlots(
      [template],
      [],
      existingAppointments,
      [],
      { from: MONDAY_DATE, to: MONDAY_DATE },
      'Indian/Antananarivo',
      0,
      FIXED_NOW,
    );

    // The 09:00 slot should be removed even though max_bookings_per_slot=2
    expect(slots).toHaveLength(5);
    expect(slots[0].startTime.toISOString()).toBe('2025-01-06T06:30:00.000Z'); // 09:30 EAT
  });

  // Test 15: multi-day range with mixed exceptions — the most realistic usage pattern
  it('handles a multi-day range with mixed exceptions (normal, day_off, custom_hours)', () => {
    // Mon 2025-01-06 = normal, Tue 2025-01-07 = day_off, Wed 2025-01-08 = custom_hours 10:00–11:00
    const FRIDAY_NOW = new Date('2025-01-03T00:00:00Z'); // before the range so advance-booking doesn't interfere

    const monTemplate = makeTemplate({ id: 'mon', dayOfWeek: 1 }); // Mon 09:00–12:00
    const tueTemplate = makeTemplate({ id: 'tue', dayOfWeek: 2 }); // Tue 09:00–12:00
    const wedTemplate = makeTemplate({ id: 'wed', dayOfWeek: 3 }); // Wed 09:00–12:00

    const tueDayOff = makeException({
      id: 'tue-off',
      exceptionDate: dateOf(2025, 1, 7),
      exceptionType: 'day_off' as ExceptionType,
    });

    const wedCustom = makeException({
      id: 'wed-custom',
      exceptionDate: dateOf(2025, 1, 8),
      exceptionType: 'custom_hours' as ExceptionType,
      customStartTime: timeOf(10),
      customEndTime: timeOf(11),
    });

    const slots = generateAvailableSlots(
      [monTemplate, tueTemplate, wedTemplate],
      [tueDayOff, wedCustom],
      [],
      [],
      { from: dateOf(2025, 1, 6), to: dateOf(2025, 1, 8) },
      'Indian/Antananarivo',
      0,
      FRIDAY_NOW,
    );

    // Monday: 6 normal slots (09:00–11:30 EAT)
    const monSlots = slots.filter(s => s.startTime >= new Date('2025-01-06T00:00:00Z') && s.startTime < new Date('2025-01-07T00:00:00Z'));
    expect(monSlots).toHaveLength(6);

    // Tuesday: 0 slots (day_off)
    const tueSlots = slots.filter(s => s.startTime >= new Date('2025-01-07T00:00:00Z') && s.startTime < new Date('2025-01-08T00:00:00Z'));
    expect(tueSlots).toHaveLength(0);

    // Wednesday: 2 slots (custom_hours 10:00–11:00 EAT = 07:00–08:00 UTC)
    const wedSlots = slots.filter(s => s.startTime >= new Date('2025-01-08T00:00:00Z') && s.startTime < new Date('2025-01-09T00:00:00Z'));
    expect(wedSlots).toHaveLength(2);
    expect(wedSlots[0].startTime.toISOString()).toBe('2025-01-08T07:00:00.000Z'); // 10:00 EAT
    expect(wedSlots[1].startTime.toISOString()).toBe('2025-01-08T07:30:00.000Z'); // 10:30 EAT
  });

  // Test 16: custom_hours exception skips templates whose window doesn't overlap
  it('skips afternoon template when custom_hours only overlaps morning window', () => {
    // Morning template: 09:00–12:00. Afternoon template: 14:00–17:00.
    // custom_hours exception: 10:00–11:00.
    // Only the morning template overlaps → 2 slots from morning, 0 from afternoon.
    const morning = makeTemplate({ id: 'morning', startTime: timeOf(9), endTime: timeOf(12) });
    const afternoon = makeTemplate({ id: 'afternoon', startTime: timeOf(14), endTime: timeOf(17) });

    const exception = makeException({
      exceptionType: 'custom_hours' as ExceptionType,
      customStartTime: timeOf(10),
      customEndTime: timeOf(11),
    });

    const slots = generateAvailableSlots(
      [morning, afternoon],
      [exception],
      [],
      [],
      { from: MONDAY_DATE, to: MONDAY_DATE },
      'Indian/Antananarivo',
      0,
      FIXED_NOW,
    );

    // Only 2 slots from the morning template's custom window (10:00 and 10:30 EAT)
    // Afternoon template is skipped because 14:00–17:00 doesn't overlap 10:00–11:00
    expect(slots).toHaveLength(2);
    expect(slots[0].startTime.toISOString()).toBe('2025-01-06T07:00:00.000Z'); // 10:00 EAT
    expect(slots[1].startTime.toISOString()).toBe('2025-01-06T07:30:00.000Z'); // 10:30 EAT
  });
});
