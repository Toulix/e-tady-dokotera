import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { PrismaClientKnownRequestError } from '../../../generated/prisma/internal/prismaNamespace';
import type { DoctorProfileModel } from '../../../generated/prisma/models/DoctorProfile';
import type { InputJsonValue } from '../../../generated/prisma/internal/prismaNamespace';

/**
 * All database access for the doctors module is funneled through this repository.
 * Services and controllers never call Prisma directly — this boundary keeps
 * the data layer swappable and testable.
 */

/**
 * Uses Prisma's InputJsonValue for education/certifications instead of
 * Record<string, unknown>. Record<string, unknown> is not assignable to
 * Prisma's JSON input types because Prisma needs to distinguish between
 * JSON null (DbNull/JsonNull) and TypeScript undefined.
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
  education?: InputJsonValue;
  certifications?: InputJsonValue;
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

/**
 * Shared select clause for the user relation.
 * Keeps the public-facing fields in one place so findByUserId
 * and updateProfile stay in sync.
 */
const USER_PUBLIC_SELECT = {
  select: {
    firstName: true,
    lastName: true,
    profilePhotoUrl: true,
  },
} as const;

@Injectable()
export class DoctorRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Finds a doctor profile by userId (internal use — returns all fields).
   * Used by updateOwnProfile / verifyDoctor where the caller needs full model access.
   */
  async findByUserId(userId: string): Promise<DoctorProfileWithUser | null> {
    return this.prisma.doctorProfile.findUnique({
      where: { userId },
      include: { user: USER_PUBLIC_SELECT },
    }) as Promise<DoctorProfileWithUser | null>;
  }

  /**
   * Finds a verified doctor profile for public display.
   * Only returns profiles where isProfileLive = true — unverified doctors
   * must not be visible to unauthenticated users. Using `select` instead of
   * returning the full model to avoid leaking internal fields
   * (e.g. totalAppointments, isProfileLive flag itself) to the public API.
   */
  async findPublicProfile(userId: string): Promise<DoctorProfileWithUser | null> {
    return this.prisma.doctorProfile.findUnique({
      where: { userId, isProfileLive: true },
      include: { user: USER_PUBLIC_SELECT },
    }) as Promise<DoctorProfileWithUser | null>;
  }

  /**
   * Updates a doctor profile and returns the updated record with user relation.
   *
   * Combines update + include in a single Prisma call to avoid an extra
   * round-trip that the previous implementation required (update then re-fetch).
   *
   * Catches Prisma P2025 ("Record not found") to handle the TOCTOU race
   * condition: the service checks existence before calling this method, but
   * the profile could be deleted between the check and this update.
   */
  async updateProfile(
    userId: string,
    data: UpdateProfileData,
  ): Promise<DoctorProfileWithUser> {
    try {
      return await this.prisma.doctorProfile.update({
        where: { userId },
        data,
        include: { user: USER_PUBLIC_SELECT },
      }) as DoctorProfileWithUser;
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Doctor profile not found');
      }
      throw error;
    }
  }

  /**
   * Marks a doctor as verified by setting isProfileLive = true.
   * Only admins should call this (enforced at the controller/service layer).
   *
   * Same P2025 guard as updateProfile — protects against race conditions
   * where the profile is deleted between the service's existence check and this write.
   */
  async verifyDoctor(userId: string): Promise<DoctorProfileModel> {
    try {
      return await this.prisma.doctorProfile.update({
        where: { userId },
        data: { isProfileLive: true },
      });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Doctor profile not found');
      }
      throw error;
    }
  }
}
