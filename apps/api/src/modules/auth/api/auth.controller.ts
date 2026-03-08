import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';
import { AuthService, JwtPayload } from '../application/auth.service';
import { RegisterDto } from '../application/dto/register.dto';
import { LoginDto } from '../application/dto/login.dto';
import { VerifyOtpDto } from '../application/dto/verify-otp.dto';
import { JwtAuthGuard } from '@/shared/guards/jwt-auth.guard';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Sets the refresh token as an HttpOnly cookie.
   * In production the cookie name uses the __Host- prefix, which enforces
   * Secure=true, no Domain attribute, and Path=/. SameSite=Strict prevents
   * cross-site leakage. In development the prefix is omitted because
   * browsers ignore __Host- on non-HTTPS origins.
   */
  private setRefreshCookie(response: Response, token: string): void {
    const isProd = this.config.get('NODE_ENV') === 'production';
    const cookieName = isProd ? '__Host-refresh_token' : 'refresh_token';
    response.cookie(cookieName, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    });
  }

  private clearRefreshCookie(response: Response): void {
    const isProd = this.config.get('NODE_ENV') === 'production';
    const cookieName = isProd ? '__Host-refresh_token' : 'refresh_token';
    response.clearCookie(cookieName, { path: '/' });
  }

  /**
   * Reads the refresh token from the cookie, respecting the environment-dependent name.
   */
  private getRefreshTokenFromCookie(request: Request): string {
    const isProd = this.config.get('NODE_ENV') === 'production';
    const cookieName = isProd ? '__Host-refresh_token' : 'refresh_token';
    const token = request.cookies?.[cookieName];
    if (!token) {
      throw new UnauthorizedException('No refresh token');
    }
    return token;
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    await this.authService.register(dto);
    return { message: 'OTP sent' };
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.verifyOtp(dto);
    this.setRefreshCookie(res, refreshToken);
    return { access_token: accessToken };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.login(dto);
    this.setRefreshCookie(res, refreshToken);
    return { access_token: accessToken };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const oldToken = this.getRefreshTokenFromCookie(req);
    const { accessToken, refreshToken } =
      await this.authService.rotateRefreshToken(oldToken);
    this.setRefreshCookie(res, refreshToken);
    return { access_token: accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(user.sub);
    this.clearRefreshCookie(res);
    return { message: 'Logged out' };
  }
}
