import { Module } from '@nestjs/common';
import { SchedulingRepository } from './infrastructure/scheduling.repository';
import { SchedulingService } from './application/scheduling.service';
import { SchedulingController } from './api/scheduling.controller';

@Module({
  controllers: [SchedulingController],
  providers: [SchedulingRepository, SchedulingService],
  // Only export the service — cross-module access must go through
  // the public service interface, not directly to the repository.
  exports: [SchedulingService],
})
export class SchedulingModule {}
