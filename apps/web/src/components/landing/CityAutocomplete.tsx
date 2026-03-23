import { useState, useRef, useEffect, useCallback } from 'react';

// ─── Static data ────────────────────────────────────────────────────────────
// Will be replaced by API / geolocation calls once the backend is live.

interface City {
  name: string;
  region: string;
}

const CITIES: City[] = [
  { name: 'Antananarivo', region: 'Analamanga' },
  { name: 'Toamasina', region: 'Atsinanana' },
  { name: 'Antsirabe', region: 'Vakinankaratra' },
  { name: 'Mahajanga', region: 'Boeny' },
  { name: 'Fianarantsoa', region: 'Haute Matsiatra' },
  { name: 'Toliara', region: 'Atsimo-Andrefana' },
  { name: 'Antsiranana', region: 'Diana' },
];

// ─── Component ──────────────────────────────────────────────────────────────

interface CityAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (value: string) => void;
}

/**
 * Autocomplete dropdown for the "Où ?" search field.
 * Shows a "Ma position actuelle" shortcut and a filterable list of
 * popular cities with their region names.
 *
 * Keyboard-accessible: arrow keys navigate, Enter selects, Escape closes.
 */
export default function CityAutocomplete({
  value,
  onChange,
  onSelect,
}: CityAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalizedQuery = value.toLowerCase().trim();

  const filteredCities = normalizedQuery
    ? CITIES.filter(
        (c) =>
          c.name.toLowerCase().includes(normalizedQuery) ||
          c.region.toLowerCase().includes(normalizedQuery),
      )
    : CITIES;

  // Index 0 = "Ma position actuelle", rest = cities
  const totalItems = 1 + filteredCities.length;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setActiveIndex(-1);
  }, [normalizedQuery]);

  const selectCity = useCallback(
    (cityName: string) => {
      onChange(cityName);
      setIsOpen(false);
      onSelect?.(cityName);
      inputRef.current?.blur();
    },
    [onChange, onSelect],
  );

  /**
   * Uses the browser Geolocation API to get the user's coordinates,
   * then picks the nearest city from our static list.
   * Falls back to Antananarivo if geolocation is denied or unavailable.
   */
  function handleUseCurrentPosition() {
    if (!navigator.geolocation) {
      selectCity('Antananarivo');
      return;
    }

    // City coordinates for basic nearest-match (rough centroids)
    const coords: Record<string, [number, number]> = {
      Antananarivo: [-18.91, 47.52],
      Toamasina: [-18.15, 49.40],
      Antsirabe: [-19.87, 47.03],
      Mahajanga: [-15.72, 46.32],
      Fianarantsoa: [-21.44, 47.09],
      Toliara: [-23.35, 43.68],
      Antsiranana: [-12.28, 49.29],
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        let closest = 'Antananarivo';
        let minDist = Infinity;
        for (const [city, [lat, lon]] of Object.entries(coords)) {
          const dist = Math.hypot(lat - latitude, lon - longitude);
          if (dist < minDist) {
            minDist = dist;
            closest = city;
          }
        }
        selectCity(closest);
      },
      () => {
        // Geolocation denied or errored — fall back silently
        selectCity('Antananarivo');
      },
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) {
      if (e.key === 'ArrowDown') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex === 0) {
          handleUseCurrentPosition();
        } else if (activeIndex > 0 && activeIndex <= filteredCities.length) {
          selectCity(filteredCities[activeIndex - 1].name);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  }

  const showDropdown = isOpen;

  return (
    <div ref={containerRef} className="relative flex-1 w-full z-50">
      {/* Input row */}
      <div className="flex items-center px-6 gap-3 border-r-0 md:border-r border-outline-variant/30">
        <span className="material-symbols-outlined text-primary">location_on</span>
        <div className="flex flex-col items-start w-full">
          <label htmlFor="hero-city" className="text-[10px] uppercase font-bold text-outline">
            Où ?
          </label>
          <input
            ref={inputRef}
            id="hero-city"
            type="text"
            role="combobox"
            aria-expanded={showDropdown}
            aria-haspopup="listbox"
            aria-controls="city-listbox"
            aria-activedescendant={activeIndex >= 0 ? `city-option-${activeIndex}` : undefined}
            autoComplete="off"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Ville ou région..."
            className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-on-surface font-semibold p-0 placeholder:text-outline-variant text-sm"
          />
        </div>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          id="city-listbox"
          role="listbox"
          className="absolute left-0 right-0 top-full mt-2 bg-surface-container-lowest rounded-xl shadow-[0_4px_40px_rgba(25,28,32,0.10)] overflow-hidden border border-outline-variant/10 z-50 max-h-[400px] overflow-y-auto"
        >
          <div className="p-2 space-y-1">
            {/* "Ma position actuelle" button */}
            <button
              id="city-option-0"
              role="option"
              aria-selected={activeIndex === 0}
              onMouseDown={(e) => {
                e.preventDefault();
                handleUseCurrentPosition();
              }}
              onMouseEnter={() => setActiveIndex(0)}
              className={`w-full flex items-center gap-3 px-3 py-4 rounded-lg transition-colors text-primary font-semibold text-sm ${
                activeIndex === 0 ? 'bg-primary/5' : 'hover:bg-primary/5'
              }`}
            >
              <span className="material-symbols-outlined">near_me</span>
              Ma position actuelle
            </button>

            {/* Region heading */}
            {filteredCities.length > 0 && (
              <>
                <div className="px-3 py-2 mt-2">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em] font-label">
                    Régions Populaires
                  </span>
                </div>
                {filteredCities.map((city, i) => {
                  const itemIndex = i + 1;
                  return (
                    <button
                      key={city.name}
                      id={`city-option-${itemIndex}`}
                      role="option"
                      aria-selected={activeIndex === itemIndex}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectCity(city.name);
                      }}
                      onMouseEnter={() => setActiveIndex(itemIndex)}
                      className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-colors ${
                        activeIndex === itemIndex
                          ? 'bg-secondary-container/30'
                          : 'hover:bg-secondary-container/30'
                      }`}
                    >
                      <span className="text-sm font-body text-on-surface">{city.name}</span>
                      <span className="text-xs text-on-surface-variant">{city.region}</span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
