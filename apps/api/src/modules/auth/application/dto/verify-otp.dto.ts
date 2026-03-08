import { IsString, IsNotEmpty, Matches, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+261\d{9}$/, {
    message: 'phone_number must be a valid Madagascar E.164 number (+261XXXXXXXXX)',
  })
  phone_number: string;

  @IsString()
  @Length(6, 6, { message: 'OTP code must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'OTP code must be numeric' })
  code: string;
}
