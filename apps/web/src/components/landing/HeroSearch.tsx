import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SpecialtyAutocomplete from './SpecialtyAutocomplete';

const CITIES = [
  'Antananarivo',
  'Toamasina',
  'Antsirabe',
  'Mahajanga',
  'Fianarantsoa',
  'Toliara',
  'Antsiranana',
] as const;

const WHEN_OPTIONS = [
  "Aujourd'hui",
  'Demain',
  'Cette semaine',
  'Choisir une date',
] as const;

/**
 * Full-width hero with gradient background and a combined search bar.
 * The search bar has three fields: specialty/name, city, and date filter.
 * On submit it navigates to /search with query params so the SearchPage
 * can pick them up.
 *
 * Pre-fills inputs from URL params so the user sees their current search
 * reflected in the hero bar when navigating back or refining a search.
 */
export default function HeroSearch() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Pre-fill from URL so the hero reflects the active search
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [city, setCity] = useState(searchParams.get('city') ?? CITIES[0]);
  const [when, setWhen] = useState<string>(searchParams.get('when') ?? WHEN_OPTIONS[0]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (city) params.set('city', city);
    if (when) params.set('when', when);
    navigate(`/search?${params.toString()}`);
  }

  return (
    <header className="relative pt-20 overflow-x-clip">
      <div className="hero-gradient min-h-[600px] flex flex-col items-center justify-center px-6 text-center text-on-primary">
        {/* Background image overlay for depth */}
        <div className="absolute inset-0 z-0 opacity-10 bg-[url('/hero-bg.webp')] bg-cover bg-center" />

        <div className="relative z-10 max-w-6xl mx-auto w-full space-y-10">
          {/* Headline */}
          <div className="space-y-4">
            <h1 className="font-headline text-5xl md:text-7xl font-extrabold tracking-tight">
              Votre santé, <span className="text-on-primary-container">simplifiée</span>
            </h1>
            <p className="text-lg md:text-xl font-medium text-blue-100 max-w-2xl mx-auto opacity-80">
              Prenez rendez-vous avec les meilleurs praticiens de Madagascar en
              quelques secondes.
            </p>
          </div>

          {/* Search bar — pill-shaped, three sections + CTA */}
          <form
            onSubmit={handleSearch}
            className="w-full bg-surface-container-lowest rounded-full p-2 shadow-2xl flex flex-col md:flex-row items-center gap-1"
          >
            {/* Quoi ? — autocomplete with specialty + doctor suggestions */}
            <SpecialtyAutocomplete
              value={query}
              onChange={setQuery}
              onSelect={(selected) => {
                setQuery(selected);
              }}
            />

            {/* Où ? */}
            <div className="flex-1 w-full flex items-center px-6 gap-3 border-r-0 md:border-r border-outline-variant/30">
              <span className="material-symbols-outlined text-primary">location_on</span>
              <div className="flex flex-col items-start w-full">
                <label htmlFor="hero-city" className="text-[10px] uppercase font-bold text-outline">
                  Où ?
                </label>
                <select
                  id="hero-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-transparent border-none focus:ring-0 text-on-surface font-semibold p-0 appearance-none cursor-pointer text-sm"
                >
                  {CITIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quand ? */}
            <div className="flex-1 w-full flex items-center px-6 gap-3">
              <span className="material-symbols-outlined text-primary">calendar_today</span>
              <div className="flex flex-col items-start w-full">
                <label htmlFor="hero-when" className="text-[10px] uppercase font-bold text-outline">
                  Quand ?
                </label>
                <select
                  id="hero-when"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  className="w-full bg-transparent border-none focus:ring-0 text-on-surface font-semibold p-0 appearance-none cursor-pointer text-sm"
                >
                  {WHEN_OPTIONS.map((w) => (
                    <option key={w}>{w}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full md:w-auto px-10 py-4 bg-primary text-on-primary font-bold rounded-full hover:brightness-110 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              Rechercher
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
