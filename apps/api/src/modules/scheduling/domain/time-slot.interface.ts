import type { ScheduleAppointmentType } from '../../../generated/prisma/enums';

/**
 * A single bookable time window produced by the slot generator.
 *
 * All Date values are in UTC. The consumer (Step 17 availability endpoint)
 * is responsible for formatting them in the user's timezone for display.
 */
export interface TimeSlot {
  startTime: Date;
  endTime: Date;
  appointmentType: ScheduleAppointmentType;
  /** Always true — the generator only returns slots that passed all filters. */
  isAvailable: boolean;
  /**
   * True when the date has a 'emergency_only' ScheduleException.
   * The slot is still bookable but the UI should surface a warning
   * and the booking flow should confirm intent with the patient.
   */
  isEmergencyOnly: boolean;
  /**
   * The facility this slot belongs to (from the template).
   * Required at booking time to associate the appointment with a location.
   * Null when the template is not tied to a specific facility.
   */
  facilityId: string | null;
}
