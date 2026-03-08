export class SlotLockExpiredEvent {
  constructor(
    public readonly doctorId: string,
    public readonly slotTime: Date,
    public readonly lockToken: string,
  ) {}
}
