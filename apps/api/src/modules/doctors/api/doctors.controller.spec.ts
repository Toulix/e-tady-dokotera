import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DoctorsController } from './doctors.controller';
import { DoctorsService } from '../application/doctors.service';

// ── Mock profile factory ──────────────────────────────────────────────
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
    isProfileLive: true,
    averageRating: 450,
    totalReviews: 32,
    totalAppointments: 150,
    user: {
      firstName: 'Tahiry',
      lastName: 'Rakoto',
      profilePhotoUrl: null,
    },
    ...overrides,
  };
}

const mockDoctorsService = {
  getPublicProfile: jest.fn(),
  updateOwnProfile: jest.fn(),
  verifyDoctor: jest.fn(),
};

describe('DoctorsController', () => {
  let controller: DoctorsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DoctorsController],
      providers: [
        { provide: DoctorsService, useValue: mockDoctorsService },
      ],
    }).compile();

    controller = module.get<DoctorsController>(DoctorsController);
  });

  // ───────────────────── GET /doctors/:id ─────────────────────────────
  describe('getProfile', () => {
    it('should return a doctor profile wrapped in success envelope', async () => {
      const profile = mockProfile();
      mockDoctorsService.getPublicProfile.mockResolvedValue(profile);

      const result = await controller.getProfile('doctor-uuid-1');

      expect(result).toEqual({ success: true, data: profile });
      expect(mockDoctorsService.getPublicProfile).toHaveBeenCalledWith(
        'doctor-uuid-1',
      );
    });

    it('should propagate NotFoundException from service', async () => {
      mockDoctorsService.getPublicProfile.mockRejectedValue(
        new NotFoundException('Doctor profile not found'),
      );

      await expect(
        controller.getProfile('nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ───────────────────── PATCH /doctors/profile ───────────────────────
  describe('updateProfile', () => {
    const doctorUser = { sub: 'doctor-uuid-1', userType: 'doctor' };
    const dto = {
      specialties: ['Pédiatrie'],
      consultation_fee_mga: 150000,
    };

    it('should update profile and return success envelope', async () => {
      const updated = mockProfile({
        specialties: ['Pédiatrie'],
        consultationFeeMga: 150000,
      });
      mockDoctorsService.updateOwnProfile.mockResolvedValue(updated);

      const result = await controller.updateProfile(doctorUser as any, dto);

      expect(result).toEqual({ success: true, data: updated });
      expect(mockDoctorsService.updateOwnProfile).toHaveBeenCalledWith(
        'doctor-uuid-1',
        dto,
      );
    });

    it('should propagate NotFoundException when profile does not exist', async () => {
      mockDoctorsService.updateOwnProfile.mockRejectedValue(
        new NotFoundException('Doctor profile not found'),
      );

      await expect(
        controller.updateProfile(doctorUser as any, dto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ───────────────────── POST /doctors/:id/verify ─────────────────────
  describe('verifyDoctor', () => {
    const adminUser = { sub: 'admin-uuid-1', userType: 'admin' };

    it('should verify doctor and return success message', async () => {
      mockDoctorsService.verifyDoctor.mockResolvedValue(undefined);

      const result = await controller.verifyDoctor(
        'doctor-uuid-1',
        adminUser as any,
      );

      expect(result).toEqual({ success: true, message: 'Doctor verified' });
      expect(mockDoctorsService.verifyDoctor).toHaveBeenCalledWith(
        'doctor-uuid-1',
        'admin-uuid-1',
      );
    });

    it('should propagate NotFoundException when doctor does not exist', async () => {
      mockDoctorsService.verifyDoctor.mockRejectedValue(
        new NotFoundException('Doctor profile not found'),
      );

      await expect(
        controller.verifyDoctor('nonexistent-id', adminUser as any),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
