/**
 * Types for the doctor profile page.
 *
 * The API returns camelCase fields (Prisma ORM convention) for the
 * single-doctor endpoint, unlike the search endpoint which uses raw SQL
 * and returns snake_case.
 */

/** Shape returned by GET /doctors/:id — public fields only. */
export interface ApiDoctorProfile {
  userId: string;
  specialties: string[];
  subSpecialties: string[];
  yearsOfExperience: number;
  about: string | null;
  languagesSpoken: string[];
  consultationFeeMga: number;
  consultationDurationMinutes: number;
  acceptsNewPatients: boolean;
  education: EducationEntry[] | null;
  certifications: CertificationEntry[] | null;
  insuranceAccepted: string[];
  videoConsultationEnabled: boolean;
  homeVisitEnabled: boolean;
  averageRating: number; // 0–500 scale (divide by 100 for display)
  totalReviews: number;
  user: {
    firstName: string;
    lastName: string;
    profilePhotoUrl: string | null;
  };
}

export interface EducationEntry {
  degree: string;
  institution: string;
  year?: number;
}

export interface CertificationEntry {
  name: string;
  issuer?: string;
  year?: number;
}

/** Frontend-friendly shape after mapping from API response. */
export interface DoctorProfile {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatarUrl: string | null;
  specialties: string[];
  subSpecialties: string[];
  yearsOfExperience: number;
  about: string | null;
  languages: string[];
  fee: number;
  durationMinutes: number;
  acceptsNewPatients: boolean;
  education: EducationEntry[];
  certifications: CertificationEntry[];
  insuranceAccepted: string[];
  videoEnabled: boolean;
  homeVisitEnabled: boolean;
  rating: number; // 0–5 scale
  reviewCount: number;
}

/**
 * Maps the API response to our frontend-friendly shape.
 * Keeps the mapping in one place so every component consumes the same data.
 */
export function mapApiProfile(api: ApiDoctorProfile): DoctorProfile {
  return {
    id: api.userId,
    firstName: api.user.firstName,
    lastName: api.user.lastName,
    fullName: `Dr ${api.user.firstName} ${api.user.lastName}`,
    avatarUrl: api.user.profilePhotoUrl,
    specialties: api.specialties,
    subSpecialties: api.subSpecialties,
    yearsOfExperience: api.yearsOfExperience,
    about: api.about,
    languages: api.languagesSpoken,
    fee: api.consultationFeeMga,
    durationMinutes: api.consultationDurationMinutes,
    acceptsNewPatients: api.acceptsNewPatients,
    education: Array.isArray(api.education) ? api.education : [],
    certifications: Array.isArray(api.certifications) ? api.certifications : [],
    insuranceAccepted: api.insuranceAccepted,
    videoEnabled: api.videoConsultationEnabled,
    homeVisitEnabled: api.homeVisitEnabled,
    // Backend stores 0–500, UI shows 0–5. Clamp to [0, 5] in case
    // the backend sends an unexpected value (e.g. stale migration data).
    rating: Math.min(5, Math.max(0, api.averageRating / 100)),
    reviewCount: api.totalReviews,
  };
}

/** Maps backend language enum to French label (same as SearchPage). */
export const LANGUAGE_LABELS: Record<string, string> = {
  malagasy: 'Malagasy',
  french: 'Français',
  english: 'Anglais',
};
