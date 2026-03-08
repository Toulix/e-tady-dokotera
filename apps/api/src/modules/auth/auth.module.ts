import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthRepository } from './infrastructure/auth.repository';
import { OtpService } from './infrastructure/otp.service';
import { JwtStrategy } from './infrastructure/jwt.strategy';
import { AuthService } from './application/auth.service';
import { AuthController } from './api/auth.controller';

@Module({
  imports: [
    NotificationsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthRepository, OtpService, AuthService, JwtStrategy],
  exports: [AuthRepository, OtpService, AuthService],
})
export class AuthModule {}
