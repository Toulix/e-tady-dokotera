import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DoctorProfile } from './types';
import { useBookingStore } from '../../stores/bookingStore';

interface BookingCardProps {
  doctor: DoctorProfile;
}

/** French day abbreviations for the weekly calendar strip. */
const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'] as const;

/** Full French day names for the slot section header. */
const FULL_DAY_NAMES = [
  'Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi',
] as const;

/** French month names for the header. */
const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
] as const;

/**
 * Returns the Monday of the week that contains `date`.
 * ISO weeks start on Monday — this aligns with Malagasy work-week conventions.
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Sunday (0) → go back 6 days; otherwise go back (day - 1) days
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Build an array of 7 consecutive days starting from `weekStart`. */
function buildWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/**
 * Placeholder time slots for the selected day.
 *
 * The scheduling API doesn't exist yet (roadmap Step 16). Once it's live,
 * replace this with a fetch to GET /scheduling/doctors/:id/slots?date=YYYY-MM-DD.
 * Each slot should include { time: string, available: boolean }.
 */
const PLACEHOLDER_SLOTS: { time: string; available: boolean }[] = [
  { time: '08:30', available: true },
  { time: '09:15', available: false },
  { time: '10:00', available: true },
  { time: '10:45', available: true },
  { time: '11:30', available: false },
  { time: '14:00', available: true },
  { time: '14:45', available: true },
  { time: '15:30', available: false },
  { time: '16:15', available: true },
];

/**
 * Sticky booking sidebar — weekly calendar strip + time slot grid + CTA buttons.
 *
 * Matches the Stitch "Réserver" card design:
 * - Horizontal week strip with chevron navigation (Mon→Sun)
 * - Selected day highlighted in primary blue
 * - Available slots as outlined buttons, booked slots as disabled/strikethrough
 * - "Prendre RDV" primary CTA + "Envoyer un message" secondary CTA
 */
export default function BookingCard({ doctor }: BookingCardProps) {
  const navigate = useNavigate();
  const { setDoctor } = useBookingStore();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const weekDays = useMemo(() => buildWeekDays(weekStart), [weekStart]);

  // The month label shown in the header — uses the month of the first day of the visible week
  const monthLabel = `${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getFullYear()}`;

  function goToPreviousWeek() {
    const prev = new Date(weekStart);
    prev.setDate(prev.getDate() - 7);
    // Don't allow navigating to weeks entirely in the past
    const prevWeekEnd = new Date(prev);
    prevWeekEnd.setDate(prevWeekEnd.getDate() + 6);
    if (prevWeekEnd >= today) {
      setWeekStart(prev);
    }
  }

  function goToNextWeek() {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    setWeekStart(next);
  }

  function handleDayClick(day: Date) {
    // Don't allow selecting past dates or Sundays
    if (day < today) return;
    setSelectedDate(day);
    setSelectedSlot(null);
  }

  function handleBooking() {
    setDoctor(doctor.id);

    // Persist the user's date/slot selection as URL params so the booking
    // page can pre-fill them. Without this, the local state (selectedDate,
    // selectedSlot) would be lost on navigation.
    const dateStr = selectedDate.toISOString().split('T')[0];
    const params = new URLSearchParams({ date: dateStr });
    if (selectedSlot) params.set('slot', selectedSlot);
    navigate(`/booking/${doctor.id}?${params.toString()}`);
  }

  /** Format selected date for the slot header: "Lundi 18" */
  const selectedDayLabel = `${FULL_DAY_NAMES[selectedDate.getDay()]} ${selectedDate.getDate()}`;

  const isSunday = selectedDate.getDay() === 0;

  return (
    <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/15">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-headline text-xl font-bold">Réserver</h3>
        <span className="px-3 py-1 bg-primary-container text-on-primary-container rounded-full text-xs font-bold uppercase tracking-widest">
          Disponible
        </span>
      </div>

      {/* Weekly calendar strip */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="font-bold text-sm">{monthLabel}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={goToPreviousWeek}
              className="p-1 hover:bg-surface-container rounded-full transition-colors"
              aria-label="Semaine précédente"
            >
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
            <button
              type="button"
              onClick={goToNextWeek}
              className="p-1 hover:bg-surface-container rounded-full transition-colors"
              aria-label="Semaine suivante"
            >
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const isSelected = day.toDateString() === selectedDate.toDateString();
            const isPast = day < today;
            const isSun = day.getDay() === 0;
            const isDisabled = isPast || isSun;

            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => handleDayClick(day)}
                disabled={isDisabled}
                className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
                  isSelected
                    ? 'bg-primary text-white'
                    : isDisabled
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:bg-surface-container'
                }`}
              >
                <span
                  className={`text-[10px] uppercase font-bold ${
                    isSelected ? '' : 'text-outline'
                  }`}
                >
                  {DAY_LABELS[day.getDay()]}
                </span>
                <span className="text-sm font-bold">{day.getDate()}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time slots grid */}
      <div className="space-y-4 mb-8">
        <div className="text-sm font-bold text-on-surface-variant flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">schedule</span>
          {isSunday
            ? 'Fermé le dimanche'
            : `Créneaux disponibles (${selectedDayLabel})`}
        </div>

        {!isSunday && (
          <div className="grid grid-cols-3 gap-2">
            {PLACEHOLDER_SLOTS.map((slot) =>
              slot.available ? (
                <button
                  key={slot.time}
                  type="button"
                  onClick={() => setSelectedSlot(slot.time)}
                  className={`py-2.5 text-xs font-bold border-2 rounded-lg transition-all text-center ${
                    selectedSlot === slot.time
                      ? 'bg-primary-container border-primary-container text-on-primary-container'
                      : 'border-primary-container text-primary-container hover:bg-primary-container hover:text-on-primary-container'
                  }`}
                >
                  {slot.time}
                </button>
              ) : (
                <button
                  key={slot.time}
                  type="button"
                  disabled
                  className="py-2.5 text-xs font-medium bg-surface-container text-outline line-through rounded-lg text-center cursor-not-allowed"
                >
                  {slot.time}
                </button>
              ),
            )}
          </div>
        )}
      </div>

      {/* CTA buttons */}
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={handleBooking}
          className="w-full py-4 bg-primary text-on-primary rounded-full font-bold text-lg hover:shadow-xl transition-all"
        >
          Prendre RDV
        </button>
        <button
          type="button"
          disabled
          title="Bientôt disponible"
          className="w-full py-4 bg-secondary-container text-on-secondary-container rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-80 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-sm">mail</span>
          Envoyer un message
        </button>
      </div>

      <p className="text-center text-xs text-on-surface-variant mt-6">
        Confirmation instantanée &bull; Sans frais de service
      </p>
    </div>
  );
}
