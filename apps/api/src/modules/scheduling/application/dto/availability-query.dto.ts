import { IsOptional, IsUUID, Matches } from 'class-validator';

/**
 * Query parameters for the availability endpoint.
 *
 * Both date fields are required — unlike the exceptions query DTO which
 * defaults to a 90-day window, availability queries must be explicit
 * because they drive an expensive computation (slot generation).
 */
export class AvailabilityQueryDto {
  // Strict YYYY-MM-DD format. @IsDateString() also accepts full ISO datetimes
  // like '2026-06-01T23:00:00Z', which produce different Date objects when
  // parsed with new Date() and can cause off-by-one day errors in queries.
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'start_date must be in YYYY-MM-DD format' })
  start_date: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'end_date must be in YYYY-MM-DD format' })
  end_date: string;

  @IsOptional()
  @IsUUID()
  facility_id?: string;
}
