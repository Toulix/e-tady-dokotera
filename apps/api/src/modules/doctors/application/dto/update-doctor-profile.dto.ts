import {
  IsString,
  IsInt,
  IsBoolean,
  IsOptional,
  IsArray,
  Min,
  Max,
  IsObject,
} from 'class-validator';

/**
 * Partial update DTO for doctor profiles.
 * Every field is optional — only provided fields are updated.
 * Consultation fee is in Ariary (integer), never Decimal/Float.
 */
export class UpdateDoctorProfileDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sub_specialties?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(70)
  years_of_experience?: number;

  @IsOptional()
  @IsString()
  about?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages_spoken?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
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
  @IsString({ each: true })
  insurance_accepted?: string[];

  @IsOptional()
  @IsBoolean()
  video_consultation_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  home_visit_enabled?: boolean;
}
