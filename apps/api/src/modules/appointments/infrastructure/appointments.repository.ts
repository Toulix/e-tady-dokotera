import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';

/**
 * Read-only appointment data access for cross-module consumers.
 *
 * This repository exists to serve the availability endpoint (Step 17),
 * which needs to know about existing bookings and active slot locks to
 * exclude occupied time windows from the available slots.
 *
 * Full CRUD operations will be added when the booking flow is implemented.
 */
@Injectable()
export class AppointmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns non-cancelled appointments for a doctor within a date range.
   *
   * The slot generator needs only { startTime, durationMinutes } to detect
   * overlap — we select just those fields to keep the query lightweight.
   *
   * Why NOT IN ('cancelled') instead of IN ('confirmed', 'pending_confirmation')?
   * Because completed and no_show appointments still block the time slot.
   * A doctor who had a no_show at 10:00 shouldn't have that slot re-offered
   * to another patient on the same day — the doctor has already allocated
   * that time and may have prepared for the visit.
   */
  async findActiveByDoctorAndRange(
    doctorId: string,
    from: Date,
    to: Date,
  ): Promise<{ startTime: Date; durationMinutes: number }[]> {
    return this.prisma.appointment.findMany({
      where: {
        doctorId,
        startTime: { gte: from, lte: to },
        status: { not: 'cancelled' },
      },
      select: {
        startTime: true,
        durationMinutes: true,
      },
      // Uses the @@index([doctorId, startTime]) composite index.
    });
  }

  /**
   * Returns unexpired slot locks for a doctor within a date range.
   *
   * Slot locks are short-lived (10-minute TTL) reservations created when
   * a patient begins the booking flow. They prevent two patients from
   * booking the same slot simultaneously.
   *
   * The slot generator expects { slotTime: Date }[] — we select only that field.
   */
  async findActiveLocksByDoctor(
    doctorId: string,
    from: Date,
    to: Date,
  ): Promise<{ slotTime: Date }[]> {
    return this.prisma.slotLock.findMany({
      where: {
        doctorId,
        slotTime: { gte: from, lte: to },
        // Only return locks that haven't expired yet.
        // Expired locks are cleaned up by a background job, but stale rows
        // may linger briefly — filtering here ensures accuracy.
        expiresAt: { gt: new Date() },
      },
      select: {
        slotTime: true,
      },
    });
  }
}
