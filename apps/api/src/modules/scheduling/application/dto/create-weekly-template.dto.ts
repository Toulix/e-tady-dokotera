import {
  IsString,
  IsInt,
  IsOptional,
  IsIn,
  Min,
  Max,
  Matches,
  IsDateString,
  IsUUID,
} from 'class-validator';

/**
 * DTO for creating a new weekly schedule template.
 *
 * Time format is "HH:mm" (24h) — the backend converts to a Date for the
 * Prisma TIME column. We validate the string format here rather than
 * accepting a full ISO datetime, because only hours and minutes matter.
 *
 * Bounds rationale:
 * - day_of_week 0–6: Sunday through Saturday (JS Date convention)
 * - slot_duration_minutes 5–240: 5min minimum prevents abuse, 4h max covers
 *   the longest realistic consultation (surgery follow-up blocks)
 * - buffer_minutes 0–60: 1h max buffer between slots is generous
 * - max_bookings_per_slot 1–3: supports group sessions (Phase 2); slot generator uses max=1 for MVP
 */
export class CreateWeeklyTemplateDto {
  @IsInt()
  @Min(0)
  @Max(6)
  day_of_week: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'start_time must be in HH:mm format (e.g. "08:00")',
  })
  start_time: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'end_time must be in HH:mm format (e.g. "17:00")',
  })
  end_time: string;

  @IsIn(['in_person', 'video', 'both'])
  appointment_type: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(240)
  slot_duration_minutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  buffer_minutes?: number;

  // MVP: the slot generator (Step 16) treats all slots as single-booking (effectively max=1).
  // This field is validated so the data model is ready when multi-booking is enabled in Phase 2.
  // Max value is 3 — group consultation limit per spec §3.2.2.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  max_bookings_per_slot?: number;

  @IsDateString()
  effective_from: string;

  @IsOptional()
  @IsDateString()
  effective_until?: string;

  @IsOptional()
  @IsUUID()
  facility_id?: string;
}
