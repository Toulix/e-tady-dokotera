import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { SchedulingService } from './scheduling.service';
import { AppointmentsQueryService } from '../../appointments/application/appointments-query.service';
import { DoctorsService } from '../../doctors/application/doctors.service';
import { REDIS_CLIENT } from '../../../shared/redis/redis.module';

// ─── Helpers ──────────────────────────────────────────────────────────

/** Creates a 1970-01-01 UTC Date with only hours set — matches Prisma TIME columns. */
function timeOf(hour: number, minute = 0): Date {
  return new Date(Date.UTC(1970, 0, 1, hour, minute, 0, 0));
}

/** Creates a UTC midnight Date for a given date — matches Prisma DATE columns. */
function dateOf(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Builds a minimal WeeklyScheduleTemplate for testing.
 * Default: Monday (dayOfWeek=1), 09:00–12:00, 30min slots, no buffer.
 */
function makeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tpl-1',
    doctorId: 'doctor-1',
    facilityId: null,
    dayOfWeek: 1, // Monday
    startTime: timeOf(9),
    endTime: timeOf(12),
    appointmentType: 'in_person',
    slotDurationMinutes: 30,
    bufferMinutes: 0,
    maxBookingsPerSlot: 1,
    isActive: true,
    effectiveFrom: dateOf(2025, 1, 1),
    effectiveUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── Mock setup ───────────────────────────────────────────────────────

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  scan: jest.fn(),
  del: jest.fn(),
};

const mockSchedulingService = {
  getSchedulingDataForAvailability: jest.fn(),
};

const mockAppointmentsQueryService = {
  getActiveAppointments: jest.fn(),
  getActiveSlotLocks: jest.fn(),
};

const mockDoctorsService = {
  getMinAdvanceBookingHours: jest.fn(),
};

