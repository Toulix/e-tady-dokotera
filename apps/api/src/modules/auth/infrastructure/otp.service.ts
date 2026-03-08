import { Inject, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import Redis from 'ioredis';
import * as bcrypt from 'bcrypt';
import { REDIS_CLIENT } from '../../../shared/redis/redis.module';
import { SmsProvider } from '../../notifications/domain/sms-provider.interface';

const OTP_TTL_SECONDS = 600; // 10 minutes
const MAX_VERIFY_ATTEMPTS = 5;

/**
 * Handles OTP generation, hashed storage in Redis, and verification.
 *
 * Security design:
 * - The raw OTP code is never stored — only a bcrypt hash lives in Redis.
 * - A per-phone attempt counter (also in Redis) caps brute-force tries at 5
 *   per OTP lifetime. This is keyed on phone number, not IP, because
 *   Madagascar carriers use CGN (thousands of users share one public IP).
 * - On successful verification, both the OTP hash and the attempt counter
 *   are deleted to prevent replay attacks.
 */
@Injectable()
export class OtpService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly smsProvider: SmsProvider,
  ) {}

  async generate(phone: string): Promise<void> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const hash = await bcrypt.hash(code, 10);
    await this.redis.set(`otp:${phone}`, hash, 'EX', OTP_TTL_SECONDS);
    await this.smsProvider.send({
      to: phone,
      message: `Your e-tady-dokotera verification code: ${code}`,
    });
  }

  async verify(phone: string, code: string): Promise<boolean> {
    // CRIT-02 fix: per-phone attempt counter prevents distributed brute force.
    // A 6-digit OTP (1,000,000 values) can be exhausted quickly if rate limiting
    // is IP-only — Madagascar carriers use CGN so thousands of users share one IP.
    // This Redis counter is keyed on phone number, not IP, and is atomic.
    const attemptsKey = `otp_attempts:${phone}`;
    const attempts = await this.redis.incr(attemptsKey);
    if (attempts === 1) {
      await this.redis.expire(attemptsKey, OTP_TTL_SECONDS);
    }

    if (attempts > MAX_VERIFY_ATTEMPTS) {
      throw new HttpException(
        {
          code: 'OTP_MAX_ATTEMPTS',
          message: 'Too many attempts. Request a new code.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const hash = await this.redis.get(`otp:${phone}`);
    if (!hash) return false;

    const valid = await bcrypt.compare(code, hash);
    if (valid) {
      await this.redis.del(`otp:${phone}`, attemptsKey);
    }
    return valid;
  }
}
