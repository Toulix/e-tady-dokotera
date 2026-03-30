import type { ScheduleAppointmentType } from '../../../generated/prisma/enums';

/**
 * Domain interface for a doctor's recurring weekly schedule.
 *
 * Each template defines a time window on a specific day of the week
 * during which the doctor is available. The slot generator (Step 16)
 * consumes these templates to produce bookable time slots.
 */
export interface WeeklyScheduleTemplate {
  id: string;
  doctorId: string;
  facilityId: string | null;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday (JavaScript Date convention)
  startTime: Date; // TIME column — only hours/minutes matter
  endTime: Date;
  appointmentType: ScheduleAppointmentType;
  slotDurationMinutes: number;
  bufferMinutes: number;
  maxBookingsPerSlot: number;
  isActive: boolean;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
}
