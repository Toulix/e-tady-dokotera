import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SchedulingRepository } from '../infrastructure/scheduling.repository';
import {
  CreateWeeklyTemplateDto,
  UpdateWeeklyTemplateDto,
  CreateScheduleExceptionDto,
  QueryScheduleExceptionsDto,
} from './dto';
import type { ScheduleAppointmentType, ExceptionType } from '../../../generated/prisma/enums';
import type { WeeklyScheduleTemplate } from '../domain/weekly-schedule-template.interface';
import type { ScheduleException } from '../domain/schedule-exception.interface';

/**
 * Converts an "HH:mm" string to a Date with only the time portion set.
 *
 * Prisma's TIME column maps to a JS Date where only hours and minutes
 * matter. We use 1970-01-01 as the epoch date since the date portion
 * is irrelevant — the database stores only the time component.
 *
 * The DTO regex validates format at the API boundary, but this function
 * may be called by the slot generator (Step 16) or other internal code,
 * so it fails loudly on invalid input rather than producing a silent
 * Invalid Date.
 */
function parseTimeString(time: string): Date {
  const [hoursStr, minutesStr] = time.split(':');
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    throw new BadRequestException(
      `Invalid time format: "${time}". Expected HH:mm`,
    );
  }

  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0, 0));
}

