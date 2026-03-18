import { SetMetadata } from '@nestjs/common';
import { UserType } from '@/generated/prisma/enums';

export { UserType };

export const ROLES_KEY = 'roles';

/**
 * Restricts an endpoint to one or more user types.
 * Must be combined with @UseGuards(JwtAuthGuard, RolesGuard).
 *
 * @example
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('doctor')
 * @Get('schedule')
 */
export const Roles = (...roles: UserType[]) => SetMetadata(ROLES_KEY, roles);
