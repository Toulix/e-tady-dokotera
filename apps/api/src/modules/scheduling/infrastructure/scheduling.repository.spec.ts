import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SchedulingRepository } from './scheduling.repository';
import { PrismaService } from '../../../shared/database/prisma.service';
import { PrismaClientKnownRequestError } from '../../../generated/prisma/internal/prismaNamespace';

// ── Mock Prisma methods ─────────────────────────────────────────────

const mockPrisma = {
  weeklyScheduleTemplate: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  scheduleException: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
  },
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

// ── P2025 error helper ──────────────────────────────────────────────
// Uses the real PrismaClientKnownRequestError class so that the
// instanceof check in the repository's catch block works correctly.

function prismaNotFoundError() {
  return new PrismaClientKnownRequestError('Record not found', {
    code: 'P2025',
    clientVersion: '6.0.0',
  });
}

describe('SchedulingRepository', () => {
  let repository: SchedulingRepository;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulingRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repository = module.get<SchedulingRepository>(SchedulingRepository);
  });

  // ───────────────────── Templates ───────────────────────────────────

  describe('createTemplate', () => {
    it('should create a template and return it', async () => {
      const template = mockTemplate();
      mockPrisma.weeklyScheduleTemplate.create.mockResolvedValue(template);

      const result = await repository.createTemplate({
        doctorId: 'doctor-uuid-1',
        dayOfWeek: 1,
        startTime: new Date('1970-01-01T08:00:00Z'),
        endTime: new Date('1970-01-01T17:00:00Z'),
        appointmentType: 'in_person',
        slotDurationMinutes: 30,
        bufferMinutes: 0,
        maxBookingsPerSlot: 1,
        effectiveFrom: new Date('2026-01-01'),
      });

      expect(result).toEqual(template);
      expect(mockPrisma.weeklyScheduleTemplate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          doctorId: 'doctor-uuid-1',
          dayOfWeek: 1,
          startTime: new Date('1970-01-01T08:00:00Z'),
          endTime: new Date('1970-01-01T17:00:00Z'),
          slotDurationMinutes: 30,
        }),
      });
    });
  });

  describe('findTemplatesByDoctor', () => {
    it('should return templates ordered by day then start time', async () => {
      const templates = [mockTemplate(), mockTemplate({ id: 'template-uuid-2', dayOfWeek: 3 })];
      mockPrisma.weeklyScheduleTemplate.findMany.mockResolvedValue(templates);

      const result = await repository.findTemplatesByDoctor('doctor-uuid-1');

      expect(result).toEqual(templates);
      expect(mockPrisma.weeklyScheduleTemplate.findMany).toHaveBeenCalledWith({
        where: { doctorId: 'doctor-uuid-1' },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      });
    });
  });

  describe('findTemplateById', () => {
    it('should return the template when it exists', async () => {
      const template = mockTemplate();
      mockPrisma.weeklyScheduleTemplate.findUnique.mockResolvedValue(template);

      const result = await repository.findTemplateById('template-uuid-1');

      expect(result).toEqual(template);
      expect(mockPrisma.weeklyScheduleTemplate.findUnique).toHaveBeenCalledWith({
        where: { id: 'template-uuid-1' },
      });
    });

    it('should return null when the template does not exist', async () => {
      mockPrisma.weeklyScheduleTemplate.findUnique.mockResolvedValue(null);

      const result = await repository.findTemplateById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateTemplate', () => {
    it('should update and return the template', async () => {
      const updated = mockTemplate({ slotDurationMinutes: 45 });
      mockPrisma.weeklyScheduleTemplate.update.mockResolvedValue(updated);

      const result = await repository.updateTemplate('template-uuid-1', {
        slotDurationMinutes: 45,
      });

      expect(result).toEqual(updated);
      expect(mockPrisma.weeklyScheduleTemplate.update).toHaveBeenCalledWith({
        where: { id: 'template-uuid-1' },
        data: { slotDurationMinutes: 45 },
      });
    });

    it('should convert P2025 to NotFoundException on race condition', async () => {
      // Simulates: ownership check passes, but template is deleted before
      // the update query executes (race condition between two requests).
      mockPrisma.weeklyScheduleTemplate.update.mockRejectedValue(
        prismaNotFoundError(),
      );

      await expect(
        repository.updateTemplate('deleted-uuid', { slotDurationMinutes: 45 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should re-throw non-P2025 errors as-is', async () => {
      const dbError = new Error('Connection refused');
      mockPrisma.weeklyScheduleTemplate.update.mockRejectedValue(dbError);

      await expect(
        repository.updateTemplate('template-uuid-1', { slotDurationMinutes: 45 }),
      ).rejects.toThrow('Connection refused');
    });
  });

  describe('deleteTemplate', () => {
    it('should delete a template by id', async () => {
      mockPrisma.weeklyScheduleTemplate.delete.mockResolvedValue(mockTemplate());

      await expect(
        repository.deleteTemplate('template-uuid-1'),
      ).resolves.toBeUndefined();
    });

    it('should convert P2025 to NotFoundException', async () => {
      mockPrisma.weeklyScheduleTemplate.delete.mockRejectedValue(
        prismaNotFoundError(),
      );

      await expect(
        repository.deleteTemplate('nonexistent-uuid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should re-throw non-P2025 errors as-is', async () => {
      const dbError = new Error('Disk full');
      mockPrisma.weeklyScheduleTemplate.delete.mockRejectedValue(dbError);

      await expect(
        repository.deleteTemplate('template-uuid-1'),
      ).rejects.toThrow('Disk full');
    });
  });

  describe('findOverlappingTemplate', () => {
    it('should find overlapping templates for the same day, facility, and date range', async () => {
      const overlap = mockTemplate();
      mockPrisma.weeklyScheduleTemplate.findFirst.mockResolvedValue(overlap);

      const result = await repository.findOverlappingTemplate(
        'doctor-uuid-1',
        1,
        new Date('1970-01-01T09:00:00Z'),
        new Date('1970-01-01T12:00:00Z'),
        null,
        new Date('2026-01-01'),
        new Date('2026-06-30'),
      );

      expect(result).toEqual(overlap);
      expect(mockPrisma.weeklyScheduleTemplate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            doctorId: 'doctor-uuid-1',
            dayOfWeek: 1,
            isActive: true,
            // Time-overlap predicates: two ranges overlap if each starts
            // before the other ends. Without these, a regression removing
            // the time check would still pass this test.
            startTime: { lt: new Date('1970-01-01T12:00:00Z') },
            endTime: { gt: new Date('1970-01-01T09:00:00Z') },
            // Effective date overlap: existing must start before our end
            effectiveFrom: { lt: new Date('2026-06-30') },
            OR: [
              { effectiveUntil: null },
              { effectiveUntil: { gt: new Date('2026-01-01') } },
            ],
          }),
        }),
      );
    });

    it('should omit effectiveFrom filter when effectiveUntil is null (open-ended)', async () => {
      mockPrisma.weeklyScheduleTemplate.findFirst.mockResolvedValue(null);

      await repository.findOverlappingTemplate(
        'doctor-uuid-1',
        1,
        new Date('1970-01-01T09:00:00Z'),
        new Date('1970-01-01T12:00:00Z'),
        null,
        new Date('2026-01-01'),
        null, // open-ended — no upper bound
      );

      const calledWith =
        mockPrisma.weeklyScheduleTemplate.findFirst.mock.calls[0][0];
      // effectiveFrom filter should be undefined (any start date qualifies)
      expect(calledWith.where.effectiveFrom).toBeUndefined();
    });

    it('should exclude a specific template id when provided', async () => {
      mockPrisma.weeklyScheduleTemplate.findFirst.mockResolvedValue(null);

      await repository.findOverlappingTemplate(
        'doctor-uuid-1',
        1,
        new Date('1970-01-01T09:00:00Z'),
        new Date('1970-01-01T12:00:00Z'),
        null,
        new Date('2026-01-01'),
        null,
        'template-uuid-1',
      );

      expect(mockPrisma.weeklyScheduleTemplate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: 'template-uuid-1' },
          }),
        }),
      );
    });
  });

  // ───────────────────── Exceptions ──────────────────────────────────

  describe('createException', () => {
    it('should create an exception and return it', async () => {
      const exception = mockException();
      mockPrisma.scheduleException.create.mockResolvedValue(exception);

      const result = await repository.createException({
        doctorId: 'doctor-uuid-1',
        exceptionDate: new Date('2026-04-15'),
        exceptionType: 'day_off',
        reason: 'National holiday',
      });

      expect(result).toEqual(exception);
    });
  });

  describe('findExceptionsByDoctorAndRange', () => {
    it('should return exceptions within the date range', async () => {
      const exceptions = [mockException()];
      mockPrisma.scheduleException.findMany.mockResolvedValue(exceptions);

      const result = await repository.findExceptionsByDoctorAndRange(
        'doctor-uuid-1',
        new Date('2026-04-01'),
        new Date('2026-04-30'),
      );

      expect(result).toEqual(exceptions);
      expect(mockPrisma.scheduleException.findMany).toHaveBeenCalledWith({
        where: {
          doctorId: 'doctor-uuid-1',
          exceptionDate: {
            gte: new Date('2026-04-01'),
            lte: new Date('2026-04-30'),
          },
        },
        orderBy: { exceptionDate: 'asc' },
      });
    });
  });

  describe('findExceptionById', () => {
    it('should return the exception when it exists', async () => {
      const exception = mockException();
      mockPrisma.scheduleException.findUnique.mockResolvedValue(exception);

      const result = await repository.findExceptionById('exception-uuid-1');

      expect(result).toEqual(exception);
      expect(mockPrisma.scheduleException.findUnique).toHaveBeenCalledWith({
        where: { id: 'exception-uuid-1' },
      });
    });

    it('should return null when the exception does not exist', async () => {
      mockPrisma.scheduleException.findUnique.mockResolvedValue(null);

      const result = await repository.findExceptionById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findExceptionByDoctorAndDate', () => {
    it('should return null when no exception exists for the date', async () => {
      mockPrisma.scheduleException.findFirst.mockResolvedValue(null);

      const result = await repository.findExceptionByDoctorAndDate(
        'doctor-uuid-1',
        new Date('2026-04-20'),
      );

      expect(result).toBeNull();
    });

    it('should return the exception when one exists for the date', async () => {
      const exception = mockException();
      mockPrisma.scheduleException.findFirst.mockResolvedValue(exception);

      const result = await repository.findExceptionByDoctorAndDate(
        'doctor-uuid-1',
        new Date('2026-04-15'),
      );

      expect(result).toEqual(exception);
      expect(mockPrisma.scheduleException.findFirst).toHaveBeenCalledWith({
        where: {
          doctorId: 'doctor-uuid-1',
          exceptionDate: new Date('2026-04-15'),
        },
      });
    });

    it('should exclude a specific exception id when provided', async () => {
      mockPrisma.scheduleException.findFirst.mockResolvedValue(null);

      await repository.findExceptionByDoctorAndDate(
        'doctor-uuid-1',
        new Date('2026-04-15'),
        'exception-uuid-1',
      );

      expect(mockPrisma.scheduleException.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: 'exception-uuid-1' },
          }),
        }),
      );
    });
  });

  describe('deleteException', () => {
    it('should delete an exception by id', async () => {
      mockPrisma.scheduleException.delete.mockResolvedValue(mockException());

      await expect(
        repository.deleteException('exception-uuid-1'),
      ).resolves.toBeUndefined();
    });

    it('should convert P2025 to NotFoundException', async () => {
      mockPrisma.scheduleException.delete.mockRejectedValue(
        prismaNotFoundError(),
      );

      await expect(
        repository.deleteException('nonexistent-uuid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should re-throw non-P2025 errors as-is', async () => {
      const dbError = new Error('Connection timeout');
      mockPrisma.scheduleException.delete.mockRejectedValue(dbError);

      await expect(
        repository.deleteException('exception-uuid-1'),
      ).rejects.toThrow('Connection timeout');
    });
  });
});
