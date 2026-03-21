import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DoctorsService } from './doctors.service';
import { DoctorRepository } from '../infrastructure/doctor.repository';
import { DoctorSearchRepository } from '../infrastructure/doctor-search.repository';
import {
  DoctorProfileUpdatedEvent,
  DoctorVerifiedEvent,
} from '@/shared/events';

// ── Mock profile factory ──────────────────────────────────────────────
// Produces a plain object matching DoctorProfileWithUser shape.
function mockProfile(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'doctor-uuid-1',
    registrationNumber: 'MED-2024-001',
    specialties: ['Cardiologie'],
    subSpecialties: [],
    yearsOfExperience: 10,
    about: 'Experienced cardiologist',
    languagesSpoken: ['french', 'malagasy'],
    consultationFeeMga: 100000,
    consultationDurationMinutes: 30,
    acceptsNewPatients: true,
    education: null,
    certifications: null,
    insuranceAccepted: [],
    videoConsultationEnabled: false,
    homeVisitEnabled: false,
    isProfileLive: false,
    averageRating: 0,
    totalReviews: 0,
    totalAppointments: 0,
    user: {
      firstName: 'Tahiry',
      lastName: 'Rakoto',
      profilePhotoUrl: null,
    },
    ...overrides,
  };
}

// ── Mocks ──────────────────────────────────────────────────────────────
const mockDoctorRepository = {
  findByUserId: jest.fn(),
  findPublicProfile: jest.fn(),
  updateProfile: jest.fn(),
  verifyDoctor: jest.fn(),
};

const mockDoctorSearchRepository = {
  search: jest.fn(),
};

const mockEventEmitter = {
  emit: jest.fn(),
};

