import { IsString, IsIn, IsNotEmpty, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+261\d{9}$/, {
    message: 'phone_number must be a valid Madagascar E.164 number (+261XXXXXXXXX)',
  })
  phone_number: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;

  // Self-registration is restricted to patients only.
  // Doctor accounts are created via admin-initiated invite;
  // admin/support accounts via internal tooling only.
  @IsIn(['patient'])
  user_type: 'patient';
}
