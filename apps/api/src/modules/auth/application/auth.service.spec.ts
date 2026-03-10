import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { AuthRepository } from '../infrastructure/auth.repository';
import { OtpService } from '../infrastructure/otp.service';
import { REDIS_CLIENT } from '@/shared/redis/redis.module';

// ── Mock user factory ──────────────────────────────────────────────────
// Produces a plain object that satisfies the shape used by AuthService.
// The real UserModel is a runtime-derived Prisma type — for unit tests we
// only need the fields AuthService actually reads.
function mockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-uuid-1',
    phoneNumber: '+261340000001',
    passwordHash: '$2b$10$hashedpassword',
    firstName: 'Tahiry',
    lastName: 'Rakoto',
    userType: 'patient' as const,
    isVerified: true,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    email: null,
    dateOfBirth: null,
    gender: null,
    profilePhotoUrl: null,
    preferredLanguage: 'malagasy' as const,
    ...overrides,
  };
}

// ── Mocks ──────────────────────────────────────────────────────────────
const mockAuthRepository = {
  findByPhone: jest.fn(),
  createUser: jest.fn(),
  markVerified: jest.fn(),
  updateLastLogin: jest.fn(),
};

const mockOtpService = {
  generate: jest.fn(),
  verify: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn(),
  verify: jest.fn(),
};

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: mockAuthRepository },
        { provide: OtpService, useValue: mockOtpService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ───────────────────── register ─────────────────────────────────────
  describe('register', () => {
    const dto = {
      phone_number: '+261340000001',
      password: 'securePass1',
      first_name: 'Tahiry',
      last_name: 'Rakoto',
      user_type: 'patient' as const,
    };

    it('should create a user and trigger OTP generation', async () => {
      mockAuthRepository.findByPhone.mockResolvedValue(null);
      mockAuthRepository.createUser.mockResolvedValue(
        mockUser({ phoneNumber: dto.phone_number }),
      );
      mockOtpService.generate.mockResolvedValue(undefined);

      await service.register(dto);

      expect(mockAuthRepository.findByPhone).toHaveBeenCalledWith(
        dto.phone_number,
      );
      expect(mockAuthRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          phoneNumber: dto.phone_number,
          firstName: dto.first_name,
          lastName: dto.last_name,
          userType: dto.user_type,
        }),
      );
      // Password must be hashed — never stored in plain text
      const createCall = mockAuthRepository.createUser.mock.calls[0][0];
      expect(createCall.passwordHash).not.toBe(dto.password);
      expect(mockOtpService.generate).toHaveBeenCalledWith(dto.phone_number);
    });

    it('should throw ConflictException when phone number is already registered', async () => {
      mockAuthRepository.findByPhone.mockResolvedValue(mockUser());

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(mockAuthRepository.createUser).not.toHaveBeenCalled();
    });
  });

  // ───────────────────── verifyOtp ────────────────────────────────────
  describe('verifyOtp', () => {
    const dto = { phone_number: '+261340000001', code: '123456' };

    it('should return tokens and mark user verified on first OTP verification', async () => {
      const unverifiedUser = mockUser({ isVerified: false });
      mockAuthRepository.findByPhone.mockResolvedValue(unverifiedUser);
      mockOtpService.verify.mockResolvedValue(true);
      mockJwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.verifyOtp(dto);

      expect(result.accessToken).toBe('access-token');
      expect(mockAuthRepository.markVerified).toHaveBeenCalledWith(
        unverifiedUser.id,
      );
      expect(mockAuthRepository.updateLastLogin).toHaveBeenCalledWith(
        unverifiedUser.id,
      );
    });

    it('should skip markVerified when user is already verified', async () => {
      const verifiedUser = mockUser({ isVerified: true });
      mockAuthRepository.findByPhone.mockResolvedValue(verifiedUser);
      mockOtpService.verify.mockResolvedValue(true);
      mockJwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      mockRedis.set.mockResolvedValue('OK');

      await service.verifyOtp(dto);

      expect(mockAuthRepository.markVerified).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for unknown phone number', async () => {
      mockAuthRepository.findByPhone.mockResolvedValue(null);

      await expect(service.verifyOtp(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw UnauthorizedException for invalid OTP', async () => {
      mockAuthRepository.findByPhone.mockResolvedValue(mockUser());
      mockOtpService.verify.mockResolvedValue(false);

      await expect(service.verifyOtp(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ───────────────────── login ────────────────────────────────────────
  describe('login', () => {
    const dto = { phone_number: '+261340000001', password: 'securePass1' };

    it('should return tokens for valid credentials', async () => {
      const hash = await bcrypt.hash(dto.password, 10);
      const user = mockUser({ passwordHash: hash });
      mockAuthRepository.findByPhone.mockResolvedValue(user);
      mockJwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.login(dto);

      expect(result).toEqual(
        expect.objectContaining({ accessToken: 'access-token' }),
      );
      expect(mockAuthRepository.updateLastLogin).toHaveBeenCalledWith(user.id);
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      mockAuthRepository.findByPhone.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when account is not verified', async () => {
      mockAuthRepository.findByPhone.mockResolvedValue(
        mockUser({ isVerified: false }),
      );

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when account is suspended', async () => {
      mockAuthRepository.findByPhone.mockResolvedValue(
        mockUser({ isActive: false }),
      );

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const hash = await bcrypt.hash('differentPassword', 10);
      mockAuthRepository.findByPhone.mockResolvedValue(
        mockUser({ passwordHash: hash }),
      );

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ───────────────────── rotateRefreshToken ───────────────────────────
  describe('rotateRefreshToken', () => {
    it('should issue new tokens when the refresh token is valid', async () => {
      const oldToken = 'old-refresh-token';
      const storedHash = await bcrypt.hash(oldToken, 10);

      mockJwtService.verify.mockReturnValue({
        sub: 'user-uuid-1',
        userType: 'patient',
      });
      mockRedis.get.mockResolvedValue(storedHash);
      mockJwtService.sign
        .mockReturnValueOnce('new-access')
        .mockReturnValueOnce('new-refresh');
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.rotateRefreshToken(oldToken);

      expect(result.accessToken).toBe('new-access');
      expect(result.refreshToken).toBe('new-refresh');
    });

    it('should throw when JWT verification fails', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.rotateRefreshToken('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw when no stored hash exists in Redis', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-uuid-1',
        userType: 'patient',
      });
      mockRedis.get.mockResolvedValue(null);

      await expect(
        service.rotateRefreshToken('orphan-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should delete refresh key and throw on token reuse (hash mismatch)', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-uuid-1',
        userType: 'patient',
      });
      // Stored hash does NOT match the incoming token
      mockRedis.get.mockResolvedValue(await bcrypt.hash('other-token', 10));
      mockRedis.del.mockResolvedValue(1);

      await expect(
        service.rotateRefreshToken('reused-token'),
      ).rejects.toThrow(UnauthorizedException);

      // The entire token family must be invalidated
      expect(mockRedis.del).toHaveBeenCalledWith('refresh:user-uuid-1');
    });
  });

  // ───────────────────── logout ───────────────────────────────────────
  describe('logout', () => {
    it('should delete the refresh token from Redis', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.logout('user-uuid-1');

      expect(mockRedis.del).toHaveBeenCalledWith('refresh:user-uuid-1');
    });
  });

  // ───────────────────── issueTokenPair (via login) ───────────────────
  describe('issueTokenPair (private, tested through login)', () => {
    it('should store bcrypt-hashed refresh token in Redis with 7-day TTL', async () => {
      const hash = await bcrypt.hash('securePass1', 10);
      mockAuthRepository.findByPhone.mockResolvedValue(
        mockUser({ passwordHash: hash }),
      );
      mockJwtService.sign
        .mockReturnValueOnce('access-tok')
        .mockReturnValueOnce('refresh-tok');
      mockRedis.set.mockResolvedValue('OK');

      await service.login({
        phone_number: '+261340000001',
        password: 'securePass1',
      });

      // Redis.set must be called with: key, hash, 'EX', 604800
      expect(mockRedis.set).toHaveBeenCalledWith(
        'refresh:user-uuid-1',
        expect.any(String), // bcrypt hash
        'EX',
        604800,
      );

      // The stored value must be a bcrypt hash, not the raw token
      const storedValue = mockRedis.set.mock.calls[0][1];
      expect(storedValue).not.toBe('refresh-tok');
      expect(storedValue).toMatch(/^\$2[aby]\$/);
    });
  });
});
