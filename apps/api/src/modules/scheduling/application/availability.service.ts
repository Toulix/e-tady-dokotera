import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import Redis from 'ioredis';
import { DateTime } from 'luxon';
import { REDIS_CLIENT } from '../../../shared/redis/redis.module';
import { SchedulingService } from './scheduling.service';
import { AppointmentsQueryService } from '../../appointments/application/appointments-query.service';
import { DoctorsService } from '../../doctors/application/doctors.service';
import { generateAvailableSlots } from '../domain/slot-generator';
import type { TimeSlot } from '../domain/time-slot.interface';

// Default timezone for Madagascar (Indian Ocean Time, UTC+3).
const TIMEZONE = 'Indian/Antananarivo';

// Maximum number of days a single availability query can span.
// Prevents abuse and keeps response size manageable.
const MAX_QUERY_SPAN_DAYS = 31;

// Maximum number of days into the future a query can reach.
// Matches the spec's "patients can book up to 3 months ahead" rule.
const MAX_ADVANCE_DAYS = 90;

// Redis cache TTL in seconds for availability results.
const CACHE_TTL_SECONDS = 30;

/**
 * Serialized version of TimeSlot for JSON responses and Redis caching.
 * Dates are stored as ISO 8601 strings instead of Date objects.
 */
export interface SerializedTimeSlot {
  startTime: string;
  endTime: string;
  appointmentType: string;
  isAvailable: boolean;
  isEmergencyOnly: boolean;
  facilityId: string | null;
}

/**
 * Orchestrates the availability computation for a doctor.
 *
 * Fetches data from 3 modules in parallel (scheduling, appointments, doctors),
 * calls the pure slot generator, groups results by date, and caches in Redis.
 *
 * This service lives in the scheduling module because it owns the slot
 * generation algorithm and schedule data. It imports DoctorsService and
 * AppointmentsQueryService via module imports (no circular dependency).
 */
