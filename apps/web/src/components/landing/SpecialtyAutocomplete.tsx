import { useState, useRef, useEffect, useCallback } from 'react';

// ─── Static data ────────────────────────────────────────────────────────────
// These will be replaced by API calls once the doctors module is live.
// For now they let the autocomplete feel real during frontend development.

interface Specialty {
  label: string;
  description: string;
  icon: string;
  slug: string;
}

interface Doctor {
  name: string;
  specialty: string;
  avatarUrl?: string;
}

const SPECIALTIES: Specialty[] = [
  { label: 'Généraliste', description: 'Médecine générale', icon: 'stethoscope', slug: 'generaliste' },
  { label: 'Cardiologue', description: 'Maladies du cœur', icon: 'cardiology', slug: 'cardiologue' },
  { label: 'Pédiatre', description: 'Santé des enfants', icon: 'child_care', slug: 'pediatre' },
  { label: 'Gynécologue', description: 'Santé de la femme', icon: 'female', slug: 'gynecologue' },
  { label: 'Dentiste', description: 'Soins dentaires', icon: 'dentistry', slug: 'dentiste' },
  { label: 'Dermatologue', description: 'Maladies de la peau', icon: 'dermatology', slug: 'dermatologue' },
  { label: 'Ophtalmologue', description: 'Santé des yeux', icon: 'visibility', slug: 'ophtalmologue' },
  { label: 'ORL', description: 'Oreilles, nez, gorge', icon: 'hearing', slug: 'orl' },
];

const MOCK_DOCTORS: Doctor[] = [
  { name: 'Dr. Rakotomalala', specialty: 'CARDIOLOGUE' },
  { name: 'Dr. Rasoamanana', specialty: 'PÉDIATRE' },
  { name: 'Dr. Andrianarisoa', specialty: 'GÉNÉRALISTE' },
  { name: 'Dr. Razafindrakoto', specialty: 'DENTISTE' },
  { name: 'Dr. Randrianasolo', specialty: 'GYNÉCOLOGUE' },
];

// ─── Component ──────────────────────────────────────────────────────────────

interface SpecialtyAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  /** Called when the user picks a suggestion so the parent can navigate */
  onSelect?: (value: string) => void;
}

/**
 * Autocomplete dropdown for the "Quoi ?" search field.
 * Filters specialties and doctors by fuzzy-matching on the input text.
 * Renders a floating dropdown below the input with two sections:
 * "Spécialités Suggérées" and "Médecins Suggérés".
 *
 * Keyboard-accessible: arrow keys navigate, Enter selects, Escape closes.
 */
export default function SpecialtyAutocomplete({
  value,
  onChange,
  onSelect,
}: SpecialtyAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalizedQuery = value.toLowerCase().trim();

  // Filter specialties and doctors based on the current input
  const filteredSpecialties = normalizedQuery
    ? SPECIALTIES.filter(
        (s) =>
          s.label.toLowerCase().includes(normalizedQuery) ||
          s.description.toLowerCase().includes(normalizedQuery) ||
          s.slug.includes(normalizedQuery),
      )
    : SPECIALTIES.slice(0, 4);

  const filteredDoctors = normalizedQuery
    ? MOCK_DOCTORS.filter(
        (d) =>
          d.name.toLowerCase().includes(normalizedQuery) ||
          d.specialty.toLowerCase().includes(normalizedQuery),
      )
    : MOCK_DOCTORS.slice(0, 2);

  // Flat list of all selectable items for keyboard navigation
  const allItems = [
    ...filteredSpecialties.map((s) => ({ type: 'specialty' as const, label: s.label })),
    ...filteredDoctors.map((d) => ({ type: 'doctor' as const, label: d.name })),
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(-1);
  }, [normalizedQuery]);

  const selectItem = useCallback(
    (label: string) => {
      onChange(label);
      setIsOpen(false);
      onSelect?.(label);
      inputRef.current?.blur();
    },
    [onChange, onSelect],
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) {
      // Open dropdown on arrow down even if closed
      if (e.key === 'ArrowDown') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => (prev < allItems.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : allItems.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < allItems.length) {
          selectItem(allItems[activeIndex].label);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  }

  const showDropdown = isOpen && (filteredSpecialties.length > 0 || filteredDoctors.length > 0);

  return (
    <div ref={containerRef} className="relative flex-1 w-full z-50">
      {/* Input row — keeps the same layout as the original HeroSearch field */}
      <div className="flex items-center px-6 gap-3 border-r-0 md:border-r border-outline-variant/30">
        <span className="material-symbols-outlined text-primary">search</span>
        <div className="flex flex-col items-start w-full">
          <label htmlFor="hero-query" className="text-[10px] uppercase font-bold text-outline">
            Quoi ?
          </label>
          <input
            ref={inputRef}
            id="hero-query"
            type="text"
            role="combobox"
            aria-expanded={showDropdown}
            aria-haspopup="listbox"
            aria-controls="specialty-listbox"
            aria-activedescendant={activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
            autoComplete="off"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Nom, spécialité..."
            className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-on-surface font-semibold p-0 placeholder:text-outline-variant text-sm"
          />
        </div>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          id="specialty-listbox"
          role="listbox"
          className="absolute left-0 right-0 top-full mt-2 bg-surface-container-lowest rounded-xl shadow-[0_4px_40px_rgba(25,28,32,0.10)] overflow-hidden border border-outline-variant/10 z-50 max-h-[400px] overflow-y-auto"
        >
          {/* Specialties section */}
          {filteredSpecialties.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-2">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em] font-label">
                  Spécialités Suggérées
                </span>
              </div>
              {filteredSpecialties.map((specialty, i) => {
                const itemIndex = i;
                return (
                  <button
                    key={specialty.slug}
                    id={`suggestion-${itemIndex}`}
                    role="option"
                    aria-selected={activeIndex === itemIndex}
                    onMouseDown={(e) => {
                      // Prevent input blur before selection fires
                      e.preventDefault();
                      selectItem(specialty.label);
                    }}
                    onMouseEnter={() => setActiveIndex(itemIndex)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                      activeIndex === itemIndex
                        ? 'bg-secondary-container/30'
                        : 'hover:bg-secondary-container/30'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary-container/10 flex items-center justify-center text-primary shrink-0">
                      <span className="material-symbols-outlined">{specialty.icon}</span>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold font-body text-on-surface">
                        {specialty.label}
                      </p>
                      <p className="text-xs text-on-surface-variant">{specialty.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Doctors section */}
          {filteredDoctors.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-2">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em] font-label">
                  Médecins Suggérés
                </span>
              </div>
              {filteredDoctors.map((doctor, i) => {
                const itemIndex = filteredSpecialties.length + i;
                return (
                  <button
                    key={doctor.name}
                    id={`suggestion-${itemIndex}`}
                    role="option"
                    aria-selected={activeIndex === itemIndex}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectItem(doctor.name);
                    }}
                    onMouseEnter={() => setActiveIndex(itemIndex)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                      activeIndex === itemIndex
                        ? 'bg-secondary-container/30'
                        : 'hover:bg-secondary-container/30'
                    }`}
                  >
                    {/* Avatar — uses a placeholder icon until real images are available */}
                    <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant shrink-0 overflow-hidden">
                      {doctor.avatarUrl ? (
                        <img
                          src={doctor.avatarUrl}
                          alt={doctor.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="material-symbols-outlined text-xl">person</span>
                      )}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold font-body text-on-surface">
                        {doctor.name}
                      </p>
                      <p className="text-xs text-primary font-bold">{doctor.specialty}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
