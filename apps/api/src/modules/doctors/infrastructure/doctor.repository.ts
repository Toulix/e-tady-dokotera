import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import type { DoctorProfileModel } from '../../../generated/prisma/models/DoctorProfile';

/**
 * All database access for the doctors module is funneled through this repository.
 * Services and controllers never call Prisma directly — this boundary keeps
 * the data layer swappable and testable.
 */

export interface UpdateProfileData {
  specialties?: string[];
  subSpecialties?: string[];
  yearsOfExperience?: number;
  about?: string;
  languagesSpoken?: string[];
  consultationFeeMga?: number;
  consultationDurationMinutes?: number;
  acceptsNewPatients?: boolean;
  education?: Record<string, unknown>;
  certifications?: Record<string, unknown>;
  insuranceAccepted?: string[];
  videoConsultationEnabled?: boolean;
  homeVisitEnabled?: boolean;
}

/** Shape returned for public doctor profiles (profile + user name/photo). */
export interface DoctorProfileWithUser extends DoctorProfileModel {
  user: {
    firstName: string;
    lastName: string;
    profilePhotoUrl: string | null;
  };
}

@Injectable()
export class DoctorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<DoctorProfileWithUser | null> {
    return this.prisma.doctorProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
          },
        },
      },
    }) as Promise<DoctorProfileWithUser | null>;
  }

  async updateProfile(
    userId: string,
    data: UpdateProfileData,
  ): Promise<DoctorProfileModel> {
    return this.prisma.doctorProfile.update({
      where: { userId },
      data,
    });
  }

  /**
   * Marks a doctor as verified by setting isProfileLive = true.
   * Only admins should call this (enforced at the controller/service layer).
   */
  async verifyDoctor(userId: string): Promise<DoctorProfileModel> {
    return this.prisma.doctorProfile.update({
      where: { userId },
      data: { isProfileLive: true },
    });
  }
}
