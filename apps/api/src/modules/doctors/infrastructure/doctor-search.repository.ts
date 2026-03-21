import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import {
  sql,
  empty,
  type Sql,
} from '../../../generated/prisma/internal/prismaNamespace';
import type { DoctorSearchResult } from '../domain/search-result.interface';

/**
 * Parameters accepted by the search method.
 * These come from the validated SearchDoctorsQueryDto, but with camelCase naming
 * to follow internal TypeScript conventions.
 */
export interface SearchParams {
  q?: string;
  specialty?: string;
  region?: string;
  city?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  language?: string;
  minRating?: number;
  consultationType?: string;
  page: number;
  limit: number;
}

/**
 * Handles all raw SQL queries for doctor search.
 *
 * This is a separate repository from DoctorRepository (Single Responsibility Principle):
 * - DoctorRepository handles CRUD operations via Prisma ORM
 * - DoctorSearchRepository handles complex search queries via raw SQL
 *
 * Why raw SQL instead of Prisma ORM?
 * Prisma can't handle pg_trgm similarity(), PostGIS ST_DWithin(), or DISTINCT ON
 * efficiently. These are PostgreSQL-specific features that require raw queries.
 *
 * SQL injection safety:
 * All queries use Prisma.sql tagged templates (the `sql` function imported above).
 * This works like parameterized queries — user input is NEVER concatenated into the SQL
 * string. Instead, values are sent as separate parameters that PostgreSQL handles safely.
 */
