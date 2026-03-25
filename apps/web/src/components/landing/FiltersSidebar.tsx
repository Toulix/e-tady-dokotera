import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DayPicker } from 'react-day-picker';
import { fr } from 'date-fns/locale';
import 'react-day-picker/style.css';
import { useDebounce } from '../../hooks/useDebounce';

/**
 * Maps French UI labels to the lowercase enum values the backend expects.
 * The API DTO accepts: 'malagasy' | 'french' | 'english' — see SearchDoctorsQueryDto.
 */
const LANGUAGES = [
  { label: 'Malagasy', value: 'malagasy' },
  { label: 'Français', value: 'french' },
  { label: 'Anglais', value: 'english' },
] as const;

/**
 * Static specialty options for the dropdown filter.
 * These mirror the autocomplete suggestions in SpecialtyAutocomplete — when the
 * backend specialties endpoint is available, both should pull from the same source.
 */
const SPECIALTIES = [
  'Généraliste',
  'Cardiologue',
  'Pédiatre',
  'Gynécologue',
  'Dentiste',
  'Dermatologue',
  'Ophtalmologue',
  'ORL',
] as const;

/**
 * Quick-select availability options.
 * These are UI-only for now — the scheduling module (Phase 3) will make them
 * functional by filtering doctors with open slots on the selected day.
 */
const AVAILABILITY_OPTIONS = [
  { label: "Aujourd'hui", value: 'today' },
  { label: 'Demain', value: 'tomorrow' },
] as const;

interface FiltersSidebarProps {
  onFilterChange: (key: string, value: string | null) => void;
  onClearFilters: () => void;
}

/**
 * Advanced filters sidebar — adapted from the Stitch redesign.
 *
 * Layout: rounded card with grouped filters (specialty dropdown, language chips,
 * price range slider, availability quick-select) and an "Apply" CTA.
 *
 * All filter state lives in URL search params (managed by SearchPage)
 * rather than local component state. This ensures:
 * - Filters are reflected in the URL → shareable/bookmarkable
 * - SearchPage's useEffect re-fetches when any filter changes
 * - No state synchronization bugs between sidebar and search
 */
