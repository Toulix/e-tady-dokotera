import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { PrismaClientKnownRequestError } from '../../../generated/prisma/internal/prismaNamespace';
import type { WeeklyScheduleTemplateModel } from '../../../generated/prisma/models/WeeklyScheduleTemplate';
import type { ScheduleExceptionModel } from '../../../generated/prisma/models/ScheduleException';
import type { ScheduleAppointmentType, ExceptionType } from '../../../generated/prisma/enums';

// ─── Data shapes for create/update operations ───────────────────────

export interface CreateTemplateData {
  doctorId: string;
  facilityId?: string;
  dayOfWeek: number;
  startTime: Date;
  endTime: Date;
  appointmentType: ScheduleAppointmentType;
  slotDurationMinutes: number;
  bufferMinutes: number;
  maxBookingsPerSlot: number;
  effectiveFrom: Date;
  effectiveUntil?: Date;
}

export interface UpdateTemplateData {
  dayOfWeek?: number;
  startTime?: Date;
  endTime?: Date;
  appointmentType?: ScheduleAppointmentType;
  slotDurationMinutes?: number;
  bufferMinutes?: number;
  maxBookingsPerSlot?: number;
  effectiveFrom?: Date;
  effectiveUntil?: Date | null;
  isActive?: boolean;
}

export interface CreateExceptionData {
  doctorId: string;
  exceptionDate: Date;
  exceptionType: ExceptionType;
  customStartTime?: Date;
  customEndTime?: Date;
  reason?: string;
}

/**
 * All database access for the scheduling module.
 * Services never call Prisma directly — this boundary keeps the data
 * layer swappable and testable.
 */
@Injectable()
export class SchedulingRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Weekly templates ───────────────────────────────────────────────

  async createTemplate(
    data: CreateTemplateData,
  ): Promise<WeeklyScheduleTemplateModel> {
    return this.prisma.weeklyScheduleTemplate.create({ data });
  }

  /**
   * Returns all active templates for a doctor, ordered by day then start time.
   * Includes inactive templates so the doctor can see and reactivate them.
   */
  async findTemplatesByDoctor(
    doctorId: string,
  ): Promise<WeeklyScheduleTemplateModel[]> {
    return this.prisma.weeklyScheduleTemplate.findMany({
      where: { doctorId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async findTemplateById(
    id: string,
  ): Promise<WeeklyScheduleTemplateModel | null> {
    return this.prisma.weeklyScheduleTemplate.findUnique({ where: { id } });
  }

  /**
   * Updates a template and returns the updated record.
   *
   * Catches Prisma P2025 ("Record not found") to handle the race condition
   * where the template is deleted between the service's ownership check
   * and this update.
   */
  async updateTemplate(
    id: string,
    data: UpdateTemplateData,
  ): Promise<WeeklyScheduleTemplateModel> {
    try {
      return await this.prisma.weeklyScheduleTemplate.update({
        where: { id },
        data,
      });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Schedule template not found');
      }
      throw error;
    }
  }

  /**
   * Hard-deletes a template. We hard-delete rather than soft-delete because
   * templates are doctor-controlled configuration, not audit-critical records.
   * The doctor can always recreate a deleted template.
   */
  async deleteTemplate(id: string): Promise<void> {
    try {
      await this.prisma.weeklyScheduleTemplate.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Schedule template not found');
      }
      throw error;
    }
  }

  /**
   * Checks if an overlapping active template already exists for the same
   * doctor + facility + day + time range + effective date range.
   *
   * Two templates overlap only if both their time windows AND their
   * effective date ranges intersect. Without the date range check,
   * doctors couldn't create seasonal schedules (e.g. Monday 08–12
   * in Jan–Mar, then a different Monday 08–12 in Apr–Jun).
   */
  async findOverlappingTemplate(
    doctorId: string,
    dayOfWeek: number,
    startTime: Date,
    endTime: Date,
    facilityId: string | null,
    effectiveFrom: Date,
    effectiveUntil: Date | null,
    excludeId?: string,
  ): Promise<WeeklyScheduleTemplateModel | null> {
    return this.prisma.weeklyScheduleTemplate.findFirst({
      where: {
        doctorId,
        dayOfWeek,
        facilityId: facilityId ?? null,
        isActive: true,
        // Two time ranges overlap if one starts before the other ends
        startTime: { lt: endTime },
        endTime: { gt: startTime },
        // Two effective date ranges overlap if each starts before the other ends.
        // A null effectiveUntil means open-ended (no end date), so it always
        // overlaps with any range that starts before it.
        effectiveFrom: effectiveUntil
          ? { lt: effectiveUntil }
          : undefined, // no upper bound → any start date qualifies
        OR: [
          { effectiveUntil: null }, // open-ended templates overlap everything
          { effectiveUntil: { gt: effectiveFrom } },
        ],
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  // ─── Schedule exceptions ────────────────────────────────────────────

  async createException(
    data: CreateExceptionData,
  ): Promise<ScheduleExceptionModel> {
    return this.prisma.scheduleException.create({ data });
  }

  /**
   * Returns exceptions within a date range for a doctor.
   * Used by the slot generator (Step 16) and the doctor's exception list UI.
   */
  async findExceptionsByDoctorAndRange(
    doctorId: string,
    from: Date,
    to: Date,
  ): Promise<ScheduleExceptionModel[]> {
    return this.prisma.scheduleException.findMany({
      where: {
        doctorId,
        exceptionDate: { gte: from, lte: to },
      },
      orderBy: { exceptionDate: 'asc' },
    });
  }

  async findExceptionById(id: string): Promise<ScheduleExceptionModel | null> {
    return this.prisma.scheduleException.findUnique({ where: { id } });
  }

  /**
   * Checks if an exception already exists for this doctor on this date.
   * Prevents duplicate exceptions which would confuse the slot generator.
   */
  async findExceptionByDoctorAndDate(
    doctorId: string,
    exceptionDate: Date,
    excludeId?: string,
  ): Promise<ScheduleExceptionModel | null> {
    return this.prisma.scheduleException.findFirst({
      where: {
        doctorId,
        exceptionDate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async deleteException(id: string): Promise<void> {
    try {
      await this.prisma.scheduleException.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Schedule exception not found');
      }
      throw error;
    }
  }
}
