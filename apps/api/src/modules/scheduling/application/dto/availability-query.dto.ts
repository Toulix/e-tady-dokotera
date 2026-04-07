import { IsDateString, IsOptional, IsUUID } from 'class-validator';

/**
 * Query parameters for the availability endpoint.
 *
 * Both date fields are required — unlike the exceptions query DTO which
 * defaults to a 90-day window, availability queries must be explicit
 * because they drive an expensive computation (slot generation).
 */
export class AvailabilityQueryDto {
  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsOptional()
  @IsUUID()
  facility_id?: string;
}
