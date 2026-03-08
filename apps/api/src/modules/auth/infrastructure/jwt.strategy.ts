import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@/shared/redis/redis.module';
import type { JwtPayload } from '../application/auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
    });
  }

  /**
   * Called by Passport after JWT signature verification succeeds.
   * HIGH-04 fix: checks a Redis denylist before trusting the token.
   * On account suspension, a `token_denylist:{userId}` key is set with TTL = 15 min
   * (matching access token lifespan). Tokens issued before the suspension timestamp
   * are rejected; the entry self-cleans once all pre-suspension tokens expire.
   */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const revokedAt = await this.redis.get(`token_denylist:${payload.sub}`);
    if (revokedAt && payload.iat && Number(revokedAt) > payload.iat * 1000) {
      throw new UnauthorizedException('Token has been revoked');
    }
    return payload;
  }
}
