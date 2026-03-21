import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DoctorRepository,
  type DoctorProfileWithUser,
  type UpdateProfileData,
} from '../infrastructure/doctor.repository';
import { UpdateDoctorProfileDto } from './dto/update-doctor-profile.dto';
import {
  DoctorProfileUpdatedEvent,
  DoctorVerifiedEvent,
} from '@/shared/events';

@Injectable()
export class DoctorsService {
  constructor(
    private readonly doctorRepository: DoctorRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getPublicProfile(doctorId: string): Promise<DoctorProfileWithUser> {
    const profile = await this.doctorRepository.findByUserId(doctorId);

    if (!profile) {
      throw new NotFoundException('Doctor profile not found');
    }

    return profile;
  }

  /**
   * Allows a doctor to update their own profile.
   * Maps snake_case DTO fields to camelCase Prisma fields.
   * Emits DoctorProfileUpdatedEvent for cross-module consumers.
   */
  async updateOwnProfile(
    doctorId: string,
    dto: UpdateDoctorProfileDto,
  ): Promise<DoctorProfileWithUser> {
    const existing = await this.doctorRepository.findByUserId(doctorId);
    if (!existing) {
      throw new NotFoundException('Doctor profile not found');
    }

    const data = this.mapDtoToUpdateData(dto);
    const updatedFields = Object.keys(data);

    if (updatedFields.length === 0) {
      return existing;
    }

    await this.doctorRepository.updateProfile(doctorId, data);

    // Re-fetch with user relation included
    const updated = await this.doctorRepository.findByUserId(doctorId);

    try {
      this.eventEmitter.emit(
        'doctor.profile.updated',
        new DoctorProfileUpdatedEvent(doctorId, updatedFields),
      );
    } catch (error) {
      // Domain event listeners must not break the primary flow.
      // Sentry will capture the error via the global exception handler.
      console.error('DoctorProfileUpdatedEvent listener failed:', error);
    }

    return updated!;
  }

  /**
   * Admin-only: marks a doctor profile as verified (isProfileLive = true).
   * A verified doctor's profile appears in search results.
   */
  async verifyDoctor(
    doctorId: string,
    adminId: string,
  ): Promise<void> {
    const profile = await this.doctorRepository.findByUserId(doctorId);
    if (!profile) {
      throw new NotFoundException('Doctor profile not found');
    }

    if (profile.isProfileLive) {
      // Already verified — idempotent, no error thrown
      return;
    }

    await this.doctorRepository.verifyDoctor(doctorId);

    try {
      this.eventEmitter.emit(
        'doctor.verified',
        new DoctorVerifiedEvent(doctorId, adminId),
      );
    } catch (error) {
      console.error('DoctorVerifiedEvent listener failed:', error);
    }
  }

  /**
   * Maps the snake_case DTO fields coming from the API request
   * to camelCase fields expected by Prisma.
   */
  private mapDtoToUpdateData(dto: UpdateDoctorProfileDto): UpdateProfileData {
    const data: UpdateProfileData = {};

    if (dto.specialties !== undefined) data.specialties = dto.specialties;
    if (dto.sub_specialties !== undefined) data.subSpecialties = dto.sub_specialties;
    if (dto.years_of_experience !== undefined) data.yearsOfExperience = dto.years_of_experience;
    if (dto.about !== undefined) data.about = dto.about;
    if (dto.languages_spoken !== undefined) data.languagesSpoken = dto.languages_spoken;
    if (dto.consultation_fee_mga !== undefined) data.consultationFeeMga = dto.consultation_fee_mga;
    if (dto.consultation_duration_minutes !== undefined) data.consultationDurationMinutes = dto.consultation_duration_minutes;
    if (dto.accepts_new_patients !== undefined) data.acceptsNewPatients = dto.accepts_new_patients;
    if (dto.education !== undefined) data.education = dto.education;
    if (dto.certifications !== undefined) data.certifications = dto.certifications;
    if (dto.insurance_accepted !== undefined) data.insuranceAccepted = dto.insurance_accepted;
    if (dto.video_consultation_enabled !== undefined) data.videoConsultationEnabled = dto.video_consultation_enabled;
    if (dto.home_visit_enabled !== undefined) data.homeVisitEnabled = dto.home_visit_enabled;

    return data;
  }
}
