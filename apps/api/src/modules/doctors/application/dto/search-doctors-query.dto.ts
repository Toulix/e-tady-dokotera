import {
  IsOptional,
  IsString,
  IsInt,
  IsNumber,
  Min,
  Max,
  MaxLength,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Validates and transforms the query parameters for GET /api/v1/doctors/search.
 *
 * All fields are optional — calling the endpoint with no params returns all live doctors
 * sorted by rating. Query params arrive as strings from the URL, so numeric fields use
 * @Type(() => Number) to convert them before validation runs.
 *
 * Note: `available_date` from the spec is not included yet because the scheduling
 * module (Layer 4 / next-available-slot) is not implemented yet. It will be added
 * as a non-breaking change when Step 16 (slot generation) is complete.
 */
export class SearchDoctorsQueryDto {
  /** Free-text fuzzy name search. Uses PostgreSQL pg_trgm similarity matching. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  /**
   * Filter by medical specialty (exact match against the doctor's specialties array).
   * Example: "Cardiologie", "Dermatologie", "Pediatrie"
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  specialty?: string;

  /** Filter by the region where the doctor's facility is located. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  /** Filter by the city where the doctor's facility is located. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  /**
   * Latitude of the user's location for distance-based search.
   * Must be used together with `lng` and `radius_km` — if any of the three is missing,
   * the geo filter is silently skipped.
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  /**
   * Longitude of the user's location for distance-based search.
   * Must be used together with `lat` and `radius_km`.
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  /**
   * Search radius in kilometers around the user's location.
   * Must be used together with `lat` and `lng`.
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  radius_km?: number;

  /**
   * Filter by language the doctor speaks.
   * Matches against the doctor's `languages_spoken` array.
   */
  @IsOptional()
  @IsString()
  @IsIn(['malagasy', 'french', 'english'])
  language?: string;

  /**
   * Minimum rating filter on the 0–500 scale (where 500 = 5 stars).
   * Example: min_rating=300 means "3 stars and above".
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(500)
  min_rating?: number;

  /**
   * Filter by the type of consultation the doctor offers.
   * - "in_person": doctor sees patients at a facility
   * - "video": doctor offers video consultations
   * - "home_visit": doctor does home visits
   */
  @IsOptional()
  @IsString()
  @IsIn(['in_person', 'video', 'home_visit'])
  consultation_type?: string;

  /** Page number for pagination (1-based). Defaults to 1. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  /** Number of results per page. Defaults to 20, max 50. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