export default function FiltersSidebar({ onFilterChange, onClearFilters }: FiltersSidebarProps) {
  const [searchParams] = useSearchParams();

  const activeLanguage = searchParams.get('language') || '';
  const activeSpecialty = searchParams.get('specialty') || '';
  const activeAvailability = searchParams.get('availability') || '';

  // Local state for the specialty input — debounced before updating the URL
  // so each keystroke doesn't trigger an API call.
  const [localSpecialty, setLocalSpecialty] = useState(activeSpecialty);
  const debouncedSpecialty = useDebounce(localSpecialty, 300);

  // Sync debounced value to URL params
  useEffect(() => {
    onFilterChange('specialty', debouncedSpecialty || null);
  // onFilterChange is stable (useCallback in SearchPage) — listing it here
  // prevents a stale closure if the parent ever re-creates the function.
  }, [debouncedSpecialty, onFilterChange]);

  // Keep local input in sync when URL changes externally (e.g. filter reset)
  useEffect(() => {
    setLocalSpecialty(activeSpecialty);
  }, [activeSpecialty]);

  const hasActiveFilters = activeLanguage || activeSpecialty || activeAvailability;

  // A custom date is any availability value that isn't a quick-select keyword.
  // We derive it from the URL so the picker stays in sync with back/forward nav.
  const isCustomDate = activeAvailability !== '' && !['today', 'tomorrow'].includes(activeAvailability);
  const [showDatePicker, setShowDatePicker] = useState(isCustomDate);

  // Keep picker visibility in sync with URL on back/forward navigation.
  // Without this, navigating back to a URL with a custom date wouldn't re-show the picker
  // because useState only reads the initial value once on mount.
  useEffect(() => {
    setShowDatePicker(isCustomDate);
  }, [isCustomDate]);

  // Today's date in YYYY-MM-DD — stable for the lifetime of this component mount
  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);

  function handleQuickSelect(value: string) {
    // Selecting a quick button hides the custom picker
    setShowDatePicker(false);
    onFilterChange('availability', activeAvailability === value ? null : value);
  }

  function handleCustomDateToggle() {
    if (showDatePicker) {
      // Clicking the button while picker is open clears the custom date
      setShowDatePicker(false);
      onFilterChange('availability', null);
    } else {
      setShowDatePicker(true);
      // Deselect any quick-select so only one mode is active at a time
      if (['today', 'tomorrow'].includes(activeAvailability)) {
        onFilterChange('availability', null);
      }
    }
  }

  function handleDaySelect(day: Date | undefined) {
    if (!day) {
      onFilterChange('availability', null);
      return;
    }
    // Store as YYYY-MM-DD in the URL — timezone-safe local date formatting
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    onFilterChange('availability', iso);
  }

  return (
    // top-55 (220px) = navbar h-20 (80px) + sticky search section (~140px)
    <aside className="w-80 hidden lg:flex flex-col p-6 gap-8 bg-surface-container-low rounded-2xl h-fit sticky top-55 mt-4">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="font-headline font-extrabold text-primary text-xl">
          Filtres Avancés
        </h2>
        <p className="text-xs text-outline">
          Affinez votre recherche pour un soin optimal.
        </p>
      </div>

      <div className="space-y-6">
        {/* Specialty — dropdown select matching the Stitch design */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-primary font-semibold">
            <span className="material-symbols-outlined text-sm">medical_services</span>
            <span className="text-sm">Spécialité</span>
          </div>
          <select
            value={localSpecialty}
            onChange={(e) => setLocalSpecialty(e.target.value)}
            className="w-full bg-surface-container-highest border-none rounded-xl text-sm py-2.5 focus:ring-2 focus:ring-primary/20 cursor-pointer"
          >
            <option value="">Toutes les spécialités</option>
            {SPECIALTIES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Language — toggle chip buttons (single-select, re-click deselects) */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-primary font-semibold">
            <span className="material-symbols-outlined text-sm">translate</span>
            <span className="text-sm">Langue</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  onFilterChange('language', activeLanguage === value ? null : value)
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeLanguage === value
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Price range — visual placeholder until backend supports max_fee filter */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-primary font-semibold">
            <span className="material-symbols-outlined text-sm">payments</span>
            <span className="text-sm">Prix maximum</span>
          </div>
          <input
            type="range"
            min={20000}
            max={150000}
            step={5000}
            defaultValue={150000}
            className="w-full accent-primary h-1.5 bg-surface-container-high rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-outline font-bold">
            <span>20 000 Ar</span>
            <span>150 000 Ar</span>
          </div>
        </div>

        {/* Availability — quick-select + optional custom date picker */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-primary font-semibold">
            <span className="material-symbols-outlined text-sm">event_available</span>
            <span className="text-sm">Disponibilité</span>
          </div>

          {/* Quick-select row */}
          <div className="grid grid-cols-2 gap-2">
            {AVAILABILITY_OPTIONS.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleQuickSelect(value)}
                className={`p-2 rounded-xl text-center text-xs transition-all ${
                  activeAvailability === value
                    ? 'bg-primary text-on-primary font-bold'
                    : 'border border-outline-variant/30 hover:bg-surface-container-high'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Custom date toggle button — full-width, below quick-select */}
          <button
            type="button"
            onClick={handleCustomDateToggle}
            className={`w-full p-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all ${
              showDatePicker || isCustomDate
                ? 'bg-primary text-on-primary font-bold'
                : 'border border-outline-variant/30 hover:bg-surface-container-high'
            }`}
          >
            <span className="material-symbols-outlined text-sm">calendar_month</span>
            {isCustomDate
              ? new Date(activeAvailability + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
              : 'Choisir une date'}
          </button>

          {/* Calendar picker — shown only when the user toggled it.
              We use CSS variables for sizing/radius (the intended DayPicker v9
              theming mechanism) so the default rdp-* classes keep their built-in
              centering logic intact. Wrapper selectors apply the primary colour
              directly on the inner <button> — not the <td> — so the blue circle
              is perfectly centred around the date number. */}
          {showDatePicker && (
            // when-calendar in index.css provides all DayPicker v9 theming:
            // correct CSS vars (--rdp-accent-color), ROUND_FULL buttons, today's
            // border ring, and primary-container hover — no need to repeat here.
            <div className="rounded-xl overflow-hidden when-calendar">
              <DayPicker
                mode="single"
                locale={fr}
                selected={isCustomDate ? new Date(activeAvailability + 'T00:00:00') : undefined}
                onSelect={handleDaySelect}
                disabled={{ before: new Date(todayIso) }}
                style={{
                  // Shrink cells to fit the 272px inner width of the sidebar
                  // (w-80=320px minus p-6 padding on both sides)
                  '--rdp-day-width': '32px',
                  '--rdp-day-height': '32px',
                  '--rdp-day_button-width': '32px',
                  '--rdp-day_button-height': '32px',
                } as React.CSSProperties}
              />
            </div>
          )}
        </div>
      </div>

      {/* Apply / Reset — the "Apply" button is visual reinforcement since filters
          already apply in real-time via URL params. Reset clears everything. */}
      {hasActiveFilters ? (
        <button
          type="button"
          onClick={() => {
            setLocalSpecialty('');
            onClearFilters();
          }}
          className="w-full py-3.5 border-2 border-primary text-primary rounded-xl font-bold hover:bg-surface-container-low transition-all"
        >
          Réinitialiser les filtres
        </button>
      ) : (
        <button
          type="button"
          className="w-full py-3.5 bg-primary text-on-primary rounded-xl font-bold shadow-lg hover:shadow-primary/20 hover:-translate-y-px transition-all duration-300"
        >
          Appliquer les filtres
        </button>
      )}
    </aside>
  );
}
