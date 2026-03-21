import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/shared/guards/jwt-auth.guard';
import { RolesGuard } from '@/shared/guards/roles.guard';
import { Roles } from '@/shared/decorators/roles.decorator';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import type { JwtPayload } from '@/modules/auth/application/auth.service';
import { DoctorsService } from '../application/doctors.service';
import { UpdateDoctorProfileDto } from '../application/dto';

@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  /** Public endpoint — anyone can view a doctor's profile. */
  @Get(':id')
  async getProfile(@Param('id') id: string) {
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
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
  ) {
    await this.doctorsService.verifyDoctor(id, admin.sub);
    return { success: true, message: 'Doctor verified' };
  }
}
