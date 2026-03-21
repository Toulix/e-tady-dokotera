export class DoctorVerifiedEvent {
  constructor(
    public readonly doctorId: string,
    public readonly verifiedByAdminId: string,
  ) {}
}
