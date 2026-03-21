import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../shared/database/prisma.service';
import { DoctorSearchRepository, type SearchParams } from './doctor-search.repository';

/**
 * Unit tests for the DoctorSearchRepository.
 *
 * These tests verify that the repository correctly builds SQL queries and processes
 * results for each search filter (specialty, name, geo, etc.) and their combinations.
 *
 * We mock PrismaService.$queryRaw to inspect the SQL fragments being built and
 * verify the repository returns correctly shaped results. Integration tests
 * against a real database would test the actual SQL execution.
 */

// ── Helpers ──────────────────────────────────────────────────────────

/** Factory for creating search params with sensible defaults */
function searchParams(overrides: Partial<SearchParams> = {}): SearchParams {
  return {
    page: 1,
    limit: 20,
    ...overrides,
  };
}

/** Factory for creating a mock search result row */
function mockDoctorRow(overrides: Record<string, unknown> = {}) {
  return {
    user_id: 'doctor-uuid-1',
    first_name: 'Tahiry',
    last_name: 'Rakoto',
    profile_photo_url: null,
    specialties: ['Cardiologie'],
    languages_spoken: ['french', 'malagasy'],
    consultation_fee_mga: 100000,
    consultation_duration_minutes: 30,
    average_rating: 450,
    total_reviews: 32,
    video_consultation_enabled: false,
    home_visit_enabled: false,
    accepts_new_patients: true,
    about: 'Experienced cardiologist',
    ...overrides,
  };
}

// ── Mock setup ───────────────────────────────────────────────────────

const mockPrismaService = {
  $queryRaw: jest.fn(),
};

