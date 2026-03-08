export class AppointmentRescheduledEvent {
  constructor(
    public readonly appointmentId: string,
    public readonly doctorId: string,
    public readonly patientId: string,
    public readonly newStartTime: Date,
  ) {}
}
