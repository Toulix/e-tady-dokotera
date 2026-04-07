import { Injectable } from '@nestjs/common';
import { AppointmentsRepository } from '../infrastructure/appointments.repository';

/**
 * Public query interface for the appointments module.
 *
 * Cross-module consumers (e.g. the scheduling module's AvailabilityService)
 * call this service instead of reaching into AppointmentsRepository directly.
 * This keeps the module boundary clean — if the internal data model changes,
 * only this service needs updating.
 */
@Injectable()
export class AppointmentsQueryService {
  constructor(private readonly appointmentsRepository: AppointmentsRepository) {}

  /**
   * Returns non-cancelled appointments for a doctor within a date range.
   * Used by the availability endpoint to detect slot conflicts.
   */
  async getActiveAppointments(
    doctorId: string,
    from: Date,
    to: Date,
  ): Promise<{ startTime: Date; durationMinutes: number }[]> {
    return this.appointmentsRepository.findActiveByDoctorAndRange(doctorId, from, to);
  }

  /**
   * Returns unexpired slot locks for a doctor within a date range.
   * Used by the availability endpoint to exclude temporarily reserved slots.
   */
  async getActiveSlotLocks(
    doctorId: string,
    from: Date,
    to: Date,
  ): Promise<{ slotTime: Date }[]> {
    return this.appointmentsRepository.findActiveLocksByDoctor(doctorId, from, to);
  }
}
