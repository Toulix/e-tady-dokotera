/**
 * Shape of a single doctor row returned from the raw SQL search query.
 *
 * Field names are snake_case because they come directly from PostgreSQL column names
 * (raw SQL bypasses Prisma's camelCase mapping). The frontend or a mapper can
 * convert to camelCase if needed.
 */
export interface DoctorSearchResult {
  user_id: string;
  first_name: string;
  last_name: string;
  profile_photo_url: string | null;
  specialties: string[];
  languages_spoken: string[];
  consultation_fee_mga: number;
  consultation_duration_minutes: number;
  /** Rating on a 0–500 scale (divide by 100 for 0.00–5.00 stars) */
  average_rating: number;
  total_reviews: number;
  video_consultation_enabled: boolean;
  home_visit_enabled: boolean;
  accepts_new_patients: boolean;
  about: string | null;
  /** Distance in km from the user's location. Only present when lat/lng/radius_km are provided. */
  distance_km?: number;
  /**
   * How closely the doctor's name matches the search text (0 = no match, 1 = exact match).
   * Only present when the `q` query parameter is provided.
   * Powered by PostgreSQL's pg_trgm extension.
   */
  similarity_score?: number;
  /** Name of the closest matching facility. Only present when geo filter is active. */
  facility_name?: string;
  /** City of the closest matching facility. Only present when geo filter is active. */
  facility_city?: string;
  /** Region of the closest matching facility. Only present when geo filter is active. */
  facility_region?: string;
}

/**
 * Wraps search results with pagination metadata so the frontend knows
 * how many pages of results exist and which page it's currently viewing.
 */
export interface PaginatedSearchResult {
  doctors: DoctorSearchResult[];
  /** Total number of doctors matching the filters (across all pages) */
  total: number;
  /** Current page number (1-based) */
  page: number;
  /** Maximum results per page */
  limit: number;
  /** Total number of pages (calculated from total / limit, rounded up) */
  total_pages: number;
}
