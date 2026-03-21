import {
  IsString,
  IsInt,
  IsBoolean,
  IsOptional,
  IsArray,
  Min,
  Max,
  MaxLength,
  ArrayMaxSize,
  IsObject,
} from 'class-validator';

/**
 * Partial update DTO for doctor profiles.
 * Every field is optional — only provided fields are updated.
 * Consultation fee is in Ariary (integer), never Decimal/Float.
 *
 * Bounds rationale:
 * - ArrayMaxSize(20): no doctor realistically has more than 20 specialties,
 *   languages, or insurance partners. Prevents payload abuse.
 * - MaxLength(2000) on `about`: generous bio limit without allowing unbounded text.
 * - Max(10_000_000) on fee: ~$2,000 USD ceiling — adjust if domain reality differs.
 */
export class UpdateDoctorProfileDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  specialties?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  sub_specialties?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(70)
  years_of_experience?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  about?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  languages_spoken?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  consultation_fee_mga?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(180)
  consultation_duration_minutes?: number;

  @IsOptional()
  @IsBoolean()
  accepts_new_patients?: boolean;

  @IsOptional()
  @IsObject()
  education?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  certifications?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  insurance_accepted?: string[];

  @IsOptional()
  @IsBoolean()
  video_consultation_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  home_visit_enabled?: boolean;
}
