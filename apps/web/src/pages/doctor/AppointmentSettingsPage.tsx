import { useState, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AppointmentSettings {
  duration: number;
  bufferTime: number;
  minimumNotice: number;
  dailyLimitEnabled: boolean;
  dailyLimit: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DURATION_OPTIONS = [
  { value: 15, label: '15 mins' },
  { value: 30, label: '30 mins' },
  { value: 45, label: '45 mins' },
  { value: 60, label: '60 mins' },
];

const BUFFER_OPTIONS = [
  { value: 0, label: '0 min' },
  { value: 5, label: '5 mins' },
  { value: 10, label: '10 mins' },
  { value: 15, label: '15 mins' },
];

const INITIAL_SETTINGS: AppointmentSettings = {
  duration: 30,
  bufferTime: 10,
  minimumNotice: 2,
  dailyLimitEnabled: true,
  dailyLimit: 12,
};

const HELPER_CARDS = [
  {
    icon: 'auto_awesome',
    colorClass: 'text-primary',
    title: 'Synchronisation auto',
    description:
      'Les modifications se synchronisent instantanément avec Google et Outlook pour éviter les chevauchements.',
    comingSoon: true,
  },
  {
    icon: 'groups',
    colorClass: 'text-tertiary',
    title: 'Sessions de groupe',
    description:
      'Plusieurs participants peuvent être autorisés dans les paramètres individuels par type de rendez-vous.',
    comingSoon: true,
  },
  {
    icon: 'lock_clock',
    colorClass: 'text-error',
    title: 'Verrouillage jours fériés',
    description:
      "Utilisez l'onglet 'Exceptions' pour bloquer les jours fériés ou les congés personnels.",
    comingSoon: false,
  },
] as const;

// ─── Sub-components ─────────────────────────────────────────────────────────

/** Styled select matching the Stitch design — pill-shaped with a trailing chevron icon. */
function SettingsSelect({
  value,
  options,
  onChange,
  label,
}: {
  value: number;
  options: { value: number; label: string }[];
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="w-full appearance-none bg-surface-container-low border-none rounded-lg py-3 px-4 text-on-surface text-sm focus:bg-surface-container-highest transition-colors focus:ring-0 focus:outline-none cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <span className="material-symbols-outlined absolute right-3 top-3 text-outline pointer-events-none text-[20px]">
        expand_more
      </span>
    </div>
  );
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function AppointmentSettingsPage() {
  const [settings, setSettings] = useState<AppointmentSettings>(INITIAL_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);

  const markChanged = useCallback(() => setHasChanges(true), []);

  const updateField = useCallback(
    <K extends keyof AppointmentSettings>(field: K, value: AppointmentSettings[K]) => {
      setSettings((prev) => ({ ...prev, [field]: value }));
      markChanged();
    },
    [markChanged],
  );

  const handleCancel = useCallback(() => {
    setSettings(INITIAL_SETTINGS);
    setHasChanges(false);
  }, []);

  const handleSave = useCallback(() => {
    // Will be wired to the API later
    setHasChanges(false);
  }, []);

  return (
    <div className="pt-4 pb-12 px-8 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-10">
        <div className="flex items-center gap-4 mb-2">
          <h1 className="text-2xl font-extrabold text-on-surface font-headline tracking-tight">
            Paramètres des rendez-vous
          </h1>
          {hasChanges && (
            <div className="flex items-center gap-2 bg-tertiary/10 px-3 py-1 rounded-full animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
              <span className="text-xs font-medium text-tertiary">
                Modifications non enregistrées
              </span>
            </div>
          )}
        </div>
        <p className="text-on-surface-variant text-sm leading-relaxed max-w-2xl">
          Configurez la manière dont les patients interagissent avec votre calendrier. Les créneaux
          horaires sont générés automatiquement en fonction de ces paramètres pour garantir une
          journée organisée et efficace.
        </p>
      </div>

      {/* Main settings card */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm p-8 md:p-10 relative overflow-hidden">
        {/* Gradient accent bar at the top of the card */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary-container" />

        <form
          className="space-y-12"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          {/* Section 1: Timing Core — duration and buffer side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-on-surface-variant font-headline">
                Durée du rendez-vous
              </label>
              <SettingsSelect
                value={settings.duration}
                options={DURATION_OPTIONS}
                onChange={(v) => updateField('duration', v)}
                label="Durée du rendez-vous"
              />
              <p className="text-xs text-on-surface-variant/70 italic">
                Durée par défaut pour toutes les nouvelles consultations standard.
              </p>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-semibold text-on-surface-variant font-headline">
                Temps de battement
              </label>
              <SettingsSelect
                value={settings.bufferTime}
                options={BUFFER_OPTIONS}
                onChange={(v) => updateField('bufferTime', v)}
                label="Temps de battement"
              />
              <p className="text-xs text-on-surface-variant/70 italic">
                Période de transition entre les sessions consécutives.
              </p>
            </div>
          </div>

          {/* Section 2: Notice & Limits */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 items-start">
            {/* Minimum notice */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-on-surface-variant font-headline">
                Préavis minimum
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={72}
                  value={settings.minimumNotice}
                  onChange={(e) => updateField('minimumNotice', Number(e.target.value))}
                  aria-label="Préavis minimum en heures"
                  className="w-full bg-surface-container-low border-none rounded-lg py-3 px-4 text-on-surface text-sm focus:bg-surface-container-highest transition-colors focus:ring-0 focus:outline-none"
                />
                <span className="text-sm font-medium text-on-surface-variant whitespace-nowrap">
                  Heures
                </span>
              </div>
              <p className="text-xs text-on-surface-variant/70 italic">
                Empêche les réservations de dernière minute d'apparaître sur votre planning.
              </p>
            </div>

            {/* Daily booking limit */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-on-surface-variant font-headline">
                  Limite de réservations quotidienne
                </label>
                <button
                  type="button"
                  className="toggle-track"
                  data-checked={settings.dailyLimitEnabled}
                  onClick={() => updateField('dailyLimitEnabled', !settings.dailyLimitEnabled)}
                  aria-label={`${settings.dailyLimitEnabled ? 'Désactiver' : 'Activer'} la limite quotidienne`}
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={settings.dailyLimitEnabled ? settings.dailyLimit : ''}
                  onChange={(e) => updateField('dailyLimit', Number(e.target.value))}
                  disabled={!settings.dailyLimitEnabled}
                  placeholder="ex: 12"
                  aria-label="Nombre maximum de créneaux par jour"
                  className={`w-full bg-surface-container-low border-none rounded-lg py-3 px-4 text-on-surface text-sm focus:bg-surface-container-highest transition-colors focus:ring-0 focus:outline-none ${
                    !settings.dailyLimitEnabled ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                />
                <span className="text-sm font-medium text-on-surface-variant whitespace-nowrap">
                  Créneaux
                </span>
              </div>
              <p className="text-xs text-on-surface-variant/70 italic">
                Nombre maximal de rendez-vous par jour avant la fermeture du calendrier.
              </p>
            </div>
          </div>

          {/* Section 3: Advanced — coming soon features */}
          <div className="pt-8 border-t border-surface-container-high space-y-6">
            <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-widest">
              Avancé
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
              {/* Emergency overbooking */}
              <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl opacity-60">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-error text-[20px]">emergency</span>
                  <div>
                    <span className="text-sm font-semibold text-on-surface">Overbooking d'urgence</span>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Permettre les réservations au-delà de la limite en cas d'urgence.
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-tertiary/10 text-tertiary text-[10px] font-bold rounded-full uppercase shrink-0">
                  Bientôt
                </span>
              </div>

              {/* Conflict detection */}
              <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl opacity-60">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-[20px]">shield</span>
                  <div>
                    <span className="text-sm font-semibold text-on-surface">Détection de conflits</span>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Alertes automatiques en cas de double réservation.
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-tertiary/10 text-tertiary text-[10px] font-bold rounded-full uppercase shrink-0">
                  Bientôt
                </span>
              </div>

              {/* Waitlist */}
              <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl opacity-60">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-secondary text-[20px]">list_alt</span>
                  <div>
                    <span className="text-sm font-semibold text-on-surface">Liste d'attente</span>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Les patients peuvent s'inscrire quand aucun créneau n'est libre.
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-tertiary/10 text-tertiary text-[10px] font-bold rounded-full uppercase shrink-0">
                  Bientôt
                </span>
              </div>
            </div>
          </div>

          {/* Form footer */}
          <div className="pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-surface-container-high">
            <div className="flex items-center gap-2 text-on-surface-variant/60 text-sm">
              <span className="material-symbols-outlined text-base">info</span>
              <span>Les modifications s'appliqueront à tous les futurs créneaux libres.</span>
            </div>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold text-on-surface hover:bg-surface-container-high transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-8 py-2.5 rounded-lg text-sm font-bold text-on-primary bg-gradient-to-b from-primary to-primary-container shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-transform"
              >
                Enregistrer les modifications
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Helper cards — bento-style grid */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {HELPER_CARDS.map((card) => (
          <div
            key={card.title}
            className={`bg-surface-container-low p-6 rounded-xl space-y-3 ${card.comingSoon ? 'opacity-60' : ''}`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`material-symbols-outlined ${card.colorClass}`}
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {card.icon}
              </span>
              {card.comingSoon && (
                <span className="px-2 py-0.5 bg-tertiary/10 text-tertiary text-[10px] font-bold rounded-full uppercase">
                  Bientôt disponible
                </span>
              )}
            </div>
            <h4 className="font-headline font-bold text-on-surface">{card.title}</h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">{card.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
