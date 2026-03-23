import { useSearchParams } from 'react-router-dom';

/**
 * Maps French UI labels to the lowercase enum values the backend expects.
 * The API DTO accepts: 'malagasy' | 'french' | 'english' — see SearchDoctorsQueryDto.
 */
const LANGUAGES = [
  { label: 'Malagasy', value: 'malagasy' },
  { label: 'Français', value: 'french' },
  { label: 'Anglais', value: 'english' },
] as const;

interface FiltersSidebarProps {
  /**
   * Callback to update a single search param by key.
   * Passing null as value removes the param.
   * Provided by SearchPage — writes directly to URL search params
   * so the search effect re-fires automatically.
   */
  onFilterChange: (key: string, value: string | null) => void;
}

/**
 * Left sidebar with search filters.
 *
 * All filter state lives in URL search params (managed by SearchPage)
 * rather than local component state. This ensures:
 * - Filters are reflected in the URL → shareable/bookmarkable
 * - SearchPage's useEffect re-fetches when any filter changes
 * - No state synchronization bugs between sidebar and search
 */
export default function FiltersSidebar({ onFilterChange }: FiltersSidebarProps) {
  const [searchParams] = useSearchParams();

  const activeLanguage = searchParams.get('language') || '';
  const activeSpecialty = searchParams.get('specialty') || '';

  return (
    <aside className="space-y-8">
      <h3 className="font-headline font-bold text-lg flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">filter_list</span>
        Filtres
      </h3>

      <div className="space-y-6">
        {/* Specialty filter */}
        <div className="space-y-3">
          <label
            htmlFor="filter-specialty"
            className="text-xs font-bold uppercase tracking-wider text-outline"
          >
            Spécialité
          </label>
          <input
            id="filter-specialty"
            type="text"
            value={activeSpecialty}
            onChange={(e) =>
              onFilterChange('specialty', e.target.value || null)
            }
            placeholder="Ex : Cardiologie"
            className="w-full bg-surface-container border-none rounded-full px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-primary placeholder:text-outline-variant"
          />
        </div>

        {/* Language — single-select because the API only accepts one language at a time */}
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-outline">
            Langue parlée
          </label>
          <div className="space-y-2">
            {LANGUAGES.map(({ label, value }) => (
              <label key={value} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name="language"
                  checked={activeLanguage === value}
                  onChange={() =>
                    // Clicking the already-selected language deselects it (clears filter)
                    onFilterChange('language', activeLanguage === value ? null : value)
                  }
                  className="rounded-full border-outline-variant text-primary focus:ring-primary h-5 w-5"
                />
                <span className="text-sm font-medium group-hover:text-primary transition-colors">
                  {label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Clear all filters */}
        {(activeLanguage || activeSpecialty) && (
          <button
            type="button"
            onClick={() => {
              onFilterChange('language', null);
              onFilterChange('specialty', null);
            }}
            className="w-full py-2 text-sm text-primary font-semibold hover:underline cursor-pointer"
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>
    </aside>
  );
}
