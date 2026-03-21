export class DoctorProfileUpdatedEvent {
  constructor(
    public readonly doctorId: string,
    public readonly updatedFields: string[],
  ) {}
}
