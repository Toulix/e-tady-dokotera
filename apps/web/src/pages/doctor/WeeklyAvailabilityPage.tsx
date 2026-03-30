import { useState, useCallback, useMemo } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

type AppointmentType = 'in_person' | 'video' | 'both';

interface DaySchedule {
  active: boolean;
  startTime: string;
  endTime: string;
  appointmentType: AppointmentType;
}

type DayKey =
  | 'lundi'
  | 'mardi'
  | 'mercredi'
  | 'jeudi'
  | 'vendredi'
  | 'samedi'
  | 'dimanche';

interface DayConfig {
  key: DayKey;
  label: string;
  type: 'Semaine' | 'Week-end';
}

// ─── Constants ──────────────────────────────────────────────────────────────
const DAYS: DayConfig[] = [
  { key: 'lundi', label: 'Lundi', type: 'Semaine' },
  { key: 'mardi', label: 'Mardi', type: 'Semaine' },
  { key: 'mercredi', label: 'Mercredi', type: 'Semaine' },
  { key: 'jeudi', label: 'Jeudi', type: 'Semaine' },
  { key: 'vendredi', label: 'Vendredi', type: 'Semaine' },
  { key: 'samedi', label: 'Samedi', type: 'Week-end' },
  { key: 'dimanche', label: 'Dimanche', type: 'Week-end' },
];

const DEFAULT_START = '08:00';
const DEFAULT_END = '17:00';

const APPOINTMENT_TYPE_OPTIONS: { value: AppointmentType; label: string; icon: string }[] = [
  { value: 'in_person', label: 'En personne', icon: 'person' },
  { value: 'video', label: 'Vidéo', icon: 'videocam' },
  { value: 'both', label: 'Les deux', icon: 'swap_horiz' },
];

const INITIAL_SCHEDULE: Record<DayKey, DaySchedule> = {
  lundi: { active: true, startTime: '08:00', endTime: '17:00', appointmentType: 'both' },
  mardi: { active: true, startTime: '08:00', endTime: '17:00', appointmentType: 'both' },
  mercredi: { active: false, startTime: '', endTime: '', appointmentType: 'both' },
  jeudi: { active: true, startTime: '09:00', endTime: '18:30', appointmentType: 'both' },
  vendredi: { active: true, startTime: '08:00', endTime: '12:00', appointmentType: 'both' },
  samedi: { active: false, startTime: '', endTime: '', appointmentType: 'both' },
  dimanche: { active: false, startTime: '', endTime: '', appointmentType: 'both' },
};

// ─── Presets ────────────────────────────────────────────────────────────────
// Each preset defines which days are active and with what hours.
const PRESETS = [
  { label: 'Standard 08-17', apply: applyStandard },
  { label: 'Matin uniquement', apply: applyMorning },
  { label: 'Après-midi uniquement', apply: applyAfternoon },
  { label: 'Spécial week-end', apply: applyWeekend },
] as const;

function applyStandard(): Record<DayKey, DaySchedule> {
  const s: Record<string, DaySchedule> = {};
  for (const day of DAYS) {
    const isWeekday = day.type === 'Semaine';
    s[day.key] = {
      active: isWeekday,
      startTime: isWeekday ? '08:00' : '',
      endTime: isWeekday ? '17:00' : '',
      appointmentType: 'both',
    };
  }
  return s as Record<DayKey, DaySchedule>;
}

function applyMorning(): Record<DayKey, DaySchedule> {
  const s: Record<string, DaySchedule> = {};
  for (const day of DAYS) {
    const isWeekday = day.type === 'Semaine';
    s[day.key] = {
      active: isWeekday,
      startTime: isWeekday ? '08:00' : '',
      endTime: isWeekday ? '12:00' : '',
      appointmentType: 'both',
    };
  }
  return s as Record<DayKey, DaySchedule>;
}

function applyAfternoon(): Record<DayKey, DaySchedule> {
  const s: Record<string, DaySchedule> = {};
  for (const day of DAYS) {
    const isWeekday = day.type === 'Semaine';
    s[day.key] = {
      active: isWeekday,
      startTime: isWeekday ? '13:00' : '',
      endTime: isWeekday ? '17:00' : '',
      appointmentType: 'both',
    };
  }
  return s as Record<DayKey, DaySchedule>;
}

