import { IsDateString, IsOptional } from 'class-validator';

/**
 * Query params for listing schedule exceptions within a date range.
 * Both `from` and `to` are optional — if omitted, the service defaults
 * to a sensible window (e.g. current month or next 30 days).
 */
export class QueryScheduleExceptionsDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
