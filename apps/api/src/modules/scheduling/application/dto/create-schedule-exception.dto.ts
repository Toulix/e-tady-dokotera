import {
  IsString,
  IsOptional,
  IsIn,
  Matches,
  MaxLength,
  IsDateString,
} from 'class-validator';

/**
 * DTO for creating a schedule exception (day-off, custom hours, etc.).
 *
 * custom_start_time and custom_end_time are required when exception_type
 * is "custom_hours" — this is validated in the service layer because
 * class-validator cannot express cross-field conditional requirements cleanly.
 */
export class CreateScheduleExceptionDto {
  @IsDateString()
  exception_date: string;

  @IsIn(['day_off', 'custom_hours', 'emergency_only'])
  exception_type: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'custom_start_time must be in HH:mm format (e.g. "08:00")',
  })
  custom_start_time?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'custom_end_time must be in HH:mm format (e.g. "17:00")',
  })
  custom_end_time?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
