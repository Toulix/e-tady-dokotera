import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../shared/redis/redis.module';
import { AppointmentBookedEvent } from '../../../shared/events/appointment-booked.event';
import { AppointmentCancelledEvent } from '../../../shared/events/appointment-cancelled.event';
import { ScheduleTemplateUpdatedEvent } from '../../../shared/events/schedule-template-updated.event';

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
