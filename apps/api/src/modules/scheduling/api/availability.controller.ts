import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AvailabilityService } from '../application/availability.service';
import { AvailabilityQueryDto } from '../application/dto';

/**
 * Public availability endpoint for patients browsing doctor schedules.
 *
 * Uses @Controller('doctors') even though it lives in the scheduling module.
 * NestJS allows multiple controllers to share route prefixes across modules.
 * This avoids a circular dependency: the scheduling module imports
 * DoctorsModule (for minAdvanceBookingHours), so DoctorsModule cannot
 * import SchedulingModule back.
 *
 * No auth guards — availability is public information. Patients must be
 * able to view a doctor's free slots before creating an account or logging in.
 */
@Controller('doctors')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  /**
   * Returns available appointment slots for a doctor, grouped by date.
   *
   * GET /api/v1/doctors/:id/availability?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&facility_id=uuid
   *
   * Response shape:
   * {
   *   "2026-04-09": [{ startTime, endTime, appointmentType, isAvailable, isEmergencyOnly, facilityId }],
   *   "2026-04-10": [...]
   * }
   *
   * Dates with zero available slots are omitted from the response.
   */
  @Get(':id/availability')
  async getAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.availabilityService.getAvailability(
      id,
      query.start_date,
      query.end_date,
      query.facility_id,
    );
  }
}
