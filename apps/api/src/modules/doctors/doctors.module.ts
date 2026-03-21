import { Module } from '@nestjs/common';
import { DoctorRepository } from './infrastructure/doctor.repository';
import { DoctorsService } from './application/doctors.service';
import { DoctorsController } from './api/doctors.controller';

@Module({
  controllers: [DoctorsController],
  providers: [DoctorRepository, DoctorsService],
  exports: [DoctorRepository, DoctorsService],
})
export class DoctorsModule {}
