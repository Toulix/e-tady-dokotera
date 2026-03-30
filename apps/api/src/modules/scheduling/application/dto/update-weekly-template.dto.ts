import {
  IsString,
  IsInt,
  IsOptional,
  IsIn,
  IsBoolean,
  Min,
  Max,
  Matches,
  IsDateString,
} from 'class-validator';

/**
 * Partial update DTO for weekly schedule templates.
 * Every field is optional — only provided fields are updated.
 */
export class UpdateWeeklyTemplateDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  day_of_week?: number;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'start_time must be in HH:mm format (e.g. "08:00")',
  })
  start_time?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'end_time must be in HH:mm format (e.g. "17:00")',
  })
  end_time?: string;

  @IsOptional()
  @IsIn(['in_person', 'video', 'both'])
  appointment_type?: string;

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

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  max_bookings_per_slot?: number;

  @IsOptional()
  @IsDateString()
  effective_from?: string;

  @IsOptional()
  @IsDateString()
  effective_until?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
