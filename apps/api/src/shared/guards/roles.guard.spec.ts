import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

// ── ExecutionContext factory ───────────────────────────────────────────────
// Builds a minimal mock context. `userType` populates `request.user` the way
// JwtStrategy.validate() does after a successful JWT verification.
function makeContext(userType: string | null, handler = jest.fn(), klass = class {}): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => klass,
    switchToHttp: () => ({
      getRequest: () => ({
        user: userType !== null ? { sub: 'uuid-1', userType, iat: 1000 } : undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}

// ── Reflector factory ─────────────────────────────────────────────────────
// Returns a mock Reflector whose getAllAndOverride returns `roles`.
// Pass `undefined` to simulate a route with no @Roles() decorator.
function makeReflector(roles: string[] | undefined): Reflector {
  return {
    getAllAndOverride: jest.fn().mockReturnValue(roles),
  } as unknown as Reflector;
}

describe('RolesGuard', () => {
  // ── no @Roles() decorator ────────────────────────────────────────────────
  describe('when no @Roles() decorator is present', () => {
    it('allows any authenticated user through', () => {
      const guard = new RolesGuard(makeReflector(undefined));

      expect(guard.canActivate(makeContext('patient'))).toBe(true);
      expect(guard.canActivate(makeContext('doctor'))).toBe(true);
      expect(guard.canActivate(makeContext('admin'))).toBe(true);
    });

    it('allows through even when the roles array is empty', () => {
      const guard = new RolesGuard(makeReflector([]));

      expect(guard.canActivate(makeContext('patient'))).toBe(true);
    });
  });

  // ── single-role restriction ──────────────────────────────────────────────
  describe('when @Roles("doctor") is set', () => {
    let guard: RolesGuard;

    beforeEach(() => {
      guard = new RolesGuard(makeReflector(['doctor']));
    });

    it('grants access to a doctor', () => {
      expect(guard.canActivate(makeContext('doctor'))).toBe(true);
    });

    it('denies access to a patient', () => {
      expect(guard.canActivate(makeContext('patient'))).toBe(false);
    });

    it('denies access to an admin', () => {
      expect(guard.canActivate(makeContext('admin'))).toBe(false);
    });
  });

  // ── multi-role restriction ───────────────────────────────────────────────
  describe('when @Roles("doctor", "admin") is set', () => {
    let guard: RolesGuard;

    beforeEach(() => {
      guard = new RolesGuard(makeReflector(['doctor', 'admin']));
    });

    it('grants access to a doctor', () => {
      expect(guard.canActivate(makeContext('doctor'))).toBe(true);
    });

    it('grants access to an admin', () => {
      expect(guard.canActivate(makeContext('admin'))).toBe(true);
    });

    it('denies access to a patient', () => {
      expect(guard.canActivate(makeContext('patient'))).toBe(false);
    });
  });

  // ── admin-only restriction ───────────────────────────────────────────────
  describe('when @Roles("admin") is set', () => {
    let guard: RolesGuard;

    beforeEach(() => {
      guard = new RolesGuard(makeReflector(['admin']));
    });

    it('grants access to an admin', () => {
      expect(guard.canActivate(makeContext('admin'))).toBe(true);
    });

    it('denies access to a doctor', () => {
      expect(guard.canActivate(makeContext('doctor'))).toBe(false);
    });

    it('denies access to a patient', () => {
      expect(guard.canActivate(makeContext('patient'))).toBe(false);
    });
  });

  // ── Reflector metadata lookup ────────────────────────────────────────────
  describe('Reflector usage', () => {
    it('calls getAllAndOverride with the correct key and both handler and class targets', () => {
      const reflector = makeReflector(['patient']);
      const guard = new RolesGuard(reflector);
      const handler = jest.fn();
      const klass = class MyController {};
      const ctx = makeContext('patient', handler, klass);

      guard.canActivate(ctx);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
        handler,
        klass,
      ]);
    });
  });

  // ── missing request.user (guard used without JwtAuthGuard) ──────────────
  describe('when request.user is missing', () => {
    it('denies access instead of throwing', () => {
      const guard = new RolesGuard(makeReflector(['doctor']));
      expect(guard.canActivate(makeContext(null))).toBe(false);
    });
  });

  // ── unknown / future user types ──────────────────────────────────────────
  describe('robustness against unknown user types', () => {
    it('denies access when JWT carries an unrecognised user type', () => {
      // Guards against a token with a spoofed or future role value.
      const guard = new RolesGuard(makeReflector(['doctor']));
      expect(guard.canActivate(makeContext('superuser'))).toBe(false);
    });
  });
});