describe('AvailabilityService', () => {
  let service: AvailabilityService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        { provide: SchedulingService, useValue: mockSchedulingService },
        { provide: AppointmentsQueryService, useValue: mockAppointmentsQueryService },
        { provide: DoctorsService, useValue: mockDoctorsService },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AvailabilityService>(AvailabilityService);
  });

  // ─── Helper to set up default mocks for a successful call ─────────
  function setupDefaultMocks(templates = [makeTemplate()]) {
    // "now" in the service defaults to new Date(), so we need templates
    // far enough in the future to pass the advance booking filter.
    mockSchedulingService.getSchedulingDataForAvailability.mockResolvedValue({
      templates,
      exceptions: [],
    });
    mockAppointmentsQueryService.getActiveAppointments.mockResolvedValue([]);
    mockAppointmentsQueryService.getActiveSlotLocks.mockResolvedValue([]);
    mockDoctorsService.getMinAdvanceBookingHours.mockResolvedValue(2);
    mockRedis.get.mockResolvedValue(null); // cache miss
    mockRedis.set.mockResolvedValue('OK');
  }

  // ─── Happy path ────────────────────────────────────────────────────

  it('returns grouped slots for a valid date range', async () => {
    // Use a Monday far in the future so slots pass the advance booking filter.
    const monday = '2026-06-01'; // Monday
    const template = makeTemplate({
      effectiveFrom: dateOf(2026, 1, 1),
    });
    setupDefaultMocks([template]);

    const result = await service.getAvailability(
      'doctor-1',
      monday,
      monday,
    );

    // Monday 09:00–12:00 with 30min slots = 6 slots
    expect(result[monday]).toBeDefined();
    expect(result[monday]).toHaveLength(6);

    // Verify slot shape
    const firstSlot = result[monday][0];
    expect(firstSlot).toHaveProperty('startTime');
    expect(firstSlot).toHaveProperty('endTime');
    expect(firstSlot).toHaveProperty('appointmentType', 'in_person');
    expect(firstSlot).toHaveProperty('isAvailable', true);
    expect(firstSlot).toHaveProperty('isEmergencyOnly', false);
    expect(firstSlot).toHaveProperty('facilityId', null);

    // Dates are serialized as ISO strings, not Date objects
    expect(typeof firstSlot.startTime).toBe('string');
    expect(typeof firstSlot.endTime).toBe('string');
  });

  // ─── Caching ───────────────────────────────────────────────────────

  it('returns cached result on cache hit without querying the database', async () => {
    const cachedData = { '2026-06-01': [{ startTime: '2026-06-01T06:00:00.000Z' }] };
    mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

    const result = await service.getAvailability('doctor-1', '2026-06-01', '2026-06-01');

    expect(result).toEqual(cachedData);
    // No database queries should have been made
    expect(mockSchedulingService.getSchedulingDataForAvailability).not.toHaveBeenCalled();
    expect(mockAppointmentsQueryService.getActiveAppointments).not.toHaveBeenCalled();
    expect(mockDoctorsService.getMinAdvanceBookingHours).not.toHaveBeenCalled();
  });

  it('caches the computed result in Redis with 30s TTL', async () => {
    const monday = '2026-06-01';
    setupDefaultMocks([makeTemplate({ effectiveFrom: dateOf(2026, 1, 1) })]);

    await service.getAvailability('doctor-1', monday, monday);

    expect(mockRedis.set).toHaveBeenCalledWith(
      `avail:doctor-1:${monday}:${monday}:all`,
      expect.any(String),
      'EX',
      30,
    );
  });

  // ─── Doctor not found ──────────────────────────────────────────────

  it('throws 404 when doctor does not exist', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockSchedulingService.getSchedulingDataForAvailability.mockResolvedValue({
      templates: [],
      exceptions: [],
    });
    mockAppointmentsQueryService.getActiveAppointments.mockResolvedValue([]);
    mockAppointmentsQueryService.getActiveSlotLocks.mockResolvedValue([]);
    mockDoctorsService.getMinAdvanceBookingHours.mockRejectedValue(
      new NotFoundException('Doctor not found'),
    );

    await expect(
      service.getAvailability('nonexistent', '2026-06-01', '2026-06-01'),
    ).rejects.toThrow(NotFoundException);
  });

  // ─── Date range validation ─────────────────────────────────────────

  it('throws 400 when start_date is after end_date', async () => {
    await expect(
      service.getAvailability('doctor-1', '2026-06-10', '2026-06-01'),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws 400 when date range exceeds 31 days', async () => {
    await expect(
      service.getAvailability('doctor-1', '2026-06-01', '2026-07-15'),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws 400 when end_date is more than 90 days in the future', async () => {
    // Pick a date far enough ahead to exceed 90 days from today
    const farFuture = new Date();
    farFuture.setDate(farFuture.getDate() + 100);
    const farFutureStr = farFuture.toISOString().split('T')[0];
    const startStr = new Date(
      farFuture.getTime() - 5 * 24 * 60 * 60 * 1000,
    ).toISOString().split('T')[0];

    await expect(
      service.getAvailability('doctor-1', startStr, farFutureStr),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws 400 when start_date is in the past', async () => {
    await expect(
      service.getAvailability('doctor-1', '2020-01-01', '2020-01-02'),
    ).rejects.toThrow(BadRequestException);
  });

  // ─── Facility filtering ────────────────────────────────────────────

  it('includes facility-agnostic templates when filtering by facility_id', async () => {
    const facilityTemplate = makeTemplate({
      id: 'tpl-facility',
      facilityId: 'facility-1',
      effectiveFrom: dateOf(2026, 1, 1),
    });
    const agnosticTemplate = makeTemplate({
      id: 'tpl-agnostic',
      facilityId: null,
      effectiveFrom: dateOf(2026, 1, 1),
    });
    const otherFacilityTemplate = makeTemplate({
      id: 'tpl-other',
      facilityId: 'facility-2',
      effectiveFrom: dateOf(2026, 1, 1),
    });

    setupDefaultMocks([facilityTemplate, agnosticTemplate, otherFacilityTemplate]);

    const result = await service.getAvailability(
      'doctor-1',
      '2026-06-01', // Monday
      '2026-06-01',
      'facility-1',
    );

    // With facility-1 filter: facility-1 template (6 slots) + null template
    // (6 slots) = 12 total. The facility-2 template must be excluded.
    // If otherFacilityTemplate leaked through, we'd see 18 slots instead.
    const monday = '2026-06-01';
    expect(result[monday]).toBeDefined();
    expect(result[monday]).toHaveLength(12);
  });

  // ─── Redis failure graceful degradation ────────────────────────────

  it('returns computed data when Redis read fails', async () => {
    const monday = '2026-06-01';
    mockRedis.get.mockRejectedValue(new Error('Redis connection refused'));
    mockRedis.set.mockRejectedValue(new Error('Redis connection refused'));

    setupDefaultMocks([makeTemplate({ effectiveFrom: dateOf(2026, 1, 1) })]);
    // Override the get mock to simulate failure
    mockRedis.get.mockRejectedValue(new Error('Redis connection refused'));

    const result = await service.getAvailability('doctor-1', monday, monday);

    // Should still return data from the database
    expect(result[monday]).toBeDefined();
    expect(result[monday].length).toBeGreaterThan(0);
  });

  // ─── Empty result ──────────────────────────────────────────────────

  it('returns empty object when no templates match', async () => {
    setupDefaultMocks([]); // no templates

    const result = await service.getAvailability(
      'doctor-1',
      '2026-06-01',
      '2026-06-01',
    );

    expect(result).toEqual({});
  });
});