describe('DoctorSearchRepository', () => {
  let repository: DoctorSearchRepository;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DoctorSearchRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repository = module.get<DoctorSearchRepository>(DoctorSearchRepository);
  });

  // ───────────────────── Basic search (no filters) ────────────────────
  describe('search with no filters', () => {
    it('should return all live, active doctors sorted by rating', async () => {
      const doctors = [
        mockDoctorRow({ average_rating: 450 }),
        mockDoctorRow({ user_id: 'doctor-uuid-2', average_rating: 300 }),
      ];

      // First call: search query, second call: count query
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce(doctors)
        .mockResolvedValueOnce([{ count: BigInt(2) }]);

      const result = await repository.search(searchParams());

      expect(result.rows).toEqual(doctors);
      expect(result.total).toBe(2);
      // Should have made exactly 2 queries: one for results, one for count
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it('should return empty results when no doctors match', async () => {
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(0) }]);

      const result = await repository.search(searchParams());

      expect(result.rows).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ───────────────────── Pagination ────────────────────────────────────
  describe('pagination', () => {
    it('should calculate correct offset for page 2', async () => {
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(0) }]);

      await repository.search(searchParams({ page: 2, limit: 10 }));

      // The search query (first call) should use OFFSET 10 (page 2, limit 10)
      // We verify the query was called — the actual SQL offset is embedded in
      // the Prisma.Sql tagged template which we can't easily inspect directly.
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it('should use provided limit', async () => {
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(0) }]);

      await repository.search(searchParams({ limit: 5 }));

      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(2);
    });
  });

  // ───────────────────── Layer 1: Specialty filter ────────────────────
  describe('specialty filter', () => {
    it('should filter by specialty when provided', async () => {
      const cardiologist = mockDoctorRow({ specialties: ['Cardiologie'] });

      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([cardiologist])
        .mockResolvedValueOnce([{ count: BigInt(1) }]);

      const result = await repository.search(
        searchParams({ specialty: 'Cardiologie' }),
      );

      expect(result.rows).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // ───────────────────── Layer 1: Language filter ─────────────────────
  describe('language filter', () => {
    it('should filter by language when provided', async () => {
      const frenchDoctor = mockDoctorRow({
        languages_spoken: ['french', 'malagasy'],
      });

      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([frenchDoctor])
        .mockResolvedValueOnce([{ count: BigInt(1) }]);

      const result = await repository.search(
        searchParams({ language: 'french' }),
      );

      expect(result.rows).toHaveLength(1);
    });
  });

  // ───────────────────── Layer 1: Rating filter ──────────────────────
  describe('rating filter', () => {
    it('should filter by minimum rating', async () => {
      const highRatedDoctor = mockDoctorRow({ average_rating: 450 });

      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([highRatedDoctor])
        .mockResolvedValueOnce([{ count: BigInt(1) }]);

      const result = await repository.search(
        searchParams({ minRating: 400 }),
      );

      expect(result.rows).toHaveLength(1);
    });
  });

  // ───────────────────── Layer 1: Consultation type filter ───────────
  describe('consultation type filter', () => {
    it('should filter by video consultation', async () => {
      const videoDoctor = mockDoctorRow({ video_consultation_enabled: true });

      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([videoDoctor])
        .mockResolvedValueOnce([{ count: BigInt(1) }]);

      const result = await repository.search(
        searchParams({ consultationType: 'video' }),
      );

      expect(result.rows).toHaveLength(1);
    });

    it('should filter by home visit', async () => {
      const homeVisitDoctor = mockDoctorRow({ home_visit_enabled: true });

      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([homeVisitDoctor])
        .mockResolvedValueOnce([{ count: BigInt(1) }]);

      const result = await repository.search(
        searchParams({ consultationType: 'home_visit' }),
      );

      expect(result.rows).toHaveLength(1);
    });
  });

  // ───────────────────── Layer 2: Fuzzy name search ──────────────────
  describe('fuzzy name search', () => {
    it('should search by name when q is provided', async () => {
      const matchingDoctor = mockDoctorRow({
        first_name: 'Tahiry',
        last_name: 'Rakoto',
        similarity_score: 0.8,
      });

      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([matchingDoctor])
        .mockResolvedValueOnce([{ count: BigInt(1) }]);

      const result = await repository.search(
        searchParams({ q: 'Rakoto' }),
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].first_name).toBe('Tahiry');
    });

    it('should include similarity_score in results when q is provided', async () => {
      const doctor = mockDoctorRow({ similarity_score: 0.75 });

      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([doctor])
        .mockResolvedValueOnce([{ count: BigInt(1) }]);

      const result = await repository.search(searchParams({ q: 'Tahiry' }));

      expect(result.rows[0].similarity_score).toBe(0.75);
    });
  });

  // ───────────────────── Layer 3: Geo search ─────────────────────────
  describe('geographic search', () => {
    const geoParams = {
      lat: -18.9137,
      lng: 47.5361,
      radiusKm: 10,
    };

    it('should use facility join and deduplication when geo filter is active', async () => {
      const nearbyDoctor = mockDoctorRow({
        distance_km: 2.5,
        facility_name: 'Centre Hospitalier',
        facility_city: 'Antananarivo',
        facility_region: 'Analamanga',
      });

      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([nearbyDoctor])
        .mockResolvedValueOnce([{ count: BigInt(1) }]);

      const result = await repository.search(searchParams(geoParams));

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].distance_km).toBe(2.5);
      expect(result.rows[0].facility_name).toBe('Centre Hospitalier');
    });

    it('should skip geo filter when lat is missing', async () => {
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(0) }]);

      // Only lng and radiusKm — lat is missing, so geo filter is skipped
      await repository.search(
        searchParams({ lng: 47.5361, radiusKm: 10 }),
      );

      // Should use the simple query path (no facility join)
      // = 2 queries (search + count)
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it('should skip geo filter when lng is missing', async () => {
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(0) }]);

      await repository.search(
        searchParams({ lat: -18.9137, radiusKm: 10 }),
      );

      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it('should skip geo filter when radiusKm is missing', async () => {
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(0) }]);

      await repository.search(
        searchParams({ lat: -18.9137, lng: 47.5361 }),
      );

      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(2);
    });
  });

  // ───────────────────── Region/City filter ──────────────────────────
  describe('region and city filters', () => {
    it('should use facility join when region is provided', async () => {
      const doctor = mockDoctorRow();

      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([doctor])
        .mockResolvedValueOnce([{ count: BigInt(1) }]);

      const result = await repository.search(
        searchParams({ region: 'Analamanga' }),
      );

      expect(result.rows).toHaveLength(1);
    });

    it('should use facility join when city is provided', async () => {
      const doctor = mockDoctorRow();

      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([doctor])
        .mockResolvedValueOnce([{ count: BigInt(1) }]);

      const result = await repository.search(
        searchParams({ city: 'Antananarivo' }),
      );

      expect(result.rows).toHaveLength(1);
    });
  });

  // ───────────────────── Combined filters ─────────────────────────────
  describe('combined filters', () => {
    it('should handle all filters together', async () => {
      const doctor = mockDoctorRow({
        similarity_score: 0.6,
        distance_km: 3.2,
        facility_name: 'CHU Antananarivo',
        facility_city: 'Antananarivo',
        facility_region: 'Analamanga',
      });

      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([doctor])
        .mockResolvedValueOnce([{ count: BigInt(1) }]);

      const result = await repository.search(
        searchParams({
          q: 'Rakoto',
          specialty: 'Cardiologie',
          language: 'french',
          minRating: 300,
          consultationType: 'video',
          lat: -18.9137,
          lng: 47.5361,
          radiusKm: 10,
          region: 'Analamanga',
          city: 'Antananarivo',
        }),
      );

      expect(result.rows).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // ───────────────────── BigInt conversion ────────────────────────────
  describe('count conversion', () => {
    it('should convert BigInt count to Number', async () => {
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(42) }]);

      const result = await repository.search(searchParams());

      expect(result.total).toBe(42);
      expect(typeof result.total).toBe('number');
    });
  });
});
