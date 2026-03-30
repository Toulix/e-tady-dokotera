import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SchedulingService } from './scheduling.service';
import { SchedulingRepository } from '../infrastructure/scheduling.repository';

// ── Mock repository ─────────────────────────────────────────────────

const mockRepository = {
  createTemplate: jest.fn(),
  findTemplatesByDoctor: jest.fn(),
  findTemplateById: jest.fn(),
  updateTemplate: jest.fn(),
  deleteTemplate: jest.fn(),
  findOverlappingTemplate: jest.fn(),
  createException: jest.fn(),
  findExceptionsByDoctorAndRange: jest.fn(),
  findExceptionById: jest.fn(),
  findExceptionByDoctorAndDate: jest.fn(),
  deleteException: jest.fn(),
};

// ── Test data factories ─────────────────────────────────────────────

function mockTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'template-uuid-1',
    doctorId: 'doctor-uuid-1',
    facilityId: null,
    dayOfWeek: 1,
    startTime: new Date('1970-01-01T08:00:00Z'),
    endTime: new Date('1970-01-01T17:00:00Z'),
    appointmentType: 'in_person',
    slotDurationMinutes: 30,
    bufferMinutes: 0,
    maxBookingsPerSlot: 1,
    isActive: true,
    effectiveFrom: new Date('2026-01-01'),
    effectiveUntil: null,
    ...overrides,
  };
}

