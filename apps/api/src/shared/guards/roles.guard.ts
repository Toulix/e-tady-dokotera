import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, UserType } from '../decorators/roles.decorator';
import type { JwtPayload } from '@/modules/auth/application/auth.service';

/**
 * Enforces role-based access control after JWT authentication.
 * Reads the @Roles() metadata set on the handler and compares against
 * the authenticated user's `userType` from the JWT payload.
 *
 * Routes with no @Roles() decorator are open to any authenticated user.
 * Must be used after JwtAuthGuard so `request.user` is already populated.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserType[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles() on the handler or class — any authenticated user is allowed.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user?: JwtPayload }>();

    // Deny if JwtAuthGuard was not applied before this guard — request.user
    // will be undefined, so we fail closed rather than throwing a 500.
    if (!user) {
      return false;
    }

    return requiredRoles.includes(user.userType as UserType);
  }
}