describe('DoctorsService', () => {
  let service: DoctorsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DoctorsService,
        { provide: DoctorRepository, useValue: mockDoctorRepository },
        { provide: DoctorSearchRepository, useValue: mockDoctorSearchRepository },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<DoctorsService>(DoctorsService);
  });

  // ───────────────────── getPublicProfile ──────────────────────────────
  describe('getPublicProfile', () => {
    it('should return a verified doctor profile with user info', async () => {
      // getPublicProfile now delegates to findPublicProfile, which
      // filters by isProfileLive = true at the query level.
      const profile = mockProfile({ isProfileLive: true });
      mockDoctorRepository.findPublicProfile.mockResolvedValue(profile);

      const result = await service.getPublicProfile('doctor-uuid-1');

      expect(result).toEqual(profile);
      expect(mockDoctorRepository.findPublicProfile).toHaveBeenCalledWith(
        'doctor-uuid-1',
      );
    });

    it('should throw NotFoundException when doctor does not exist', async () => {
      mockDoctorRepository.findPublicProfile.mockResolvedValue(null);

      await expect(
        service.getPublicProfile('nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when doctor is not verified', async () => {
      // findPublicProfile returns null for unverified profiles because
      // the query includes isProfileLive = true in its WHERE clause.
      mockDoctorRepository.findPublicProfile.mockResolvedValue(null);

      await expect(
        service.getPublicProfile('unverified-doctor-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ───────────────────── updateOwnProfile ─────────────────────────────
  describe('updateOwnProfile', () => {
    const dto = {
      specialties: ['Pédiatrie', 'Cardiologie'],
      consultation_fee_mga: 150000,
      about: 'Updated bio',
    };

    it('should update profile and return updated data with user relation', async () => {
      const existing = mockProfile();
      const updated = mockProfile({
        specialties: ['Pédiatrie', 'Cardiologie'],
        consultationFeeMga: 150000,
        about: 'Updated bio',
      });

      // updateProfile now returns the full profile with user relation
      // in a single Prisma call (no re-fetch needed).
      mockDoctorRepository.findByUserId.mockResolvedValue(existing);
      mockDoctorRepository.updateProfile.mockResolvedValue(updated);

      const result = await service.updateOwnProfile('doctor-uuid-1', dto);

      expect(result).toEqual(updated);
      expect(mockDoctorRepository.updateProfile).toHaveBeenCalledWith(
        'doctor-uuid-1',
        {
          specialties: ['Pédiatrie', 'Cardiologie'],
          consultationFeeMga: 150000,
          about: 'Updated bio',
        },
      );
      // Verify we only called findByUserId once (existence check only,
      // no second call for re-fetch).
      expect(mockDoctorRepository.findByUserId).toHaveBeenCalledTimes(1);
    });

    it('should emit DoctorProfileUpdatedEvent with updated field names', async () => {
      const existing = mockProfile();
      const updated = mockProfile({ consultationFeeMga: 200000 });

      mockDoctorRepository.findByUserId.mockResolvedValue(existing);
      mockDoctorRepository.updateProfile.mockResolvedValue(updated);

      await service.updateOwnProfile('doctor-uuid-1', {
        consultation_fee_mga: 200000,
      });

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'doctor.profile.updated',
        expect.any(DoctorProfileUpdatedEvent),
      );

      const emittedEvent = mockEventEmitter.emit.mock.calls[0][1];
      expect(emittedEvent.doctorId).toBe('doctor-uuid-1');
      expect(emittedEvent.updatedFields).toEqual(['consultationFeeMga']);
    });

    it('should return existing profile without updating when DTO is empty', async () => {
      const existing = mockProfile();
      mockDoctorRepository.findByUserId.mockResolvedValue(existing);

      const result = await service.updateOwnProfile('doctor-uuid-1', {});

      expect(result).toEqual(existing);
      expect(mockDoctorRepository.updateProfile).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when doctor profile does not exist', async () => {
      mockDoctorRepository.findByUserId.mockResolvedValue(null);

      await expect(
        service.updateOwnProfile('nonexistent-id', dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not throw when event listener fails', async () => {
      const existing = mockProfile();
      const updated = mockProfile({ about: 'new bio' });

      mockDoctorRepository.findByUserId.mockResolvedValue(existing);
      mockDoctorRepository.updateProfile.mockResolvedValue(updated);

      // Simulate event listener throwing an error — emitEventSafely
      // catches this and logs via NestJS Logger instead of propagating.
      mockEventEmitter.emit.mockImplementation(() => {
        throw new Error('Listener crashed');
      });

      const result = await service.updateOwnProfile('doctor-uuid-1', {
        about: 'new bio',
      });

      expect(result).toEqual(updated);
    });

    it('should map all snake_case DTO fields to camelCase Prisma fields', async () => {
      const fullDto = {
        specialties: ['Dermatologie'],
        sub_specialties: ['Cosmétique'],
        years_of_experience: 15,
        about: 'Full update',
        languages_spoken: ['french', 'english'],
        consultation_fee_mga: 120000,
        consultation_duration_minutes: 45,
        accepts_new_patients: false,
        education: { degree: 'MD' },
        certifications: { board: 'Certified' },
        insurance_accepted: ['OSTIE'],
        video_consultation_enabled: true,
        home_visit_enabled: true,
      };

      const existing = mockProfile();
      mockDoctorRepository.findByUserId.mockResolvedValue(existing);
      mockDoctorRepository.updateProfile.mockResolvedValue(existing);

      await service.updateOwnProfile('doctor-uuid-1', fullDto);

      expect(mockDoctorRepository.updateProfile).toHaveBeenCalledWith(
        'doctor-uuid-1',
        {
          specialties: ['Dermatologie'],
          subSpecialties: ['Cosmétique'],
          yearsOfExperience: 15,
          about: 'Full update',
          languagesSpoken: ['french', 'english'],
          consultationFeeMga: 120000,
          consultationDurationMinutes: 45,
          acceptsNewPatients: false,
          education: { degree: 'MD' },
          certifications: { board: 'Certified' },
          insuranceAccepted: ['OSTIE'],
          videoConsultationEnabled: true,
          homeVisitEnabled: true,
        },
      );
    });
  });

  // ───────────────────── verifyDoctor ─────────────────────────────────
  describe('verifyDoctor', () => {
    it('should mark doctor as verified and emit DoctorVerifiedEvent', async () => {
      const profile = mockProfile({ isProfileLive: false });
      mockDoctorRepository.findByUserId.mockResolvedValue(profile);
      mockDoctorRepository.verifyDoctor.mockResolvedValue({
        ...profile,
        isProfileLive: true,
      });

      await service.verifyDoctor('doctor-uuid-1', 'admin-uuid-1');

      expect(mockDoctorRepository.verifyDoctor).toHaveBeenCalledWith(
        'doctor-uuid-1',
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'doctor.verified',
        expect.any(DoctorVerifiedEvent),
      );

      const emittedEvent = mockEventEmitter.emit.mock.calls[0][1];
      expect(emittedEvent.doctorId).toBe('doctor-uuid-1');
      expect(emittedEvent.verifiedByAdminId).toBe('admin-uuid-1');
    });

    it('should be idempotent — no error when doctor is already verified', async () => {
      const profile = mockProfile({ isProfileLive: true });
      mockDoctorRepository.findByUserId.mockResolvedValue(profile);

      await service.verifyDoctor('doctor-uuid-1', 'admin-uuid-1');

      // Should not attempt to update or emit events
      expect(mockDoctorRepository.verifyDoctor).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when doctor does not exist', async () => {
      mockDoctorRepository.findByUserId.mockResolvedValue(null);

      await expect(
        service.verifyDoctor('nonexistent-id', 'admin-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not throw when event listener fails', async () => {
      const profile = mockProfile({ isProfileLive: false });
      mockDoctorRepository.findByUserId.mockResolvedValue(profile);
      mockDoctorRepository.verifyDoctor.mockResolvedValue({
        ...profile,
        isProfileLive: true,
      });

      mockEventEmitter.emit.mockImplementation(() => {
        throw new Error('Listener crashed');
      });

      // Should not propagate the event listener error
      await expect(
        service.verifyDoctor('doctor-uuid-1', 'admin-uuid-1'),
      ).resolves.toBeUndefined();
    });
  });

  // ───────────────────── searchDoctors ─────────────────────────────────
  describe('searchDoctors', () => {
    const mockSearchRow = {
      user_id: 'doctor-uuid-1',
      first_name: 'Tahiry',
      last_name: 'Rakoto',
      profile_photo_url: null,
      specialties: ['Cardiologie'],
      languages_spoken: ['french'],
      consultation_fee_mga: 100000,
      consultation_duration_minutes: 30,
      average_rating: 450,
      total_reviews: 10,
      video_consultation_enabled: false,
      home_visit_enabled: false,
      accepts_new_patients: true,
      about: 'Experienced cardiologist',
    };

    it('should return paginated search results', async () => {
      mockDoctorSearchRepository.search.mockResolvedValue({
        rows: [mockSearchRow],
        total: 1,
      });

      const result = await service.searchDoctors({});

      expect(result).toEqual({
        doctors: [mockSearchRow],
        total: 1,
        page: 1,
        limit: 20,
        total_pages: 1,
      });
    });

    it('should use default page=1 and limit=20 when not provided', async () => {
      mockDoctorSearchRepository.search.mockResolvedValue({
        rows: [],
        total: 0,
      });

      await service.searchDoctors({});

      expect(mockDoctorSearchRepository.search).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 20 }),
      );
    });

    it('should use provided page and limit values', async () => {
      mockDoctorSearchRepository.search.mockResolvedValue({
        rows: [],
        total: 0,
      });

      await service.searchDoctors({ page: 3, limit: 10 });

      expect(mockDoctorSearchRepository.search).toHaveBeenCalledWith(
        expect.objectContaining({ page: 3, limit: 10 }),
      );
    });

    it('should calculate total_pages correctly', async () => {
      mockDoctorSearchRepository.search.mockResolvedValue({
        rows: [],
        total: 45,
      });

      // 45 results / 20 per page = 3 pages (2 full + 1 partial, ceil rounds up)
      const result = await service.searchDoctors({});

      expect(result.total_pages).toBe(3);
    });

    it('should return at least 1 total_pages even when total is 0', async () => {
      // This prevents the frontend from showing "page 1 of 0" which is confusing
      mockDoctorSearchRepository.search.mockResolvedValue({
        rows: [],
        total: 0,
      });

      const result = await service.searchDoctors({});

      expect(result.total_pages).toBe(1);
    });

    it('should map snake_case DTO fields to camelCase repository params', async () => {
      mockDoctorSearchRepository.search.mockResolvedValue({
        rows: [],
        total: 0,
      });

      await service.searchDoctors({
        q: 'Rakoto',
        specialty: 'Cardiologie',
        region: 'Analamanga',
        city: 'Antananarivo',
        lat: -18.9,
        lng: 47.5,
        radius_km: 10,
        language: 'french',
        min_rating: 300,
        consultation_type: 'video',
        page: 2,
        limit: 15,
      });

      expect(mockDoctorSearchRepository.search).toHaveBeenCalledWith({
        q: 'Rakoto',
        specialty: 'Cardiologie',
        region: 'Analamanga',
        city: 'Antananarivo',
        lat: -18.9,
        lng: 47.5,
        radiusKm: 10,
        language: 'french',
        minRating: 300,
        consultationType: 'video',
        page: 2,
        limit: 15,
      });
    });
  });
});
