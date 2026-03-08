import { IsString, IsNotEmpty, Matches, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+261\d{9}$/, {
    message: 'phone_number must be a valid Madagascar E.164 number (+261XXXXXXXXX)',
  })
  phone_number: string;

  @IsString()
  @MinLength(8)
  password: string;
}
