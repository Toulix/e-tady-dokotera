import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts the authenticated user (JWT payload) from the request.
 * Usage: @CurrentUser() user: JwtPayload
 * Requires @UseGuards(JwtAuthGuard) on the route.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    return ctx.switchToHttp().getRequest().user;
  },
);
