import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SchedulingController } from './scheduling.controller';
import { SchedulingService } from '../application/scheduling.service';
import type { JwtPayload } from '@/modules/auth/application/auth.service';

// ── Mock service ────────────────────────────────────────────────────

const mockService = {
  createTemplate: jest.fn(),
  getTemplates: jest.fn(),
  updateTemplate: jest.fn(),
  deleteTemplate: jest.fn(),
  createException: jest.fn(),
  getExceptions: jest.fn(),
  deleteException: jest.fn(),
};

const doctorUser: JwtPayload = { sub: 'doctor-uuid-1', userType: 'doctor' };

describe('SchedulingController', () => {
  let controller: SchedulingController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SchedulingController],
      providers: [
        { provide: SchedulingService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<SchedulingController>(SchedulingController);
  });

  // ───────────────────── Templates ───────────────────────────────────

  describe('createTemplate', () => {
    it('should pass doctorId from JWT and DTO to service', async () => {
      const dto = {
        day_of_week: 1,
        start_time: '08:00',
        end_time: '17:00',
        appointment_type: 'in_person' as const,
        effective_from: '2026-01-01',
      };
      const expected = { id: 'template-uuid-1', ...dto };
      mockService.createTemplate.mockResolvedValue(expected);

      const result = await controller.createTemplate(doctorUser, dto);

      expect(result).toEqual(expected);
      expect(mockService.createTemplate).toHaveBeenCalledWith(
        'doctor-uuid-1',
        dto,
      );
    });
  });

  describe('getTemplates', () => {
    it('should return templates for the authenticated doctor', async () => {
      const templates = [{ id: 'template-uuid-1' }];
      mockService.getTemplates.mockResolvedValue(templates);

      const result = await controller.getTemplates(doctorUser);

      expect(result).toEqual(templates);
      expect(mockService.getTemplates).toHaveBeenCalledWith('doctor-uuid-1');
    });
  });

  describe('updateTemplate', () => {
    it('should pass doctorId, templateId, and DTO to service', async () => {
      const dto = { slot_duration_minutes: 45 };
      const updated = { id: 'template-uuid-1', slotDurationMinutes: 45 };
      mockService.updateTemplate.mockResolvedValue(updated);

      const result = await controller.updateTemplate(
        doctorUser,
        'template-uuid-1',
        dto,
      );

      expect(result).toEqual(updated);
      expect(mockService.updateTemplate).toHaveBeenCalledWith(
        'doctor-uuid-1',
        'template-uuid-1',
        dto,
      );
    });
  });

  describe('deleteTemplate', () => {
    it('should call service.deleteTemplate with correct args', async () => {
      mockService.deleteTemplate.mockResolvedValue(undefined);

      await controller.deleteTemplate(doctorUser, 'template-uuid-1');

      expect(mockService.deleteTemplate).toHaveBeenCalledWith(
        'doctor-uuid-1',
        'template-uuid-1',
      );
    });

    it('should return undefined for 204 No Content', async () => {
      // The controller uses @HttpCode(204), so the method must return void.
      // If someone accidentally adds "return this.schedulingService.deleteTemplate(...)",
      // NestJS would include the service result in the response body.
      mockService.deleteTemplate.mockResolvedValue(undefined);

      const result = await controller.deleteTemplate(
        doctorUser,
        'template-uuid-1',
      );

      expect(result).toBeUndefined();
    });
  });

  // ───────────────────── Exceptions ──────────────────────────────────

  describe('createException', () => {
    it('should pass doctorId from JWT and DTO to service', async () => {
      const dto = {
        exception_date: '2026-04-15',
        exception_type: 'day_off' as const,
        reason: 'Holiday',
      };
      const expected = { id: 'exception-uuid-1', ...dto };
      mockService.createException.mockResolvedValue(expected);

      const result = await controller.createException(doctorUser, dto);

      expect(result).toEqual(expected);
      expect(mockService.createException).toHaveBeenCalledWith(
        'doctor-uuid-1',
        dto,
      );
    });
  });

  describe('getExceptions', () => {
    it('should pass doctorId and query params to service', async () => {
      const query = { from: '2026-04-01', to: '2026-04-30' };
      const exceptions = [{ id: 'exception-uuid-1' }];
      mockService.getExceptions.mockResolvedValue(exceptions);

      const result = await controller.getExceptions(doctorUser, query);

      expect(result).toEqual(exceptions);
      expect(mockService.getExceptions).toHaveBeenCalledWith(
        'doctor-uuid-1',
        query,
      );
    });
  });

  describe('deleteException', () => {
    it('should call service.deleteException with correct args', async () => {
      mockService.deleteException.mockResolvedValue(undefined);

      await controller.deleteException(doctorUser, 'exception-uuid-1');

      expect(mockService.deleteException).toHaveBeenCalledWith(
        'doctor-uuid-1',
        'exception-uuid-1',
      );
    });

    it('should return undefined for 204 No Content', async () => {
      mockService.deleteException.mockResolvedValue(undefined);

      const result = await controller.deleteException(
        doctorUser,
        'exception-uuid-1',
      );

      expect(result).toBeUndefined();
    });
  });

  // ───────────────────── Exception propagation ────────────────────────
  // The controller is a thin passthrough, but these tests ensure
  // that service exceptions bubble up to the NestJS exception filter
  // without being accidentally caught or swallowed.

  describe('exception propagation', () => {
    it('should propagate NotFoundException from service', async () => {
      mockService.updateTemplate.mockRejectedValue(
        new NotFoundException('Schedule template not found'),
      );

      await expect(
        controller.updateTemplate(doctorUser, 'nonexistent', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate ForbiddenException from service', async () => {
      mockService.deleteTemplate.mockRejectedValue(
        new ForbiddenException('You can only manage your own schedule templates'),
      );

      await expect(
        controller.deleteTemplate(doctorUser, 'other-doctor-template'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should propagate BadRequestException from service', async () => {
      mockService.createTemplate.mockRejectedValue(
        new BadRequestException('start_time must be before end_time'),
      );

      await expect(
        controller.createTemplate(doctorUser, {
          day_of_week: 1,
          start_time: '17:00',
          end_time: '08:00',
          appointment_type: 'in_person' as const,
          effective_from: '2026-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate NotFoundException from deleteException', async () => {
      mockService.deleteException.mockRejectedValue(
        new NotFoundException('Schedule exception not found'),
      );

      await expect(
        controller.deleteException(doctorUser, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate BadRequestException from createException', async () => {
      mockService.createException.mockRejectedValue(
        new BadRequestException(
          'custom_start_time and custom_end_time are required',
        ),
      );

      await expect(
        controller.createException(doctorUser, {
          exception_date: '2026-04-15',
          exception_type: 'custom_hours' as const,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate BadRequestException from getExceptions', async () => {
      mockService.getExceptions.mockRejectedValue(
        new BadRequestException('"from" date must be before "to" date'),
      );

      await expect(
        controller.getExceptions(doctorUser, {
          from: '2026-05-01',
          to: '2026-04-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
