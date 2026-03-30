import type { ExceptionType } from '../../../generated/prisma/enums';

/**
 * Domain interface for a one-off schedule override.
 *
 * Exceptions take precedence over weekly templates for their date:
 * - day_off: doctor is unavailable the entire day
 * - custom_hours: replaces template hours with custom window
 * - emergency_only: slots are generated but flagged as emergency-only
 */
export interface ScheduleException {
  id: string;
  doctorId: string;
  exceptionDate: Date;
  exceptionType: ExceptionType;
  customStartTime: Date | null;
  customEndTime: Date | null;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
}
