import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/shared/guards/jwt-auth.guard';
import { RolesGuard } from '@/shared/guards/roles.guard';
import { Roles } from '@/shared/decorators/roles.decorator';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import type { JwtPayload } from '@/modules/auth/application/auth.service';
import { DoctorsService } from '../application/doctors.service';
import { UpdateDoctorProfileDto, SearchDoctorsQueryDto } from '../application/dto';

@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  /**
   * Public endpoint — search for doctors by name, specialty, location, language, etc.
   *
   * IMPORTANT: This route MUST be declared BEFORE @Get(':id') below.
   * NestJS evaluates routes top-down, and if ':id' came first, a request to
   * /doctors/search would match ':id' with id="search", then ParseUUIDPipe
   * would reject it with a confusing 400 error ("search" is not a valid UUID).
   */
  @Get('search')
  async searchDoctors(@Query() query: SearchDoctorsQueryDto) {
    const result = await this.doctorsService.searchDoctors(query);
    return { success: true, data: result };
  }

  /**
   * Public endpoint — anyone can view a verified doctor's profile.
   * ParseUUIDPipe rejects malformed IDs early (400) instead of letting
   * invalid strings reach Prisma, which would throw an opaque internal error.
   */
  @Get(':id')
  async getProfile(@Param('id', ParseUUIDPipe) id: string) {
    const profile = await this.doctorsService.getPublicProfile(id);
    return { success: true, data: profile };
  }

  /** Doctor updates their own profile. */
  @Patch('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('doctor')
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateDoctorProfileDto,
  ) {
    const profile = await this.doctorsService.updateOwnProfile(user.sub, dto);
    return { success: true, data: profile };
  }

  /** Admin marks a doctor as verified (isProfileLive = true). */
  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async verifyDoctor(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: JwtPayload,
  ) {
    await this.doctorsService.verifyDoctor(id, admin.sub);
    return { success: true, message: 'Doctor verified' };
  }
}
