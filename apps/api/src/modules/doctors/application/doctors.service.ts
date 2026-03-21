import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DoctorRepository,
  type DoctorProfileWithUser,
  type UpdateProfileData,
} from '../infrastructure/doctor.repository';
import type { InputJsonValue } from '../../../generated/prisma/internal/prismaNamespace';
import { UpdateDoctorProfileDto } from './dto/update-doctor-profile.dto';
import {
  DoctorProfileUpdatedEvent,
  DoctorVerifiedEvent,
} from '@/shared/events';

@Injectable()
export class DoctorsService {
  private readonly logger = new Logger(DoctorsService.name);

  constructor(
    private readonly doctorRepository: DoctorRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Returns a doctor profile for public display.
   * Uses findPublicProfile which filters by isProfileLive = true,
   * so unverified doctors are not exposed to unauthenticated users.
   * Returns 404 for both non-existent and unverified profiles to avoid
   * leaking whether an unverified profile exists (information disclosure).
   */
  async getPublicProfile(doctorId: string): Promise<DoctorProfileWithUser> {
    const profile = await this.doctorRepository.findPublicProfile(doctorId);

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

    /**
     * updateProfile now returns the full profile with user relation included
     * in a single Prisma call (update + include), eliminating the previous
     * extra round-trip that re-fetched after update. The repository also
     * handles the P2025 race condition internally.
     */
    const updated = await this.doctorRepository.updateProfile(doctorId, data);

    this.emitEventSafely(
      'doctor.profile.updated',
      new DoctorProfileUpdatedEvent(doctorId, updatedFields),
    );

    return updated;
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

    this.emitEventSafely(
      'doctor.verified',
      new DoctorVerifiedEvent(doctorId, adminId),
    );
  }

  /**
   * Emits a domain event inside a try/catch so that a failing listener
   * never breaks the primary request flow.
   *
   * Uses NestJS Logger instead of console.error so the output is structured
   * and routed through the application's logging pipeline. When Sentry is
   * installed (Phase 2), replace this.logger.error with Sentry.captureException
   * to ensure errors are tracked in the error monitoring dashboard.
   */
  private emitEventSafely(eventName: string, event: object): void {
    try {
      this.eventEmitter.emit(eventName, event);
    } catch (error) {
      this.logger.error(
        `Event listener for "${eventName}" failed — the primary operation succeeded but the side-effect did not fire.`,
        error instanceof Error ? error.stack : String(error),
      );
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
    // DTO uses Record<string, unknown> for class-validator's @IsObject(),
    // but Prisma expects InputJsonValue. The cast is safe here because
    // class-validator has already validated the shape as a plain object.
    if (dto.education !== undefined) data.education = dto.education as InputJsonValue;
    if (dto.certifications !== undefined) data.certifications = dto.certifications as InputJsonValue;
    if (dto.insurance_accepted !== undefined) data.insuranceAccepted = dto.insurance_accepted;
    if (dto.video_consultation_enabled !== undefined) data.videoConsultationEnabled = dto.video_consultation_enabled;
    if (dto.home_visit_enabled !== undefined) data.homeVisitEnabled = dto.home_visit_enabled;

    return data;
  }
}
