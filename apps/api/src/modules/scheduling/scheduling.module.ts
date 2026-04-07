import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module';
import { DoctorsModule } from '../doctors/doctors.module';
import { SchedulingRepository } from './infrastructure/scheduling.repository';
import { SchedulingService } from './application/scheduling.service';
import { AvailabilityService } from './application/availability.service';
import { AvailabilityCacheListener } from './application/availability-cache.listener';
import { SchedulingController } from './api/scheduling.controller';
import { AvailabilityController } from './api/availability.controller';

@Module({
  imports: [
    // AppointmentsModule provides AppointmentsQueryService for fetching
    // existing bookings and slot locks during availability computation.
    AppointmentsModule,
    // DoctorsModule provides DoctorsService for fetching
    // minAdvanceBookingHours from the doctor's profile.
    DoctorsModule,
  ],
  controllers: [SchedulingController, AvailabilityController],
  providers: [
    SchedulingRepository,
    SchedulingService,
    AvailabilityService,
    AvailabilityCacheListener,
  ],
  // Export both services — SchedulingService for existing cross-module
  // consumers, AvailabilityService for potential future consumers
  // (e.g. WebSocket gateway pushing real-time slot updates).
  exports: [SchedulingService, AvailabilityService],
})
export class SchedulingModule {}
