export class AppointmentCancelledEvent {
  constructor(
    public readonly appointmentId: string,
    public readonly doctorId: string,
    public readonly patientId: string,
    public readonly cancelledBy: 'patient' | 'doctor' | 'system',
  ) {}
}
