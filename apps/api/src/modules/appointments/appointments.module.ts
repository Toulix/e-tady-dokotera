import { Module } from '@nestjs/common';
import { AppointmentsRepository } from './infrastructure/appointments.repository';
import { AppointmentsQueryService } from './application/appointments-query.service';

@Module({
  providers: [AppointmentsRepository, AppointmentsQueryService],
  // Only export the query service — cross-module access goes through
  // the public service interface, not directly to the repository.
  exports: [AppointmentsQueryService],
})
export class AppointmentsModule {}
