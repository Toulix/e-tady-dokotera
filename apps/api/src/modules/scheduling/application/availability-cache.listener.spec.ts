import { Test, TestingModule } from '@nestjs/testing';
import { AvailabilityCacheListener } from './availability-cache.listener';
import { REDIS_CLIENT } from '../../../shared/redis/redis.module';
import { AppointmentBookedEvent } from '../../../shared/events/appointment-booked.event';
import { AppointmentCancelledEvent } from '../../../shared/events/appointment-cancelled.event';
import { AppointmentRescheduledEvent } from '../../../shared/events/appointment-rescheduled.event';
import { ScheduleTemplateUpdatedEvent } from '../../../shared/events/schedule-template-updated.event';
import { ScheduleExceptionUpdatedEvent } from '../../../shared/events/schedule-exception-updated.event';
import { SlotLockExpiredEvent } from '../../../shared/events/slot-lock-expired.event';

const DOCTOR_ID = 'doctor-abc-123';

const mockRedis = {
  scan: jest.fn(),
  del: jest.fn(),
};

describe('AvailabilityCacheListener', () => {
  let listener: AvailabilityCacheListener;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityCacheListener,
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    listener = module.get<AvailabilityCacheListener>(AvailabilityCacheListener);
  });

  // ─── Cache invalidation logic ──────────────────────────────────────

  it('deletes all matching keys using SCAN cursor loop', async () => {
    // Simulate 2 SCAN batches: first returns 3 keys, second returns 1 key and cursor '0' (done).
    mockRedis.scan
      .mockResolvedValueOnce(['42', ['avail:doctor-abc-123:2026-06-01:2026-06-01:all', 'avail:doctor-abc-123:2026-06-02:2026-06-02:all', 'avail:doctor-abc-123:2026-06-01:2026-06-07:fac-1']])
      .mockResolvedValueOnce(['0', ['avail:doctor-abc-123:2026-06-03:2026-06-03:all']]);
    mockRedis.del.mockResolvedValue(1);

    await listener.handleAppointmentBooked(
      new AppointmentBookedEvent('appt-1', DOCTOR_ID, 'patient-1', new Date()),
    );

    expect(mockRedis.scan).toHaveBeenCalledTimes(2);
    expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', `avail:${DOCTOR_ID}:*`, 'COUNT', 100);
    expect(mockRedis.scan).toHaveBeenCalledWith('42', 'MATCH', `avail:${DOCTOR_ID}:*`, 'COUNT', 100);
    expect(mockRedis.del).toHaveBeenCalledTimes(2);
  });

  it('does not call DEL when SCAN returns no keys', async () => {
    mockRedis.scan.mockResolvedValueOnce(['0', []]);

    await listener.handleAppointmentCancelled(
      new AppointmentCancelledEvent('appt-1', DOCTOR_ID, 'patient-1', 'patient'),
    );

    expect(mockRedis.scan).toHaveBeenCalledTimes(1);
    expect(mockRedis.del).not.toHaveBeenCalled();
  });

  it('aborts after MAX_SCAN_ITERATIONS to prevent infinite loops', async () => {
    // SCAN always returns cursor '1' (never '0'), simulating a stuck loop.
    mockRedis.scan.mockResolvedValue(['1', []]);

    await listener.handleScheduleUpdated(
      new ScheduleTemplateUpdatedEvent(DOCTOR_ID),
    );

    // The listener's MAX_SCAN_ITERATIONS is 1000.
    expect(mockRedis.scan).toHaveBeenCalledTimes(1000);
  });

  // ─── Error handling ────────────────────────────────────────────────

  it('does not throw when Redis SCAN fails', async () => {
    mockRedis.scan.mockRejectedValue(new Error('Redis connection refused'));

    // Should not throw — errors are logged and swallowed.
    await expect(
      listener.handleAppointmentBooked(
        new AppointmentBookedEvent('appt-1', DOCTOR_ID, 'patient-1', new Date()),
      ),
    ).resolves.toBeUndefined();
  });

  it('does not throw when Redis DEL fails', async () => {
    mockRedis.scan.mockResolvedValueOnce(['0', ['avail:doctor-abc-123:2026-06-01:2026-06-01:all']]);
    mockRedis.del.mockRejectedValue(new Error('Redis write error'));

    await expect(
      listener.handleAppointmentCancelled(
        new AppointmentCancelledEvent('appt-1', DOCTOR_ID, 'patient-1', 'patient'),
      ),
    ).resolves.toBeUndefined();
  });

  // ─── All event handlers delegate to invalidateDoctorCache ──────────

  it('invalidates cache on appointment.rescheduled', async () => {
    mockRedis.scan.mockResolvedValueOnce(['0', ['avail:doctor-abc-123:2026-06-01:2026-06-01:all']]);
    mockRedis.del.mockResolvedValue(1);

    await listener.handleAppointmentRescheduled(
      new AppointmentRescheduledEvent('appt-1', DOCTOR_ID, 'patient-1', new Date()),
    );

    expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', `avail:${DOCTOR_ID}:*`, 'COUNT', 100);
    expect(mockRedis.del).toHaveBeenCalled();
  });

  it('invalidates cache on schedule.exception.updated', async () => {
    mockRedis.scan.mockResolvedValueOnce(['0', ['avail:doctor-abc-123:2026-06-01:2026-06-01:all']]);
    mockRedis.del.mockResolvedValue(1);

    await listener.handleScheduleExceptionUpdated(
      new ScheduleExceptionUpdatedEvent(DOCTOR_ID),
    );

    expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', `avail:${DOCTOR_ID}:*`, 'COUNT', 100);
    expect(mockRedis.del).toHaveBeenCalled();
  });

  it('invalidates cache on slot.lock.expired', async () => {
    mockRedis.scan.mockResolvedValueOnce(['0', ['avail:doctor-abc-123:2026-06-01:2026-06-01:all']]);
    mockRedis.del.mockResolvedValue(1);

    await listener.handleSlotLockExpired(
      new SlotLockExpiredEvent(DOCTOR_ID, new Date(), 'lock-token-1'),
    );

    expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', `avail:${DOCTOR_ID}:*`, 'COUNT', 100);
    expect(mockRedis.del).toHaveBeenCalled();
  });
});
