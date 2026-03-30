import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { SchedulingService } from '../application/scheduling.service';
import {
  CreateWeeklyTemplateDto,
  UpdateWeeklyTemplateDto,
  CreateScheduleExceptionDto,
  QueryScheduleExceptionsDto,
} from '../application/dto';

/**
 * Doctor-facing schedule management endpoints.
 *
 * All endpoints require authentication + doctor role. A doctor can only
 * manage their own templates and exceptions — ownership is enforced in
 * the service layer to prevent IDOR attacks.
 */
@Controller('scheduling')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('doctor')
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  // ─── Weekly templates ───────────────────────────────────────────────

  @Post('templates')
  async createTemplate(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateWeeklyTemplateDto,
  ) {
    return this.schedulingService.createTemplate(user.sub, dto);
  }

  @Get('templates')
  async getTemplates(@CurrentUser() user: JwtPayload) {
    return this.schedulingService.getTemplates(user.sub);
  }

  @Patch('templates/:id')
  async updateTemplate(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWeeklyTemplateDto,
  ) {
    return this.schedulingService.updateTemplate(user.sub, id, dto);
  }

  @Delete('templates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTemplate(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.schedulingService.deleteTemplate(user.sub, id);
  }

  // ─── Schedule exceptions ────────────────────────────────────────────

  @Post('exceptions')
  async createException(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateScheduleExceptionDto,
  ) {
    return this.schedulingService.createException(user.sub, dto);
  }

  @Get('exceptions')
  async getExceptions(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryScheduleExceptionsDto,
  ) {
    return this.schedulingService.getExceptions(user.sub, query);
  }

  @Delete('exceptions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteException(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.schedulingService.deleteException(user.sub, id);
  }
}
