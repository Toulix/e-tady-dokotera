import { Reflector } from '@nestjs/core';
import { Roles, ROLES_KEY, UserType } from './roles.decorator';

// ── Helper ────────────────────────────────────────────────────────────────
// Applies the @Roles() decorator to a fresh method and reads back the
// metadata via NestJS's Reflector, which is the same mechanism RolesGuard
// uses at runtime.
function applyAndRead(...roles: UserType[]): UserType[] | undefined {
  class TestController {
    target() {}
  }

  Roles(...roles)(
    TestController.prototype,
    'target',
    Object.getOwnPropertyDescriptor(TestController.prototype, 'target')!,
  );

  const reflector = new Reflector();
  return reflector.get<UserType[]>(ROLES_KEY, TestController.prototype.target);
}

describe('@Roles() decorator', () => {
  it('stores a single role in metadata', () => {
    expect(applyAndRead('doctor')).toEqual(['doctor']);
  });

  it('stores multiple roles in metadata', () => {
    expect(applyAndRead('doctor', 'admin')).toEqual(['doctor', 'admin']);
  });

  it('stores all valid user types when all are passed', () => {
    expect(applyAndRead('patient', 'doctor', 'admin', 'support')).toEqual([
      'patient',
      'doctor',
      'admin',
      'support',
    ]);
  });

  it('uses the exported ROLES_KEY constant as the metadata key', () => {
    expect(ROLES_KEY).toBe('roles');
  });

  it('returns undefined for a method that has no @Roles() applied', () => {
    class PlainController {
      open() {}
    }
    const reflector = new Reflector();
    const result = reflector.get<UserType[]>(
      ROLES_KEY,
      PlainController.prototype.open,
    );
    expect(result).toBeUndefined();
  });
});