function applyWeekend(): Record<DayKey, DaySchedule> {
  const s: Record<string, DaySchedule> = {};
  for (const day of DAYS) {
    const isWeekend = day.type === 'Week-end';
    s[day.key] = {
      active: isWeekend,
      startTime: isWeekend ? '09:00' : '',
      endTime: isWeekend ? '13:00' : '',
      appointmentType: 'both',
    };
  }
  return s as Record<DayKey, DaySchedule>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convert "14:30" → minutes since midnight (870). */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Calculate total weekly hours from the schedule. */
function computeWeeklySummary(schedule: Record<DayKey, DaySchedule>) {
  let totalMinutes = 0;
  let activeDays = 0;

  for (const day of DAYS) {
    const entry = schedule[day.key];
    if (!entry.active || !entry.startTime || !entry.endTime) continue;

    const start = timeToMinutes(entry.startTime);
    const end = timeToMinutes(entry.endTime);
    if (end > start) {
      totalMinutes += end - start;
      activeDays++;
    }
  }

  const hours = Math.floor(totalMinutes / 60);
  const remainingMins = totalMinutes % 60;
  const displayHours =
    remainingMins > 0 ? `${hours}h${String(remainingMins).padStart(2, '0')}` : `${hours}h`;

  return { displayHours, activeDays };
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function AppointmentTypeSelector({
  value,
  onChange,
  disabled,
}: {
  value: AppointmentType;
  onChange: (v: AppointmentType) => void;
  disabled: boolean;
}) {
  return (
    <div className={`flex gap-1 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      {APPOINTMENT_TYPE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          title={opt.label}
          className={`p-1.5 rounded-lg transition-colors ${
            value === opt.value
              ? 'bg-primary/10 text-primary'
              : 'text-on-surface-variant/50 hover:bg-surface-container-highest hover:text-on-surface-variant'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">{opt.icon}</span>
        </button>
      ))}
    </div>
  );
}

function DayRow({
  config,
  schedule,
  onToggle,
  onTimeChange,
  onAppointmentTypeChange,
  onCopy,
  onPaste,
  hasClipboard,
}: {
  config: DayConfig;
  schedule: DaySchedule;
  onToggle: () => void;
  onTimeChange: (field: 'startTime' | 'endTime', value: string) => void;
  onAppointmentTypeChange: (value: AppointmentType) => void;
  onCopy: () => void;
  onPaste: () => void;
  hasClipboard: boolean;
}) {
  const { active, startTime, endTime, appointmentType } = schedule;

  return (
    <div
      className={`p-5 rounded-2xl flex items-center gap-6 transition-all ${
        active
          ? 'bg-surface-container-lowest shadow-sm hover:shadow-md'
          : 'bg-surface-container-low/50 border border-dashed border-outline-variant/30 opacity-60'
      }`}
    >
      {/* Day name and type label */}
      <div className="w-28 shrink-0 flex flex-col">
        <span
          className={`text-lg font-headline font-extrabold ${
            active ? 'text-primary' : 'text-on-surface-variant'
          }`}
        >
          {config.label}
        </span>
        <span
          className={`text-[11px] font-semibold uppercase tracking-wider ${
            config.type === 'Week-end' ? 'text-tertiary' : 'text-on-surface-variant/60'
          }`}
        >
          {config.type}
        </span>
      </div>

      {/* Toggle switch */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          className="toggle-track"
          data-checked={active}
          onClick={onToggle}
          aria-label={`${active ? 'Désactiver' : 'Activer'} ${config.label}`}
        />
        <span
          className={`text-xs font-bold uppercase ${
            active ? 'text-primary' : 'text-on-surface-variant'
          }`}
        >
          {active ? 'Actif' : 'Inactif'}
        </span>
      </div>

      {/* Time inputs */}
      <div className="flex-1 flex items-center justify-center gap-3">
        {active ? (
          <>
            <TimeInput
              value={startTime}
              onChange={(v) => onTimeChange('startTime', v)}
              label={`Heure de début ${config.label}`}
            />
            <span className="text-outline-variant text-sm">à</span>
            <TimeInput
              value={endTime}
              onChange={(v) => onTimeChange('endTime', v)}
              label={`Heure de fin ${config.label}`}
            />
          </>
        ) : (
          <>
            <div className="flex items-center bg-surface-container-highest px-4 py-2 rounded-xl">
              <span className="text-sm font-bold text-on-surface-variant/50 w-20 text-center">
                --:--
              </span>
            </div>
            <span className="text-outline-variant text-sm">à</span>
            <div className="flex items-center bg-surface-container-highest px-4 py-2 rounded-xl">
              <span className="text-sm font-bold text-on-surface-variant/50 w-20 text-center">
                --:--
              </span>
            </div>
          </>
        )}
      </div>

      {/* Appointment type selector */}
      <AppointmentTypeSelector
        value={appointmentType}
        onChange={onAppointmentTypeChange}
        disabled={!active}
      />

      {/* Copy / Paste actions — visible on hover */}
      <div className="flex items-center gap-1 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity">
        {active && (
          <button
            type="button"
            onClick={onCopy}
            className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
            title="Copier l'horaire"
          >
            <span className="material-symbols-outlined text-[20px]">content_copy</span>
          </button>
        )}
        {hasClipboard && (
          <button
            type="button"
            onClick={onPaste}
            className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
            title="Coller l'horaire"
          >
            <span className="material-symbols-outlined text-[20px]">content_paste</span>
          </button>
        )}
      </div>
    </div>
  );
}

function TimeInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div className="flex items-center bg-surface-container-low px-4 py-2 rounded-xl border border-transparent focus-within:border-primary/30 transition-colors">
      <span className="material-symbols-outlined text-on-surface-variant text-[18px] mr-2">
        schedule
      </span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="bg-transparent border-none p-0 text-sm font-bold text-on-surface focus:ring-0 focus:outline-none w-24"
      />
    </div>
  );
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function WeeklyAvailabilityPage() {
  const [schedule, setSchedule] = useState<Record<DayKey, DaySchedule>>(INITIAL_SCHEDULE);
  const [clipboard, setClipboard] = useState<{ start: string; end: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const markChanged = useCallback(() => setHasChanges(true), []);

  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveUntil, setEffectiveUntil] = useState('');

  const handleToggle = useCallback(
    (day: DayKey) => {
      setSchedule((prev) => {
        const current = prev[day];
        return {
          ...prev,
          [day]: {
            ...current,
            active: !current.active,
            startTime: !current.active ? (current.startTime || DEFAULT_START) : current.startTime,
            endTime: !current.active ? (current.endTime || DEFAULT_END) : current.endTime,
          },
        };
      });
      markChanged();
    },
    [markChanged],
  );

  const handleTimeChange = useCallback(
    (day: DayKey, field: 'startTime' | 'endTime', value: string) => {
      setSchedule((prev) => ({
        ...prev,
        [day]: { ...prev[day], [field]: value },
      }));
      markChanged();
    },
    [markChanged],
  );

  const handleCopy = useCallback(
    (day: DayKey) => {
      const entry = schedule[day];
      setClipboard({ start: entry.startTime, end: entry.endTime });
    },
    [schedule],
  );

  const handlePaste = useCallback(
    (day: DayKey) => {
      if (!clipboard) return;
      setSchedule((prev) => ({
        ...prev,
        [day]: { active: true, startTime: clipboard.start, endTime: clipboard.end },
      }));
      markChanged();
    },
    [clipboard, markChanged],
  );

  const handleAppointmentTypeChange = useCallback(
    (day: DayKey, value: AppointmentType) => {
      setSchedule((prev) => ({
        ...prev,
        [day]: { ...prev[day], appointmentType: value },
      }));
      markChanged();
    },
    [markChanged],
  );

  const handlePreset = useCallback(
    (applyFn: () => Record<DayKey, DaySchedule>) => {
      setSchedule(applyFn());
      markChanged();
    },
    [markChanged],
  );

  const handleCancel = useCallback(() => {
    setSchedule(INITIAL_SCHEDULE);
    setHasChanges(false);
  }, []);

  const handleSave = useCallback(() => {
    // Will be wired to the API later
    setHasChanges(false);
  }, []);

  const { displayHours, activeDays } = useMemo(() => computeWeeklySummary(schedule), [schedule]);

  return (
    <div className="pt-4 pb-12 px-8 max-w-5xl mx-auto">
      {/* Page header with unsaved-changes indicator */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-on-surface font-headline tracking-tight">
            Disponibilité hebdomadaire
          </h1>
          {hasChanges && (
            <div className="flex items-center gap-2 bg-error-container/15 px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-error" />
              <span className="text-xs font-semibold text-error">
                Modifications non enregistrées
              </span>
            </div>
          )}
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-container text-on-primary rounded-xl font-bold text-sm transition-colors shadow-md shadow-primary/20 active:scale-95"
        >
          <span className="material-symbols-outlined text-[18px]">save</span>
          Enregistrer
        </button>
      </div>

      {/* Quick presets */}
      <section className="flex flex-col md:flex-row gap-6 mb-8 items-end">
        <div className="flex-1">
          <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">
            Préréglages rapides
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePreset(preset.apply)}
                className="px-4 py-2 bg-surface-container-low hover:bg-surface-container-highest text-on-surface-variant font-semibold text-sm rounded-lg transition-colors border border-transparent hover:border-outline-variant/20"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Effective date range + facility */}
      <section className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest">
            Effectif à partir du
          </label>
          <input
            type="date"
            value={effectiveFrom}
            onChange={(e) => { setEffectiveFrom(e.target.value); markChanged(); }}
            className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-4 text-on-surface text-sm focus:bg-surface-container-highest transition-colors focus:ring-0 focus:outline-none"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest">
            Effectif jusqu'au
            <span className="text-on-surface-variant/50 normal-case tracking-normal font-normal ml-1">(optionnel)</span>
          </label>
          <input
            type="date"
            value={effectiveUntil}
            onChange={(e) => { setEffectiveUntil(e.target.value); markChanged(); }}
            className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-4 text-on-surface text-sm focus:bg-surface-container-highest transition-colors focus:ring-0 focus:outline-none"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest">
            Établissement
          </label>
          <div className="relative">
            <select
              disabled
              className="w-full appearance-none bg-surface-container-low border-none rounded-lg py-2.5 px-4 text-on-surface-variant/50 text-sm cursor-not-allowed"
            >
              <option>Tous les établissements</option>
            </select>
            <span className="absolute right-3 top-2.5 px-2 py-0.5 bg-tertiary/10 text-tertiary text-[10px] font-bold rounded-full uppercase">
              Bientôt
            </span>
          </div>
        </div>
      </section>

      {/* Day rows */}
      <div className="space-y-3">
        {DAYS.map((day) => (
          <DayRow
            key={day.key}
            config={day}
            schedule={schedule[day.key]}
            onToggle={() => handleToggle(day.key)}
            onTimeChange={(field, value) => handleTimeChange(day.key, field, value)}
            onAppointmentTypeChange={(value) => handleAppointmentTypeChange(day.key, value)}
            onCopy={() => handleCopy(day.key)}
            onPaste={() => handlePaste(day.key)}
            hasClipboard={clipboard !== null}
          />
        ))}
      </div>

      {/* Weekly summary footer */}
      <div className="mt-10 p-6 bg-primary/5 rounded-2xl border border-primary/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-primary font-bold text-lg font-headline">Résumé hebdomadaire</h3>
          <p className="text-sm text-on-surface-variant mt-1">
            Vous avez planifié{' '}
            <span className="text-primary font-bold">{displayHours} de travail</span> cette semaine
            sur <span className="text-primary font-bold">{activeDays} jour{activeDays > 1 ? 's' : ''}</span>.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            className="px-5 py-2.5 bg-surface-container-low text-on-surface-variant font-bold rounded-xl hover:bg-surface-container-highest transition-colors text-sm"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="px-8 py-2.5 bg-primary text-on-primary font-bold rounded-xl hover:bg-primary-container transition-colors shadow-lg shadow-primary/20 text-sm"
          >
            Enregistrer le planning hebdomadaire
          </button>
        </div>
      </div>

      {/* Copy to future weeks — coming soon */}
      <div className="mt-4 p-5 bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-on-surface-variant/50">date_range</span>
          <div>
            <span className="text-sm font-semibold text-on-surface-variant">
              Copier vers les semaines futures
            </span>
            <span className="ml-2 px-2 py-0.5 bg-tertiary/10 text-tertiary text-[10px] font-bold rounded-full uppercase">
              Bientôt disponible
            </span>
          </div>
        </div>
        <button
          disabled
          className="px-4 py-2 bg-surface-container-highest text-on-surface-variant/40 font-semibold rounded-lg text-sm cursor-not-allowed"
        >
          Dupliquer le planning
        </button>
      </div>
    </div>
  );
}
