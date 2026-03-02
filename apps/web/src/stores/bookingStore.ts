import { create } from 'zustand';

interface BookingState {
  selectedDoctorId: string | null;
  selectedSlot: string | null;
  lockToken: string | null;
  setDoctor: (doctorId: string) => void;
  setSlot: (slot: string, lockToken: string) => void;
  clearBooking: () => void;
}

export const useBookingStore = create<BookingState>((set) => ({
  selectedDoctorId: null,
  selectedSlot: null,
  lockToken: null,
  setDoctor: (doctorId) => set({ selectedDoctorId: doctorId }),
  setSlot: (slot, lockToken) => set({ selectedSlot: slot, lockToken }),
  clearBooking: () =>
    set({ selectedDoctorId: null, selectedSlot: null, lockToken: null }),
}));