@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);

  constructor(private readonly schedulingRepository: SchedulingRepository) {}

  // ─── Weekly templates ───────────────────────────────────────────────

  async createTemplate(
    doctorId: string,
    dto: CreateWeeklyTemplateDto,
  ): Promise<WeeklyScheduleTemplate> {
    const startTime = parseTimeString(dto.start_time);
    const endTime = parseTimeString(dto.end_time);

    if (startTime >= endTime) {
      throw new BadRequestException('start_time must be before end_time');
    }

    // Effective date range must be logically valid — without this check,
    // a template with effective_from after effective_until would silently
    // never match any date in the slot generator (Step 16).
    if (dto.effective_until) {
      const from = new Date(dto.effective_from);
      const until = new Date(dto.effective_until);
      if (from >= until) {
        throw new BadRequestException(
          'effective_from must be before effective_until',
        );
      }
    }

    // Guard: check for overlapping active templates on the same day+facility.
    // Without this check, the partial unique index would reject the insert with
    // a cryptic Prisma error. This gives the doctor a clear message instead.
    const effectiveFrom = new Date(dto.effective_from);
    const effectiveUntil = dto.effective_until
      ? new Date(dto.effective_until)
      : null;

    const overlap = await this.schedulingRepository.findOverlappingTemplate(
      doctorId,
      dto.day_of_week,
      startTime,
      endTime,
      dto.facility_id ?? null,
      effectiveFrom,
      effectiveUntil,
    );

    if (overlap) {
      throw new BadRequestException(
        'An active template already exists for this day and time range. ' +
        'Deactivate or delete the existing template first.',
      );
    }

    return this.schedulingRepository.createTemplate({
      doctorId,
      facilityId: dto.facility_id,
      dayOfWeek: dto.day_of_week,
      startTime,
      endTime,
      appointmentType: dto.appointment_type as ScheduleAppointmentType,
      slotDurationMinutes: dto.slot_duration_minutes ?? 30,
      bufferMinutes: dto.buffer_minutes ?? 0,
      maxBookingsPerSlot: dto.max_bookings_per_slot ?? 1,
      effectiveFrom,
      effectiveUntil: effectiveUntil ?? undefined,
    });
  }

  async getTemplates(
    doctorId: string,
  ): Promise<WeeklyScheduleTemplate[]> {
    return this.schedulingRepository.findTemplatesByDoctor(doctorId);
  }

  async updateTemplate(
    doctorId: string,
    templateId: string,
    dto: UpdateWeeklyTemplateDto,
  ): Promise<WeeklyScheduleTemplate> {
    const template = await this.ensureTemplateOwnership(doctorId, templateId);

    // If time fields are being updated, validate the resulting time range
    const startTime = dto.start_time
      ? parseTimeString(dto.start_time)
      : undefined;
    const endTime = dto.end_time ? parseTimeString(dto.end_time) : undefined;

    const effectiveStart = startTime ?? template.startTime;
    const effectiveEnd = endTime ?? template.endTime;

    if (effectiveStart >= effectiveEnd) {
      throw new BadRequestException('start_time must be before end_time');
    }

    // Validate effective date range if either date is being updated
    if (dto.effective_from || dto.effective_until !== undefined) {
      const effectiveFrom = dto.effective_from
        ? new Date(dto.effective_from)
        : template.effectiveFrom;
      const effectiveUntil =
        dto.effective_until !== undefined
          ? dto.effective_until
            ? new Date(dto.effective_until)
            : null
          : template.effectiveUntil;

      if (effectiveUntil && effectiveFrom >= effectiveUntil) {
        throw new BadRequestException(
          'effective_from must be before effective_until',
        );
      }
    }

    // Resolve the effective date range for the overlap check — merge
    // the DTO values with the existing template's values so we check
    // the *resulting* effective window, not just the changed fields.
    const resolvedEffectiveFrom = dto.effective_from
      ? new Date(dto.effective_from)
      : template.effectiveFrom;
    const resolvedEffectiveUntil =
      dto.effective_until !== undefined
        ? dto.effective_until
          ? new Date(dto.effective_until)
          : null
        : template.effectiveUntil;

    // If day, time, effective dates, or active status changed, check for overlaps
    const dayChanged = dto.day_of_week !== undefined;
    const timeChanged = startTime !== undefined || endTime !== undefined;
    const datesChanged =
      dto.effective_from !== undefined || dto.effective_until !== undefined;
    const activating = dto.is_active === true && !template.isActive;

    if (dayChanged || timeChanged || datesChanged || activating) {
      const overlap = await this.schedulingRepository.findOverlappingTemplate(
        doctorId,
        dto.day_of_week ?? template.dayOfWeek,
        effectiveStart,
        effectiveEnd,
        template.facilityId,
        resolvedEffectiveFrom,
        resolvedEffectiveUntil,
        templateId, // exclude the current template from the overlap check
      );

      if (overlap) {
        throw new BadRequestException(
          'This change would overlap with an existing active template.',
        );
      }
    }

    return this.schedulingRepository.updateTemplate(templateId, {
      ...(dto.day_of_week !== undefined && { dayOfWeek: dto.day_of_week }),
      ...(startTime && { startTime }),
      ...(endTime && { endTime }),
      ...(dto.appointment_type && {
        appointmentType: dto.appointment_type as ScheduleAppointmentType,
      }),
      ...(dto.slot_duration_minutes !== undefined && {
        slotDurationMinutes: dto.slot_duration_minutes,
      }),
      ...(dto.buffer_minutes !== undefined && {
        bufferMinutes: dto.buffer_minutes,
      }),
      ...(dto.max_bookings_per_slot !== undefined && {
        maxBookingsPerSlot: dto.max_bookings_per_slot,
      }),
      ...(dto.effective_from && {
        effectiveFrom: new Date(dto.effective_from),
      }),
      ...(dto.effective_until !== undefined && {
        effectiveUntil: dto.effective_until
          ? new Date(dto.effective_until)
          : null,
      }),
      ...(dto.is_active !== undefined && { isActive: dto.is_active }),
    });
  }

  async deleteTemplate(doctorId: string, templateId: string): Promise<void> {
    await this.ensureTemplateOwnership(doctorId, templateId);
    await this.schedulingRepository.deleteTemplate(templateId);
  }

  // ─── Schedule exceptions ────────────────────────────────────────────

  async createException(
    doctorId: string,
    dto: CreateScheduleExceptionDto,
  ): Promise<ScheduleException> {
    // Cross-field validation: custom_hours requires both start and end times.
    // class-validator cannot express conditional required fields cleanly,
    // so we validate here in the service layer.
    if (dto.exception_type === 'custom_hours') {
      if (!dto.custom_start_time || !dto.custom_end_time) {
        throw new BadRequestException(
          'custom_start_time and custom_end_time are required when exception_type is "custom_hours"',
        );
      }

      const start = parseTimeString(dto.custom_start_time);
      const end = parseTimeString(dto.custom_end_time);
      if (start >= end) {
        throw new BadRequestException(
          'custom_start_time must be before custom_end_time',
        );
      }
    }

    const exceptionDate = new Date(dto.exception_date);

    // Guard: prevent duplicate exceptions on the same date.
    // The slot generator (Step 16) doesn't handle multiple exceptions per date,
    // so allowing duplicates would cause unpredictable behavior.
    const existing =
      await this.schedulingRepository.findExceptionByDoctorAndDate(
        doctorId,
        exceptionDate,
      );

    if (existing) {
      // ConflictException (409) is more appropriate than BadRequestException (400)
      // because the input itself is valid — it conflicts with an existing resource.
      throw new ConflictException(
        `An exception already exists for ${dto.exception_date}. ` +
        'Delete the existing exception first or use a different date.',
      );
    }

    return this.schedulingRepository.createException({
      doctorId,
      exceptionDate,
      exceptionType: dto.exception_type as ExceptionType,
      customStartTime: dto.custom_start_time
        ? parseTimeString(dto.custom_start_time)
        : undefined,
      customEndTime: dto.custom_end_time
        ? parseTimeString(dto.custom_end_time)
        : undefined,
      reason: dto.reason,
    });
  }

  /**
   * Returns exceptions for a doctor within a date range.
   * Defaults to the next 90 days if no range is provided — a reasonable
   * window for a doctor reviewing their upcoming schedule overrides.
   */
  async getExceptions(
    doctorId: string,
    query: QueryScheduleExceptionsDto,
  ): Promise<ScheduleException[]> {
    const from = query.from ? new Date(query.from) : new Date();
    const to = query.to
      ? new Date(query.to)
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    if (from > to) {
      throw new BadRequestException('"from" date must be before "to" date');
    }

    return this.schedulingRepository.findExceptionsByDoctorAndRange(
      doctorId,
      from,
      to,
    );
  }

  async deleteException(
    doctorId: string,
    exceptionId: string,
  ): Promise<void> {
    await this.ensureExceptionOwnership(doctorId, exceptionId);
    await this.schedulingRepository.deleteException(exceptionId);
  }

  // ─── Ownership guards ──────────────────────────────────────────────

  /**
   * Verifies that the template exists and belongs to the requesting doctor.
   * Without this check, a doctor could delete or modify another doctor's
   * schedule by guessing template IDs (IDOR vulnerability).
   */
  private async ensureTemplateOwnership(
    doctorId: string,
    templateId: string,
  ): Promise<WeeklyScheduleTemplate> {
    const template =
      await this.schedulingRepository.findTemplateById(templateId);

    if (!template) {
      throw new NotFoundException('Schedule template not found');
    }

    if (template.doctorId !== doctorId) {
      // Log the IDOR attempt — a doctor trying to access another doctor's
      // template is suspicious and worth monitoring.
      this.logger.warn(
        `IDOR attempt: doctor ${doctorId} tried to access template ${templateId} owned by ${template.doctorId}`,
      );
      throw new ForbiddenException(
        'You can only manage your own schedule templates',
      );
    }

    return template;
  }

  private async ensureExceptionOwnership(
    doctorId: string,
    exceptionId: string,
  ): Promise<ScheduleException> {
    const exception =
      await this.schedulingRepository.findExceptionById(exceptionId);

    if (!exception) {
      throw new NotFoundException('Schedule exception not found');
    }

    if (exception.doctorId !== doctorId) {
      this.logger.warn(
        `IDOR attempt: doctor ${doctorId} tried to access exception ${exceptionId} owned by ${exception.doctorId}`,
      );
      throw new ForbiddenException(
        'You can only manage your own schedule exceptions',
      );
    }

    return exception;
  }
}
