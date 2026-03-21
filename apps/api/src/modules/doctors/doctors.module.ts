import { Module } from '@nestjs/common';
import { DoctorRepository } from './infrastructure/doctor.repository';
import { DoctorSearchRepository } from './infrastructure/doctor-search.repository';
import { DoctorsService } from './application/doctors.service';
import { DoctorsController } from './api/doctors.controller';

@Module({
  controllers: [DoctorsController],
  providers: [DoctorRepository, DoctorSearchRepository, DoctorsService],
  exports: [DoctorRepository, DoctorSearchRepository, DoctorsService],
})
export class DoctorsModule {}
