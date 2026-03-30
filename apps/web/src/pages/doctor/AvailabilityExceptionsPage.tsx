import { useState, useCallback } from 'react';
import { DayPicker } from 'react-day-picker';
import { fr } from 'react-day-picker/locale';

// ─── Types ──────────────────────────────────────────────────────────────────

type ExceptionType = 'unavailable' | 'custom_hours' | 'emergency_only';

interface AvailabilityException {
  id: string;
  date: Date;
  title: string;
  type: ExceptionType;
  /** Only relevant when type === 'custom_hours' */
  startTime?: string;
  endTime?: string;
}

// ─── Mock Data ──────────────────────────────────────────────────────────────
// Static data to showcase the UI — will be replaced by API calls.

const MOCK_EXCEPTIONS: AvailabilityException[] = [
  {
    id: '1',
    date: new Date(2026, 3, 10),
    title: 'Jour de la Révolution Malgache',
    type: 'unavailable',
  },
  {
    id: '2',
    date: new Date(2026, 3, 18),
    title: 'Symposium Médical',
    type: 'custom_hours',
    startTime: '08:00',
    endTime: '11:30',
  },
  {
    id: '3',
    date: new Date(2026, 4, 1),
    title: 'Fête du Travail',
    type: 'unavailable',
  },
  {
    id: '4',
    date: new Date(2026, 4, 12),
    title: 'Formation Hebdomadaire du Personnel',
    type: 'custom_hours',
    startTime: '13:00',
    endTime: '17:00',
  },
  {
    id: '5',
    date: new Date(2026, 4, 20),
    title: 'Garde urgences CHU',
    type: 'emergency_only',
    startTime: '08:00',
    endTime: '20:00',
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const MONTH_ABBR = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun',
  'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc',
];

function formatDay(date: Date): string {
  return String(date.getDate()).padStart(2, '0');
}

function formatMonthAbbr(date: Date): string {
  return MONTH_ABBR[date.getMonth()];
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ExceptionCard({
  exception,
  onEdit,
  onDelete,
}: {
  exception: AvailabilityException;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const badgeConfig = {
    unavailable: {
      bg: 'bg-error-container/15 text-error',
      badgeBg: 'bg-error-container/20 text-error',
      label: 'Indisponible',
    },
    custom_hours: {
      bg: 'bg-secondary-container/30 text-primary',
      badgeBg: 'bg-secondary-container text-secondary',
      label: 'Horaires personnalisés',
    },
    emergency_only: {
      bg: 'bg-tertiary-container/30 text-tertiary',
      badgeBg: 'bg-tertiary-container text-tertiary',
      label: 'Urgences uniquement',
    },
  }[exception.type];

  const timeLabel =
    exception.type === 'unavailable'
      ? 'Toute la journée'
      : `${exception.startTime} — ${exception.endTime}`;

  return (
    <div className="group bg-surface-container-lowest p-5 rounded-2xl flex items-center justify-between transition-all hover:shadow-lg hover:shadow-primary/5 border border-transparent hover:border-primary/10">
      <div className="flex items-center gap-5">
        {/* Date badge */}
        <div
          className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center shrink-0 ${badgeConfig.bg}`}
        >
          <span className="text-[11px] font-bold uppercase">
            {formatMonthAbbr(exception.date)}
          </span>
          <span className="text-2xl font-extrabold leading-none">
            {formatDay(exception.date)}
          </span>
        </div>

        {/* Title + badges */}
        <div>
          <h4 className="text-base font-bold text-on-surface font-headline">
            {exception.title}
          </h4>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`px-2 py-0.5 ${badgeConfig.badgeBg} text-[10px] font-bold rounded uppercase tracking-wider`}>
              {badgeConfig.label}
            </span>
            <span className="text-on-surface-variant text-sm font-medium">
              {timeLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Edit / Delete — visible on hover */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => onEdit(exception.id)}
          className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
          aria-label={`Modifier ${exception.title}`}
        >
          <span className="material-symbols-outlined text-[20px]">edit</span>
        </button>
        <button
          type="button"
          onClick={() => onDelete(exception.id)}
          className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-lg transition-colors"
          aria-label={`Supprimer ${exception.title}`}
        >
          <span className="material-symbols-outlined text-[20px]">delete</span>
        </button>
      </div>
    </div>
  );
}

function SystemInsightsCard({ exceptionCount }: { exceptionCount: number }) {
  return (
    <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-surface-container-high">
      <div className="flex items-center gap-3 mb-4">
        <span className="material-symbols-outlined text-primary">info</span>
        <h4 className="font-bold text-on-surface font-headline">
          Aperçu du système
        </h4>
      </div>
      <ul className="space-y-4">
        <li className="flex items-start gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
          <p className="text-sm text-on-surface-variant">
            Vous avez{' '}
            <span className="font-bold text-on-surface">
              {exceptionCount} exception{exceptionCount > 1 ? 's' : ''}
            </span>{' '}
            à venir prévue{exceptionCount > 1 ? 's' : ''} pour les 60 prochains
            jours.
          </p>
        </li>
        <li className="flex items-start gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-tertiary mt-2 shrink-0" />
          <p className="text-sm text-on-surface-variant">
            Les jours fériés se synchronisent automatiquement depuis votre
            calendrier clinique principal.
          </p>
        </li>
      </ul>
    </div>
  );
}

function ConflictAlertCard() {
  return (
    <div className="bg-primary text-on-primary p-6 rounded-2xl relative overflow-hidden">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-bold text-lg font-headline">Avis</h4>
          <span className="px-2 py-0.5 bg-white/20 text-[10px] font-bold rounded-full uppercase">
            Bientôt disponible
          </span>
        </div>
        <p className="text-sm opacity-90 leading-relaxed mb-4">
          Vous avez 2 patients réservés pendant votre nouvelle exception
          personnalisée le 18 avr. Souhaitez-vous les replanifier maintenant ?
        </p>
        <div className="flex gap-2">
          <button disabled className="bg-white/30 text-on-primary px-4 py-2 rounded-lg font-bold text-xs cursor-not-allowed">
            Gérer les conflits
          </button>
          <button disabled className="bg-white/15 text-on-primary px-4 py-2 rounded-lg font-bold text-xs cursor-not-allowed">
            Liste d'attente
          </button>
        </div>
      </div>
      {/* Decorative background icon */}
      <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-[9rem] opacity-10 select-none pointer-events-none">
        warning
      </span>
    </div>
  );
}

function AddExceptionModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [selectedType, setSelectedType] =
    useState<ExceptionType>('unavailable');

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest w-full max-w-md rounded-2xl p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-extrabold text-on-surface font-headline">
            Ajouter une exception
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-on-surface-variant hover:text-error transition-colors"
            aria-label="Fermer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-6">
          {/* Date picker field (static placeholder — no logic yet) */}
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
              Sélectionner une date
            </label>
            <div className="bg-surface-container-low p-3 rounded-xl flex items-center justify-between border-b-2 border-transparent focus-within:border-primary transition-all cursor-pointer">
              <span className="text-on-surface text-sm">
                Choisir une date...
              </span>
              <span className="material-symbols-outlined text-primary">
                calendar_month
              </span>
            </div>
          </div>

          {/* Exception type selector */}
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
              Type d'exception
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setSelectedType('unavailable')}
                className={`p-3 border-2 rounded-xl font-bold flex flex-col items-center gap-1 transition-all ${
                  selectedType === 'unavailable'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-outline-variant text-on-surface-variant hover:border-primary'
                }`}
              >
                <span className="material-symbols-outlined">block</span>
                <span className="text-xs">Indisponible</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedType('custom_hours')}
                className={`p-3 border-2 rounded-xl font-bold flex flex-col items-center gap-1 transition-all ${
                  selectedType === 'custom_hours'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-outline-variant text-on-surface-variant hover:border-primary'
                }`}
              >
                <span className="material-symbols-outlined">schedule</span>
                <span className="text-xs">Horaires personnalisés</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedType('emergency_only')}
                className={`p-3 border-2 rounded-xl font-bold flex flex-col items-center gap-1 transition-all ${
                  selectedType === 'emergency_only'
                    ? 'border-tertiary bg-tertiary/5 text-tertiary'
                    : 'border-outline-variant text-on-surface-variant hover:border-tertiary'
                }`}
              >
                <span className="material-symbols-outlined">emergency</span>
                <span className="text-xs">Urgences seules</span>
              </button>
            </div>
          </div>

          {/* Custom hours inputs — shown for custom_hours and emergency_only */}
          {(selectedType === 'custom_hours' || selectedType === 'emergency_only') && (
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                Plage horaire
              </label>
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center bg-surface-container-low px-4 py-2.5 rounded-xl border border-transparent focus-within:border-primary/30 transition-colors">
                  <span className="material-symbols-outlined text-on-surface-variant text-[18px] mr-2">
                    schedule
                  </span>
                  <input
                    type="time"
                    defaultValue="08:00"
                    className="bg-transparent border-none p-0 text-sm font-bold text-on-surface focus:ring-0 focus:outline-none w-full"
                    aria-label="Heure de début"
                  />
                </div>
                <span className="text-outline-variant text-sm font-medium">
                  à
                </span>
                <div className="flex-1 flex items-center bg-surface-container-low px-4 py-2.5 rounded-xl border border-transparent focus-within:border-primary/30 transition-colors">
                  <span className="material-symbols-outlined text-on-surface-variant text-[18px] mr-2">
                    schedule
                  </span>
                  <input
                    type="time"
                    defaultValue="12:00"
                    className="bg-transparent border-none p-0 text-sm font-bold text-on-surface focus:ring-0 focus:outline-none w-full"
                    aria-label="Heure de fin"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Reason / title input */}
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
              Motif (optionnel)
            </label>
            <input
              type="text"
              placeholder="Ex : Conférence médicale, Congé personnel..."
              className="w-full bg-surface-container-low px-4 py-3 rounded-xl border border-transparent focus:border-primary/30 text-sm text-on-surface placeholder:text-outline-variant focus:ring-0 focus:outline-none transition-colors"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-surface-container-highest text-on-surface font-bold py-3 rounded-xl hover:bg-surface-container-high transition-colors text-sm"
            >
              Annuler
            </button>
            <button
              type="button"
              className="flex-1 bg-primary text-on-primary font-bold py-3 rounded-xl shadow-md hover:bg-primary-container transition-colors text-sm"
            >
              Appliquer l'exception
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function AvailabilityExceptionsPage() {
  const [exceptions] = useState<AvailabilityException[]>(MOCK_EXCEPTIONS);
  const [modalOpen, setModalOpen] = useState(false);

  // Dates that have exceptions — used to highlight them on the mini calendar
  const exceptionDates = exceptions.map((e) => e.date);
  const unavailableDates = exceptions
    .filter((e) => e.type === 'unavailable')
    .map((e) => e.date);
  const customHoursDates = exceptions
    .filter((e) => e.type === 'custom_hours')
    .map((e) => e.date);
  const emergencyOnlyDates = exceptions
    .filter((e) => e.type === 'emergency_only')
    .map((e) => e.date);

  const handleEdit = useCallback((id: string) => {
    // Will be wired to open an edit modal pre-filled with the exception data
    console.log('Edit exception:', id);
  }, []);

  const handleDelete = useCallback((id: string) => {
    // Will be wired to a confirmation dialog + API call
    console.log('Delete exception:', id);
  }, []);

  return (
    <>
      <div className="pt-4 pb-12 px-8">
        {/* Hero Header */}
        <section className="mb-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold text-on-surface font-headline tracking-tight mb-2">
              Exceptions de disponibilité
            </h1>
            <p className="text-on-surface-variant max-w-lg leading-relaxed text-sm">
              Gérez les dates spécifiques où votre disponibilité hebdomadaire
              habituelle est modifiée. Idéal pour les jours fériés, les
              conférences ou les congés d'urgence.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <button
              onClick={() => setModalOpen(true)}
              className="bg-primary text-on-primary px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-primary-container transition-colors shadow-md shadow-primary/20 active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Ajouter une exception
            </button>
          </div>
        </section>

        {/* Main Grid: Exception List + Sidebar */}
        <div className="grid grid-cols-12 gap-6">
          {/* Exception List (8 cols) */}
          <div className="col-span-12 lg:col-span-8 space-y-3">
            <h3 className="text-xs font-bold text-outline uppercase tracking-widest px-1 mb-1">
              Exceptions à venir
            </h3>

            {exceptions.length === 0 ? (
              <div className="bg-surface-container-lowest p-10 rounded-2xl text-center">
                <span className="material-symbols-outlined text-5xl text-outline-variant mb-3">
                  event_available
                </span>
                <p className="text-on-surface-variant font-medium">
                  Aucune exception planifiée. Votre disponibilité hebdomadaire
                  s'applique normalement.
                </p>
              </div>
            ) : (
              exceptions.map((exception) => (
                <ExceptionCard
                  key={exception.id}
                  exception={exception}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>

          {/* Sidebar (4 cols) */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            <h3 className="text-xs font-bold text-outline uppercase tracking-widest px-1">
              Résumé
            </h3>

            {/* Mini Calendar — highlights exception dates */}
            <div className="bg-surface-container-low p-5 rounded-2xl when-calendar">
              <DayPicker
                locale={fr}
                mode="multiple"
                selected={exceptionDates}
                modifiers={{
                  unavailable: unavailableDates,
                  customHours: customHoursDates,
                  emergencyOnly: emergencyOnlyDates,
                }}
                modifiersClassNames={{
                  unavailable: 'exception-unavailable',
                  customHours: 'exception-custom',
                  emergencyOnly: 'exception-emergency',
                }}
                showOutsideDays
                fixedWeeks
              />
            </div>

            {/* System Insights */}
            <SystemInsightsCard exceptionCount={exceptions.length} />

            {/* Conflict Alert */}
            <ConflictAlertCard />
          </div>
        </div>
      </div>

      {/* Add Exception Modal */}
      <AddExceptionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