@Injectable()
export class DoctorSearchRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Searches for doctors using up to 3 filter layers:
   *   Layer 1: specialty, language, rating, consultation type
   *   Layer 2: fuzzy name matching via pg_trgm
   *   Layer 3: geographic proximity via PostGIS
   *
   * Returns matching doctor rows and the total count for pagination.
   */
  async search(
    params: SearchParams,
  ): Promise<{ rows: DoctorSearchResult[]; total: number }> {
    const {
      q,
      specialty,
      region,
      city,
      lat,
      lng,
      radiusKm,
      language,
      minRating,
      consultationType,
      page,
      limit,
    } = params;

    // ── Build WHERE clause fragments ──────────────────────────────────
    // Each filter is either a SQL fragment or `empty` (which Prisma skips entirely).
    // This approach avoids string concatenation and keeps the query injection-safe.

    const whereClauses = this.buildWhereClauses({
      specialty,
      q,
      language,
      minRating,
      consultationType,
      lat,
      lng,
      radiusKm,
      region,
      city,
    });

    // ── Determine if we need facility JOINs ───────────────────────────
    // Facility tables are only joined when geo, region, or city filters are active.
    // Joining them unnecessarily would slow down the query with extra table scans.
    const needsFacilityJoin =
      this.hasGeoFilter(lat, lng, radiusKm) || !!region || !!city;

    const facilityJoin = needsFacilityJoin
      ? sql`LEFT JOIN doctors.doctor_facilities df ON df.doctor_id = p.user_id
            LEFT JOIN doctors.facilities f ON f.id = df.facility_id`
      : empty;

    // ── Build SELECT columns ──────────────────────────────────────────
    const extraSelectColumns = this.buildExtraSelectColumns(q, lat, lng, radiusKm);

    // ── Build ORDER BY ────────────────────────────────────────────────
    // When searching by name, results are sorted by how closely the name matches first,
    // then by rating as a tiebreaker. Without a name search, we just sort by rating.
    //
    // We need TWO versions of ORDER BY:
    // - "simple" uses table aliases (p., u.) for the non-subquery path
    // - "outer" uses column names only, for when results are wrapped in a dedup subquery
    //   (the p./u. aliases don't exist outside the subquery)
    const simpleOrderBy = q
      ? sql`ORDER BY similarity(u.first_name || ' ' || u.last_name, ${q}) DESC, p.average_rating DESC NULLS LAST`
      : sql`ORDER BY p.average_rating DESC NULLS LAST`;

    const outerOrderBy = q
      ? sql`ORDER BY similarity_score DESC, average_rating DESC NULLS LAST`
      : sql`ORDER BY average_rating DESC NULLS LAST`;

    // ── Pagination ────────────────────────────────────────────────────
    const offset = (page - 1) * limit;

    // ── Execute the search query ──────────────────────────────────────
    // When facility JOINs are active, a doctor with multiple facilities would appear
    // multiple times in the results. We handle this with a two-step approach:
    //   1. Inner query: DISTINCT ON (p.user_id) removes duplicates, keeping the
    //      closest facility (for geo) or first match (for region/city)
    //   2. Outer query: applies the user-facing sort order and pagination
    //
    // Without facility JOINs, we skip the subquery wrapper for simplicity.
    let rows: DoctorSearchResult[];

    if (needsFacilityJoin) {
      // PostgreSQL requires DISTINCT ON columns to match the leftmost ORDER BY columns.
      // So the inner query sorts by user_id first (for dedup), then by distance or rating
      // to pick the best facility per doctor. The outer query then re-sorts for display.
      const innerOrderBy = this.hasGeoFilter(lat, lng, radiusKm)
        ? sql`ORDER BY p.user_id, ST_Distance(
                f.geolocation::geography,
                ST_SetSRID(ST_MakePoint(${lng!}, ${lat!}), 4326)::geography
              ) ASC NULLS LAST`
        : sql`ORDER BY p.user_id, p.average_rating DESC NULLS LAST`;

      rows = await this.prisma.$queryRaw<DoctorSearchResult[]>(sql`
        SELECT * FROM (
          SELECT DISTINCT ON (p.user_id)
            p.user_id,
            u.first_name,
            u.last_name,
            u.profile_photo_url,
            p.specialties,
            p.languages_spoken,
            p.consultation_fee_mga,
            p.consultation_duration_minutes,
            p.average_rating,
            p.total_reviews,
            p.video_consultation_enabled,
            p.home_visit_enabled,
            p.accepts_new_patients,
            p.about
            ${extraSelectColumns}
          FROM doctors.profiles p
          INNER JOIN auth.users u ON u.id = p.user_id
          ${facilityJoin}
          WHERE p.is_profile_live = true
            AND u.is_active = true
            ${whereClauses.specialty}
            ${whereClauses.name}
            ${whereClauses.geo}
            ${whereClauses.region}
            ${whereClauses.city}
            ${whereClauses.language}
            ${whereClauses.rating}
            ${whereClauses.consultationType}
          ${innerOrderBy}
        ) AS deduplicated
        ${outerOrderBy}
        LIMIT ${limit} OFFSET ${offset}
      `);
    } else {
      // Simple case: no facility join means no duplicates, so no subquery needed
      rows = await this.prisma.$queryRaw<DoctorSearchResult[]>(sql`
        SELECT
          p.user_id,
          u.first_name,
          u.last_name,
          u.profile_photo_url,
          p.specialties,
          p.languages_spoken,
          p.consultation_fee_mga,
          p.consultation_duration_minutes,
          p.average_rating,
          p.total_reviews,
          p.video_consultation_enabled,
          p.home_visit_enabled,
          p.accepts_new_patients,
          p.about
          ${extraSelectColumns}
        FROM doctors.profiles p
        INNER JOIN auth.users u ON u.id = p.user_id
        WHERE p.is_profile_live = true
          AND u.is_active = true
          ${whereClauses.specialty}
          ${whereClauses.name}
          ${whereClauses.language}
          ${whereClauses.rating}
          ${whereClauses.consultationType}
        ${simpleOrderBy}
        LIMIT ${limit} OFFSET ${offset}
      `);
    }

    // ── Count total matching doctors (for pagination metadata) ─────────
    // This is a separate query because adding COUNT(*) OVER() to the main query
    // would force PostgreSQL to scan all matching rows even when we only need one page.
    const total = await this.countResults(
      facilityJoin,
      whereClauses,
    );

    return { rows, total };
  }

  // ── Private helper methods ──────────────────────────────────────────

  /**
   * Checks if all three geo parameters are present.
   * If any of lat/lng/radiusKm is missing, the geo filter is silently skipped
   * rather than throwing an error — this is intentional for a search endpoint
   * where filters are optional and combinable.
   */
  private hasGeoFilter(
    lat?: number,
    lng?: number,
    radiusKm?: number,
  ): boolean {
    return lat !== undefined && lng !== undefined && radiusKm !== undefined;
  }

  /**
   * Builds all WHERE clause fragments based on the provided filters.
   * Each fragment is either a Prisma.Sql piece or `empty` (which Prisma skips).
   *
   * This keeps the main search() method clean and makes each filter independently testable.
   */
  private buildWhereClauses(filters: {
    specialty?: string;
    q?: string;
    language?: string;
    minRating?: number;
    consultationType?: string;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    region?: string;
    city?: string;
  }): Record<string, Sql> {
    const {
      specialty,
      q,
      language,
      minRating,
      consultationType,
      lat,
      lng,
      radiusKm,
      region,
      city,
    } = filters;

    // ── Layer 1: Basic filters ──

    // The @> operator checks if the doctor's specialties array CONTAINS the given value.
    // ARRAY['Cardiologie']::text[] creates a single-element array to compare against.
    const specialtyClause = specialty
      ? sql`AND p.specialties @> ARRAY[${specialty}]::text[]`
      : empty;

    // Same approach for language — checks if doctor speaks the requested language
    const languageClause = language
      ? sql`AND p.languages_spoken @> ARRAY[${language}]::text[]`
      : empty;

    // average_rating is stored as an integer 0–500 (e.g., 450 = 4.5 stars)
    const ratingClause = minRating !== undefined
      ? sql`AND p.average_rating >= ${minRating}`
      : empty;

    // Consultation type maps to boolean flags on the profile.
    // "in_person" is the default, so we don't filter for it — most doctors offer it.
    const consultationTypeClause = this.buildConsultationTypeClause(consultationType);

    // ── Layer 2: Fuzzy name search ──

    // pg_trgm's similarity() function compares two strings and returns a score from 0 to 1.
    // A threshold of 0.3 is the PostgreSQL default — it catches common misspellings
    // (e.g., "Rakot" still matches "Rakoto") without returning too many false positives.
    const nameClause = q
      ? sql`AND similarity(u.first_name || ' ' || u.last_name, ${q}) > 0.3`
      : empty;

    // ── Layer 3: PostGIS geographic filter ──

    // ST_DWithin checks if two geographic points are within a certain distance of each other.
    // We convert radiusKm to meters (* 1000) because ST_DWithin uses meters for geography types.
    // The ::geography cast is essential — without it, ST_DWithin would use degrees (not meters).
    // We also filter out facilities with no geolocation to let PostgreSQL use the GIST index.
    const geoClause = this.hasGeoFilter(lat, lng, radiusKm)
      ? sql`AND f.geolocation IS NOT NULL
            AND ST_DWithin(
              f.geolocation::geography,
              ST_SetSRID(ST_MakePoint(${lng!}, ${lat!}), 4326)::geography,
              ${radiusKm! * 1000}
            )`
      : empty;

    // Region and city filters match against the facility's location fields
    const regionClause = region ? sql`AND f.region = ${region}` : empty;
    const cityClause = city ? sql`AND f.city = ${city}` : empty;

    return {
      specialty: specialtyClause,
      name: nameClause,
      geo: geoClause,
      region: regionClause,
      city: cityClause,
      language: languageClause,
      rating: ratingClause,
      consultationType: consultationTypeClause,
    };
  }

  /**
   * Maps consultation_type filter values to profile boolean flags.
   * "video" → videoConsultationEnabled must be true
   * "home_visit" → homeVisitEnabled must be true
   * "in_person" or undefined → no filter (most doctors offer in-person)
   */
  private buildConsultationTypeClause(consultationType?: string): Sql {
    switch (consultationType) {
      case 'video':
        return sql`AND p.video_consultation_enabled = true`;
      case 'home_visit':
        return sql`AND p.home_visit_enabled = true`;
      default:
        return empty;
    }
  }

  /**
   * Builds extra SELECT columns that only appear when certain filters are active.
   * - similarity_score: shows how closely the name matches the search text
   * - distance_km: shows how far the facility is from the user's location
   * - facility info: name/city/region of the matching facility
   */
  private buildExtraSelectColumns(
    q?: string,
    lat?: number,
    lng?: number,
    radiusKm?: number,
  ): Sql {
    const parts: Sql[] = [];

    if (q) {
      // similarity() returns a float between 0 and 1 — we expose this so the frontend
      // can show a "match quality" indicator or sort client-side if needed
      parts.push(
        sql`, similarity(u.first_name || ' ' || u.last_name, ${q}) AS similarity_score`,
      );
    }

    if (this.hasGeoFilter(lat, lng, radiusKm)) {
      // ST_Distance returns meters for geography types, so we divide by 1000 for km.
      // We also include facility details so the frontend can show "Dr. X at Hospital Y (2.3 km away)"
      parts.push(sql`, ST_Distance(
          f.geolocation::geography,
          ST_SetSRID(ST_MakePoint(${lng!}, ${lat!}), 4326)::geography
        ) / 1000.0 AS distance_km`);
      parts.push(sql`, f.name AS facility_name`);
      parts.push(sql`, f.city AS facility_city`);
      parts.push(sql`, f.region AS facility_region`);
    }

    // If no extra columns are needed, return `empty` so nothing is added to the SQL
    if (parts.length === 0) return empty;

    // Combine all extra column fragments into a single Sql piece
    // We manually build this because Prisma's join() is for list-separated values,
    // but these fragments already include their leading commas
    let combined = parts[0];
    for (let i = 1; i < parts.length; i++) {
      combined = sql`${combined}${parts[i]}`;
    }
    return combined;
  }

  /**
   * Counts the total number of distinct doctors matching the filters.
   * Used for pagination metadata (total, total_pages).
   *
   * PostgreSQL returns COUNT as bigint, which JavaScript represents as BigInt.
   * We convert to Number since doctor counts will never exceed Number.MAX_SAFE_INTEGER.
   */
  private async countResults(
    facilityJoin: Sql,
    whereClauses: Record<string, Sql>,
  ): Promise<number> {
    const countResult = await this.prisma.$queryRaw<[{ count: bigint }]>(sql`
      SELECT COUNT(DISTINCT p.user_id) AS count
      FROM doctors.profiles p
      INNER JOIN auth.users u ON u.id = p.user_id
      ${facilityJoin}
      WHERE p.is_profile_live = true
        AND u.is_active = true
        ${whereClauses.specialty}
        ${whereClauses.name}
        ${whereClauses.geo}
        ${whereClauses.region}
        ${whereClauses.city}
        ${whereClauses.language}
        ${whereClauses.rating}
        ${whereClauses.consultationType}
    `);

    return Number(countResult[0].count);
  }
}
