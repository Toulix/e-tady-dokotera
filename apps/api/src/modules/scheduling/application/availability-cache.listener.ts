import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../shared/redis/redis.module';
import { AppointmentBookedEvent } from '../../../shared/events/appointment-booked.event';
import { AppointmentCancelledEvent } from '../../../shared/events/appointment-cancelled.event';
import { AppointmentRescheduledEvent } from '../../../shared/events/appointment-rescheduled.event';
import { ScheduleTemplateUpdatedEvent } from '../../../shared/events/schedule-template-updated.event';
import { ScheduleExceptionUpdatedEvent } from '../../../shared/events/schedule-exception-updated.event';
import { SlotLockExpiredEvent } from '../../../shared/events/slot-lock-expired.event';

// Maximum SCAN iterations to prevent infinite loops if the cursor
// never converges (defensive — shouldn't happen with a healthy Redis).
const MAX_SCAN_ITERATIONS = 1000;

/**
 * Listens for domain events that change a doctor's availability and
 * invalidates the corresponding Redis cache entries.
 *
 * Without invalidation, patients would see stale availability for up
 * to 30 seconds after a booking or schedule change. The event-driven
 * approach ensures near-instant cache freshness.
 *
 * All handlers use try/catch because event listeners must never crash
 * the main request flow — a failed cache invalidation is logged but
 * the worst case is a 30-second stale window (the TTL expires anyway).
 */
@Injectable()
export class AvailabilityCacheListener {
  private readonly logger = new Logger(AvailabilityCacheListener.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  @OnEvent('appointment.booked')
  async handleAppointmentBooked(event: AppointmentBookedEvent): Promise<void> {
    try {
      await this.invalidateDoctorCache(event.doctorId);
    } catch (error) {
      this.logger.error(
        `Failed to invalidate cache after appointment booked for doctor ${event.doctorId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  @OnEvent('appointment.cancelled')
  async handleAppointmentCancelled(event: AppointmentCancelledEvent): Promise<void> {
    try {
      await this.invalidateDoctorCache(event.doctorId);
    } catch (error) {
      this.logger.error(
        `Failed to invalidate cache after appointment cancelled for doctor ${event.doctorId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  @OnEvent('schedule.template.updated')
  async handleScheduleUpdated(event: ScheduleTemplateUpdatedEvent): Promise<void> {
    try {
      await this.invalidateDoctorCache(event.doctorId);
    } catch (error) {
      this.logger.error(
        `Failed to invalidate cache after schedule update for doctor ${event.doctorId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // A reschedule may be emitted as a single event (not cancel+rebook),
  // so the cache must be invalidated to reflect the freed and newly occupied slots.
  @OnEvent('appointment.rescheduled')
  async handleAppointmentRescheduled(event: AppointmentRescheduledEvent): Promise<void> {
    try {
      await this.invalidateDoctorCache(event.doctorId);
    } catch (error) {
      this.logger.error(
        `Failed to invalidate cache after appointment rescheduled for doctor ${event.doctorId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // When a schedule exception is created, updated, or deleted (e.g. day off,
  // custom hours), the doctor's availability changes and the cache must be cleared.
  @OnEvent('schedule.exception.updated')
  async handleScheduleExceptionUpdated(event: ScheduleExceptionUpdatedEvent): Promise<void> {
    try {
      await this.invalidateDoctorCache(event.doctorId);
    } catch (error) {
      this.logger.error(
        `Failed to invalidate cache after schedule exception update for doctor ${event.doctorId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // When a slot lock expires, the previously locked slot becomes available again.
  // Without invalidation, the cached response would show it as unavailable
  // until the 30s TTL expires naturally.
  @OnEvent('slot.lock.expired')
  async handleSlotLockExpired(event: SlotLockExpiredEvent): Promise<void> {
    try {
      await this.invalidateDoctorCache(event.doctorId);
    } catch (error) {
      this.logger.error(
        `Failed to invalidate cache after slot lock expired for doctor ${event.doctorId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Deletes all cached availability entries for a doctor.
   *
   * Uses SCAN instead of KEYS to avoid blocking Redis on large keyspaces.
   * KEYS iterates the entire keyspace in a single blocking call — at scale,
   * this stalls all other Redis operations. SCAN is cursor-based and
   * non-blocking, yielding batches of results across multiple round-trips.
   *
   * Pattern: avail:{doctorId}:* matches all date range combinations.
   */
  private async invalidateDoctorCache(doctorId: string): Promise<void> {
    const pattern = `avail:${doctorId}:*`;
    let cursor = '0';
    let totalDeleted = 0;
    let iterations = 0;

    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        await this.redis.del(...keys);
        totalDeleted += keys.length;
      }

      iterations++;
      if (iterations >= MAX_SCAN_ITERATIONS) {
        this.logger.warn(
          `SCAN loop exceeded ${MAX_SCAN_ITERATIONS} iterations for pattern "${pattern}" — aborting`,
        );
        break;
      }
    } while (cursor !== '0');

    if (totalDeleted > 0) {
      this.logger.log(
        `Invalidated ${totalDeleted} availability cache entries for doctor ${doctorId}`,
      );
    }
  }
}