@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger(AvailabilityService.name);

  constructor(
    private readonly schedulingService: SchedulingService,
    private readonly appointmentsQueryService: AppointmentsQueryService,
    private readonly doctorsService: DoctorsService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Returns available appointment slots for a doctor, grouped by date.
   *
   * @param doctorId   UUID of the doctor.
   * @param startDate  Start of the date range (YYYY-MM-DD inclusive).
   * @param endDate    End of the date range (YYYY-MM-DD inclusive).
   * @param facilityId Optional facility filter — includes facility-agnostic
   *                   templates (facilityId=null) alongside exact matches.
   * @returns Object keyed by date string ('YYYY-MM-DD'), each value an array
   *          of available slots. Dates with zero slots are omitted.
   */
  async getAvailability(
    doctorId: string,
    startDate: string,
    endDate: string,
    facilityId?: string,
    now: Date = new Date(),
  ): Promise<Record<string, SerializedTimeSlot[]>> {
    this.validateDateRange(startDate, endDate);

    // ── 1. Check Redis cache ──────────────────────────────────────────
    const cacheKey = this.buildCacheKey(doctorId, startDate, endDate, facilityId);
    const cached = await this.tryReadCache(cacheKey);
    if (cached) return cached;

    // ── 2. Fetch all data in parallel ─────────────────────────────────
    // Four independent queries — Promise.all minimizes total latency.
    // If the doctor doesn't exist, getMinAdvanceBookingHours throws 404
    // and the whole Promise.all rejects — we don't need a separate existence check.
    const [schedulingData, appointments, slotLocks, minAdvanceHours] =
      await Promise.all([
        this.schedulingService.getSchedulingDataForAvailability(
          doctorId,
          new Date(startDate),
          new Date(endDate),
        ),
        this.appointmentsQueryService.getActiveAppointments(
          doctorId,
          new Date(startDate),
          new Date(endDate),
        ),
        this.appointmentsQueryService.getActiveSlotLocks(
          doctorId,
          new Date(startDate),
          new Date(endDate),
        ),
        this.doctorsService.getMinAdvanceBookingHours(doctorId),
      ]);

    // ── 3. Filter templates by facility if requested ──────────────────
    // Include templates with facilityId=null (available everywhere)
    // alongside templates for the specific facility.
    let { templates } = schedulingData;
    if (facilityId) {
      templates = templates.filter(
        (t) => t.facilityId === null || t.facilityId === facilityId,
      );
    }

    // ── 4. Generate slots ─────────────────────────────────────────────
    const slots = generateAvailableSlots(
      templates,
      schedulingData.exceptions,
      appointments,
      slotLocks,
      { from: new Date(startDate), to: new Date(endDate) },
      TIMEZONE,
      minAdvanceHours,
      now,
    );

    // ── 5. Group by date and serialize ────────────────────────────────
    const grouped = this.groupByDate(slots);

    // ── 6. Cache result ───────────────────────────────────────────────
    await this.tryWriteCache(cacheKey, grouped);

    return grouped;
  }

  /**
   * Builds the Redis cache key for an availability query.
   * Format: avail:{doctorId}:{startDate}:{endDate}:{facilityId|all}
   *
   * The facilityId suffix is critical — without it, a request filtered by
   * facility A would cache its result, and a subsequent request for facility B
   * (or no facility) would get facility A's filtered slots back.
   */
  private buildCacheKey(
    doctorId: string,
    startDate: string,
    endDate: string,
    facilityId?: string,
  ): string {
    return `avail:${doctorId}:${startDate}:${endDate}:${facilityId ?? 'all'}`;
  }

  /**
   * Validates that the date range is logical and within allowed bounds.
   *
   * Validation runs before any database query to fail fast on bad input.
   * Each check has a specific error message so the caller knows exactly
   * what to fix.
   */
  private validateDateRange(startDate: string, endDate: string): void {
    const start = DateTime.fromISO(startDate, { zone: TIMEZONE });
    const end = DateTime.fromISO(endDate, { zone: TIMEZONE });
    const today = DateTime.now().setZone(TIMEZONE).startOf('day');

    if (!start.isValid || !end.isValid) {
      throw new BadRequestException(
        'Invalid date format. Expected YYYY-MM-DD.',
      );
    }

    if (start > end) {
      throw new BadRequestException(
        'start_date must be on or before end_date',
      );
    }

    if (start < today) {
      throw new BadRequestException(
        'start_date cannot be in the past',
      );
    }

    const spanDays = end.diff(start, 'days').days;
    if (spanDays > MAX_QUERY_SPAN_DAYS) {
      throw new BadRequestException(
        `Date range cannot exceed ${MAX_QUERY_SPAN_DAYS} days`,
      );
    }

    const advanceDays = end.diff(today, 'days').days;
    if (advanceDays > MAX_ADVANCE_DAYS) {
      throw new BadRequestException(
        `Cannot query more than ${MAX_ADVANCE_DAYS} days into the future`,
      );
    }
  }

  /**
   * Attempts to read a cached availability result from Redis.
   *
   * Returns null on cache miss OR Redis errors. The availability endpoint
   * must never fail because Redis is down — it falls back to computing
   * from the database.
   */
  private async tryReadCache(
    key: string,
  ): Promise<Record<string, SerializedTimeSlot[]> | null> {
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        this.logger.debug(`Cache hit: ${key}`);
        return JSON.parse(cached);
      }
    } catch (error) {
      this.logger.warn(
        `Redis read failed for ${key} — falling back to database`,
        error instanceof Error ? error.message : String(error),
      );
    }
    return null;
  }

  /**
   * Attempts to write an availability result to Redis cache.
   *
   * Failures are logged but swallowed — a cache write failure should
   * never prevent the endpoint from returning computed results.
   */
  private async tryWriteCache(
    key: string,
    data: Record<string, SerializedTimeSlot[]>,
  ): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(data), 'EX', CACHE_TTL_SECONDS);
      this.logger.debug(`Cache set: ${key} (TTL ${CACHE_TTL_SECONDS}s)`);
    } catch (error) {
      this.logger.warn(
        `Redis write failed for ${key} — result not cached`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Groups flat slot array by local date string and serializes Date objects.
   *
   * Dates are converted to the doctor's timezone (Indian/Antananarivo)
   * before extracting the YYYY-MM-DD key — a slot at 2026-04-08T21:30:00Z
   * is 2026-04-09T00:30:00+03:00, so it belongs to April 9th locally.
   *
   * Dates with zero slots are omitted from the result to keep the
   * response compact.
   */
  private groupByDate(
    slots: TimeSlot[],
  ): Record<string, SerializedTimeSlot[]> {
    const grouped: Record<string, SerializedTimeSlot[]> = {};

    for (const slot of slots) {
      const dateKey = DateTime.fromJSDate(slot.startTime)
        .setZone(TIMEZONE)
        .toISODate() as string;

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }

      grouped[dateKey].push({
        startTime: slot.startTime.toISOString(),
        endTime: slot.endTime.toISOString(),
        appointmentType: slot.appointmentType,
        isAvailable: slot.isAvailable,
        isEmergencyOnly: slot.isEmergencyOnly,
        facilityId: slot.facilityId,
      });
    }

    return grouped;
  }
}