function mockException(overrides: Record<string, unknown> = {}) {
  return {
    id: 'exception-uuid-1',
    doctorId: 'doctor-uuid-1',
    exceptionDate: new Date('2026-04-15'),
    exceptionType: 'day_off',
    customStartTime: null,
    customEndTime: null,
    reason: 'National holiday',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('SchedulingService', () => {
  let service: SchedulingService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulingService,
        { provide: SchedulingRepository, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<SchedulingService>(SchedulingService);
  });

  // ───────────────────── createTemplate ──────────────────────────────

  describe('createTemplate', () => {
    it('should create a template with valid data', async () => {
      const template = mockTemplate();
      mockRepository.findOverlappingTemplate.mockResolvedValue(null);
      mockRepository.createTemplate.mockResolvedValue(template);

      const result = await service.createTemplate('doctor-uuid-1', {
        day_of_week: 1,
        start_time: '08:00',
        end_time: '17:00',
        appointment_type: 'in_person',
        effective_from: '2026-01-01',
      });

      expect(result).toEqual(template);
      expect(mockRepository.createTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          doctorId: 'doctor-uuid-1',
          dayOfWeek: 1,
          slotDurationMinutes: 30, // default
          bufferMinutes: 0, // default
          maxBookingsPerSlot: 1, // default
        }),
      );
    });

    it('should reject when start_time > end_time', async () => {
      await expect(
        service.createTemplate('doctor-uuid-1', {
          day_of_week: 1,
          start_time: '17:00',
          end_time: '08:00',
          appointment_type: 'in_person',
          effective_from: '2026-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when start_time equals end_time', async () => {
      await expect(
        service.createTemplate('doctor-uuid-1', {
          day_of_week: 1,
          start_time: '12:00',
          end_time: '12:00',
          appointment_type: 'in_person',
          effective_from: '2026-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when an overlapping template exists', async () => {
      mockRepository.findOverlappingTemplate.mockResolvedValue(mockTemplate());

      await expect(
        service.createTemplate('doctor-uuid-1', {
          day_of_week: 1,
          start_time: '09:00',
          end_time: '12:00',
          appointment_type: 'in_person',
          effective_from: '2026-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when effective_from > effective_until', async () => {
      await expect(
        service.createTemplate('doctor-uuid-1', {
          day_of_week: 1,
          start_time: '08:00',
          end_time: '17:00',
          appointment_type: 'in_person',
          effective_from: '2026-12-01',
          effective_until: '2026-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when effective_from equals effective_until', async () => {
      await expect(
        service.createTemplate('doctor-uuid-1', {
          day_of_week: 1,
          start_time: '08:00',
          end_time: '17:00',
          appointment_type: 'in_person',
          effective_from: '2026-06-01',
          effective_until: '2026-06-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should pass effective dates to findOverlappingTemplate', async () => {
      mockRepository.findOverlappingTemplate.mockResolvedValue(null);
      mockRepository.createTemplate.mockResolvedValue(mockTemplate());

      await service.createTemplate('doctor-uuid-1', {
        day_of_week: 1,
        start_time: '08:00',
        end_time: '17:00',
        appointment_type: 'in_person',
        effective_from: '2026-01-01',
        effective_until: '2026-06-30',
      });

      expect(mockRepository.findOverlappingTemplate).toHaveBeenCalledWith(
        'doctor-uuid-1',
        1,
        expect.any(Date),
        expect.any(Date),
        null, // facilityId
        new Date('2026-01-01'), // effectiveFrom
        new Date('2026-06-30'), // effectiveUntil
      );
    });

    it('should apply custom slot_duration_minutes when provided', async () => {
      mockRepository.findOverlappingTemplate.mockResolvedValue(null);
      mockRepository.createTemplate.mockResolvedValue(
        mockTemplate({ slotDurationMinutes: 60 }),
      );

      await service.createTemplate('doctor-uuid-1', {
        day_of_week: 2,
        start_time: '08:00',
        end_time: '12:00',
        appointment_type: 'video',
        slot_duration_minutes: 60,
        effective_from: '2026-01-01',
      });

      expect(mockRepository.createTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ slotDurationMinutes: 60 }),
      );
    });
  });

  // ───────────────────── getTemplates ────────────────────────────────

  describe('getTemplates', () => {
    it('should return all templates for the doctor', async () => {
      const templates = [mockTemplate(), mockTemplate({ id: 'template-uuid-2' })];
      mockRepository.findTemplatesByDoctor.mockResolvedValue(templates);

      const result = await service.getTemplates('doctor-uuid-1');

      expect(result).toEqual(templates);
      expect(mockRepository.findTemplatesByDoctor).toHaveBeenCalledWith('doctor-uuid-1');
    });
  });

  // ───────────────────── updateTemplate ──────────────────────────────

  describe('updateTemplate', () => {
    it('should update a template owned by the doctor', async () => {
      const template = mockTemplate();
      const updated = mockTemplate({ slotDurationMinutes: 45 });
      mockRepository.findTemplateById.mockResolvedValue(template);
      mockRepository.updateTemplate.mockResolvedValue(updated);

      const result = await service.updateTemplate(
        'doctor-uuid-1',
        'template-uuid-1',
        { slot_duration_minutes: 45 },
      );

      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException when template does not exist', async () => {
      mockRepository.findTemplateById.mockResolvedValue(null);

      await expect(
        service.updateTemplate('doctor-uuid-1', 'nonexistent', {
          slot_duration_minutes: 45,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for IDOR attempt', async () => {
      mockRepository.findTemplateById.mockResolvedValue(
        mockTemplate({ doctorId: 'other-doctor-uuid' }),
      );

      await expect(
        service.updateTemplate('doctor-uuid-1', 'template-uuid-1', {
          slot_duration_minutes: 45,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject when updated times result in start > end', async () => {
      mockRepository.findTemplateById.mockResolvedValue(mockTemplate());

      await expect(
        service.updateTemplate('doctor-uuid-1', 'template-uuid-1', {
          start_time: '18:00', // after existing end_time of 17:00
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when updated times result in start === end', async () => {
      mockRepository.findTemplateById.mockResolvedValue(mockTemplate());

      // Existing end_time is 17:00, updating start_time to match it
      await expect(
        service.updateTemplate('doctor-uuid-1', 'template-uuid-1', {
          start_time: '17:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject overlap when changing time range', async () => {
      // Template exists and is owned by the doctor
      mockRepository.findTemplateById.mockResolvedValue(mockTemplate());
      // Another template already occupies the new time range
      mockRepository.findOverlappingTemplate.mockResolvedValue(
        mockTemplate({ id: 'other-template-uuid' }),
      );

      await expect(
        service.updateTemplate('doctor-uuid-1', 'template-uuid-1', {
          start_time: '09:00',
          end_time: '12:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject overlap when changing day_of_week', async () => {
      mockRepository.findTemplateById.mockResolvedValue(mockTemplate());
      mockRepository.findOverlappingTemplate.mockResolvedValue(
        mockTemplate({ id: 'other-template-uuid', dayOfWeek: 3 }),
      );

      await expect(
        service.updateTemplate('doctor-uuid-1', 'template-uuid-1', {
          day_of_week: 3,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject overlap when reactivating an inactive template', async () => {
      // The template being updated is currently inactive
      mockRepository.findTemplateById.mockResolvedValue(
        mockTemplate({ isActive: false }),
      );
      // Another active template occupies the same slot
      mockRepository.findOverlappingTemplate.mockResolvedValue(
        mockTemplate({ id: 'other-template-uuid' }),
      );

      await expect(
        service.updateTemplate('doctor-uuid-1', 'template-uuid-1', {
          is_active: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should exclude the current template from overlap check', async () => {
      mockRepository.findTemplateById.mockResolvedValue(mockTemplate());
      mockRepository.findOverlappingTemplate.mockResolvedValue(null);
      mockRepository.updateTemplate.mockResolvedValue(
        mockTemplate({ startTime: new Date('1970-01-01T09:00:00Z') }),
      );

      await service.updateTemplate('doctor-uuid-1', 'template-uuid-1', {
        start_time: '09:00',
      });

      // The last argument to findOverlappingTemplate should be the templateId
      // to exclude the template being updated from the overlap search
      expect(mockRepository.findOverlappingTemplate).toHaveBeenCalledWith(
        'doctor-uuid-1',
        1, // existing dayOfWeek
        expect.any(Date),
        expect.any(Date),
        null, // facilityId
        expect.any(Date), // effectiveFrom
        null, // effectiveUntil
        'template-uuid-1', // excludeId — the template being updated
      );
    });

    it('should reject when effective_from > effective_until on update', async () => {
      mockRepository.findTemplateById.mockResolvedValue(mockTemplate());

      await expect(
        service.updateTemplate('doctor-uuid-1', 'template-uuid-1', {
          effective_from: '2026-12-01',
          effective_until: '2026-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should trigger overlap check when effective dates change', async () => {
      mockRepository.findTemplateById.mockResolvedValue(mockTemplate());
      mockRepository.findOverlappingTemplate.mockResolvedValue(null);
      mockRepository.updateTemplate.mockResolvedValue(
        mockTemplate({ effectiveFrom: new Date('2026-03-01') }),
      );

      await service.updateTemplate('doctor-uuid-1', 'template-uuid-1', {
        effective_from: '2026-03-01',
      });

      // Verify the updated effectiveFrom is actually forwarded — not just
      // that the function was called. A regression passing stale dates
      // would still green with a bare toHaveBeenCalled().
      expect(mockRepository.findOverlappingTemplate).toHaveBeenCalledWith(
        'doctor-uuid-1',
        1,                                    // existing dayOfWeek
        new Date('1970-01-01T08:00:00Z'),     // existing startTime
        new Date('1970-01-01T17:00:00Z'),     // existing endTime
        null,                                 // facilityId
        new Date('2026-03-01'),               // updated effectiveFrom
        null,                                 // effectiveUntil (unchanged)
        'template-uuid-1',                    // excludeId
      );
    });

    it('should skip overlap check when only non-time/day fields change', async () => {
      mockRepository.findTemplateById.mockResolvedValue(mockTemplate());
      mockRepository.updateTemplate.mockResolvedValue(
        mockTemplate({ slotDurationMinutes: 60 }),
      );

      await service.updateTemplate('doctor-uuid-1', 'template-uuid-1', {
        slot_duration_minutes: 60,
      });

      // No overlap check needed since day/time/active didn't change
      expect(mockRepository.findOverlappingTemplate).not.toHaveBeenCalled();
    });
  });

  // ───────────────────── deleteTemplate ──────────────────────────────

  describe('deleteTemplate', () => {
    it('should delete a template owned by the doctor', async () => {
      mockRepository.findTemplateById.mockResolvedValue(mockTemplate());
      mockRepository.deleteTemplate.mockResolvedValue(undefined);

      await expect(
        service.deleteTemplate('doctor-uuid-1', 'template-uuid-1'),
      ).resolves.toBeUndefined();
    });

    it('should throw NotFoundException when template does not exist', async () => {
      mockRepository.findTemplateById.mockResolvedValue(null);

      await expect(
        service.deleteTemplate('doctor-uuid-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for IDOR attempt on delete', async () => {
      mockRepository.findTemplateById.mockResolvedValue(
        mockTemplate({ doctorId: 'other-doctor-uuid' }),
      );

      await expect(
        service.deleteTemplate('doctor-uuid-1', 'template-uuid-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ───────────────────── createException ─────────────────────────────

  describe('createException', () => {
    it('should create a day_off exception', async () => {
      const exception = mockException();
      mockRepository.findExceptionByDoctorAndDate.mockResolvedValue(null);
      mockRepository.createException.mockResolvedValue(exception);

      const result = await service.createException('doctor-uuid-1', {
        exception_date: '2026-04-15',
        exception_type: 'day_off',
        reason: 'National holiday',
      });

      expect(result).toEqual(exception);
    });

    it('should reject custom_hours when both custom times are missing', async () => {
      await expect(
        service.createException('doctor-uuid-1', {
          exception_date: '2026-04-15',
          exception_type: 'custom_hours',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject custom_hours when only custom_start_time is provided', async () => {
      await expect(
        service.createException('doctor-uuid-1', {
          exception_date: '2026-04-15',
          exception_type: 'custom_hours',
          custom_start_time: '09:00',
          // missing custom_end_time
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject custom_hours when only custom_end_time is provided', async () => {
      await expect(
        service.createException('doctor-uuid-1', {
          exception_date: '2026-04-15',
          exception_type: 'custom_hours',
          // missing custom_start_time
          custom_end_time: '12:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject custom_hours when start > end', async () => {
      await expect(
        service.createException('doctor-uuid-1', {
          exception_date: '2026-04-15',
          exception_type: 'custom_hours',
          custom_start_time: '17:00',
          custom_end_time: '08:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject custom_hours when start equals end', async () => {
      await expect(
        service.createException('doctor-uuid-1', {
          exception_date: '2026-04-15',
          exception_type: 'custom_hours',
          custom_start_time: '10:00',
          custom_end_time: '10:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create an emergency_only exception without custom times', async () => {
      const exception = mockException({ exceptionType: 'emergency_only' });
      mockRepository.findExceptionByDoctorAndDate.mockResolvedValue(null);
      mockRepository.createException.mockResolvedValue(exception);

      const result = await service.createException('doctor-uuid-1', {
        exception_date: '2026-04-15',
        exception_type: 'emergency_only',
        reason: 'Reduced staff',
      });

      expect(result).toEqual(exception);
    });

    it('should reject duplicate exception on the same date with ConflictException', async () => {
      mockRepository.findExceptionByDoctorAndDate.mockResolvedValue(
        mockException(),
      );

      // ConflictException (409), not BadRequestException (400) — the input is valid,
      // it just conflicts with an existing resource on the same date.
      await expect(
        service.createException('doctor-uuid-1', {
          exception_date: '2026-04-15',
          exception_type: 'day_off',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ───────────────────── getExceptions ───────────────────────────────

  describe('getExceptions', () => {
    it('should return exceptions within the specified range', async () => {
      const exceptions = [mockException()];
      mockRepository.findExceptionsByDoctorAndRange.mockResolvedValue(exceptions);

      const result = await service.getExceptions('doctor-uuid-1', {
        from: '2026-04-01',
        to: '2026-04-30',
      });

      expect(result).toEqual(exceptions);
      // Verify the correct Date objects reach the repository — a bug that
      // silently swapped from/to would not be caught by the state assertion alone.
      expect(mockRepository.findExceptionsByDoctorAndRange).toHaveBeenCalledWith(
        'doctor-uuid-1',
        new Date('2026-04-01'),
        new Date('2026-04-30'),
      );
    });

    it('should use default 90-day range when no dates provided', async () => {
      mockRepository.findExceptionsByDoctorAndRange.mockResolvedValue([]);

      const beforeCall = Date.now();
      await service.getExceptions('doctor-uuid-1', {});
      const afterCall = Date.now();

      expect(
        mockRepository.findExceptionsByDoctorAndRange,
      ).toHaveBeenCalledWith(
        'doctor-uuid-1',
        expect.any(Date),
        expect.any(Date),
      );

      // Verify the 90-day window is actually 90 days, not some other value.
      // Without this, a regression changing 90 → 9 would still pass.
      const [, from, to] =
        mockRepository.findExceptionsByDoctorAndRange.mock.calls[0];
      const fromMs = from.getTime();
      const toMs = to.getTime();

      // "from" should be approximately now (within the test execution window)
      expect(fromMs).toBeGreaterThanOrEqual(beforeCall);
      expect(fromMs).toBeLessThanOrEqual(afterCall);

      // "to" should be ~90 days after "from"
      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
      const diffMs = toMs - fromMs;
      expect(diffMs).toBeGreaterThanOrEqual(ninetyDaysMs - 1000);
      expect(diffMs).toBeLessThanOrEqual(ninetyDaysMs + 1000);
    });

    it('should reject when from > to', async () => {
      await expect(
        service.getExceptions('doctor-uuid-1', {
          from: '2026-05-01',
          to: '2026-04-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ───────────────────── deleteException ─────────────────────────────

  describe('deleteException', () => {
    it('should delete an exception owned by the doctor', async () => {
      mockRepository.findExceptionById.mockResolvedValue(mockException());
      mockRepository.deleteException.mockResolvedValue(undefined);

      await expect(
        service.deleteException('doctor-uuid-1', 'exception-uuid-1'),
      ).resolves.toBeUndefined();
    });

    it('should throw ForbiddenException for IDOR attempt on exception delete', async () => {
      mockRepository.findExceptionById.mockResolvedValue(
        mockException({ doctorId: 'other-doctor-uuid' }),
      );

      await expect(
        service.deleteException('doctor-uuid-1', 'exception-uuid-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when exception does not exist', async () => {
      mockRepository.findExceptionById.mockResolvedValue(null);

      await expect(
        service.deleteException('doctor-uuid-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
