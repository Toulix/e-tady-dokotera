import {
  Injectable,
  Inject,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import * as bcrypt from 'bcrypt';
import { REDIS_CLIENT } from '@/shared/redis/redis.module';
import { AuthRepository } from '../infrastructure/auth.repository';
import { OtpService } from '../infrastructure/otp.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
export interface JwtPayload {
  sub: string;
  userType: string;
  iat?: number;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Returned to the controller for verify-otp and login responses */
export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; firstName: string; lastName: string; userType: string };
}

const REFRESH_TOKEN_TTL = 7 * 24 * 3600; // 7 days in seconds
const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly otpService: OtpService,
    private readonly jwtService: JwtService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async register(dto: RegisterDto): Promise<void> {
    const existing = await this.authRepository.findByPhone(dto.phone_number);
    if (existing) {
      throw new ConflictException('Phone number already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.authRepository.createUser({
      phoneNumber: dto.phone_number,
      passwordHash,
      firstName: dto.first_name,
      lastName: dto.last_name,
      userType: dto.user_type,
    });

    await this.otpService.generate(user.phoneNumber);
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<AuthResult> {
    const user = await this.authRepository.findByPhone(dto.phone_number);
    if (!user) {
      throw new BadRequestException('Invalid phone number');
    }

    const valid = await this.otpService.verify(dto.phone_number, dto.code);
    if (!valid) {
      throw new UnauthorizedException('Invalid or expired OTP code');
    }

    if (!user.isVerified) {
      await this.authRepository.markVerified(user.id);
    }
    await this.authRepository.updateLastLogin(user.id);

    const tokens = await this.issueTokenPair(user.id, user.userType);
    return {
      ...tokens,
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, userType: user.userType },
    };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.authRepository.findByPhone(dto.phone_number);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isVerified) {
      throw new UnauthorizedException('Account not verified. Please verify your OTP first.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is suspended');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.authRepository.updateLastLogin(user.id);

    const tokens = await this.issueTokenPair(user.id, user.userType);
    return {
      ...tokens,
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, userType: user.userType },
    };
  }

  /**
   * Validates the incoming refresh token against the bcrypt hash stored in Redis,
   * then rotates: deletes the old token, issues and stores a new pair.
   * This rotation ensures a stolen refresh token can only be used once.
   */
  async rotateRefreshToken(oldToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(oldToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const storedHash = await this.redis.get(`refresh:${payload.sub}`);
    if (!storedHash) {
      throw new UnauthorizedException('Refresh token not found — please log in again');
    }

    const matches = await bcrypt.compare(oldToken, storedHash);
    if (!matches) {
      // Possible token reuse attack — invalidate the family
      await this.redis.del(`refresh:${payload.sub}`);
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    return this.issueTokenPair(payload.sub, payload.userType);
  }

  async logout(userId: string): Promise<void> {
    await this.redis.del(`refresh:${userId}`);
  }

  /**
   * Issues an access+refresh token pair and stores the refresh token hash in Redis.
   * The raw refresh token is never persisted — only its bcrypt hash. This way a Redis
   * compromise does not expose valid session tokens.
   */
  private async issueTokenPair(userId: string, userType: string): Promise<TokenPair> {
    const jwtPayload: JwtPayload = { sub: userId, userType };

    const accessToken = this.jwtService.sign(jwtPayload, { expiresIn: '15m' });
    // Refresh token has a longer expiry, verified via Redis (not just JWT expiry)
    const refreshToken = this.jwtService.sign(jwtPayload, { expiresIn: '7d' });

    const refreshHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    await this.redis.set(`refresh:${userId}`, refreshHash, 'EX', REFRESH_TOKEN_TTL);

    return { accessToken, refreshToken };
  }
}
